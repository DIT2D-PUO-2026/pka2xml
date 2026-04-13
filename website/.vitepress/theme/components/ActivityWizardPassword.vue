<template>
  <div class="activity-password">

    <!-- Upload zone -->
    <div
      class="upload-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <div class="upload-icon">Key</div>
      <p v-if="!selectedFile">
        <strong>Click to select</strong> or drag &amp; drop a file here<br />
        <span style="font-size:0.85em;color:var(--vp-c-text-2)">
          Supported: .pka, .pkt (will be decrypted first) | .xml (parsed directly)
        </span>
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

    <!-- Actions -->
    <div class="actions">
      <button
        class="btn btn-primary"
        :disabled="!selectedFile || loading"
        @click="extractActivityPassword"
      >
        Extract Activity Password Hash
      </button>
      <button
        v-if="selectedFile"
        class="btn btn-secondary"
        :disabled="loading || cracking"
        @click="reset"
      >
        Clear
      </button>
    </div>

    <!-- Status -->
    <div v-if="loading" class="status-box status-loading">
      <div class="spinner"></div>
      <span>
        <span v-if="decrypting">{{ uploadStatus || `Decrypting ${selectedFile?.name}... this may take a few seconds.` }}</span>
        <span v-else>Parsing XML and extracting Activity metadata...</span>
      </span>
    </div>

    <div v-if="loading && decrypting" class="upload-progress">
      <div class="upload-progress__track">
        <div class="upload-progress__fill" :style="{ width: `${uploadProgress}%` }"></div>
      </div>
      <span class="upload-progress__text">{{ uploadProgress }}%</span>
    </div>

    <div v-if="errorMsg" class="status-box status-error">
      {{ errorMsg }}
    </div>

    <!-- Extracted hash -->
    <div v-if="activityMeta" class="result-card">
      <h3 class="section-heading">Activity Wizard Password</h3>

      <div class="hash-row">
        <span class="hash-label">PASS hash</span>
        <code class="hash-value">{{ activityMeta.passHash || '(empty)' }}</code>
        <button
          class="btn btn-secondary btn-copy"
          :disabled="!activityMeta.passHash"
          @click="copyText(activityMeta.passHash)"
        >
          {{ copiedHash ? 'Copied' : 'Copy' }}
        </button>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span>COUNTDOWNMS</span>
          <code>{{ activityMeta.countdownMs || '-' }}</code>
        </div>
        <div class="meta-item">
          <span>COUNTDOWNLEFT</span>
          <code>{{ activityMeta.countdownLeft || '-' }}</code>
        </div>
        <div class="meta-item">
          <span>COUNTDOWN_EXPIRED</span>
          <code>{{ activityMeta.countdownExpired || '-' }}</code>
        </div>
      </div>

      <div class="field-hint">
        The Activity Wizard password is stored in the <code>PASS</code> attribute as a 32-char MD5 hash.
      </div>

      <div v-if="!isLikelyMd5" class="status-box status-error" style="margin-top: 0.75rem;">
        The extracted PASS value is not a standard MD5 hash. Automatic recovery is disabled.
      </div>
    </div>

    <!-- Recovery panel -->
    <div v-if="activityMeta" class="recover-card">
      <h3 class="section-heading">Recover Password</h3>

      <div class="single-check-row">
        <input
          v-model="singleCandidate"
          class="text-input"
          type="text"
          placeholder="Try one password candidate"
          :disabled="cracking || !isLikelyMd5"
          @keyup.enter="checkSingleCandidate"
        />
        <button
          class="btn btn-secondary"
          :disabled="!singleCandidate.trim() || cracking || !isLikelyMd5"
          @click="checkSingleCandidate"
        >
          Check
        </button>
      </div>

      <label class="toggle-label">
        <input type="checkbox" v-model="includeCommonPasswords" :disabled="cracking || !isLikelyMd5" />
        <span>Include common password list</span>
      </label>

      <label class="toggle-label">
        <input type="checkbox" v-model="includeInstructionWords" :disabled="cracking || !isLikelyMd5" />
        <span>Include words from activity instructions ({{ instructionCandidates.length }} candidates)</span>
      </label>

      <label class="field-label" for="custom-candidates">
        Custom candidate list (one password per line)
      </label>
      <textarea
        id="custom-candidates"
        v-model="customCandidates"
        class="text-area"
        rows="6"
        :disabled="cracking || !isLikelyMd5"
        placeholder="admin\ncisco\nstudent123"
      ></textarea>

      <label class="toggle-label">
        <input type="checkbox" v-model="includeNumericPins" :disabled="cracking || !isLikelyMd5" />
        <span>Also brute-force numeric PINs</span>
      </label>

      <div v-if="includeNumericPins" class="pin-range">
        <div class="pin-field">
          <label>Min length</label>
          <input
            v-model.number="numericMinLength"
            class="text-input"
            type="number"
            min="1"
            max="6"
            :disabled="cracking || !isLikelyMd5"
          />
        </div>
        <div class="pin-field">
          <label>Max length</label>
          <input
            v-model.number="numericMaxLength"
            class="text-input"
            type="number"
            min="1"
            max="6"
            :disabled="cracking || !isLikelyMd5"
          />
        </div>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          :disabled="cracking || !isLikelyMd5"
          @click="runDictionaryAttack"
        >
          Run Recovery
        </button>
        <button
          v-if="cracking"
          class="btn btn-secondary"
          @click="cancelDictionaryAttack"
        >
          Stop
        </button>
      </div>

      <div class="field-hint" style="margin-top: 0.5rem;">
        Candidate pool: <strong>{{ candidatePoolSize }}</strong>
      </div>

      <div v-if="cracking" class="status-box status-loading" style="margin-top: 0.75rem;">
        <div class="spinner"></div>
        <span>
          {{ crackPhase }} Tested {{ testedCount }} candidates...
        </span>
      </div>

      <div v-if="foundPassword" class="status-box status-success" style="margin-top: 0.75rem;">
        Recovered password: <code>{{ foundPassword }}</code>
        <button class="btn btn-secondary btn-copy" @click="copyText(foundPassword)">
          {{ copiedPassword ? 'Copied' : 'Copy' }}
        </button>
      </div>

      <div v-if="lastAttemptNoMatch && !cracking && !foundPassword" class="status-box status-error" style="margin-top: 0.75rem;">
        No matching password found in the attempted candidate set.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { inflate } from 'pako'
import md5 from 'js-md5'
import { removeTraces } from './watermarkUtils'
import { postJsonWithUploadProgress, toUploadStatusMessage } from './uploadWithProgress'

const DEFAULT_API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'
const API_URL = ((import.meta.env.VITE_PKA2XML_API_URL as string | undefined) ?? '').trim() || DEFAULT_API_URL

const NON_PRINTABLE_CHARS_REGEX = /[^\x20-\x7E\t\n\r\x0b\x0c]/g
const CANDIDATE_YIELD_INTERVAL = 500
const MAX_CANDIDATES = 250_000

const COMMON_PASSWORDS = [
  'admin',
  'admin123',
  'cisco',
  'cisco123',
  'password',
  'password123',
  'student',
  'student123',
  'network',
  'network123',
  'packettracer',
  'packettracer123',
  'activity',
  'activity123',
  'lab',
  'lab123',
  'router',
  'switch',
  '1234',
  '12345',
  '123456',
  '12345678',
  'qwerty',
  'qwerty123',
]

interface ActivityMeta {
  passHash: string
  countdownMs: string
  countdownLeft: string
  countdownExpired: string
}

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const decrypting = ref(false)
const errorMsg = ref('')
const isDragging = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref('')

const activityMeta = ref<ActivityMeta | null>(null)
const instructionCandidates = ref<string[]>([])

const singleCandidate = ref('')
const customCandidates = ref('')
const includeCommonPasswords = ref(true)
const includeInstructionWords = ref(true)
const includeNumericPins = ref(false)
const numericMinLength = ref(4)
const numericMaxLength = ref(6)

const testedCount = ref(0)
const crackPhase = ref('')
const cracking = ref(false)
const cancelRequested = ref(false)
const foundPassword = ref('')
const lastAttemptNoMatch = ref(false)

const copiedHash = ref(false)
const copiedPassword = ref(false)

const isLikelyMd5 = computed(() => {
  if (!activityMeta.value?.passHash) return false
  return /^[A-Fa-f0-9]{32}$/.test(activityMeta.value.passHash)
})

const candidatePoolSize = computed(() => {
  let count = buildCandidatePool().length
  if (includeNumericPins.value) {
    const minLen = clampPinLength(numericMinLength.value)
    const maxLen = clampPinLength(numericMaxLength.value)
    const lo = Math.min(minLen, maxLen)
    const hi = Math.max(minLen, maxLen)
    for (let len = lo; len <= hi; len++) {
      count += Math.pow(10, len)
    }
  }
  return count
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  if (!/\.(pka|pkt|xml)$/i.test(file.name)) {
    errorMsg.value = `Unsupported file: "${file.name}". Please select a .pka, .pkt, or .xml file.`
    selectedFile.value = null
    return
  }

  selectedFile.value = file
  errorMsg.value = ''
  activityMeta.value = null
  instructionCandidates.value = []
  clearRecoveryState()
}

function clearRecoveryState() {
  singleCandidate.value = ''
  customCandidates.value = ''
  includeCommonPasswords.value = true
  includeInstructionWords.value = true
  includeNumericPins.value = false
  numericMinLength.value = 4
  numericMaxLength.value = 6
  testedCount.value = 0
  crackPhase.value = ''
  cracking.value = false
  cancelRequested.value = false
  foundPassword.value = ''
  lastAttemptNoMatch.value = false
  copiedHash.value = false
  copiedPassword.value = false
}

function reset() {
  selectedFile.value = null
  activityMeta.value = null
  instructionCandidates.value = []
  errorMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = ''
  clearRecoveryState()
  if (fileInput.value) fileInput.value.value = ''
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

function normalizeXml(xml: string): string {
  return xml.replace(NON_PRINTABLE_CHARS_REGEX, '')
}

function extractInstructionCandidates(doc: Document): string[] {
  const pages = Array.from(doc.querySelectorAll('ACTIVITY > INSTRUCTIONS > PAGE'))
  if (pages.length === 0) return []

  const joined = pages
    .map((page) => page.textContent ?? '')
    .join('\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: string) => {
    const candidate = value.trim()
    if (!candidate) return
    if (candidate.length < 4 || candidate.length > 24) return
    if (seen.has(candidate)) return
    seen.add(candidate)
    out.push(candidate)
  }

  for (const token of joined.split(/[^A-Za-z0-9_]+/g)) {
    if (!token) continue
    add(token)
    add(token.toLowerCase())
  }

  return out
}

function parseActivityMeta(xml: string): { meta: ActivityMeta; instructionCandidates: string[] } {
  const cleaned = normalizeXml(xml)
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML parse error: ' + (parseError.textContent ?? 'unknown'))
  }

  const activity = doc.querySelector('ACTIVITY')
  if (!activity) {
    throw new Error('No <ACTIVITY> section found in this file.')
  }

  const passHash = (activity.getAttribute('PASS') ?? '').trim().toUpperCase()
  if (!passHash) {
    throw new Error('No PASS hash found in the <ACTIVITY> section.')
  }

  const meta: ActivityMeta = {
    passHash,
    countdownMs: (activity.getAttribute('COUNTDOWNMS') ?? '').trim(),
    countdownLeft: (activity.getAttribute('COUNTDOWNLEFT') ?? '').trim(),
    countdownExpired: (activity.getAttribute('COUNTDOWN_EXPIRED') ?? '').trim(),
  }

  return {
    meta,
    instructionCandidates: extractInstructionCandidates(doc),
  }
}

async function extractActivityPassword() {
  if (!selectedFile.value) return

  loading.value = true
  decrypting.value = false
  errorMsg.value = ''
  uploadProgress.value = 0
  uploadStatus.value = ''
  activityMeta.value = null
  instructionCandidates.value = []
  clearRecoveryState()

  try {
    let xmlStr: string

    if (/\.(pka|pkt)$/i.test(selectedFile.value.name)) {
      decrypting.value = true
      uploadStatus.value = 'Preparing file for upload...'
      const b64 = await toBase64(selectedFile.value)
      const response = await postJsonWithUploadProgress(API_URL, { file: b64, action: 'decode' }, (state) => {
        uploadProgress.value = state.percent
        uploadStatus.value = toUploadStatusMessage(state)
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)

      const resultB64 = response.body
      const blob = await b64toBlob(resultB64)
      const arrayBuffer = await blob.arrayBuffer()
      const data = inflate(new Uint8Array(arrayBuffer))
      const rawXml = new TextDecoder('utf-8').decode(data)
      const { xml: cleanedXml } = removeTraces(rawXml)
      xmlStr = cleanedXml
    } else {
      xmlStr = await selectedFile.value.text()
    }

    const { meta, instructionCandidates: fromInstructions } = parseActivityMeta(xmlStr)
    activityMeta.value = meta
    instructionCandidates.value = fromInstructions
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Failed to extract Activity password hash: ${msg}`
  } finally {
    loading.value = false
    decrypting.value = false
    uploadProgress.value = 0
    uploadStatus.value = ''
  }
}

function clampPinLength(value: number): number {
  if (!Number.isFinite(value)) return 4
  const rounded = Math.round(value)
  return Math.min(6, Math.max(1, rounded))
}

function parseCustomCandidates(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function dedupeCandidates(candidates: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    out.push(candidate)
  }
  return out
}

function buildCandidatePool(): string[] {
  const all: string[] = []

  if (includeCommonPasswords.value) {
    all.push(...COMMON_PASSWORDS)
  }

  if (includeInstructionWords.value) {
    all.push(...instructionCandidates.value)
  }

  all.push(...parseCustomCandidates(customCandidates.value))
  return dedupeCandidates(all)
}

function hashCandidate(candidate: string): string {
  return md5(candidate).toUpperCase()
}

async function yieldToUi() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

async function tryCandidates(targetHash: string, candidates: string[]): Promise<string | null> {
  for (let i = 0; i < candidates.length; i++) {
    if (cancelRequested.value) return null

    const candidate = candidates[i]
    testedCount.value++
    if (hashCandidate(candidate) === targetHash) {
      return candidate
    }

    if ((i + 1) % CANDIDATE_YIELD_INTERVAL === 0) {
      await yieldToUi()
    }
  }

  return null
}

async function tryNumericPins(targetHash: string): Promise<string | null> {
  const minLen = clampPinLength(numericMinLength.value)
  const maxLen = clampPinLength(numericMaxLength.value)
  const lo = Math.min(minLen, maxLen)
  const hi = Math.max(minLen, maxLen)

  for (let len = lo; len <= hi; len++) {
    const limit = Math.pow(10, len)
    for (let value = 0; value < limit; value++) {
      if (cancelRequested.value) return null

      const candidate = String(value).padStart(len, '0')
      testedCount.value++
      if (hashCandidate(candidate) === targetHash) {
        return candidate
      }

      if ((value + 1) % CANDIDATE_YIELD_INTERVAL === 0) {
        await yieldToUi()
      }
    }
  }

  return null
}

function checkSingleCandidate() {
  if (!activityMeta.value || !isLikelyMd5.value) return

  const candidate = singleCandidate.value.trim()
  if (!candidate) return

  lastAttemptNoMatch.value = false
  testedCount.value = 1
  crackPhase.value = 'Single check.'

  if (hashCandidate(candidate) === activityMeta.value.passHash) {
    foundPassword.value = candidate
  } else {
    foundPassword.value = ''
    lastAttemptNoMatch.value = true
  }
}

async function runDictionaryAttack() {
  if (!activityMeta.value || !isLikelyMd5.value) return

  const targetHash = activityMeta.value.passHash
  const candidates = buildCandidatePool()

  if (candidates.length > MAX_CANDIDATES) {
    errorMsg.value = `Candidate list is too large (${candidates.length}). Please reduce it below ${MAX_CANDIDATES}.`
    return
  }

  if (candidates.length === 0 && !includeNumericPins.value) {
    errorMsg.value = 'No candidates to test. Add custom candidates, or enable one of the candidate sources.'
    return
  }

  errorMsg.value = ''
  cracking.value = true
  cancelRequested.value = false
  foundPassword.value = ''
  lastAttemptNoMatch.value = false
  testedCount.value = 0

  try {
    crackPhase.value = 'Dictionary phase.'
    let match = await tryCandidates(targetHash, candidates)

    if (!match && includeNumericPins.value && !cancelRequested.value) {
      crackPhase.value = 'Numeric PIN phase.'
      match = await tryNumericPins(targetHash)
    }

    if (match) {
      foundPassword.value = match
      lastAttemptNoMatch.value = false
    } else if (!cancelRequested.value) {
      lastAttemptNoMatch.value = true
    }
  } finally {
    cracking.value = false
    crackPhase.value = ''
    cancelRequested.value = false
  }
}

function cancelDictionaryAttack() {
  cancelRequested.value = true
}

async function copyText(value: string) {
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const area = document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.top = '-9999px'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }

    if (value === activityMeta.value?.passHash) {
      copiedHash.value = true
      setTimeout(() => { copiedHash.value = false }, 1500)
    }

    if (value === foundPassword.value) {
      copiedPassword.value = true
      setTimeout(() => { copiedPassword.value = false }, 1500)
    }
  } catch {
    errorMsg.value = 'Failed to copy text to clipboard.'
  }
}
</script>

<style scoped>
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
.upload-icon {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

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
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--vp-c-brand-1);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}
.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}
.btn-copy {
  padding: 0.3rem 0.8rem;
  font-size: 0.82rem;
}

.status-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.92rem;
  margin-top: 1rem;
}
.status-loading {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}
.status-error {
  background: #fff0f0;
  color: #c00;
  border: 1px solid #f8c8c8;
}
.status-success {
  background: #f0fff4;
  color: #1a7a3a;
  border: 1px solid #b8e8c8;
}

.dark .status-error {
  background: #3a1010;
  color: #f88;
  border-color: #6a2020;
}
.dark .status-success {
  background: #0d2a18;
  color: #6f6;
  border-color: #1a5c30;
}

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

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.section-heading {
  margin: 0;
  font-size: 1rem;
}

.result-card,
.recover-card {
  margin-top: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem 1.1rem;
  background: var(--vp-c-bg-soft);
}

.hash-row {
  margin-top: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}
.hash-label {
  font-size: 0.86rem;
  color: var(--vp-c-text-2);
  min-width: 7rem;
}
.hash-value {
  font-size: 0.88rem;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  word-break: break-all;
}

.meta-grid {
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.6rem;
}
.meta-item {
  padding: 0.55rem 0.65rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.meta-item span {
  font-size: 0.76rem;
  color: var(--vp-c-text-2);
  font-weight: 600;
}
.meta-item code {
  font-size: 0.88rem;
}

.field-hint {
  margin-top: 0.55rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}

.single-check-row {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.field-label {
  margin-top: 0.8rem;
  margin-bottom: 0.35rem;
  display: inline-block;
  font-size: 0.84rem;
  color: var(--vp-c-text-2);
}

.text-input,
.text-area {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.94rem;
}

.text-input {
  max-width: 360px;
}

.text-input:focus,
.text-area:focus {
  outline: 2px solid var(--vp-c-brand-1);
  border-color: transparent;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.9rem;
}

.toggle-label input[type='checkbox'] {
  accent-color: var(--vp-c-brand-1);
}

.pin-range {
  margin-top: 0.6rem;
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.pin-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.pin-field label {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
}

.pin-field .text-input {
  max-width: 130px;
}
</style>