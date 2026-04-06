<template>
  <div class="pka-trace-cleaner">

    <!-- Upload zone -->
    <div
      class="upload-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <div class="upload-icon">📂</div>
      <p v-if="!selectedFile">
        <strong>Click to select</strong> or drag &amp; drop a <code>.pka</code> / <code>.pkt</code> file here
      </p>
      <p v-else>
        <strong>{{ selectedFile.name }}</strong>
        <span style="font-size:0.85em;color:var(--vp-c-text-2)"> ({{ formatSize(selectedFile.size) }})</span>
      </p>
      <input
        ref="fileInput"
        type="file"
        accept=".pka,.pkt"
        style="display:none"
        @change="onFileChange"
      />
    </div>

    <div class="actions" style="margin-top:1rem">
      <button
        class="btn btn-primary"
        :disabled="!selectedFile || loading"
        @click="cleanTraces"
      >
        🧹 Clean Traces &amp; Download
      </button>
      <button
        v-if="selectedFile"
        class="btn btn-secondary"
        :disabled="loading"
        @click="reset"
      >
        ✕ Clear
      </button>
    </div>

    <div v-if="loading" class="status-box status-loading" style="margin-top:1rem">
      <div class="spinner"></div>
      <span>Processing <strong>{{ selectedFile?.name }}</strong>… this may take a few seconds.</span>
    </div>

    <div v-if="errorMsg" class="status-box status-error" style="margin-top:1rem">
      ⚠️ {{ errorMsg }}
    </div>

    <div v-if="successMsg" class="status-box status-success" style="margin-top:1rem">
      ✅ {{ successMsg }}
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { inflate, deflate } from 'pako'

const API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'
const BLOB_URL_REVOKE_DELAY_MS = 10_000

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const isDragging = ref(false)

// ── helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
  })
}

async function b64toBlob(base64: string, type = 'application/octet-stream'): Promise<Blob> {
  const res = await fetch(`data:${type};base64,${base64}`)
  return res.blob()
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), BLOB_URL_REVOKE_DELAY_MS)
}

/**
 * Remove all pka2xml watermarks / traces from the decrypted XML string.
 * Handles known watermark variants injected by older versions of pka2xml,
 * including spacing/casing differences and CDATA-wrapped content.
 */
function removeTraces(xml: string): { xml: string; found: boolean } {
  const additionalInfoRe = /(<ADDITIONAL_INFO\b[^>]*>)([\s\S]*?)(<\/ADDITIONAL_INFO>)/gi
  const watermarkRe = /this\s+pka\s+has\s+been\s+altered\s+by\s+(?:https?:\/\/)?(?:www\.)?github\.com\/mircodezorzi\/pka2xml\/?/gi
  const emptyCdataRe = /<!\[CDATA\[\s*\]\]>/gi
  const danglingBreaksRe = /(?:&#13;|&#10;|<br\s*\/?>)+/gi
  let found = false

  const cleaned = xml.replace(additionalInfoRe, (_match, openTag, content, closeTag) => {
    const stripped = content.replace(watermarkRe, '')
    const normalized = stripped
      .replace(emptyCdataRe, '')
      .replace(danglingBreaksRe, '')

    if (stripped !== content) found = true

    if (normalized.trim() === '') {
      return `${openTag}${closeTag}`
    }

    return `${openTag}${stripped}${closeTag}`
  })

  return { xml: cleaned, found }
}

// ── file input ───────────────────────────────────────────────────────────────

function triggerFileInput() { fileInput.value?.click() }

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) setFile(input.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) setFile(file)
}

function setFile(file: File) {
  if (!/\.(pka|pkt)$/i.test(file.name)) {
    errorMsg.value = `Unsupported file: "${file.name}". Please select a .pka or .pkt file.`
    selectedFile.value = null
    return
  }
  selectedFile.value = file
  errorMsg.value = ''
  successMsg.value = ''
}

function reset() {
  selectedFile.value = null
  errorMsg.value = ''
  successMsg.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// ── main action ───────────────────────────────────────────────────────────────

async function cleanTraces() {
  if (!selectedFile.value) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    // Step 1: decrypt the file
    const b64 = await toBase64(selectedFile.value)

    const decryptResponse = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ file: b64, action: 'decode' }),
    })

    if (!decryptResponse.ok) throw new Error(`Server error: ${decryptResponse.status}`)

    const resultB64 = await decryptResponse.text()
    const blob = await b64toBlob(resultB64)
    const arrayBuffer = await blob.arrayBuffer()

    // Step 2: decompress the result
    const xmlBytes = inflate(new Uint8Array(arrayBuffer))
    const xml = new TextDecoder('utf-8').decode(xmlBytes)

    // Step 3: strip pka2xml traces
    const { xml: cleanedXml, found } = removeTraces(xml)

    if (!found) {
      successMsg.value = 'No pka2xml traces were found in this file — it is already clean.'
      return
    }

    // Step 4: re-compress and re-encrypt
    const encodedXml = new TextEncoder().encode(cleanedXml)
    const compressed = deflate(encodedXml)
    const compressedBlob = new Blob([compressed], { type: 'application/octet-stream' })
    const compressedB64 = await toBase64(compressedBlob)

    const encryptResponse = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ file: compressedB64, action: 'encode', length: encodedXml.length }),
    })

    if (!encryptResponse.ok) throw new Error(`Server error: ${encryptResponse.status}`)

    const cleanedB64 = await encryptResponse.text()
    const cleanedBlob = await b64toBlob(cleanedB64)

    const origExt = selectedFile.value.name.match(/\.(pka|pkt)$/i)?.[1]?.toLowerCase() ?? 'pka'
    const outName = selectedFile.value.name.replace(/\.(pka|pkt)$/i, `.cleaned.${origExt}`)
    triggerDownload(cleanedBlob, outName)

    successMsg.value = `Traces removed! "${outName}" has been downloaded.`
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Failed to clean traces: ${msg}. Make sure the file is a valid Packet Tracer .pka/.pkt file.`
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ── upload zone ── */
.upload-zone {
  border: 2px dashed var(--vp-c-divider);
  border-radius: 10px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}
.upload-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }

/* ── actions ── */
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: var(--vp-c-brand-1); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.btn-secondary { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); border: 1px solid var(--vp-c-divider); }
.btn-secondary:hover:not(:disabled) { background: var(--vp-c-bg-mute); }

/* ── status boxes ── */
.status-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.92rem;
}
.status-loading { background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); }
.status-error   { background: #fff0f0; color: #c00; border: 1px solid #f8c8c8; }
.status-success { background: #f0fff4; color: #1a7a3a; border: 1px solid #b8e8c8; }

.dark .status-error   { background: #3a1010; color: #f88; border-color: #6a2020; }
.dark .status-success { background: #0d2a18; color: #6f6; border-color: #1a5c30; }

/* ── spinner ── */
.spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
