<template>
  <div class="pka-patcher">

    <!-- Step 1: Upload -->
    <div v-if="step === 'upload'">
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
          @click="decryptFile"
        >
          🔓 Decrypt &amp; Load
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
        <span>{{ uploadStatus || `Decrypting ${selectedFile?.name}… this may take a few seconds.` }}</span>
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
    </div>

    <!-- Step 2: Patch options -->
    <div v-if="step === 'patch'">
      <div class="status-box status-success" style="margin-bottom:1rem">
        ✅ Decrypted <strong>{{ selectedFile?.name }}</strong>. Now configure your patches below.
      </div>

      <!-- Patch cards -->
      <div class="patch-cards">

        <!-- COUNTDOWN_EXPIRED -->
        <div class="patch-card" :class="{ 'patch-card--active': patches.expired.enabled }">
          <label class="patch-card__header">
            <input type="checkbox" v-model="patches.expired.enabled" />
            <span class="patch-card__title">Expired Activity Bypass</span>
          </label>
          <p class="patch-card__desc">
            Sets the <code>COUNTDOWN_EXPIRED</code> flag. Uncheck <strong>Mark as expired</strong> to clear the flag (<code>0</code>) and bypass the expiry check, or check it to mark the activity as expired (<code>1</code>).
          </p>
          <div v-if="patches.expired.enabled" class="patch-card__body">
            <label class="toggle-label">
              <input type="checkbox" v-model="patches.expired.value" />
              <span>Mark as expired</span>
            </label>
            <div class="field-hint">
              Unchecked = <code>COUNTDOWN_EXPIRED="0"</code> (not expired) &nbsp;|&nbsp;
              Checked = <code>COUNTDOWN_EXPIRED="1"</code> (expired)
            </div>
          </div>
        </div>

        <!-- COUNTDOWNMS -->
        <div class="patch-card" :class="{ 'patch-card--active': patches.defaultTime.enabled }">
          <label class="patch-card__header">
            <input type="checkbox" v-model="patches.defaultTime.enabled" />
            <span class="patch-card__title">Default Time</span>
          </label>
          <p class="patch-card__desc">
            Sets the total activity timer duration (<code>COUNTDOWNMS</code>).
          </p>
          <div v-if="patches.defaultTime.enabled" class="patch-card__body">
            <div class="time-inputs">
              <div class="time-field">
                <label>Hours</label>
                <input type="number" min="0" max="999" v-model.number="patches.defaultTime.h" class="time-input" />
              </div>
              <div class="time-sep">:</div>
              <div class="time-field">
                <label>Minutes</label>
                <input type="number" min="0" max="59" v-model.number="patches.defaultTime.m" class="time-input" />
              </div>
              <div class="time-sep">:</div>
              <div class="time-field">
                <label>Seconds</label>
                <input type="number" min="0" max="59" v-model.number="patches.defaultTime.s" class="time-input" />
              </div>
            </div>
            <div class="field-hint">= {{ toMs(patches.defaultTime) }} ms</div>
          </div>
        </div>

        <!-- COUNTDOWNLEFT -->
        <div class="patch-card" :class="{ 'patch-card--active': patches.timeLeft.enabled }">
          <label class="patch-card__header">
            <input type="checkbox" v-model="patches.timeLeft.enabled" />
            <span class="patch-card__title">Time Left</span>
          </label>
          <p class="patch-card__desc">
            Overrides the remaining countdown time (<code>COUNTDOWNLEFT</code>).
          </p>
          <div v-if="patches.timeLeft.enabled" class="patch-card__body">
            <div class="time-inputs">
              <div class="time-field">
                <label>Hours</label>
                <input type="number" min="0" max="999" v-model.number="patches.timeLeft.h" class="time-input" />
              </div>
              <div class="time-sep">:</div>
              <div class="time-field">
                <label>Minutes</label>
                <input type="number" min="0" max="59" v-model.number="patches.timeLeft.m" class="time-input" />
              </div>
              <div class="time-sep">:</div>
              <div class="time-field">
                <label>Seconds</label>
                <input type="number" min="0" max="59" v-model.number="patches.timeLeft.s" class="time-input" />
              </div>
            </div>
            <div class="field-hint">= {{ toMs(patches.timeLeft) }} ms</div>
          </div>
        </div>

        <!-- CHECK RESULT -->
        <div class="patch-card" :class="{ 'patch-card--active': patches.checkResult.enabled }">
          <label class="patch-card__header">
            <input
              type="checkbox"
              v-model="patches.checkResult.enabled"
            />
            <span class="patch-card__title">Check Results Feature</span>
          </label>
          <p class="patch-card__desc">
            Enable or disable scoring checks by updating <code>checkType</code> values in
            <code>COMPARISONS</code> and <code>INITIALSETUP</code>.
          </p>
          <div v-if="hasAssessmentItems" class="field-hint">
            Found <strong>{{ assessmentSummary.comparisonItems }}</strong> comparison items
            (<strong>{{ assessmentSummary.enabledCheckItems }}</strong> currently check-enabled).
          </div>
          <div v-else class="field-hint">
            No comparison items were found in <code>COMPARISONS</code>.
          </div>
          <div v-if="patches.checkResult.enabled" class="patch-card__body">
            <label class="toggle-label">
              <input type="radio" value="enable" v-model="patches.checkResult.mode" />
              <span>Enable check results (set checkType <code>0</code> → <code>1</code>)</span>
            </label>
            <label class="toggle-label">
              <input type="radio" value="disable" v-model="patches.checkResult.mode" />
              <span>Disable check results (set checkType <code>1</code> or <code>2</code> → <code>0</code>)</span>
            </label>
          </div>
        </div>

      </div>

      <!-- Validation warning -->
      <div v-if="!anyPatchEnabled" class="status-box status-error" style="margin-top:1rem">
        ⚠️ Select at least one patch to apply.
      </div>

      <!-- Apply / Back buttons -->
      <div class="actions" style="margin-top:1rem">
        <button
          class="btn btn-primary"
          :disabled="!anyPatchEnabled || loading"
          @click="applyPatches"
        >
          🩹 Apply Patches &amp; Download
        </button>
        <button class="btn btn-secondary" :disabled="loading" @click="goBack">
          ← Back
        </button>
      </div>

      <div v-if="loading" class="status-box status-loading" style="margin-top:1rem">
        <div class="spinner"></div>
        <span>{{ uploadStatus || 'Re-encrypting and downloading…' }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { inflate } from 'pako'
import { removeTraces } from './watermarkUtils'
import { postJsonWithUploadProgress, toUploadStatusMessage } from './uploadWithProgress'
import { encryptPka } from './pkaEncrypt'

const DEFAULT_API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'
const API_URL = ((import.meta.env.VITE_PKA2XML_API_URL as string | undefined) ?? '').trim() || DEFAULT_API_URL
const BLOB_URL_REVOKE_DELAY_MS = 10_000

// ── state ──────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const isDragging = ref(false)
const step = ref<'upload' | 'patch'>('upload')
const xmlContent = ref('')
const uploadProgress = ref(0)
const uploadStatus = ref('')

interface TimePatch {
  enabled: boolean
  h: number
  m: number
  s: number
}

interface ExpiredPatch {
  enabled: boolean
  value: boolean
}

interface CheckResultPatch {
  enabled: boolean
  mode: 'enable' | 'disable'
}

interface AssessmentSummary {
  comparisonItems: number
  enabledCheckItems: number
}

const patches = reactive<{
  expired: ExpiredPatch
  defaultTime: TimePatch
  timeLeft: TimePatch
  checkResult: CheckResultPatch
}>({
  expired: { enabled: false, value: false },
  defaultTime: { enabled: false, h: 0, m: 0, s: 0 },
  timeLeft: { enabled: false, h: 0, m: 0, s: 0 },
  checkResult: { enabled: false, mode: 'enable' },
})

const enabledPatchCount = computed(
  () => [
    patches.expired.enabled,
    patches.defaultTime.enabled,
    patches.timeLeft.enabled,
    patches.checkResult.enabled,
  ].filter(Boolean).length,
)
const anyPatchEnabled = computed(() => enabledPatchCount.value > 0)
const assessmentSummary = ref<AssessmentSummary>({ comparisonItems: 0, enabledCheckItems: 0 })
const hasAssessmentItems = computed(() => assessmentSummary.value.comparisonItems > 0)

// ── helpers ─────────────────────────────────────────────────────────────────
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const CHECK_TYPE_DISABLED = '0'
const CHECK_TYPE_GRADED = '1'
const CHECK_TYPE_ALTERNATIVE = '2'

function toMs(t: TimePatch): number {
  return ((t.h * SECONDS_PER_HOUR) + (t.m * SECONDS_PER_MINUTE) + t.s) * MS_PER_SECOND
}

/** Escape special regex characters so an attribute name is matched literally. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

/** Replace an XML attribute value in an XML string, e.g. COUNTDOWNLEFT="..." */
function replaceXmlAttr(xml: string, attr: string, newValue: string): { xml: string; count: number } {
  let count = 0
  const re = new RegExp(`(\\b${escapeRegex(attr)}=")[^"]*(")`,'g')
  const result = xml.replace(re, (_match, p1, p2) => { count++; return `${p1}${newValue}${p2}` })
  return { xml: result, count }
}

function summarizeAssessmentItems(xml: string): AssessmentSummary {
  const comparisonsMatch = xml.match(/<COMPARISONS\b[^>]*>([\s\S]*?)<\/COMPARISONS>/i)
  if (!comparisonsMatch) return { comparisonItems: 0, enabledCheckItems: 0 }

  const comparisonsXml = comparisonsMatch[1]
  const nameWithCheckType = Array.from(
    comparisonsXml.matchAll(/<NAME\b[^>]*\bcheckType\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi),
  )

  const comparisonItems = nameWithCheckType.length
  const enabledCheckItems = nameWithCheckType.filter((match) => {
    const checkType = match[1] ?? match[2]
    return checkType === CHECK_TYPE_GRADED || checkType === CHECK_TYPE_ALTERNATIVE
  }).length
  return { comparisonItems, enabledCheckItems }
}

function patchCheckResults(
  xml: string,
  mode: CheckResultPatch['mode'],
): { xml: string; count: number } {
  let count = 0
  const patchedXml = xml.replace(
    /<(COMPARISONS|INITIALSETUP)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (sectionBlock) =>
      sectionBlock.replace(
        /(<NAME\b[^>]*\bcheckType\s*=\s*)(?:"([^"]*)"|'([^']*)')/gi,
        (_match, before, doubleQuotedValue, singleQuotedValue) => {
          const quote = doubleQuotedValue !== undefined ? '"' : "'"
          const value = doubleQuotedValue ?? singleQuotedValue

          if (mode === 'enable' && value === CHECK_TYPE_DISABLED) {
            count++
            return `${before}${quote}${CHECK_TYPE_GRADED}${quote}`
          }
          if (
            mode === 'disable' &&
            (value === CHECK_TYPE_GRADED || value === CHECK_TYPE_ALTERNATIVE)
          ) {
            count++
            return `${before}${quote}${CHECK_TYPE_DISABLED}${quote}`
          }
          return `${before}${quote}${value}${quote}`
        },
      ),
  )

  if (count === 0) return { xml, count }
  return { xml: patchedXml, count }
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

function resetPatches() {
  patches.expired.enabled = false
  patches.expired.value = false
  patches.defaultTime.enabled = false
  patches.defaultTime.h = 0
  patches.defaultTime.m = 0
  patches.defaultTime.s = 0
  patches.timeLeft.enabled = false
  patches.timeLeft.h = 0
  patches.timeLeft.m = 0
  patches.timeLeft.s = 0
  patches.checkResult.enabled = false
  patches.checkResult.mode = 'enable'
  assessmentSummary.value = { comparisonItems: 0, enabledCheckItems: 0 }
}

function reset() {
  selectedFile.value = null
  errorMsg.value = ''
  successMsg.value = ''
  xmlContent.value = ''
  step.value = 'upload'
  uploadProgress.value = 0
  uploadStatus.value = ''
  resetPatches()
  if (fileInput.value) fileInput.value.value = ''
}

function goBack() {
  step.value = 'upload'
  errorMsg.value = ''
  successMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = ''
  resetPatches()
}

// ── decrypt ──────────────────────────────────────────────────────────────────
async function decryptFile() {
  if (!selectedFile.value) return
  loading.value = true
  errorMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = 'Preparing file for upload…'

  try {
    const uploadAction = async (payload: unknown): Promise<string> => {
      const response = await postJsonWithUploadProgress(API_URL, payload, (state) => {
        uploadProgress.value = state.percent
        uploadStatus.value = toUploadStatusMessage(state)
      })
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      return response.body
    }

    const b64 = await toBase64(selectedFile.value)
    const resultB64 = await uploadAction({ file: b64, action: 'decode' })
    const blob = await b64toBlob(resultB64)
    const arrayBuffer = await blob.arrayBuffer()

    const data = inflate(new Uint8Array(arrayBuffer))
    const rawXml = new TextDecoder('utf-8').decode(data)

    // Strip any pka2xml watermark / traces from the decrypted XML so
    // they are not present when the patched file is re-encrypted.
    const { xml: cleanedXml } = removeTraces(rawXml)
    xmlContent.value = cleanedXml
    assessmentSummary.value = summarizeAssessmentItems(cleanedXml)

    step.value = 'patch'
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Decryption failed: ${msg}. Make sure the file is a valid Packet Tracer .pka/.pkt file.`
  } finally {
    loading.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
  }
}

// ── apply patches & re-encrypt ───────────────────────────────────────────────
async function applyPatches() {
  if (!selectedFile.value || !anyPatchEnabled.value) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = 'Preparing file for upload…'

  try {
    const uploadAction = async (payload: unknown): Promise<string> => {
      const response = await postJsonWithUploadProgress(API_URL, payload, (state) => {
        uploadProgress.value = state.percent
        uploadStatus.value = toUploadStatusMessage(state)
      })
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      return response.body
    }

    let xml = xmlContent.value
    const noMatch: string[] = []

    if (patches.expired.enabled) {
      const { xml: patched, count } = replaceXmlAttr(xml, 'COUNTDOWN_EXPIRED', patches.expired.value ? '1' : '0')
      xml = patched
      if (count === 0) noMatch.push('Expired Activity Bypass (COUNTDOWN_EXPIRED not found)')
    }
    if (patches.defaultTime.enabled) {
      const { xml: patched, count } = replaceXmlAttr(xml, 'COUNTDOWNMS', String(toMs(patches.defaultTime)))
      xml = patched
      if (count === 0) noMatch.push('Default Time (COUNTDOWNMS not found)')
    }
    if (patches.timeLeft.enabled) {
      const { xml: patched, count } = replaceXmlAttr(xml, 'COUNTDOWNLEFT', String(toMs(patches.timeLeft)))
      xml = patched
      if (count === 0) noMatch.push('Time Left (COUNTDOWNLEFT not found)')
    }
    if (patches.checkResult.enabled) {
      const { xml: patched, count } = patchCheckResults(xml, patches.checkResult.mode)
      xml = patched
      if (count === 0) {
        const modeLabel = patches.checkResult.mode === 'enable'
          ? 'Check Results Enable (no checkType="0" items found)'
          : 'Check Results Disable (no checkType="1" or "2" items found)'
        noMatch.push(modeLabel)
      }
    }

    if (noMatch.length === enabledPatchCount.value) {
      throw new Error(`None of the selected attributes were found in the file. Make sure it is a valid Packet Tracer activity file with countdown settings.`)
    }

    // Strip any remaining traces before compressing and re-encrypting
    const { xml: cleanedXml } = removeTraces(xml)

    // Compress and re-encrypt locally — no backend call, so no watermark can be re-injected
    const encodedXml = new TextEncoder().encode(cleanedXml)
    const pkaBinary = encryptPka(encodedXml)
    const resultBlob = new Blob([pkaBinary], { type: 'application/octet-stream' })

    const origExt = selectedFile.value.name.match(/\.(pka|pkt)$/i)?.[1]?.toLowerCase() ?? 'pka'
    const outName = selectedFile.value.name.replace(/\.(pka|pkt)$/i, `.patched.${origExt}`)
    triggerDownload(resultBlob, outName)

    const warnMsg = noMatch.length > 0
      ? ` Warning: some attributes were not found and skipped: ${noMatch.join(', ')}.`
      : ''
    successMsg.value = `Patches applied! "${outName}" has been downloaded.${warnMsg}`
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Failed to apply patches: ${msg}`
  } finally {
    loading.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
  }
}
</script>

<style scoped>
/* ── upload zone ── (re-use converter styles) */
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

/* ── patch cards ── */
.patch-cards { display: flex; flex-direction: column; gap: 1rem; }

.patch-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s;
}
.patch-card--active { border-color: var(--vp-c-brand-1); }

.patch-card__header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  user-select: none;
}
.patch-card__header input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--vp-c-brand-1);
  cursor: pointer;
}
.patch-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.patch-card__desc {
  margin: 0.4rem 0 0 1.7rem;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
}
.patch-card__body { margin-top: 0.9rem; margin-left: 1.7rem; }

/* ── toggle label ── */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
}
.toggle-label input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--vp-c-brand-1);
}

/* ── time inputs ── */
.time-inputs {
  display: flex;
  align-items: flex-end;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.time-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.time-field label {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}
.time-input {
  width: 5rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 1rem;
  text-align: center;
}
.time-input:focus { outline: 2px solid var(--vp-c-brand-1); border-color: transparent; }

.time-sep {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
  padding-bottom: 0.15rem;
}

/* ── hint ── */
.field-hint {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}
</style>
