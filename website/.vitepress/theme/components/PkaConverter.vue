<template>
  <div class="pka-converter">
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
        <strong>Click to select</strong> or drag &amp; drop a file here<br />
        <span style="font-size:0.85em;color:var(--vp-c-text-2)">Supported: .pka, .pkt (decrypt/retrofit) &nbsp;|&nbsp; .xml (encrypt)</span>
      </p>
      <p v-else>
        <strong>{{ selectedFile.name }}</strong>
        <span style="font-size:0.85em;color:var(--vp-c-text-2)"> ({{ formatSize(selectedFile.size) }})</span>
      </p>
      <input
        ref="fileInput"
        type="file"
        accept=".pka,.pkt,.xml"
        style="display:none"
        @change="onFileChange"
      />
    </div>

    <!-- Action buttons -->
    <div class="actions">
      <button
        class="btn btn-primary"
        :disabled="!canDecrypt || loading"
        @click="doAction('decode')"
      >
        🔓 Decrypt (.pka → .xml)
      </button>
      <button
        class="btn btn-primary"
        :disabled="!canEncrypt || loading"
        @click="doAction('encode')"
      >
        🔒 Encrypt (.xml → .pka)
      </button>
      <button
        class="btn btn-secondary"
        :disabled="!canDecrypt || loading"
        @click="doAction('retrofit')"
      >
        🔧 Retrofit (make readable by any PT version)
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

    <!-- Status -->
    <div v-if="loading" class="status-box status-loading">
      <div class="spinner"></div>
      <span>
        {{ uploadStatus || `Processing ${selectedFile?.name}… this may take a few seconds.` }}
      </span>
    </div>

    <div v-if="loading" class="upload-progress">
      <div class="upload-progress__track">
        <div class="upload-progress__fill" :style="{ width: `${uploadProgress}%` }"></div>
      </div>
      <span class="upload-progress__text">{{ uploadProgress }}%</span>
    </div>

    <div v-if="errorMsg" class="status-box status-error">
      ⚠️ {{ errorMsg }}
    </div>

    <div v-if="successMsg" class="status-box status-success">
      ✅ {{ successMsg }}
    </div>

    <!-- XML Preview (shown after decrypting a pka) -->
    <div v-if="xmlPreview" class="xml-preview">
      <div class="xml-preview-header">
        <span>XML Preview</span>
        <button class="btn btn-secondary" style="padding:4px 12px;font-size:0.8rem" @click="copyXml">
          {{ copied ? '✓ Copied' : 'Copy' }}
        </button>
      </div>
      <pre><code>{{ xmlPreview }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { inflate, deflate } from 'pako'
import { removeTraces, verifyNoWatermark } from './watermarkUtils'
import { postJsonWithUploadProgress } from './uploadWithProgress'

const DEFAULT_API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'
const API_URL = ((import.meta.env.VITE_PKA2XML_API_URL as string | undefined) ?? '').trim() || DEFAULT_API_URL
const MAX_PREVIEW_LENGTH = 4000
const BLOB_URL_REVOKE_DELAY_MS = 10_000

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const xmlPreview = ref('')
const isDragging = ref(false)
const copied = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')

const canDecrypt = computed(() =>
  !!selectedFile.value &&
  (selectedFile.value.name.endsWith('.pka') || selectedFile.value.name.endsWith('.pkt'))
)
const canEncrypt = computed(() =>
  !!selectedFile.value && selectedFile.value.name.endsWith('.xml')
)

function triggerFileInput() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) {
    setFile(input.files[0])
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) setFile(file)
}

function setFile(file: File) {
  selectedFile.value = file
  errorMsg.value = ''
  successMsg.value = ''
  xmlPreview.value = ''
}

function reset() {
  selectedFile.value = null
  errorMsg.value = ''
  successMsg.value = ''
  xmlPreview.value = ''
  uploadProgress.value = 0
  uploadStatus.value = ''
  if (fileInput.value) fileInput.value.value = ''
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Convert File to data URL (base64) */
function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
  })
}

/** Convert base64 string to Blob */
async function b64toBlob(base64: string, type = 'application/octet-stream'): Promise<Blob> {
  const res = await fetch(`data:${type};base64,${base64}`)
  return res.blob()
}

async function doAction(action: 'decode' | 'encode' | 'retrofit') {
  if (!selectedFile.value) return

  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  xmlPreview.value = ''
  uploadProgress.value = 0
  uploadStatus.value = 'Preparing file for upload…'

  try {
    const file = selectedFile.value
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

    if (action === 'decode') {
      const b64 = await toBase64(file)
      const resultB64 = await uploadAction({ file: b64, action: 'decode' })
      const blob = await b64toBlob(resultB64)
      const arrayBuffer = await blob.arrayBuffer()

      // Decompress the result with pako (server returns zlib-compressed XML)
      const data = inflate(new Uint8Array(arrayBuffer))
      const rawXml = new TextDecoder('utf-8').decode(data)

      // Strip any pka2xml watermark / traces from the decrypted XML
      const { xml: xmlStr, found: tracesFound } = removeTraces(rawXml)

      // Show preview (first MAX_PREVIEW_LENGTH chars)
      xmlPreview.value = xmlStr.length > MAX_PREVIEW_LENGTH ? xmlStr.slice(0, MAX_PREVIEW_LENGTH) + '\n… (truncated)' : xmlStr

      // Trigger download
      triggerDownload(
        new Blob([xmlStr], { type: 'application/xml' }),
        file.name.replace(/\.(pka|pkt)$/i, '.xml')
      )
      const outXmlName = file.name.replace(/\.(pka|pkt)$/i, '.xml')
      successMsg.value = tracesFound
        ? `Decrypted successfully! pka2xml watermark was removed. "${outXmlName}" has been downloaded.`
        : `Decrypted successfully! Your file "${outXmlName}" has been downloaded.`
    } else if (action === 'retrofit') {
      const b64 = await toBase64(file)
      const resultB64 = await uploadAction({ file: b64, action: 'retrofit' })
      const resultBlob = await b64toBlob(resultB64)

      triggerDownload(resultBlob, file.name)
      successMsg.value = `Retrofit complete! "${file.name}" has been downloaded and can now be opened by any Packet Tracer version.`
    } else if (action === 'encode') {
      const rawXmlStr = await file.text()

      // Strip any pka2xml watermark / traces before re-encrypting
      const { xml: xmlStr } = removeTraces(rawXmlStr)

      // Compress the XML before sending (server expects compressed data)
      const encodedXml = new TextEncoder().encode(xmlStr)
      const compressed = deflate(encodedXml)
      const compressedBlob = new Blob([compressed], { type: 'application/octet-stream' })

      const b64 = await toBase64(compressedBlob)
      const resultB64 = await uploadAction({ file: b64, action: 'encode', length: encodedXml.length })

      // Verify the backend did not re-inject traces during encode
      await verifyNoWatermark(API_URL, resultB64)

      const resultBlob = await b64toBlob(resultB64)
      triggerDownload(resultBlob, file.name.replace(/\.xml$/i, '.pka'))
      successMsg.value = `Encrypted successfully! "${file.name.replace(/\.xml$/i, '.pka')}" has been downloaded.`
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Operation failed: ${msg}. Make sure the file is a valid Packet Tracer file and try again.`
  } finally {
    loading.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), BLOB_URL_REVOKE_DELAY_MS)
}

async function copyXml() {
  if (!xmlPreview.value) return
  // Prefer Clipboard API when available
   if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
     try {
       await navigator.clipboard.writeText(xmlPreview.value)
       copied.value = true
       setTimeout(() => { copied.value = false }, 2000)
       return
     } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : String(err)
       errorMsg.value = `Failed to copy XML to clipboard: ${msg}`
     }
   } else {
     errorMsg.value = 'Clipboard copying is not supported in this browser. You can still copy the XML manually.'
   }
   // Fallback: create a temporary textarea so the user can manually copy
   const textarea = document.createElement('textarea')
   textarea.value = xmlPreview.value
   textarea.setAttribute('readonly', '')
   textarea.style.position = 'fixed'
   textarea.style.top = '-9999px'
   document.body.appendChild(textarea)
   textarea.select()
   try {
     document.execCommand('copy')
     copied.value = true
     setTimeout(() => { copied.value = false }, 2000)
   } catch {
     // Ignore execCommand errors; user can still manually copy from the selected textarea
   } finally {
     document.body.removeChild(textarea)
   }
}
</script>

<style scoped>
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
</style>
