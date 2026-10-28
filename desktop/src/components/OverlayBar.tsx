import { GripVertical, Lock, Minus, Monitor, Pin, Settings, Unlock, X } from 'lucide-react'
import { useEffect } from 'react'
import { formatMbpsShort } from '../networkFormat'
import { applyTheme } from '../theme'
import type { AppSettings, TelemetrySnapshot, ThermalState } from '../types'
import type { ConnectionState } from '../hooks/useTelemetry'

interface OverlayBarProps {
  snapshot: TelemetrySnapshot | null
  state: ConnectionState
  settings: AppSettings
  style: React.CSSProperties
  settingsOpen: boolean
  onOpenSettings(): void
  onCloseSettings(): void
}

function formatPercent(value: number | null | undefined) {
  return value == null ? 'N/A' : `${Math.round(value)}%`
}

function formatTemperature(value: number | null | undefined) {
  return value == null ? 'N/A' : `${Math.round(value)}°`
}

export function OverlayBar({
  snapshot,
  state,
  settings,
  style,
  settingsOpen,
  onOpenSettings,
  onCloseSettings,
}: OverlayBarProps) {
  const gpu = snapshot?.gpus[0]
  const drive = snapshot?.storage[0]
  const display = settings.display
  const storageLabel = drive?.kind === 'HDD' ? 'HDD' : 'SSD'
  const network = settings.network
  const showNetwork = network?.enabled !== false && (
    (display.mode === 'bar' && network?.showInBar)
    || (display.mode === 'mini' && network?.showInMini)
  )
  const networkSpeed = compactSpeed(
    snapshot?.network?.downloadMbps,
    snapshot?.network?.uploadMbps,
    network?.showDownload !== false,
    network?.showUpload !== false,
  )
  const groups = [
    {
      label: 'CPU',
      tone: 'blue',
      primary: formatPercent(snapshot?.cpu.usagePercent),
      secondary: formatTemperature(snapshot?.cpu.temperatureCelsius),
      secondaryTone: snapshot?.cpu.temperatureCelsius == null ? 'na' : (settings.thermalAlerts ? thermalTone(snapshot?.cpu.thermalState) : undefined),
    },
    {
      label: 'GPU',
      tone: 'purple',
      primary: formatPercent(gpu?.usagePercent),
      secondary: formatTemperature(gpu?.temperatureCelsius),
      secondaryTone: gpu?.temperatureCelsius == null ? 'na' : (settings.thermalAlerts ? thermalTone(gpu?.thermalState) : undefined),
    },
    {
      label: 'RAM',
      tone: 'cyan',
      primary: formatPercent(snapshot?.memory.usagePercent),
    },
    {
      label: 'VRAM',
      tone: 'pink',
      primary: formatPercent(gpu?.vramUsagePercent),
    },
    {
      label: storageLabel,
      tone: 'violet',
      primary: formatPercent(drive?.usedPercent),
      secondary: formatTemperature(drive?.temperatureCelsius),
      secondaryTone: drive?.temperatureCelsius == null ? 'na' : (settings.thermalAlerts ? thermalTone(drive?.thermalState) : undefined),
    },
    ...(showNetwork ? [{
      label: 'NET',
      tone: 'blue',
      primary: networkSpeed.primary,
      secondary: networkSpeed.secondary,
    }] : []),
  ]

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.classList.add('overlay-shell')
    document.body.classList.add('overlay-shell')
    return () => {
      document.documentElement.classList.remove('overlay-shell')
      document.body.classList.remove('overlay-shell')
    }
  }, [])

  return (
    <div className={[
      'overlay-bar',
      `overlay-bar--${display.mode}`,
      settingsOpen ? 'overlay-bar--settings' : '',
      display.locked ? 'overlay-bar--locked' : '',
      settings.reducedMotion ? 'reduced-motion' : '',
    ].filter(Boolean).join(' ')} data-theme={settings.theme} style={style}>
      <div className="overlay-bar__panel">
        <div className="overlay-handle" title={display.locked ? 'Position locked' : 'Drag to move'}
          aria-label={display.locked ? 'Position locked' : 'Drag to move'}>
          <GripVertical />
          <i className={state === 'live' ? 'is-live' : ''} />
        </div>
        <div className={`overlay-metrics${showNetwork ? ' overlay-metrics--network' : ''}`}>
          {groups.map(group => (
            <div className={`overlay-metric overlay-metric--${group.tone}`} key={group.label}>
              <small>{group.label}</small>
              <div>
                <strong>{group.primary}</strong>
                {group.secondary ? (
                  <em className={group.secondaryTone ? `is-${group.secondaryTone}` : undefined}>{group.secondary}</em>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="overlay-actions">
          <button className={display.alwaysOnTop ? 'is-active' : ''} title={display.alwaysOnTop ? 'Unpin overlay' : 'Pin always on top'}
            aria-label={display.alwaysOnTop ? 'Unpin overlay' : 'Pin always on top'}
            aria-pressed={display.alwaysOnTop}
            onClick={() => void window.computerMonitor?.setDisplayState({ alwaysOnTop: !display.alwaysOnTop })}>
            <Pin />
          </button>
          <button title={display.locked ? 'Unlock position' : 'Lock position'}
            aria-label={display.locked ? 'Unlock position' : 'Lock position'}
            onClick={() => void window.computerMonitor?.setDisplayState({ locked: !display.locked })}>
            {display.locked ? <Lock /> : <Unlock />}
          </button>
          <button data-click-through-control title="Settings" aria-label="Open settings"
            className={settingsOpen ? 'is-active' : ''}
            onClick={() => settingsOpen ? onCloseSettings() : onOpenSettings()}>
            <Settings />
          </button>
          <button title="Full dashboard" aria-label="Open full dashboard"
            onClick={() => void window.computerMonitor?.setDisplayState({ mode: 'full' })}>
            <Monitor />
          </button>
          <button title="Minimize" aria-label="Minimize" onClick={() => void window.computerMonitor?.minimize()}>
            <Minus />
          </button>
          <button className="is-close" title="Close" aria-label="Close" onClick={() => void window.computerMonitor?.close()}>
            <X />
          </button>
        </div>
      </div>
    </div>
  )
}

function compactSpeed(
  download: number | null | undefined,
  upload: number | null | undefined,
  showDownload: boolean,
  showUpload: boolean,
) {
  const down = netLabel(download, '↓')
  const up = netLabel(upload, '↑')
  if (showDownload && showUpload) return { primary: down, secondary: up }
  if (showDownload) return { primary: down, secondary: undefined }
  if (showUpload) return { primary: up, secondary: undefined }
  return { primary: '—', secondary: undefined }
}

function netLabel(value: number | null | undefined, arrow: string) {
  const text = formatMbpsShort(value)
  return text === 'N/A' ? 'N/A' : `${text}${arrow}`
}

function thermalTone(state: ThermalState | undefined) {
  if (state === 'hot') return 'hot'
  if (state === 'warm') return 'warm'
  return undefined
}
