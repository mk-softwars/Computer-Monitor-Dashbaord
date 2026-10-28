import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { applyTheme, DEFAULT_THEME, normalizeTheme, type AppTheme } from '../theme'
import type { AppSettings, DisplayState } from '../types'
import { ThemePicker } from './ThemePicker'

interface SettingsPanelProps {
  value: AppSettings
  sensorStatus: string
  displays: Array<{ id: number; label: string; primary: boolean }>
  networkAdapters?: Array<{ id: string; name: string; kind: string; connected: boolean }>
  onChange(value: AppSettings): void | Promise<void>
  onClose(): void | Promise<void>
  onResetLayout(): void
}

const APP_VERSION = '1.1.0'
const categories = [
  { id: 'general', label: 'General' },
  { id: 'display', label: 'Display' },
  { id: 'overlay', label: 'Gaming Overlay' },
  { id: 'network', label: 'Network' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'thermal', label: 'Temperature' },
  { id: 'about', label: 'About' },
] as const

const thresholdLabels: Record<string, string> = {
  cpu: 'CPU package',
  gpu: 'GPU core',
  gpuHotspot: 'GPU hotspot',
  ssd: 'Solid-state drive',
  hdd: 'Hard disk',
  ram: 'Memory modules',
}

const defaultThresholds: AppSettings['thresholds'] = {
  cpu: { warm: 75, hot: 90 },
  gpu: { warm: 75, hot: 88 },
  gpuHotspot: { warm: 90, hot: 105 },
  ssd: { warm: 55, hot: 70 },
  hdd: { warm: 45, hot: 55 },
  ram: { warm: 60, hot: 75 },
}

export function defaultAppSettings(): AppSettings {
  return {
    refreshIntervalMs: 1000,
    rgbIntensity: 75,
    reducedMotion: false,
    fullscreen: false,
    showTrayIcon: true,
    minimizeToTray: false,
    launchAtStartup: false,
    uiScale: 100,
    thermalAlerts: true,
    theme: DEFAULT_THEME,
    display: {
      mode: 'full',
      alwaysOnTop: false,
      locked: false,
      clickThrough: false,
      opacity: .9,
      panelTransparent: false,
      glassBlur: false,
      subtleFrame: true,
      textScale: 100,
      sizePreset: 'normal',
      launchLastMode: true,
      preferredDisplayId: null,
      defaultMode: 'full',
      rememberPosition: true,
      overlayAnchor: 'top-right',
      clickThroughShortcut: 'CommandOrControl+Shift+F10',
    },
    thresholds: structuredClone(defaultThresholds),
    network: {
      enabled: true,
      adapterId: null,
      showDownload: true,
      showUpload: true,
      showInBar: false,
      showInMini: false,
    },
  }
}

export function SettingsPanel({ value, sensorStatus, displays, networkAdapters = [], onChange, onClose, onResetLayout }: SettingsPanelProps) {
  const [draft, setDraft] = useState(value)
  const [category, setCategory] = useState<(typeof categories)[number]['id']>('general')
  const skip = useRef(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setDraft(current => {
      const display = value.display
      if (
        current.display.clickThrough === display.clickThrough
        && current.display.clickThroughShortcut === display.clickThroughShortcut
        && current.display.clickThroughError === display.clickThroughError
        && current.display.clickThroughReady === display.clickThroughReady
        && current.display.clickThroughApplied === display.clickThroughApplied
        && current.display.clickThroughShortcutLabel === display.clickThroughShortcutLabel
      ) return current
      return {
        ...current,
        display: {
          ...current.display,
          clickThrough: display.clickThrough,
          clickThroughShortcut: display.clickThroughShortcut,
          clickThroughError: display.clickThroughError,
          clickThroughReady: display.clickThroughReady,
          clickThroughApplied: display.clickThroughApplied,
          clickThroughShortcutLabel: display.clickThroughShortcutLabel,
        },
      }
    })
  }, [
    value.display.clickThrough,
    value.display.clickThroughShortcut,
    value.display.clickThroughError,
    value.display.clickThroughReady,
    value.display.clickThroughApplied,
    value.display.clickThroughShortcutLabel,
  ])

  useEffect(() => {
    if (skip.current) {
      skip.current = false
      return
    }
    const timer = window.setTimeout(() => { void onChange(draft) }, 160)
    return () => window.clearTimeout(timer)
  }, [draft, onChange])

  const patch = (next: Partial<AppSettings>) => setDraft(current => ({ ...current, ...next }))
  const patchDisplay = (next: Partial<DisplayState>) => setDraft(current => ({
    ...current,
    display: { ...current.display, ...next },
  }))
  const patchNetwork = (next: Partial<AppSettings['network']>) => setDraft(current => ({
    ...current,
    network: { ...current.network, ...next },
  }))
  const patchThreshold = (key: string, field: 'warm' | 'hot', number: number) =>
    setDraft(current => ({
      ...current,
      thresholds: { ...current.thresholds, [key]: { ...current.thresholds[key], [field]: number } },
    }))

  return (
    <div className="settings-backdrop" data-click-through-control role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div><span className="eyebrow">SYSTEM CONFIGURATION</span><h2 id="settings-title">Monitor settings</h2></div>
          <button className="icon-button" onClick={onClose} title="Close settings" aria-label="Close settings"><X /></button>
        </header>
        <div className="settings-shell">
          <nav className="settings-nav" aria-label="Settings categories">
            {categories.map(item => (
              <button key={item.id} type="button" className={category === item.id ? 'is-active' : ''}
                onClick={() => setCategory(item.id)}>{item.label}</button>
            ))}
          </nav>
          <div className="settings-body">
            {category === 'general' && <>
              <Row label="Start with Windows" hint="Open after you sign in to Windows">
                <input type="checkbox" checked={draft.launchAtStartup}
                  onChange={e => patch({ launchAtStartup: e.target.checked })} />
              </Row>
              <Row label="System tray icon" hint="Needed to restore the dashboard from the tray">
                <input type="checkbox" checked={draft.showTrayIcon}
                  onChange={e => patch({ showTrayIcon: e.target.checked, minimizeToTray: e.target.checked ? draft.minimizeToTray : false })} />
              </Row>
              <Row label="Minimize to tray" hint="Close hides the window instead of exiting">
                <input type="checkbox" checked={draft.minimizeToTray} disabled={!draft.showTrayIcon}
                  onChange={e => patch({ minimizeToTray: e.target.checked })} />
              </Row>
              <Row label="Monitoring refresh" hint="How often hardware readings update">
                <select aria-label="Monitoring refresh" value={draft.refreshIntervalMs}
                  onChange={e => patch({ refreshIntervalMs: Number(e.target.value) })}>
                  <option value={500}>0.5 seconds</option>
                  <option value={1000}>1 second</option>
                  <option value={2000}>2 seconds</option>
                  <option value={5000}>5 seconds</option>
                </select>
              </Row>
            </>}
            {category === 'display' && <>
              <Row label="Default display mode" hint="Used when Remember last view is off">
                <select aria-label="Default display mode" value={draft.display.defaultMode}
                  onChange={e => patchDisplay({ defaultMode: e.target.value as DisplayState['mode'] })}>
                  <option value="full">Windowed</option>
                  <option value="bar">Bar</option>
                  <option value="mini">Mini</option>
                  <option value="desktop">Desktop Background</option>
                </select>
              </Row>
              <Row label="Remember last view" hint="Reopen the last Full, Windowed, Bar, Mini, or Desktop mode">
                <input type="checkbox" checked={draft.display.launchLastMode}
                  onChange={e => patchDisplay({ launchLastMode: e.target.checked })} />
              </Row>
              <Row label="Remember window size and position" hint="Restore the last window place on this PC">
                <input type="checkbox" checked={draft.display.rememberPosition}
                  onChange={e => patchDisplay({ rememberPosition: e.target.checked })} />
              </Row>
              <Row label="Select monitor" hint="Preferred screen for widgets and desktop mode">
                <select aria-label="Select monitor" value={draft.display.preferredDisplayId ?? ''}
                  onChange={e => patchDisplay({ preferredDisplayId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Primary screen</option>
                  {displays.map(display => (
                    <option key={display.id} value={display.id}>
                      {display.label || `Display ${display.id}`}{display.primary ? ' (primary)' : ''}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Bar and Mini size" hint="Compact, normal, or keep a custom size">
                <select aria-label="Bar and Mini size" value={draft.display.sizePreset}
                  onChange={e => patchDisplay({ sizePreset: e.target.value as DisplayState['sizePreset'] })}>
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="custom">Custom</option>
                </select>
              </Row>
              <p className="settings-note">Desktop Background shows the full dashboard behind other windows. It does not change the Windows wallpaper. Restore from the tray.</p>
              <button type="button" className="button" onClick={onResetLayout}>Reset window position</button>
            </>}
            {category === 'overlay' && <>
              <Row label="Always on Top" hint="Keep Bar and Mini above ordinary Windows apps">
                <input type="checkbox" checked={draft.display.alwaysOnTop}
                  onChange={e => patchDisplay({ alwaysOnTop: e.target.checked })} />
              </Row>
              <Slider label="Overlay Opacity" hint="Bar and Mini background only. 100% is solid, 10% is almost invisible." aria="Overlay Opacity"
                min={10} max={100} value={Math.round(draft.display.opacity * 100)} suffix="%"
                onChange={value => patchDisplay({ opacity: value / 100, panelTransparent: false })} />
              <button type="button" className="button" onClick={() => patchDisplay({ opacity: .9, panelTransparent: false })}>
                Reset to 90%
              </button>
              <Row label="Click-Through" hint="Mouse clicks pass through Bar and Mini onto the app underneath. Always on Top stays on. Turn it off from the tray or the shortcut below.">
                <input type="checkbox" aria-label="Click-Through"
                  checked={draft.display.clickThrough}
                  onChange={e => patchDisplay({ clickThrough: e.target.checked })} />
              </Row>
              <Row label="Click-Through shortcut" hint="Global shortcut to toggle Click-Through while Bar or Mini is showing">
                <select aria-label="Click-Through shortcut"
                  value={draft.display.clickThroughShortcut}
                  onChange={e => patchDisplay({ clickThroughShortcut: e.target.value })}>
                  <option value="CommandOrControl+Shift+F10">Ctrl+Shift+F10</option>
                  <option value="CommandOrControl+Shift+O">Ctrl+Shift+O</option>
                  <option value="CommandOrControl+Alt+C">Ctrl+Alt+C</option>
                </select>
              </Row>
              {draft.display.clickThroughError ? (
                <p className="settings-note" role="alert">{draft.display.clickThroughError}</p>
              ) : (
                <p className="settings-note">
                  Recovery: system tray “Disable Click-Through”, or {draft.display.clickThroughShortcutLabel
                    ?? 'Ctrl + Shift + F10'}. Native click-through applies on Bar and Mini after settings close.
                  Exclusive fullscreen games can cover this overlay; borderless windowed usually works. This app does
                  not inject input into games.
                </p>
              )}
              <Row label="Lock Position" hint="Prevent dragging and resizing Bar and Mini">
                <input type="checkbox" checked={draft.display.locked}
                  onChange={e => patchDisplay({ locked: e.target.checked })} />
              </Row>
              <p className="settings-note">
                Overlay Opacity does not change Full Dashboard or Desktop Background. Exclusive fullscreen games can
                cover this overlay; borderless windowed and borderless fullscreen usually work.
              </p>
              <button type="button" className="button" onClick={() => void window.computerMonitor?.resetOverlayPosition()}>
                Reset Overlay Position
              </button>
            </>}
            {category === 'network' && <>
              <Row label="Network Monitoring" hint="Read this PC’s Ethernet or Wi-Fi interface counters. No speed tests.">
                <input type="checkbox" aria-label="Network Monitoring" checked={draft.network.enabled}
                  onChange={e => patchNetwork({ enabled: e.target.checked })} />
              </Row>
              <Row label="Network Adapter" hint="Auto uses one active adapter so traffic is not double-counted">
                <select aria-label="Network Adapter" value={draft.network.adapterId ?? ''}
                  disabled={!draft.network.enabled}
                  onChange={e => patchNetwork({ adapterId: e.target.value || null })}>
                  <option value="">Auto</option>
                  {networkAdapters.map(adapter => (
                    <option key={adapter.id} value={adapter.id}>
                      {adapter.name} ({adapter.kind}{adapter.connected ? '' : ', disconnected'})
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Show Download Speed" hint="Dashboard card download value in Mbps">
                <input type="checkbox" aria-label="Show Download Speed" checked={draft.network.showDownload}
                  disabled={!draft.network.enabled}
                  onChange={e => patchNetwork({ showDownload: e.target.checked })} />
              </Row>
              <Row label="Show Upload Speed" hint="Dashboard card upload value in Mbps">
                <input type="checkbox" aria-label="Show Upload Speed" checked={draft.network.showUpload}
                  disabled={!draft.network.enabled}
                  onChange={e => patchNetwork({ showUpload: e.target.checked })} />
              </Row>
              <Row label="Show Network Metrics in Bar" hint="Adds a compact NET cell. Off keeps the original bar width">
                <input type="checkbox" aria-label="Show Network Metrics in Bar" checked={draft.network.showInBar}
                  disabled={!draft.network.enabled}
                  onChange={e => patchNetwork({ showInBar: e.target.checked })} />
              </Row>
              <Row label="Show Network Metrics in Mini" hint="Same compact NET cell on Mini">
                <input type="checkbox" aria-label="Show Network Metrics in Mini" checked={draft.network.showInMini}
                  disabled={!draft.network.enabled}
                  onChange={e => patchNetwork({ showInMini: e.target.checked })} />
              </Row>
              <p className="settings-note">
                Speeds are local interface counters, not an internet speed test. Idle links show 0.0 Mbps.
                Unavailable adapters show N/A. Virtual adapters are ignored.
              </p>
            </>}
            {category === 'appearance' && <>
              <p className="settings-note">Choose a visual theme. Original RGB is the default and keeps the current look. Changes apply immediately.</p>
              <ThemePicker value={normalizeTheme(draft.theme)} onChange={(theme: AppTheme) => {
                applyTheme(theme)
                patch({ theme })
              }} />
              <Slider label="RGB intensity" hint="Ambient lighting for Original RGB. 90s and Coding ignore this glow."
                aria="RGB intensity"
                min={0} max={100} value={draft.rgbIntensity} suffix="%"
                onChange={value => patch({ rgbIntensity: value })} />
              <Row label="Reduced motion" hint="Turn off gauge and ambient animation">
                <input type="checkbox" checked={draft.reducedMotion}
                  onChange={e => patch({ reducedMotion: e.target.checked })} />
              </Row>
            </>}
            {category === 'thermal' && <>
              {Object.entries(draft.thresholds).map(([key, threshold]) => (
                <div className="threshold-row" key={key}>
                  <strong>{thresholdLabels[key] ?? key}</strong>
                  <label>Warm <input type="number" min="20" max="115" value={threshold.warm}
                    onChange={e => patchThreshold(key, 'warm', Number(e.target.value))} />°C</label>
                  <label>Hot <input type="number" min="21" max="120" value={threshold.hot}
                    onChange={e => patchThreshold(key, 'hot', Number(e.target.value))} />°C</label>
                </div>
              ))}
              <button type="button" className="button" onClick={() => patch({ thresholds: structuredClone(defaultThresholds) })}>
                Reset recommended thresholds
              </button>
            </>}
            {category === 'about' && (
              <div className="about-block">
                <p><strong>Computer Monitor Dashboard</strong></p>
                <p>Version {APP_VERSION}</p>
                <p>GitHub repository: not configured on this copy</p>
                <p>Hardware sensors: {sensorStatus}</p>
                <p>This app does not send telemetry.</p>
              </div>
            )}
          </div>
        </div>
        <footer>
          <button className="button button--ghost" onClick={() => {
            skip.current = true
            const defaults = defaultAppSettings()
            applyTheme(defaults.theme)
            setDraft(defaults)
            void onChange(defaults)
          }}>
            Reset to defaults
          </button>
          <button className="button button--primary" onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="setting-row">
      <span><strong>{label}</strong><small>{hint}</small></span>
      {children}
    </label>
  )
}

function Slider({ label, hint, aria, min, max, step = 1, value, suffix, onChange }: {
  label: string; hint: string; aria: string; min: number; max: number; step?: number; value: number; suffix: string
  onChange(value: number): void
}) {
  return (
    <label className="setting-row setting-row--slider">
      <span><strong>{label}</strong><small>{hint}</small></span>
      <input type="range" min={min} max={max} step={step} aria-label={aria} value={value}
        onChange={e => onChange(Number(e.target.value))} />
      <output>{value}{suffix}</output>
    </label>
  )
}
