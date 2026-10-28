export const SPEED_TEST_DOWNLOAD_URL = 'https://speed.cloudflare.com/__down'
const WARMUP_BYTES = 1_048_576
const MEASURE_BYTES = 8_388_608
const MAX_BYTES = WARMUP_BYTES + MEASURE_BYTES
const TIMEOUT_MS = 25_000
const MIN_MEASURE_BYTES = 2_097_152

export class SpeedTestCancelledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'SpeedTestCancelledError'
  }
}

export class SpeedTestFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpeedTestFailedError'
  }
}

function requestUrl() {
  return `${SPEED_TEST_DOWNLOAD_URL}?bytes=${MAX_BYTES}&r=${Date.now()}`
}

function throughputMbps(bytes: number, elapsedMs: number) {
  if (bytes <= 0 || elapsedMs <= 0 || !Number.isFinite(bytes) || !Number.isFinite(elapsedMs)) return null
  return (bytes * 8) / (elapsedMs / 1000) / 1_000_000
}

export async function runInternetDownloadTest(options: {
  signal: AbortSignal
  fetchImpl?: typeof fetch
  now?: () => number
}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => Date.now())
  const combined = new AbortController()
  const onAbort = () => combined.abort()
  options.signal.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => combined.abort(), TIMEOUT_MS)
  const signal = combined.signal

  let response: Response
  try {
    response = await fetchImpl(requestUrl(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
      signal,
    })
  } catch (error) {
    if (options.signal.aborted) throw new SpeedTestCancelledError()
    throw new SpeedTestFailedError(error instanceof Error && /abort/i.test(error.message) ? 'timed out' : (error instanceof Error ? error.message : 'offline'))
  }

  if (!response.ok || !response.body) {
    throw new SpeedTestFailedError(`HTTP ${response.status || 0}`)
  }

  const reader = response.body.getReader()
  let received = 0
  let measureStartedAt: number | undefined

  try {
    while (received < MAX_BYTES) {
      if (options.signal.aborted) throw new SpeedTestCancelledError()
      if (signal.aborted) throw new SpeedTestFailedError('timed out')
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      const previous = received
      received += value.byteLength
      if (previous < WARMUP_BYTES && received >= WARMUP_BYTES) measureStartedAt = now()
    }
  } catch (error) {
    if (options.signal.aborted || error instanceof SpeedTestCancelledError) throw new SpeedTestCancelledError()
    throw new SpeedTestFailedError(error instanceof Error ? error.message : 'read failed')
  } finally {
    clearTimeout(timeout)
    options.signal.removeEventListener('abort', onAbort)
    try { await reader.cancel() } catch { /* empty */ }
  }

  if (options.signal.aborted) throw new SpeedTestCancelledError()

  const measuredBytes = Math.max(0, Math.min(received, MAX_BYTES) - WARMUP_BYTES)
  if (!measureStartedAt || measuredBytes < MIN_MEASURE_BYTES) {
    throw new SpeedTestFailedError('too little data')
  }

  const elapsedMs = Math.max(1, now() - measureStartedAt)
  const mbps = throughputMbps(measuredBytes, elapsedMs)
  if (mbps == null) throw new SpeedTestFailedError('invalid timing')
  return { mbps, measuredBytes, elapsedMs }
}
