/**
 * Client-side PKA file encryption implementing the pka2xml format.
 *
 * Encrypts cleaned XML bytes into a PKA/PKT binary using the same
 * Twofish-EAX algorithm as the original pka2xml backend, so that
 * re-encrypted files are always produced locally without any watermark
 * or trace injection.
 *
 * Algorithm (mirrors include/pka2xml.hpp — encrypt_pka / encrypt<Twofish>):
 *   Stage 1 — Qt-style zlib compress: 4-byte big-endian uncompressed size
 *             followed by the zlib-deflated payload.
 *   Stage 2 — Byte-wise XOR obfuscation: data[i] ^= (length - i) & 0xFF
 *   Stage 3 — Twofish-EAX authenticated encryption
 *             (key = 0x89 × 16,  nonce = 0x10 × 16)
 *   Stage 4 — Reverse-order XOR obfuscation:
 *             out[len-1-i] = enc[i] ^ ((len - i*len) | 0) & 0xFF
 *
 * The key and nonce are the public constants defined in include/pka2xml.hpp.
 */

import { deflate } from 'pako'
import { makeSession, encrypt as tfBlockEncrypt } from 'twofish-ts'
import type { Session } from 'twofish-ts'

// Public constants from include/pka2xml.hpp (encrypt_pka)
const PKA_KEY = new Uint8Array(16).fill(0x89)   // 137 × 16
const PKA_NONCE = new Uint8Array(16).fill(0x10)  // 16 × 16

// ---------------------------------------------------------------------------
// CMAC subkey generation (OMAC1/CMAC, 128-bit block, R_128 = 0x87)
// ---------------------------------------------------------------------------

function leftShift128(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(16)
  for (let i = 0; i < 15; i++) out[i] = ((b[i] << 1) | (b[i + 1] >>> 7)) & 0xFF
  out[15] = (b[15] << 1) & 0xFF
  return out
}

function generateCmacSubkeys(session: Session): [Uint8Array, Uint8Array] {
  const L = new Uint8Array(16)
  tfBlockEncrypt(new Uint8Array(16), 0, L, 0, session) // L = E_K(0^128)

  const K1 = leftShift128(L)
  if (L[0] & 0x80) K1[15] ^= 0x87

  const K2 = leftShift128(K1)
  if (K1[0] & 0x80) K2[15] ^= 0x87

  return [K1, K2]
}

// ---------------------------------------------------------------------------
// CMAC (OMAC1) — processes message in CBC-MAC fashion with subkey finalisation
// ---------------------------------------------------------------------------

function cmac(
  message: Uint8Array,
  session: Session,
  K1: Uint8Array,
  K2: Uint8Array,
): Uint8Array {
  const T = new Uint8Array(16)
  const n = message.length === 0 ? 1 : Math.ceil(message.length / 16)

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1
    const start = i * 16
    const end = Math.min(start + 16, message.length)
    const blockLen = end - start

    const block = new Uint8Array(16)
    if (blockLen > 0) block.set(message.subarray(start, end))

    if (isLast) {
      if (blockLen < 16) {
        // Incomplete (or empty) last block: pad with 1-bit then zeros, XOR K2
        block[blockLen] = 0x80
        for (let j = 0; j < 16; j++) block[j] ^= K2[j]
      } else {
        // Complete last block: XOR K1
        for (let j = 0; j < 16; j++) block[j] ^= K1[j]
      }
    }

    for (let j = 0; j < 16; j++) T[j] ^= block[j]
    tfBlockEncrypt(T, 0, T, 0, session) // T = E_K(T)
  }

  return T
}

// ---------------------------------------------------------------------------
// OMAC^t — EAX tweak: prepend 128-bit big-endian encoding of t, then CMAC
// ---------------------------------------------------------------------------

function omacT(
  t: number,
  message: Uint8Array,
  session: Session,
  K1: Uint8Array,
  K2: Uint8Array,
): Uint8Array {
  const tweak = new Uint8Array(16) // 15 zero bytes + t (big-endian)
  tweak[15] = t
  const full = new Uint8Array(16 + message.length)
  full.set(tweak)
  full.set(message, 16)
  return cmac(full, session, K1, K2)
}

// ---------------------------------------------------------------------------
// CTR mode (big-endian counter, Twofish ECB as the block cipher)
// ---------------------------------------------------------------------------

function ctrEncrypt(
  plaintext: Uint8Array,
  counterInit: Uint8Array,
  session: Session,
): Uint8Array {
  const ciphertext = new Uint8Array(plaintext.length)
  const counter = new Uint8Array(counterInit)
  const keystream = new Uint8Array(16)

  for (let i = 0; i < plaintext.length; i += 16) {
    tfBlockEncrypt(counter, 0, keystream, 0, session)
    const len = Math.min(16, plaintext.length - i)
    for (let j = 0; j < len; j++) ciphertext[i + j] = plaintext[i + j] ^ keystream[j]
    // Increment counter as a 128-bit big-endian integer (last byte = LSB)
    for (let j = 15; j >= 0; j--) if (++counter[j] !== 0) break
  }

  return ciphertext
}

// ---------------------------------------------------------------------------
// EAX authenticated encryption (standard mode, no associated data)
// Output: ciphertext || 16-byte tag
// ---------------------------------------------------------------------------

function eaxEncrypt(
  plaintext: Uint8Array,
  nonce: Uint8Array,
  session: Session,
): Uint8Array {
  const [K1, K2] = generateCmacSubkeys(session)
  const N = omacT(0, nonce, session, K1, K2)              // N' = OMAC^0(nonce)
  const H = omacT(1, new Uint8Array(0), session, K1, K2)  // H' = OMAC^1(no header)
  const C = ctrEncrypt(plaintext, N, session)              // C  = CTR_K(N', M)
  const CP = omacT(2, C, session, K1, K2)                 // C' = OMAC^2(C)

  const tag = new Uint8Array(16)
  for (let i = 0; i < 16; i++) tag[i] = N[i] ^ H[i] ^ CP[i] // T = N' XOR H' XOR C'

  const result = new Uint8Array(C.length + 16)
  result.set(C)
  result.set(tag, C.length)
  return result
}

// ---------------------------------------------------------------------------
// Qt-style zlib compress (pka2xml.hpp — compress())
// Format: [4-byte BE uncompressed size][zlib-deflated payload]
// ---------------------------------------------------------------------------

function qtCompress(data: Uint8Array): Uint8Array {
  const compressed = deflate(data) // produces standard zlib format
  const result = new Uint8Array(4 + compressed.length)
  const len = data.length
  result[0] = (len >>> 24) & 0xFF
  result[1] = (len >>> 16) & 0xFF
  result[2] = (len >>> 8) & 0xFF
  result[3] = len & 0xFF
  result.set(compressed, 4)
  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt XML bytes into a PKA/PKT binary file using the pka2xml algorithm.
 *
 * This is a clean, local implementation: it never injects any watermark or
 * trace, so the result is always suitable for use with Packet Tracer without
 * running through the remote Lambda backend.
 *
 * @param xmlBytes  UTF-8 encoded XML content (watermark already stripped)
 * @returns Raw binary content of the resulting PKA/PKT file
 */
export function encryptPka(xmlBytes: Uint8Array): Uint8Array {
  const session = makeSession(PKA_KEY)

  // Stage 1: Qt-style zlib compress
  const stage1 = qtCompress(xmlBytes)

  // Stage 2: Byte-wise XOR — data[i] ^= (length - i) & 0xFF
  const stage2 = new Uint8Array(stage1)
  const len2 = stage2.length
  for (let i = 0; i < len2; i++) stage2[i] ^= (len2 - i) & 0xFF

  // Stage 3: Twofish-EAX authenticated encryption
  const encrypted = eaxEncrypt(stage2, PKA_NONCE, session)

  // Stage 4: Reverse-order XOR — out[len-1-i] = enc[i] ^ ((len - i*len) | 0) & 0xFF
  const len4 = encrypted.length
  const output = new Uint8Array(len4)
  for (let i = 0; i < len4; i++) {
    output[len4 - 1 - i] = (encrypted[i] ^ ((len4 - Math.imul(i, len4)) | 0)) & 0xFF
  }

  return output
}
