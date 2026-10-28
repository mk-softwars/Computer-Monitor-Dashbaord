import {
  SPEED_TEST_DOWNLOAD_URL,
  SPEED_TEST_MAX_BYTES,
  formatSpeedTestMbps,
  measuredBytesAfterWarmup,
  speedTestRequestUrl,
  throughputMbps,
} from './internetSpeedTest'

describe('internet download speed test math', () => {
  it('does not invent a speed from empty or invalid samples', () => {
    expect(throughputMbps(0, 1000)).toBeNull()
    expect(throughputMbps(1_000_000, 0)).toBeNull()
    expect(throughputMbps(Number.NaN, 1000)).toBeNull()
  })

  it('converts measured bytes after warmup into Mbps', () => {
    expect(throughputMbps(1_250_000, 1000)).toBeCloseTo(10, 5)
    expect(measuredBytesAfterWarmup(1_048_576 + 2_000_000)).toBe(2_000_000)
    expect(measuredBytesAfterWarmup(100)).toBe(0)
  })

  it('formats the speed-test result to two decimals and never uses live 0.0 style rounding', () => {
    expect(formatSpeedTestMbps(47.234)).toBe('47.23')
    expect(formatSpeedTestMbps(0.04)).toBe('0.04')
    expect(formatSpeedTestMbps(-1)).toBe('N/A')
  })

  it('targets Cloudflare’s speed-test download URL with a cache-buster and a 9 MiB cap', () => {
    const url = speedTestRequestUrl()
    expect(url.startsWith(`${SPEED_TEST_DOWNLOAD_URL}?bytes=${SPEED_TEST_MAX_BYTES}&r=`)).toBe(true)
    expect(SPEED_TEST_MAX_BYTES).toBe(9_437_184)
  })
})
