import { Cpu, Database, Expand, Gauge, MemoryStick, Settings, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NeonGauge } from './components/NeonGauge'
import { SettingsPanel } from './components/SettingsPanel'
import { ThermalStatus } from './components/ThermalStatus'
import { useTelemetry } from './hooks/useTelemetry'
import type { AppSettings, ThermalState } from './types'

const defaultSettings: AppSettings = {
  refreshIntervalMs: 1000,
  rgbIntensity: 75,
  reducedMotion: false,
  fullscreen: false,
  showTrayIcon: true,
  minimizeToTray: false,
  launchAtStartup: false,
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
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings
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
  // Apply startup preference once; later changes are applied when saved.
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

  return (
    <main className={settings.reducedMotion ? 'app reduced-motion' : 'app'}
      style={{ '--rgb-intensity': settings.rgbIntensity / 100 } as React.CSSProperties}>
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark"><Zap /></div>
          <div><span className="eyebrow">SYSTEM TELEMETRY</span><h1>COMPUTER <b>MONITOR DASHBOARD</b></h1></div>
        </div>
        <div className="topbar__actions">
          <div className={`live-status live-status--${state}`}>
            <i /><span>{state === 'live' ? 'LIVE MONITORING' : state.toUpperCase()}</span>
            <small>{lastUpdate}</small>
          </div>
          <button className="icon-button" onClick={() => void window.computerMonitor?.toggleFullscreen()} aria-label="Toggle fullscreen"><Expand /></button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings /></button>
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

      {settingsOpen && <SettingsPanel value={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />}
    </main>
  )
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

export function thermalClass(state: ThermalState) {
  return `thermal--${state}`
}
