import { X } from 'lucide-react'
import { useState } from 'react'
import type { AppSettings } from '../types'

interface SettingsPanelProps {
  value: AppSettings
  onSave(value: AppSettings): void
  onPreview?(value: AppSettings): void
  onClose(): void
}

const thresholdLabels: Record<string, string> = {
  cpu: 'CPU package',
  gpu: 'GPU core',
  gpuHotspot: 'GPU hotspot',
  ssd: 'Solid-state drive',
  hdd: 'Hard disk',
  ram: 'Memory modules',
}

function transparencyPercent(opacity: number) {
  return Math.round((1 - Math.max(.2, Math.min(1, opacity))) * 100)
}

export function SettingsPanel({ value, onSave, onPreview, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState(value)
  const updateThreshold = (key: string, field: 'warm' | 'hot', number: number) =>
    setDraft(current => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [key]: { ...current.thresholds[key], [field]: number },
      },
    }))
  const updateDisplay = (patch: Partial<AppSettings['display']>, preview = true) => setDraft(current => {
    const next = { ...current, display: { ...current.display, ...patch } }
    if (preview) onPreview?.(next)
    return next
  })

  return (
    <div className="settings-backdrop" data-click-through-control role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div><span className="eyebrow">SYSTEM CONFIGURATION</span><h2 id="settings-title">Monitor settings</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X /></button>
        </header>

        <label className="setting-row">
          <span><strong>Refresh interval</strong><small>Sensor sampling frequency</small></span>
          <select value={draft.refreshIntervalMs} onChange={e => setDraft({ ...draft, refreshIntervalMs: Number(e.target.value) })}>
            <option value={500}>0.5 seconds</option>
            <option value={1000}>1 second</option>
            <option value={2000}>2 seconds</option>
            <option value={5000}>5 seconds</option>
          </select>
        </label>
        <label className="setting-row setting-row--slider">
          <span><strong>RGB intensity</strong><small>Ambient lighting strength</small></span>
          <input type="range" min="0" max="100" value={draft.rgbIntensity}
            onChange={e => setDraft({ ...draft, rgbIntensity: Number(e.target.value) })} />
          <output>{draft.rgbIntensity}%</output>
        </label>
        <label className="setting-row">
          <span><strong>Reduced motion</strong><small>Disable gauge and ambient animation</small></span>
          <input type="checkbox" checked={draft.reducedMotion}
            onChange={e => setDraft({ ...draft, reducedMotion: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span><strong>Launch fullscreen</strong><small>Use immersive command-center mode</small></span>
          <input type="checkbox" checked={draft.fullscreen}
            onChange={e => setDraft({ ...draft, fullscreen: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span><strong>System tray icon</strong><small>Open or exit the dashboard from the tray</small></span>
          <input type="checkbox" checked={draft.showTrayIcon}
            onChange={e => setDraft({ ...draft, showTrayIcon: e.target.checked, minimizeToTray: e.target.checked ? draft.minimizeToTray : false })} />
        </label>
        <label className="setting-row">
          <span><strong>Minimize to tray</strong><small>Hide the window instead of minimizing it</small></span>
          <input type="checkbox" checked={draft.minimizeToTray} disabled={!draft.showTrayIcon}
            onChange={e => setDraft({ ...draft, minimizeToTray: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span><strong>Launch with Windows</strong><small>Start automatically after you sign in</small></span>
          <input type="checkbox" checked={draft.launchAtStartup}
            onChange={e => setDraft({ ...draft, launchAtStartup: e.target.checked })} />
        </label>

        <div className="thresholds display-settings">
          <h3>Display mode</h3>
          <p>Switch between the full dashboard and compact Windows widgets.</p>
          <label className="setting-row">
            <span><strong>Mode</strong><small>Choose the active dashboard layout</small></span>
            <select value={draft.display.mode}
              onChange={e => updateDisplay({ mode: e.target.value as AppSettings['display']['mode'] }, false)}>
              <option value="full">Full Dashboard</option>
              <option value="bar">Floating Bar Monitor</option>
              <option value="mini">Floating Mini Monitor</option>
              <option value="desktop">Desktop Background Widget</option>
            </select>
          </label>
          <label className="setting-row setting-row--slider">
            <span><strong>Panel transparency</strong><small>0% is solid; 80% is highly see-through. Text stays readable.</small></span>
            <input type="range" min="0" max="80" step="1" aria-label="Panel transparency"
              value={transparencyPercent(draft.display.opacity)}
              onChange={e => updateDisplay({
                opacity: 1 - Number(e.target.value) / 100,
                panelTransparent: false,
              })} />
            <output>{transparencyPercent(draft.display.opacity)}%</output>
          </label>
          <label className="setting-row setting-row--slider">
            <span><strong>Text size</strong><small>Scale compact telemetry values</small></span>
            <input type="range" min="70" max="160" value={draft.display.textScale}
              onChange={e => updateDisplay({ textScale: Number(e.target.value) })} />
            <output>{draft.display.textScale}%</output>
          </label>
          <label className="setting-row">
            <span><strong>Widget size</strong><small>Custom size remains freely resizable</small></span>
            <select value={draft.display.sizePreset}
              onChange={e => updateDisplay({ sizePreset: e.target.value as AppSettings['display']['sizePreset'] })}>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="setting-row">
            <span><strong>Always on top</strong><small>Keep the floating monitor above other apps</small></span>
            <input type="checkbox" checked={draft.display.alwaysOnTop}
              onChange={e => updateDisplay({ alwaysOnTop: e.target.checked })} />
          </label>
          <label className="setting-row">
            <span><strong>Lock widget position</strong><small>Prevent movement and resizing in compact widget modes</small></span>
            <input type="checkbox" checked={draft.display.locked}
              onChange={e => updateDisplay({ locked: e.target.checked })} />
          </label>
          <label className="setting-row">
            <span><strong>Click through</strong><small>Floating bar and mini monitor only. Press Ctrl+Shift+F10 to disable.</small></span>
            <input type="checkbox"
              checked={draft.display.clickThrough && (draft.display.mode === 'bar' || draft.display.mode === 'mini')}
              disabled={draft.display.mode === 'full' || draft.display.mode === 'desktop'}
              onChange={e => updateDisplay({ clickThrough: e.target.checked }, false)} />
          </label>
          <label className="setting-row">
            <span><strong>Text-only mode</strong><small>Fully remove the panel; overrides the transparency level</small></span>
            <input type="checkbox" checked={draft.display.panelTransparent}
              onChange={e => updateDisplay({ panelTransparent: e.target.checked })} />
          </label>
          <label className="setting-row">
            <span><strong>Glass blur</strong><small>Use Windows acrylic material when available</small></span>
            <input type="checkbox" checked={draft.display.glassBlur}
              onChange={e => updateDisplay({ glassBlur: e.target.checked })} />
          </label>
          <label className="setting-row">
            <span><strong>Subtle frame</strong><small>Show a thin neon widget outline</small></span>
            <input type="checkbox" checked={draft.display.subtleFrame}
              onChange={e => updateDisplay({ subtleFrame: e.target.checked })} />
          </label>
          <label className="setting-row">
            <span><strong>Launch in last mode</strong><small>Otherwise open the full dashboard</small></span>
            <input type="checkbox" checked={draft.display.launchLastMode}
              onChange={e => updateDisplay({ launchLastMode: e.target.checked })} />
          </label>
        </div>

        <div className="thresholds">
          <h3>Thermal warning thresholds</h3>
          <p>Separate limits are applied to each hardware class.</p>
          {Object.entries(draft.thresholds).map(([key, threshold]) => (
            <div className="threshold-row" key={key}>
              <strong>{thresholdLabels[key] ?? key}</strong>
              <label>Warm <input type="number" min="20" max="115" value={threshold.warm}
                onChange={e => updateThreshold(key, 'warm', Number(e.target.value))} />°C</label>
              <label>Hot <input type="number" min="21" max="120" value={threshold.hot}
                onChange={e => updateThreshold(key, 'hot', Number(e.target.value))} />°C</label>
            </div>
          ))}
        </div>
        <footer>
          <button className="button button--ghost" onClick={onClose}>Cancel</button>
          <button className="button button--primary" onClick={() => { onSave(draft); onClose() }}>Save settings</button>
        </footer>
      </section>
    </div>
  )
}
