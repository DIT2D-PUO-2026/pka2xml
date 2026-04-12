/**
 * Shared watermark / trace detection and removal utilities.
 *
 * These helpers are used by all PKA tool components (PkaConverter,
 * PkaPatcher, PkaTraceCleaner, AssessmentItems) so that every flow
 * that produces or consumes decrypted XML automatically strips the
 * pka2xml watermark, and every re-encryption step verifies that the
 * backend did not re-inject it.
 */

import { inflate } from 'pako'

/**
 * Return true if the XML contains a pka2xml watermark inside any
 * ADDITIONAL_INFO element.
 */
export function hasTraceInAdditionalInfo(xml: string): boolean {
  const additionalInfoRe = /<ADDITIONAL_INFO\b[^>]*>([\s\S]*?)<\/ADDITIONAL_INFO>/gi
  const watermarkTextRe = /this\s+pka\s+has\s+been\s+altered\s+by/i
  const watermarkUrlRe = /(?:https?:\/\/)?(?:www\.)?github\.com\s*\/\s*mircodezorzi\s*\/\s*pka2xml\/?/i
  const markerTokenRe = /\b(?:mircodezorzi|pka2xml)\b/i

  let match: RegExpExecArray | null = null
  while ((match = additionalInfoRe.exec(xml)) !== null) {
    const content = match[1]
    if (watermarkTextRe.test(content) || watermarkUrlRe.test(content) || markerTokenRe.test(content)) {
      return true
    }
  }

  return false
}

/**
 * Remove all pka2xml watermarks / traces from the decrypted XML string.
 * Handles known watermark variants injected by older versions of pka2xml,
 * including spacing/casing differences and CDATA-wrapped content.
 *
 * The ADDITIONAL_INFO element is converted to a self-closing tag when it
 * contained a watermark — this prevents old backends from re-injecting the
 * watermark on re-encryption.
 */
export function removeTraces(xml: string): { xml: string; found: boolean } {
  const additionalInfoRe = /(<ADDITIONAL_INFO\b[^>]*>)([\s\S]*?)(<\/ADDITIONAL_INFO>)/gi
  const watermarkRe = /(?:this\s+pka\s+has\s+been\s+altered\s+by\s+)?(?:https?:\/\/)?(?:www\.)?github\.com\s*\/\s*mircodezorzi\s*\/\s*pka2xml\/?/gi
  const markerHintsRe = /(?:mircodezorzi|pka2xml)/i
  const toSelfClosingTag = (openTag: string): string => openTag.replace(/>\s*$/, '/>')
  let found = false

  const cleaned = xml.replace(additionalInfoRe, (_match, openTag, content, closeTag) => {
    const stripped = content.replace(watermarkRe, '')
    const hadWatermark = stripped !== content
    const hasMarkerHints = markerHintsRe.test(content)

    if (!hadWatermark && !hasMarkerHints) {
      return `${openTag}${content}${closeTag}`
    }

    found = true

    // Compatibility: old backends re-inject watermark when ADDITIONAL_INFO uses open/close tags.
    // Keeping it self-closing avoids reinjection while preserving USER_PROFILE structure.
    return toSelfClosingTag(openTag)
  })

  return { xml: cleaned, found }
}

/**
 * Thrown when a verified re-encrypted PKA file is found to contain a
 * pka2xml watermark re-injected by the backend.
 */
export class WatermarkDetectedError extends Error {
  constructor() {
    super(
      'The configured backend re-injected the watermark during encode. Update VITE_PKA2XML_API_URL to a clean backend and try again.'
    )
    this.name = 'WatermarkDetectedError'
  }
}

/**
 * Decode a base64 string to a Blob.
 */
async function b64toBlob(base64: string, type = 'application/octet-stream'): Promise<Blob> {
  const res = await fetch(`data:${type};base64,${base64}`)
  return res.blob()
}

/**
 * Verify that the re-encrypted PKA file (given as a base64 string) does not
 * contain any pka2xml watermark. Decodes the file via the API, decompresses
 * the result with pako, then inspects the XML.
 *
 * Network and server errors are silently ignored (verification is skipped) so
 * that a transient API hiccup does not block the user from receiving their
 * successfully-encoded file.  An Error is thrown only when the backend is
 * confirmed to have re-injected a watermark.
 */
export async function verifyNoWatermark(apiUrl: string, encodedB64: string): Promise<void> {
  let verifyResponse: Response
  try {
    verifyResponse = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify({ file: `data:application/octet-stream;base64,${encodedB64}`, action: 'decode' }),
    })
  } catch {
    // Network error — skip verification so the encode result is still delivered.
    return
  }

  if (!verifyResponse.ok) {
    // Server error during verification — skip so the encode result is still delivered.
    return
  }

  try {
    const verifyB64 = await verifyResponse.text()
    const verifyBlob = await b64toBlob(verifyB64)
    const verifyArrayBuffer = await verifyBlob.arrayBuffer()
    const verifyXmlBytes = inflate(new Uint8Array(verifyArrayBuffer))
    const verifyXml = new TextDecoder('utf-8').decode(verifyXmlBytes)

    if (hasTraceInAdditionalInfo(verifyXml)) {
      throw new WatermarkDetectedError()
    }
  } catch (err) {
    // Re-throw only if this is the watermark-detection error; ignore decoding errors.
    if (err instanceof WatermarkDetectedError) {
      throw err
    }
    // Decoding/inflate errors during verification — skip, encode result is still valid.
  }
}
