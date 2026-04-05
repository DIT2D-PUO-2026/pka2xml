<template>
  <div class="assessment-items">

    <!-- Upload zone -->
    <div
      class="upload-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="triggerFileInput"
    >
      <div class="upload-icon">📋</div>
      <p v-if="!selectedFile">
        <strong>Click to select</strong> or drag &amp; drop a file here<br />
        <span style="font-size:0.85em;color:var(--vp-c-text-2)">Supported: .pka, .pkt (will be decrypted first) &nbsp;|&nbsp; .xml (parsed directly)</span>
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
        @click="analyze"
      >
        🔍 Analyze Assessment Items
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
        <span v-if="decrypting">Decrypting <strong>{{ selectedFile?.name }}</strong>… this may take a few seconds.</span>
        <span v-else>Parsing XML and analyzing assessment items…</span>
      </span>
    </div>

    <div v-if="errorMsg" class="status-box status-error">
      ⚠️ {{ errorMsg }}
    </div>

    <!-- Results -->
    <div v-if="results">

      <!-- Summary -->
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-number">{{ results.total }}</div>
          <div class="summary-label">Total Check Items</div>
        </div>
        <div class="summary-card summary-card--correct">
          <div class="summary-number">{{ results.correctCount }}</div>
          <div class="summary-label">Already Correct</div>
        </div>
        <div class="summary-card summary-card--incorrect">
          <div class="summary-number">{{ results.incorrectCount }}</div>
          <div class="summary-label">Need Fixing</div>
        </div>
        <div class="summary-card summary-card--missing">
          <div class="summary-number">{{ results.missingCount }}</div>
          <div class="summary-label">Not in Initial Setup</div>
        </div>
      </div>

      <!-- Incorrect items -->
      <template v-if="results.incorrectItems.length > 0">
        <h3 class="section-heading section-heading--incorrect">
          ❌ Items that need to be configured ({{ results.incorrectItems.length }})
        </h3>
        <div class="table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Incorrect (Current)</th>
                <th>Correct (Expected)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in results.incorrectItems" :key="item.path">
                <td><strong>{{ item.name }}</strong></td>
                <td class="path-cell"><code>{{ item.path }}</code></td>
                <td class="value-cell value-cell--bad">{{ item.incorrect }}</td>
                <td class="value-cell value-cell--good">{{ item.correct }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Correct items -->
      <template v-if="results.correctItems.length > 0">
        <h3 class="section-heading section-heading--correct">
          ✅ Items already correct ({{ results.correctItems.length }})
        </h3>
        <div class="table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in results.correctItems" :key="item.path">
                <td><strong>{{ item.name }}</strong></td>
                <td class="path-cell"><code>{{ item.path }}</code></td>
                <td class="value-cell value-cell--good">{{ item.correct }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- Missing items -->
      <template v-if="results.missingItems.length > 0">
        <h3 class="section-heading section-heading--missing">
          ⚠️ Items only in COMPARISONS — not in initial setup ({{ results.missingItems.length }})
        </h3>
        <div class="table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Path</th>
                <th>Expected Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in results.missingItems" :key="item.path">
                <td><strong>{{ item.name }}</strong></td>
                <td class="path-cell"><code>{{ item.path }}</code></td>
                <td class="value-cell">{{ item.correct }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-if="results.total === 0" class="status-box status-error">
        No check items (checkType 1 or 2) were found in the COMPARISONS section of this file.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { inflate } from 'pako'

const API_URL = 'https://1nlsyfjbcb.execute-api.eu-south-1.amazonaws.com/default/pka2xml'

interface CheckItem {
  path: string
  name: string
  checkType: string
  incorrect: string | null
  correct: string
  match: boolean | null
}

interface Results {
  total: number
  correctCount: number
  incorrectCount: number
  missingCount: number
  incorrectItems: CheckItem[]
  correctItems: CheckItem[]
  missingItems: CheckItem[]
}

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const loading = ref(false)
const decrypting = ref(false)
const errorMsg = ref('')
const isDragging = ref(false)
const results = ref<Results | null>(null)

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

// ── XML parsing (mirrors check_items.py) ─────────────────────────────────────

interface NodeInfo {
  nodeValue: string
  checkType: string
  name: string
}

function buildPathDict(
  nodes: Element[],
  path = '',
  d: Record<string, NodeInfo> = {}
): Record<string, NodeInfo> {
  for (const node of nodes) {
    const nameEl = node.querySelector(':scope > NAME')
    const idEl = node.querySelector(':scope > ID')
    const nid = idEl ? (idEl.textContent ?? '') : ''
    const currentPath = path + '/' + nid
    if (nameEl) {
      d[currentPath] = {
        nodeValue: nameEl.getAttribute('nodeValue') ?? '',
        checkType: nameEl.getAttribute('checkType') ?? '0',
        name: nameEl.textContent ?? '',
      }
    }
    const children = Array.from(node.querySelectorAll(':scope > NODE'))
    if (children.length > 0) {
      buildPathDict(children, currentPath, d)
    }
  }
  return d
}

/** Matches any character outside the printable ASCII + whitespace range (mirrors check_items.py re.sub). */
const NON_PRINTABLE_CHARS_REGEX = /[^\x20-\x7E\t\n\r]/g

function parseXml(xmlStr: string): Results {
  // Strip non-printable characters (mirrors the re.sub in check_items.py)
  const cleaned = xmlStr.replace(NON_PRINTABLE_CHARS_REGEX, '')

  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('XML parse error: ' + (parseError.textContent ?? 'unknown'))
  }

  const comparisonsEl = doc.querySelector('COMPARISONS')
  const setupEl = doc.querySelector('INITIALSETUP')

  const compNodes = comparisonsEl
    ? Array.from(comparisonsEl.querySelectorAll(':scope > NODE'))
    : []
  const setupNodes = setupEl
    ? Array.from(setupEl.querySelectorAll(':scope > NODE'))
    : []

  const compDict = buildPathDict(compNodes)
  const setupDict = buildPathDict(setupNodes)

  const checkItems: CheckItem[] = []

  for (const [path, compInfo] of Object.entries(compDict)) {
    if (compInfo.checkType !== '1' && compInfo.checkType !== '2') continue

    const setupInfo = setupDict[path]
    const initialVal = setupInfo ? setupInfo.nodeValue : null
    const expectedVal = compInfo.nodeValue

    let match: boolean | null = null
    if (initialVal !== null) {
      match = initialVal === expectedVal
    }

    checkItems.push({
      path,
      name: compInfo.name,
      checkType: compInfo.checkType,
      incorrect: initialVal,
      correct: expectedVal,
      match,
    })
  }

  const total = checkItems.length
  const correctItems = checkItems.filter(x => x.match === true)
  const incorrectItems = checkItems.filter(x => x.match === false)
  const missingItems = checkItems.filter(x => x.match === null)

  return {
    total,
    correctCount: correctItems.length,
    incorrectCount: incorrectItems.length,
    missingCount: missingItems.length,
    incorrectItems,
    correctItems,
    missingItems,
  }
}

// ── file input ────────────────────────────────────────────────────────────────

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
  results.value = null
}

function reset() {
  selectedFile.value = null
  errorMsg.value = ''
  results.value = null
  if (fileInput.value) fileInput.value.value = ''
}

// ── analyze ───────────────────────────────────────────────────────────────────

async function analyze() {
  if (!selectedFile.value) return
  loading.value = true
  errorMsg.value = ''
  results.value = null

  try {
    let xmlStr: string

    if (/\.(pka|pkt)$/i.test(selectedFile.value.name)) {
      // Decrypt via API first
      decrypting.value = true
      const b64 = await toBase64(selectedFile.value)

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ file: b64, action: 'decode' }),
      })

      if (!response.ok) throw new Error(`Server error: ${response.status}`)

      const resultB64 = await response.text()
      const blob = await b64toBlob(resultB64)
      const arrayBuffer = await blob.arrayBuffer()

      // Decompress (server returns zlib-compressed XML)
      const data = inflate(new Uint8Array(arrayBuffer))
      xmlStr = new TextDecoder('utf-8').decode(data)
      decrypting.value = false
    } else {
      // Read XML directly
      xmlStr = await selectedFile.value.text()
    }

    results.value = parseXml(xmlStr)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errorMsg.value = `Analysis failed: ${msg}`
  } finally {
    loading.value = false
    decrypting.value = false
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
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }

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
  margin-top: 1rem;
}
.status-loading { background: var(--vp-c-bg-soft); color: var(--vp-c-text-2); }
.status-error   { background: #fff0f0; color: #c00; border: 1px solid #f8c8c8; }

.dark .status-error { background: #3a1010; color: #f88; border-color: #6a2020; }

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

/* ── summary grid ── */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.summary-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
}
.summary-card--correct  { border-color: #4caf50; }
.summary-card--incorrect { border-color: #f44336; }
.summary-card--missing  { border-color: #ff9800; }

.dark .summary-card--correct  { border-color: #388e3c; }
.dark .summary-card--incorrect { border-color: #c62828; }
.dark .summary-card--missing  { border-color: #e65100; }

.summary-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1;
}
.summary-label {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

/* ── section headings ── */
.section-heading {
  margin-top: 2rem;
  margin-bottom: 0.75rem;
  font-size: 1.05rem;
  font-weight: 700;
}
.section-heading--incorrect { color: #c62828; }
.section-heading--correct   { color: #2e7d32; }
.section-heading--missing   { color: #e65100; }

.dark .section-heading--incorrect { color: #ef9a9a; }
.dark .section-heading--correct   { color: #a5d6a7; }
.dark .section-heading--missing   { color: #ffcc80; }

/* ── table ── */
.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}
.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.items-table th {
  background: var(--vp-c-bg-soft);
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}
.items-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  vertical-align: top;
}
.items-table tr:last-child td { border-bottom: none; }
.items-table tr:hover td { background: var(--vp-c-bg-soft); }

.path-cell code {
  font-size: 0.78rem;
  word-break: break-all;
  background: transparent;
  padding: 0;
}
.value-cell { font-family: var(--vp-font-family-mono); font-size: 0.82rem; }
.value-cell--bad  { color: #c62828; }
.value-cell--good { color: #2e7d32; }

.dark .value-cell--bad  { color: #ef9a9a; }
.dark .value-cell--good { color: #a5d6a7; }
</style>
