import { Cpu, Database, Expand, Gauge, Lock, Maximize2, MemoryStick, Minus, Settings, Unlock, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NeonGauge } from './components/NeonGauge'
import { SettingsPanel } from './components/SettingsPanel'
import { ThermalStatus } from './components/ThermalStatus'
import { useTelemetry, type ConnectionState } from './hooks/useTelemetry'
import type { AppSettings, DisplayState, TelemetrySnapshot, ThermalState } from './types'

const defaultSettings: AppSettings = {
  refreshIntervalMs: 1000,
  rgbIntensity: 75,
  reducedMotion: false,
  fullscreen: false,
  showTrayIcon: true,
  minimizeToTray: false,
  launchAtStartup: false,
  display: {
    mode: 'full',
    alwaysOnTop: false,
    locked: false,
    clickThrough: false,
    opacity: 1,
    panelTransparent: false,
    glassBlur: false,
    subtleFrame: true,
    textScale: 100,
    sizePreset: 'normal',
    launchLastMode: true,
  },
  thresholds: {
    cpu: { warm: 75, hot: 90 },
    gpu: { warm: 75, hot: 88 },
    gpuHotspot: { warm: 90, hot: 105 },
    ssd: { warm: 55, hot: 70 },
    hdd: { warm: 45, hot: 55 },
    ram: { warm: 60, hot: 75 },
  },
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('computer-monitor-settings')
    if (!stored) return defaultSettings
    const parsed = JSON.parse(stored) as Partial<AppSettings>
    return {
      ...defaultSettings,
      ...parsed,
      display: { ...defaultSettings.display, ...parsed.display },
      thresholds: { ...defaultSettings.thresholds, ...parsed.thresholds },
    }
  } catch {
    return defaultSettings
  }
}

export default function App() {
  const { snapshot, state, connection } = useTelemetry()
  const [settings, setSettings] = useState(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gpu = snapshot?.gpus[0]
  const lastUpdate = useMemo(() => snapshot
    ? new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--', [snapshot])

  useEffect(() => {
    void window.computerMonitor?.setFullscreen(settings.fullscreen)
    void window.computerMonitor?.setTrayEnabled(settings.showTrayIcon)
      .then(() => window.computerMonitor?.setMinimizeToTray(settings.minimizeToTray))
    const syncDisplay = (display: DisplayState) => setSettings(current => {
      const next = { ...current, display }
      localStorage.setItem('computer-monitor-settings', JSON.stringify(next))
      return next
    })
    void window.computerMonitor?.getDisplayState().then(syncDisplay)
    const stopDisplayListener = window.computerMonitor?.onDisplayStateChanged(syncDisplay)
    const stopSettingsListener = window.computerMonitor?.onOpenSettings(() => setSettingsOpen(true))
    return () => {
      stopDisplayListener?.()
      stopSettingsListener?.()
    }
    // Desktop preferences are synchronized by Electron after startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSettings = async (next: AppSettings) => {
    const validated: AppSettings = {
      ...next,
      refreshIntervalMs: Math.max(500, Math.min(10000, next.refreshIntervalMs)),
      minimizeToTray: next.showTrayIcon && next.minimizeToTray,
    }
    setSettings(validated)
    localStorage.setItem('computer-monitor-settings', JSON.stringify(validated))
    document.documentElement.classList.toggle('reduced-motion', validated.reducedMotion)
    await window.computerMonitor?.setFullscreen(validated.fullscreen)
    await window.computerMonitor?.setTrayEnabled(validated.showTrayIcon)
    await window.computerMonitor?.setMinimizeToTray(validated.minimizeToTray)
    await window.computerMonitor?.setLaunchAtStartup(validated.launchAtStartup)
    await window.computerMonitor?.setDisplayState(validated.display)
    if (validated.display.sizePreset !== 'custom' && validated.display.mode !== 'full') {
      await window.computerMonitor?.setSizePreset(validated.display.sizePreset)
    }
    if (connection) {
      try {
        await fetch(`${connection.endpoint}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Monitor-Token': connection.token },
          body: JSON.stringify({
            refreshIntervalMs: validated.refreshIntervalMs,
            thresholds: validated.thresholds,
          }),
        })
      } catch {
        // The WebSocket reconnect loop reports service availability.
      }
    }
  }

  const previewSettings = (next: AppSettings) => {
    void window.computerMonitor?.setDisplayState(next.display)
    if (next.display.sizePreset !== 'custom' && next.display.mode !== 'full') {
      void window.computerMonitor?.setSizePreset(next.display.sizePreset)
    }
  }

  const displayStyle = {
    '--rgb-intensity': settings.rgbIntensity / 100,
    '--panel-opacity': settings.display.panelTransparent ? 0 : .88,
    '--text-scale': settings.display.textScale / 100,
  } as React.CSSProperties

  if (settings.display.mode !== 'full') {
    return <MiniMonitor snapshot={snapshot} state={state} settings={settings}
      style={displayStyle} onOpenSettings={() => {
        void window.computerMonitor?.setDisplayState({ mode: 'full' })
        setSettingsOpen(true)
      }}
      settingsPanel={settingsOpen
        ? <SettingsPanel value={settings} onSave={saveSettings} onPreview={previewSettings} onClose={() => setSettingsOpen(false)} />
        : null} />
  }

  return (
    <main className={settings.reducedMotion ? 'app reduced-motion' : 'app'}
      style={displayStyle}>
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark"><Zap /></div>
          <div><span className="eyebrow">SYSTEM TELEMETRY</span><h1>COMPUTER <b>MONITOR DASHBAORD</b></h1></div>
        </div>
        <div className="topbar__actions">
          <div className={`live-status live-status--${state}`}>
            <i /><span>{state === 'live' ? 'LIVE MONITORING' : state.toUpperCase()}</span>
            <small>{lastUpdate}</small>
          </div>
          <button className="icon-button" onClick={() => void window.computerMonitor?.toggleFullscreen()} aria-label="Toggle fullscreen"><Expand /></button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings /></button>
          <WindowControls />
        </div>
      </header>

      <section className="hero-grid" aria-label="Primary hardware">
        <HardwareCard title="CENTRAL PROCESSING UNIT" name={snapshot?.cpu.name ?? 'Detecting processor…'} tone="blue" icon={<Cpu />}>
          <NeonGauge value={snapshot?.cpu.usagePercent ?? null} label="CPU LOAD" tone="blue" />
          <div className="card__telemetry">
            <ThermalStatus value={snapshot?.cpu.temperatureCelsius ?? null}
              state={snapshot?.cpu.thermalState ?? 'unavailable'} />
            <MetricLine label="Utilization" value={formatPercent(snapshot?.cpu.usagePercent)} />
            <MetricLine label="Sensor access" value={snapshot?.cpu.temperatureCelsius == null ? 'LIMITED' : 'ACTIVE'} />
          </div>
        </HardwareCard>

        <HardwareCard title="GRAPHICS PROCESSING UNIT" name={gpu?.name ?? 'No supported GPU detected'} tone="purple" icon={<Gauge />}>
          <NeonGauge value={gpu?.usagePercent ?? null} label="GPU LOAD" tone="purple" />
          <div className="card__telemetry">
            <ThermalStatus value={gpu?.temperatureCelsius ?? null}
              state={gpu?.thermalState ?? 'unavailable'} />
            {gpu?.hotspotTemperatureCelsius != null &&
              <ThermalStatus label="Hotspot" value={gpu.hotspotTemperatureCelsius} state={gpu.hotspotThermalState} />}
            <MetricLine label="VRAM used" value={formatPercent(gpu?.vramUsagePercent)} />
          </div>
        </HardwareCard>
      </section>

      <section className="secondary-grid" aria-label="Memory and storage">
        <CompactCard title="SYSTEM MEMORY" subtitle="Physical RAM" icon={<MemoryStick />} tone="cyan">
          <NeonGauge value={snapshot?.memory.usagePercent ?? null} label="RAM USED" tone="cyan" size="small" />
          <ThermalStatus value={snapshot?.memory.temperatureCelsius ?? null}
            state={snapshot?.memory.thermalState ?? 'unavailable'} />
        </CompactCard>
        <CompactCard title="GRAPHICS MEMORY" subtitle={gpu?.name ?? 'Unavailable'} icon={<Gauge />} tone="purple">
          <NeonGauge value={gpu?.vramUsagePercent ?? null} label="VRAM USED" tone="purple" size="small" />
          <div className="availability"><span>GPU sensor</span><strong>{gpu ? 'DETECTED' : 'N/A'}</strong></div>
        </CompactCard>
        {snapshot?.storage.map(drive => (
          <CompactCard key={drive.id} title={`${drive.kind} STORAGE`} subtitle={`${drive.name} · ${drive.driveLetters}`} icon={<Database />} tone="violet">
            <NeonGauge value={drive.usedPercent} label="CAPACITY USED" tone="violet" size="small" />
            <ThermalStatus value={drive.temperatureCelsius} state={drive.thermalState} />
          </CompactCard>
        ))}
        {!snapshot?.storage.length && (
          <CompactCard title="STORAGE" subtitle="Detecting fixed drives…" icon={<Database />} tone="violet">
            <NeonGauge value={null} label="CAPACITY USED" tone="violet" size="small" />
            <ThermalStatus value={null} state="unavailable" />
          </CompactCard>
        )}
      </section>

      {!!snapshot?.cpu.coreUsagePercent.length && (
        <section className="core-panel">
          <header><div><span className="eyebrow">PROCESSOR DISTRIBUTION</span><h2>Individual core utilization</h2></div><span>{snapshot.cpu.coreUsagePercent.length} LOGICAL SENSORS</span></header>
          <div className="core-grid">
            {snapshot.cpu.coreUsagePercent.map((value, index) => (
              <div className="core" key={index}><span>C{index + 1}</span><div><i style={{ width: `${value}%` }} /></div><strong>{Math.round(value)}%</strong></div>
            ))}
          </div>
        </section>
      )}

      {snapshot?.health.notes.length ? (
        <aside className="sensor-note">{snapshot.health.notes.join(' ')}</aside>
      ) : null}

      {settingsOpen && <SettingsPanel value={settings} onSave={saveSettings} onPreview={previewSettings} onClose={() => setSettingsOpen(false)} />}
    </main>
  )
}

function MiniMonitor({ snapshot, state, settings, style, onOpenSettings, settingsPanel }: {
  snapshot: TelemetrySnapshot | null
  state: ConnectionState
  settings: AppSettings
  style: React.CSSProperties
  onOpenSettings(): void
  settingsPanel: React.ReactNode
}) {
  const gpu = snapshot?.gpus[0]
  const drive = snapshot?.storage[0]
  const storageLabel = drive?.kind?.toUpperCase() || 'SSD'
  const metrics = [
    { label: 'CPU', value: formatPercent(snapshot?.cpu.usagePercent), tone: 'blue' },
    { label: 'CPU TEMP', value: formatTemperature(snapshot?.cpu.temperatureCelsius), tone: thermalTone(snapshot?.cpu.thermalState) },
    { label: 'GPU', value: formatPercent(gpu?.usagePercent), tone: 'purple' },
    { label: 'GPU TEMP', value: formatTemperature(gpu?.temperatureCelsius), tone: thermalTone(gpu?.thermalState) },
    { label: 'RAM', value: formatPercent(snapshot?.memory.usagePercent), tone: 'cyan' },
    { label: 'VRAM', value: formatPercent(gpu?.vramUsagePercent), tone: 'pink' },
    { label: storageLabel, value: formatPercent(drive?.usedPercent), tone: 'violet' },
    { label: `${storageLabel} TEMP`, value: formatTemperature(drive?.temperatureCelsius), tone: thermalTone(drive?.thermalState) },
  ]
  const display = settings.display
  return (
    <main className={[
      'mini-shell',
      `mini-shell--${display.mode}`,
      display.panelTransparent ? 'mini-shell--transparent' : '',
      display.glassBlur ? 'mini-shell--glass' : '',
      display.subtleFrame ? 'mini-shell--framed' : '',
      settings.reducedMotion ? 'reduced-motion' : '',
    ].filter(Boolean).join(' ')} style={style}>
      <div className="mini-brand"><i className={state === 'live' ? 'is-live' : ''} /><span>CMD</span></div>
      <div className="mini-metrics">
        {metrics.map(metric => (
          <div className={`mini-metric mini-metric--${metric.tone}`} key={metric.label}>
            <small>{metric.label}</small><strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="mini-actions">
        <button onClick={() => void window.computerMonitor?.setDisplayState({ locked: !display.locked })}
          aria-label={display.locked ? 'Unlock position' : 'Lock position'}>
          {display.locked ? <Lock /> : <Unlock />}
        </button>
        <button onClick={onOpenSettings} aria-label="Open settings"><Settings /></button>
        <button onClick={() => void window.computerMonitor?.setDisplayState({ mode: 'full' })} aria-label="Open full dashboard"><Maximize2 /></button>
        <WindowControls compact />
      </div>
      {settingsPanel}
    </main>
  )
}

function WindowControls({ compact = false }: { compact?: boolean }) {
  return <div className={`window-controls${compact ? ' window-controls--compact' : ''}`}>
    <button onClick={() => void window.computerMonitor?.minimize()} aria-label="Minimize"><Minus /></button>
    {!compact && <button onClick={() => void window.computerMonitor?.toggleMaximize()} aria-label="Maximize or restore"><Maximize2 /></button>}
    <button className="window-controls__close" onClick={() => void window.computerMonitor?.close()} aria-label="Close"><X /></button>
  </div>
}

function HardwareCard({ title, name, tone, icon, children }: {
  title: string; name: string; tone: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return <article className={`hardware-card hardware-card--${tone}`}>
    <header><div className="card__icon">{icon}</div><div><span className="eyebrow">{title}</span><h2>{name}</h2></div></header>
    <div className="hardware-card__body">{children}</div>
  </article>
}

function CompactCard({ title, subtitle, tone, icon, children }: {
  title: string; subtitle: string; tone: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return <article className={`compact-card compact-card--${tone}`}>
    <header><div className="card__icon">{icon}</div><div><span className="eyebrow">{title}</span><h3 title={subtitle}>{subtitle}</h3></div></header>
    <div className="compact-card__body">{children}</div>
  </article>
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return <div className="metric-line"><span>{label}</span><strong>{value}</strong></div>
}

function formatPercent(value: number | null | undefined) {
  return value == null ? 'N/A' : `${Math.round(value)}%`
}

function formatTemperature(value: number | null | undefined) {
  return value == null ? 'N/A' : `${Math.round(value)}°`
}

function thermalTone(state: ThermalState | undefined) {
  return state === 'hot' ? 'hot' : state === 'warm' ? 'warm' : 'cyan'
}

export function thermalClass(state: ThermalState) {
  return `thermal--${state}`
}
