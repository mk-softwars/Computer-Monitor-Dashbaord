export const SPEED_TEST_DOWNLOAD_URL = 'https://speed.cloudflare.com/__down'
export const SPEED_TEST_WARMUP_BYTES = 1_048_576
export const SPEED_TEST_MEASURE_BYTES = 8_388_608
export const SPEED_TEST_MAX_BYTES = SPEED_TEST_WARMUP_BYTES + SPEED_TEST_MEASURE_BYTES
export const SPEED_TEST_TIMEOUT_MS = 25_000
export const SPEED_TEST_MIN_MEASURE_BYTES = 2_097_152

export type SpeedTestPhase = 'ready' | 'testing' | 'complete' | 'failed' | 'cancelled'

export interface SpeedTestProgress {
  phase: SpeedTestPhase
  mbps?: number
  error?: string
}

export function throughputMbps(bytes: number, elapsedMs: number) {
  if (bytes <= 0 || elapsedMs <= 0 || !Number.isFinite(bytes) || !Number.isFinite(elapsedMs)) return null
  return (bytes * 8) / (elapsedMs / 1000) / 1_000_000
}

export function formatSpeedTestMbps(value: number) {
  if (!Number.isFinite(value) || value < 0) return 'N/A'
  return value.toFixed(2)
}

export function speedTestRequestUrl(totalBytes = SPEED_TEST_MAX_BYTES, now = Date.now()) {
  const bytes = Math.max(1, Math.min(SPEED_TEST_MAX_BYTES, Math.floor(totalBytes)))
  return `${SPEED_TEST_DOWNLOAD_URL}?bytes=${bytes}&r=${now}`
}

export function measuredBytesAfterWarmup(receivedBytes: number, warmupBytes = SPEED_TEST_WARMUP_BYTES) {
  return Math.max(0, receivedBytes - warmupBytes)
}
