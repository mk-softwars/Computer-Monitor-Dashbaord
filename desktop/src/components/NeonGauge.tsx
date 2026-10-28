import { memo, useId } from 'react'

interface NeonGaugeProps {
  value: number | null
  label: string
  tone: 'blue' | 'purple' | 'cyan' | 'violet'
  size?: 'large' | 'small'
}

const colors = {
  blue: ['#00DFFF', '#005CFF'],
  purple: ['#6024FF', '#FF2AD4'],
  cyan: ['#00DFFF', '#00A7FF'],
  violet: ['#6024FF', '#A12AFF'],
}

export const NeonGauge = memo(function NeonGauge({ value, label, tone, size = 'large' }: NeonGaugeProps) {
  const id = useId().replaceAll(':', '')
  const normalized = value == null ? 0 : Math.max(0, Math.min(100, value))
  const radius = 82
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - normalized / 100)
  const [start, end] = colors[tone]

  return (
    <div className={`gauge gauge--${size}`} style={{ '--gauge-color': start } as React.CSSProperties}>
      <svg viewBox="0 0 200 200" role="img" aria-label={`${label}: ${value == null ? 'unavailable' : `${Math.round(value)} percent`}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle className="gauge__track" cx="100" cy="100" r={radius} />
        <circle className="gauge__progress" cx="100" cy="100" r={radius}
          stroke={`url(#${id})`} filter={`url(#${id}-glow)`}
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="gauge__content">
        <strong>{value == null ? 'N/A' : Math.round(value)}</strong>
        {value != null && <span className="gauge__unit">%</span>}
        <small>{label}</small>
      </div>
    </div>
  )
})
