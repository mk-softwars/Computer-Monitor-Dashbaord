import { formatMbps, formatMbpsShort } from './networkFormat'

describe('network speed formatting', () => {
  it('converts idle and missing values without inventing traffic', () => {
    expect(formatMbps(0)).toBe('0.0 Mbps')
    expect(formatMbps(0.01)).toBe('0.0 Mbps')
    expect(formatMbps(null)).toBe('N/A')
    expect(formatMbps(undefined)).toBe('N/A')
    expect(formatMbpsShort(null)).toBe('N/A')
  })

  it('uses Mbps with one decimal below 10 and rounded integers at 10+', () => {
    expect(formatMbps(1.25)).toBe('1.3 Mbps')
    expect(formatMbps(12.4)).toBe('12 Mbps')
    expect(formatMbpsShort(12.4)).toBe('12')
    expect(formatMbpsShort(1.1)).toBe('1.1')
  })
})
