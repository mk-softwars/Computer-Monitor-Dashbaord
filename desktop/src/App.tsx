import { Cpu, Database, Expand, Gauge, LayoutDashboard, Maximize2, MemoryStick, Minus, Monitor, PictureInPicture2, Settings, Square, Wifi, X, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { NeonGauge } from './components/NeonGauge'
import { OverlayBar } from './components/OverlayBar'
import { defaultAppSettings, SettingsPanel } from './components/SettingsPanel'
import { ThermalStatus } from './components/ThermalStatus'
import { useDashboardLayout } from './hooks/useDashboardLayout'
import { useTelemetry, type ConnectionState } from './hooks/useTelemetry'
import { formatMbps } from './networkFormat'
import { applyTheme, normalizeTheme } from './theme'
import type { AppSettings, DisplayState, ThermalState } from './types'

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem('computer-monitor-settings')
    if (!stored) return defaultAppSettings()
    const parsed = JSON.parse(stored) as Partial<AppSettings>
    const defaults = defaultAppSettings()
    return {
      ...defaults,
      ...parsed,
      theme: normalizeTheme(parsed.theme),
      display: { ...defaults.display, ...parsed.display },
      thresholds: { ...defaults.thresholds, ...parsed.thresholds },
      network: { ...defaults.network, ...parsed.network },
    }
  } catch {
    return defaultAppSettings()
  }
}

export default function App() {
  const { snapshot, state, connection } = useTelemetry()
  const { ref, layout } = useDashboardLayout()
  const [settings, setSettings] = useState(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chrome, setChrome] = useState({ maximized: false, fullscreen: false })
  const [displays, setDisplays] = useState<Array<{ id: number; label: string; primary: boolean }>>([])
  const gpu = snapshot?.gpus[0]
  const overlay = settings.display.mode === 'bar' || settings.display.mode === 'mini'
  const lastUpdate = useMemo(() => snapshot
    ? new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--', [snapshot])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion)
    const syncHidden = () => document.documentElement.classList.toggle('is-hidden', document.hidden)
    syncHidden()
    document.addEventListener('visibilitychange', syncHidden)
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        void openSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', syncHidden)
      window.removeEventListener('keydown', onKey)
    }
  }, [settings.reducedMotion])

  useEffect(() => {
    void window.computerMonitor?.setTrayEnabled(settings.showTrayIcon)
      .then(() => window.computerMonitor?.setMinimizeToTray(settings.minimizeToTray))
    void window.computerMonitor?.listDisplays?.().then(list => { if (list) setDisplays(list) })
    void window.computerMonitor?.getWindowChrome?.().then(next => { if (next) setChrome(next) })
    const syncDisplay = (display: DisplayState) => setSettings(current => {
      const next = { ...current, display: { ...current.display, ...display } }
      localStorage.setItem('computer-monitor-settings', JSON.stringify(next))
      return next
    })
    void window.computerMonitor?.getDisplayState().then(display => {
      syncDisplay(display)
      if (settings.fullscreen && display.mode === 'full') {
        void window.computerMonitor?.setFullscreen(true)
      }
    })
    const stopDisplayListener = window.computerMonitor?.onDisplayStateChanged(syncDisplay)
    const stopChrome = window.computerMonitor?.onWindowChromeChanged?.(setChrome)
    const stopSettingsListener = window.computerMonitor?.onOpenSettings(() => { void openSettings() })
    return () => {
      stopDisplayListener?.()
      stopChrome?.()
      stopSettingsListener?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!connection) return
    void fetch(`${connection.endpoint}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Monitor-Token': connection.token },
      body: JSON.stringify({
        refreshIntervalMs: settings.refreshIntervalMs,
        thresholds: settings.thresholds,
        networkEnabled: settings.network.enabled,
        networkAdapterId: settings.network.adapterId,
      }),
    }).catch(() => {
      // The WebSocket reconnect loop reports service availability.
    })
  }, [connection, settings.refreshIntervalMs, settings.thresholds, settings.network.enabled, settings.network.adapterId])

  const openSettings = async () => {
    window.computerMonitor?.setPointerPassthrough(false)
    await window.computerMonitor?.prepareSettings()
    setSettingsOpen(true)
  }

  const closeSettings = async () => {
    setSettingsOpen(false)
    await window.computerMonitor?.restoreAfterSettings()
  }

  const saveSettings = useCallback(async (next: AppSettings) => {
    let validated: AppSettings = {
      ...next,
      theme: normalizeTheme(next.theme),
      refreshIntervalMs: Math.max(500, Math.min(10000, next.refreshIntervalMs)),
      uiScale: 100,
      minimizeToTray: next.showTrayIcon && next.minimizeToTray,
    }
    applyTheme(validated.theme)
    setSettings(validated)
    localStorage.setItem('computer-monitor-settings', JSON.stringify(validated))
    document.documentElement.classList.toggle('reduced-motion', validated.reducedMotion)
    await window.computerMonitor?.setFullscreen(validated.fullscreen)
    await window.computerMonitor?.setTrayEnabled(validated.showTrayIcon)
    await window.computerMonitor?.setMinimizeToTray(validated.minimizeToTray)
    await window.computerMonitor?.setLaunchAtStartup(validated.launchAtStartup)
    const applied = await window.computerMonitor?.setDisplayState(validated.display)
    if (applied) {
      validated = { ...validated, display: { ...validated.display, ...applied } }
      setSettings(validated)
      localStorage.setItem('computer-monitor-settings', JSON.stringify(validated))
    }
    if (validated.display.sizePreset !== 'custom' && (validated.display.mode === 'bar' || validated.display.mode === 'mini')) {
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
            networkEnabled: validated.network.enabled,
            networkAdapterId: validated.network.adapterId,
          }),
        })
      } catch {
        // The WebSocket reconnect loop reports service availability.
      }
    }
  }, [connection])

  const applyToolbarMode = (id: ToolbarMode) => {
    if (id === 'windowed') {
      void window.computerMonitor?.setDisplayState({ mode: 'full' })
      void window.computerMonitor?.setFullscreen(false)
      void window.computerMonitor?.setMaximized?.(false)
      return
    }
    if (id === 'full') {
      void window.computerMonitor?.setDisplayState({ mode: 'full' })
      void window.computerMonitor?.setMaximized?.(true)
      return
    }
    void window.computerMonitor?.setDisplayState({ mode: id })
  }

  const overlayStyle = {
    '--rgb-intensity': settings.rgbIntensity / 100,
    '--panel-opacity': Math.max(.1, Math.min(1, settings.display.opacity)),
    '--text-scale': settings.display.textScale / 100,
  } as React.CSSProperties
  const dashboardStyle = {
    '--rgb-intensity': settings.rgbIntensity / 100,
  } as React.CSSProperties

  if (overlay) {
    return <OverlayBar snapshot={snapshot} state={state} settings={settings}
      style={overlayStyle} settingsOpen={settingsOpen}
      onOpenSettings={() => void openSettings()}
      onCloseSettings={() => void closeSettings()} />
  }

  const toolbarMode = activeToolbarMode(settings.display.mode, chrome.maximized, chrome.fullscreen)
  const narrowToolbar = layout === 'small' || layout === 'compact'

  return (
    <main ref={ref} data-layout={layout}
      className={`app${settings.display.mode === 'desktop' ? ' app--desktop' : ''}${settings.reducedMotion ? ' reduced-motion' : ''}`}
      style={dashboardStyle}>
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <header className="topbar" onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('.topbar__actions, .mode-switch, .mode-select')) return
        void window.computerMonitor?.toggleMaximize()
      }}>
        <div className="brand" title="Drag to move">
          <div className="brand__mark"><Zap /></div>
          <div>
            <span className="eyebrow">SYSTEM TELEMETRY</span>
            <h1>COMPUTER <b>MONITOR DASHBOARD</b></h1>
          </div>
        </div>
        <ModeSwitcher mode={toolbarMode} compact={narrowToolbar} onChange={applyToolbarMode} />
        <div className="topbar__actions">
          <div className={`live-status live-status--${state}`} title={statusDetail(state, lastUpdate)}>
            <i /><span>{state === 'live' ? 'LIVE MONITORING' : state.toUpperCase()}</span>
            <small>{lastUpdate}</small>
          </div>
          <button className="icon-button" title="Fullscreen" aria-label="Toggle fullscreen"
            onClick={() => void window.computerMonitor?.toggleFullscreen()}><Expand /></button>
          <button className="icon-button" data-click-through-control title="Settings (Ctrl+,)" aria-label="Open settings"
            onClick={() => void openSettings()}><Settings /></button>
          <WindowControls />
        </div>
      </header>

      <section className="hero-grid" aria-label="Primary hardware">
        <HardwareCard title="CENTRAL PROCESSING UNIT" name={snapshot?.cpu.name ?? 'Detecting processor…'} tone="blue" icon={<Cpu />}>
          <NeonGauge value={snapshot?.cpu.usagePercent ?? null} label="CPU LOAD" tone="blue" theme={settings.theme} />
          <div className="card__telemetry">
            <ThermalStatus value={snapshot?.cpu.temperatureCelsius ?? null}
              state={snapshot?.cpu.thermalState ?? 'unavailable'} />
            <MetricLine label="Utilization" value={formatPercent(snapshot?.cpu.usagePercent)} />
            <MetricLine label="Sensor access" value={snapshot?.cpu.temperatureCelsius == null ? 'LIMITED' : 'ACTIVE'} />
          </div>
        </HardwareCard>
        <HardwareCard title="GRAPHICS PROCESSING UNIT" name={gpu?.name ?? 'No supported GPU detected'} tone="purple" icon={<Gauge />}>
          <NeonGauge value={gpu?.usagePercent ?? null} label="GPU LOAD" tone="purple" theme={settings.theme} />
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
          <NeonGauge value={snapshot?.memory.usagePercent ?? null} label="RAM USED" tone="cyan" size="small" theme={settings.theme} />
          <ThermalStatus value={snapshot?.memory.temperatureCelsius ?? null}
            state={snapshot?.memory.thermalState ?? 'unavailable'} />
        </CompactCard>
        <CompactCard title="GRAPHICS MEMORY" subtitle={gpu?.name ?? 'Unavailable'} icon={<Gauge />} tone="purple">
          <NeonGauge value={gpu?.vramUsagePercent ?? null} label="VRAM USED" tone="purple" size="small" theme={settings.theme} />
          <div className="availability"><span>GPU sensor</span><strong>{gpu ? 'DETECTED' : 'N/A'}</strong></div>
        </CompactCard>
        {snapshot?.storage.map(drive => (
          <CompactCard key={drive.id} title={`${drive.kind} STORAGE`} subtitle={`${drive.name} · ${drive.driveLetters}`} icon={<Database />} tone="violet">
            <NeonGauge value={drive.usedPercent} label="CAPACITY USED" tone="violet" size="small" theme={settings.theme} />
            <ThermalStatus value={drive.temperatureCelsius} state={drive.thermalState} />
          </CompactCard>
        ))}
        {!snapshot?.storage.length && (
          <CompactCard title="STORAGE" subtitle="Detecting fixed drives…" icon={<Database />} tone="violet">
            <NeonGauge value={null} label="CAPACITY USED" tone="violet" size="small" theme={settings.theme} />
            <ThermalStatus value={null} state="unavailable" />
          </CompactCard>
        )}
        {settings.network.enabled && (
          <CompactCard title="NETWORK" subtitle={snapshot?.network?.adapterName
            ? `${snapshot.network.adapterKind ?? 'Adapter'} · ${snapshot.network.adapterName}`
            : 'Detecting adapter…'} icon={<Wifi />} tone="blue">
            <div className="network-speeds" aria-label="Network speeds">
              {settings.network.showDownload && (
                <div className="network-speeds__row">
                  <span>Download</span>
                  <strong>{formatMbps(snapshot?.network?.downloadMbps)}</strong>
                </div>
              )}
              {settings.network.showUpload && (
                <div className="network-speeds__row">
                  <span>Upload</span>
                  <strong>{formatMbps(snapshot?.network?.uploadMbps)}</strong>
                </div>
              )}
              {!settings.network.showDownload && !settings.network.showUpload && (
                <div className="availability"><span>Metrics</span><strong>Hidden</strong></div>
              )}
            </div>
            <div className="availability">
              <span>Interface</span>
              <strong>{snapshot?.network?.adapterKind ?? 'N/A'}</strong>
            </div>
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
        <aside className="sensor-note" title={snapshot.health.notes.join(' ')}>{snapshot.health.notes.join(' ')}</aside>
      ) : null}

      {settingsOpen && <SettingsPanel value={settings} sensorStatus={statusDetail(state, lastUpdate)}
        displays={displays} networkAdapters={snapshot?.network?.adapters ?? []}
        onChange={saveSettings} onClose={closeSettings}
        onResetLayout={() => void window.computerMonitor?.resetWindowLayout?.()} />}
    </main>
  )
}

type ToolbarMode = 'windowed' | 'full' | 'bar' | 'mini' | 'desktop'

function activeToolbarMode(mode: DisplayState['mode'], maximized: boolean, fullscreen: boolean): ToolbarMode {
  if (mode === 'bar' || mode === 'mini' || mode === 'desktop') return mode
  return maximized || fullscreen ? 'full' : 'windowed'
}

const modeOptions: Array<{ id: ToolbarMode; label: string; menu: string; title: string; icon: typeof Monitor }> = [
  { id: 'windowed', label: 'Windowed', menu: 'Windowed', title: 'Resizable dashboard window', icon: Square },
  { id: 'full', label: 'Full', menu: 'Full', title: 'Maximized full dashboard', icon: LayoutDashboard },
  { id: 'bar', label: 'Bar', menu: 'Bar', title: 'Compact horizontal monitoring bar', icon: Monitor },
  { id: 'mini', label: 'Mini', menu: 'Mini', title: 'Floating mini monitor', icon: PictureInPicture2 },
  { id: 'desktop', label: 'Desktop', menu: 'Desktop Background', title: 'Full dashboard behind other windows', icon: Maximize2 },
]

function ModeSwitcher({ mode, compact, onChange }: {
  mode: ToolbarMode; compact: boolean; onChange(mode: ToolbarMode): void
}) {
  if (compact) {
    return (
      <select className="mode-select" aria-label="Display mode" title="Display mode" value={mode}
        onChange={event => onChange(event.target.value as ToolbarMode)}>
        {modeOptions.map(option => <option key={option.id} value={option.id}>{option.menu}</option>)}
      </select>
    )
  }
  return (
    <div className="mode-switch" role="tablist" aria-label="Display mode">
      {modeOptions.map(option => {
        const Icon = option.icon
        return (
          <button key={option.id} type="button" role="tab" aria-selected={mode === option.id} title={option.title}
            className={mode === option.id ? 'is-active' : ''}
            onClick={() => onChange(option.id)}>
            <Icon />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function WindowControls() {
  return <div className="window-controls">
    <button title="Minimize" aria-label="Minimize" onClick={() => void window.computerMonitor?.minimize()}><Minus /></button>
    <button title="Maximize" aria-label="Maximize or restore"
      onClick={() => void window.computerMonitor?.toggleMaximize()}><Maximize2 /></button>
    <button className="window-controls__close" title="Close" aria-label="Close"
      onClick={() => void window.computerMonitor?.close()}><X /></button>
  </div>
}

function statusDetail(state: ConnectionState, lastUpdate: string) {
  if (state === 'live') return `Sensors updating · ${lastUpdate}`
  if (state === 'reconnecting') return 'Trying to reach the local sensor service'
  if (state === 'offline') return 'Sensor service is not connected'
  return 'Starting the local sensor service'
}

const HardwareCard = memo(function HardwareCard({ title, name, tone, icon, children }: {
  title: string; name: string; tone: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return <article className={`hardware-card hardware-card--${tone}`}>
    <header><div className="card__icon">{icon}</div><div><span className="eyebrow">{title}</span><h2 title={name}>{name}</h2></div></header>
    <div className="hardware-card__body">{children}</div>
  </article>
})

const CompactCard = memo(function CompactCard({ title, subtitle, tone, icon, children }: {
  title: string; subtitle: string; tone: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return <article className={`compact-card compact-card--${tone}`}>
    <header><div className="card__icon">{icon}</div><div><span className="eyebrow">{title}</span><h3 title={subtitle}>{subtitle}</h3></div></header>
    <div className="compact-card__body">{children}</div>
  </article>
})

function MetricLine({ label, value }: { label: string; value: string }) {
  return <div className="metric-line"><span>{label}</span><strong>{value}</strong></div>
}

function formatPercent(value: number | null | undefined) {
  return value == null ? 'N/A' : `${Math.round(value)}%`
}

export function thermalClass(state: ThermalState) {
  return `thermal--${state}`
}
