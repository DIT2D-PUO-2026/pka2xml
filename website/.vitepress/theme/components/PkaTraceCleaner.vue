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
      <span>{{ uploadStatus || `Processing ${selectedFile?.name}… this may take a few seconds.` }}</span>
    </div>

    <div v-if="loading" class="upload-progress">
      <div class="upload-progress__track">
        <div class="upload-progress__fill" :style="{ width: `${uploadProgress}%` }"></div>
      </div>
      <span class="upload-progress__text">{{ uploadProgress }}%</span>
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
import { removeTraces, verifyNoWatermark } from './watermarkUtils'
import { postJsonWithUploadProgress } from './uploadWithProgress'

const DEFAULT_API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'
const API_URL = ((import.meta.env.VITE_PKA2XML_API_URL as string | undefined) ?? '').trim() || DEFAULT_API_URL
const BLOB_URL_REVOKE_DELAY_MS = 10_000

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const isDragging = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')

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
  uploadProgress.value = 0
  uploadStatus.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

// ── main action ───────────────────────────────────────────────────────────────

async function cleanTraces() {
  if (!selectedFile.value) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = 'Preparing file for upload…'

  try {
    const uploadAction = async (payload: unknown): Promise<string> => {
      const response = await postJsonWithUploadProgress(API_URL, payload, (state) => {
        uploadProgress.value = state.percent
        if (state.phase === 'uploading') {
          uploadStatus.value = `Uploading file to server… ${state.percent}%`
        } else if (state.phase === 'processing') {
          uploadStatus.value = 'Upload complete. Waiting for server processing…'
        } else {
          uploadStatus.value = 'Upload verified complete. Reading server response…'
        }
      })
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      return response.body
    }

    // Step 1: decrypt the file
    const b64 = await toBase64(selectedFile.value)
    const resultB64 = await uploadAction({ file: b64, action: 'decode' })
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
    const cleanedB64 = await uploadAction({ file: compressedB64, action: 'encode', length: encodedXml.length })

    // Step 5: verify backend did not re-inject traces during encode.
    await verifyNoWatermark(API_URL, cleanedB64)

    const cleanedBlob = await b64toBlob(cleanedB64)

    const origExt = selectedFile.value.name.match(/\.(pka|pkt)$/i)?.[1]?.toLowerCase() ?? 'pka'
    const outName = selectedFile.value.name.replace(/\.(pka|pkt)$/i, `.cleaned.${origExt}`)
    triggerDownload(cleanedBlob, outName)

    successMsg.value = `Traces removed and verified! "${outName}" has been downloaded.`
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Failed to clean traces: ${msg}. Make sure the file is a valid Packet Tracer .pka/.pkt file.`
  } finally {
    loading.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
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

.upload-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.upload-progress__track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}
.upload-progress__fill {
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.2s ease;
}
.upload-progress__text {
  min-width: 3rem;
  text-align: right;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

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
