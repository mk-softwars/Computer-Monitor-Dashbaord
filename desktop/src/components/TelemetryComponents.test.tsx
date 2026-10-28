import { fireEvent, render, screen } from '@testing-library/react'
import type { AppSettings } from '../types'
import { NeonGauge } from './NeonGauge'
import { SettingsPanel } from './SettingsPanel'
import { ThermalStatus } from './ThermalStatus'

const settings: AppSettings = {
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

describe('telemetry components', () => {
  it('clearly renders unavailable readings', () => {
    render(<><NeonGauge value={null} label="GPU LOAD" tone="purple" />
      <ThermalStatus value={null} state="unavailable" /></>)
    expect(screen.getAllByText('N/A')).toHaveLength(2)
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName('GPU LOAD: unavailable')
  })

  it('renders real percentages and hot status', () => {
    render(<><NeonGauge value={87.6} label="CPU LOAD" tone="blue" />
      <ThermalStatus value={94} state="hot" /></>)
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('94°C')).toBeInTheDocument()
    expect(screen.getByText('HOT')).toBeInTheDocument()
  })

  it('previews display mode and opacity controls immediately', () => {
    const onPreview = vi.fn()
    render(<SettingsPanel value={settings} onSave={vi.fn()} onPreview={onPreview} onClose={vi.fn()} />)
    const mode = screen.getByLabelText(/Mode/)
    expect(screen.getByRole('option', { name: 'Floating Bar Monitor' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Floating Mini Monitor' })).toBeInTheDocument()
    fireEvent.change(mode, { target: { value: 'mini' } })
    expect(mode).toHaveValue('mini')
    expect(onPreview).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/Click through/))
    expect(onPreview).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText(/^Panel transparency/), { target: { value: '0.55' } })
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      display: expect.objectContaining({ mode: 'mini', opacity: .55, panelTransparent: false }),
    }))
  })
})
