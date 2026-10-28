import { X } from 'lucide-react'
import { useState } from 'react'
import type { AppSettings } from '../types'

interface SettingsPanelProps {
  value: AppSettings
  onSave(value: AppSettings): void
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

export function SettingsPanel({ value, onSave, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState(value)
  const updateThreshold = (key: string, field: 'warm' | 'hot', number: number) =>
    setDraft(current => ({
      ...current,
      thresholds: {
        ...current.thresholds,
        [key]: { ...current.thresholds[key], [field]: number },
      },
    }))

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={(event) => {
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
