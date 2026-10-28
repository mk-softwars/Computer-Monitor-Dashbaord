import { Flame, Snowflake, Thermometer, Unplug } from 'lucide-react'
import type { ThermalState } from '../types'

interface ThermalStatusProps {
  value: number | null
  state: ThermalState
  label?: string
}

export function ThermalStatus({ value, state, label = 'Temperature' }: ThermalStatusProps) {
  const Icon = state === 'hot' ? Flame : state === 'warm' ? Thermometer :
    state === 'normal' ? Snowflake : Unplug
  const text = state === 'unavailable' ? 'UNAVAILABLE' : state.toUpperCase()
  return (
    <div className={`thermal thermal--${state}`}>
      <Icon size={18} aria-hidden />
      <div>
        <span>{label}</span>
        <strong>{value == null ? 'N/A' : `${Math.round(value)}°C`}</strong>
      </div>
      <small>{text}</small>
    </div>
  )
}
