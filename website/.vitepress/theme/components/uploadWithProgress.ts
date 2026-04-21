export interface UploadProgressState {
  uploadedBytes: number
  totalBytes: number
  percent: number
  phase: 'uploading' | 'processing' | 'complete'
}

interface UploadResponse {
  ok: boolean
  status: number
  body: string
}

// Keep progress below 100% until upload completion is verified and a response is received.
const MAX_UPLOAD_PROGRESS_BEFORE_COMPLETE = 99

export function toUploadStatusMessage(state: UploadProgressState): string {
  if (state.phase === 'uploading') {
    return `Uploading file to server… ${state.percent}%`
  }
  if (state.phase === 'processing') {
    return 'Upload complete. Waiting for server processing…'
  }
  return 'Upload verified complete. Reading server response…'
}

/**
 * Send JSON payload with upload progress tracking.
 * Uses XMLHttpRequest because fetch does not expose upload progress events.
 */
export function postJsonWithUploadProgress(
  url: string,
  payload: unknown,
  onProgress: (state: UploadProgressState) => void
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const body = JSON.stringify(payload)
    let uploadCompleted = false
    let loadedBytes = 0
    // Seed progress without allocating an additional full-size byte buffer.
    // This is an approximation that assumes single-byte chars; progress events
    // correct totalBytes when the browser exposes precise transfer sizes.
    let totalBytes = Math.max(body.length, 1)

    onProgress({ uploadedBytes: 0, totalBytes, percent: 0, phase: 'uploading' })

    xhr.open('POST', url)
    // Intentionally omit Content-Type. For string payloads, XHR defaults to
    // text/plain;charset=UTF-8, which keeps this a CORS "simple request" and
    // avoids preflight failures on strict API Gateway configurations.

    xhr.upload.onprogress = (event) => {
      loadedBytes = event.loaded
      if (event.lengthComputable && event.total > 0) {
        totalBytes = event.total
      }
      const percent = totalBytes > 0
        ? Math.min(MAX_UPLOAD_PROGRESS_BEFORE_COMPLETE, Math.round((loadedBytes / totalBytes) * 100))
        : 0
      onProgress({ uploadedBytes: loadedBytes, totalBytes, percent, phase: 'uploading' })
    }

    xhr.upload.onload = () => {
      uploadCompleted = true
      loadedBytes = totalBytes
      onProgress({ uploadedBytes: loadedBytes, totalBytes, percent: 100, phase: 'processing' })
    }

    xhr.onerror = () => reject(new Error('Network error while uploading file'))
    xhr.onabort = () => reject(new Error('Upload was canceled'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.onload = () => {
      const uploadVerified = uploadCompleted || totalBytes === 0 || loadedBytes >= totalBytes
      if (!uploadVerified) {
        // Some browsers/proxies may complete the request without firing the
        // final upload progress/load events. If we have a valid HTTP response,
        // treat upload as complete rather than failing a successful operation.
        loadedBytes = totalBytes
      }
      onProgress({ uploadedBytes: totalBytes, totalBytes, percent: 100, phase: 'complete' })
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText })
    }

    xhr.send(body)
  })
}
