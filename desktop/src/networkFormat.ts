export function formatMbps(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (value < 0.05) return '0.0 Mbps'
  if (value < 10) return `${value.toFixed(1)} Mbps`
  return `${Math.round(value)} Mbps`
}

export function formatMbpsShort(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (value < 0.05) return '0.0'
  if (value < 10) return value.toFixed(1)
  return `${Math.round(value)}`
}
