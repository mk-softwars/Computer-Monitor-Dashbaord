import { fireEvent, render, screen } from '@testing-library/react'
import type { TelemetrySnapshot } from '../types'
import { OverlayBar } from './OverlayBar'
import { NeonGauge } from './NeonGauge'
import { defaultAppSettings, normalizeAppSettings, SettingsPanel } from './SettingsPanel'
import { ThermalStatus } from './ThermalStatus'

const settings = defaultAppSettings()

describe('telemetry components', () => {
  afterEach(() => {
    document.documentElement.dataset.theme = 'rgb'
  })

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

  it('autosaves overlay opacity from grouped settings', async () => {
    const onChange = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={onChange} onClose={vi.fn()} onResetLayout={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gaming Overlay' }))
    fireEvent.change(screen.getByLabelText('Overlay Opacity'), { target: { value: '50' } })
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      display: expect.objectContaining({ opacity: .5, panelTransparent: false }),
    }))
  })

  it('closes settings with Escape', () => {
    const onClose = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={vi.fn()} onClose={onClose} onResetLayout={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes settings from the Done button after a theme change', () => {
    const onClose = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={vi.fn()} onClose={onClose} onResetLayout={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('radio', { name: '90s' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders a compact overlay bar without gauges', () => {
    const overlaySettings = {
      ...settings,
      display: { ...settings.display, mode: 'mini' as const, opacity: .9 },
    }
    render(<OverlayBar snapshot={snapshot} state="live" settings={overlaySettings} style={{}}
      settingsOpen={false} onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('GPU')).toBeInTheDocument()
    expect(screen.getByText('RAM')).toBeInTheDocument()
    expect(screen.getByText('VRAM')).toBeInTheDocument()
    expect(screen.getByText('SSD')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not stack a second overlay settings strip under Monitor settings', () => {
    const overlaySettings = {
      ...settings,
      display: { ...settings.display, mode: 'bar' as const, opacity: .9 },
    }
    render(<>
      <OverlayBar snapshot={snapshot} state="live" settings={overlaySettings} style={{}}
        settingsOpen onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />
      <SettingsPanel value={overlaySettings} sensorStatus="Live" displays={[]}
        onChange={vi.fn()} onClose={vi.fn()} onResetLayout={vi.fn()} />
    </>)
    expect(screen.queryByRole('dialog', { name: 'Overlay settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Monitor settings' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Gaming Overlay' }))
    expect(screen.getByLabelText('Overlay Opacity')).toHaveValue('90')
    expect(screen.getByLabelText('Click-Through')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Overlay Position' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to 90%' })).toBeInTheDocument()
  })

  it('lets Click-Through be enabled from full dashboard settings', async () => {
    const onChange = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={onChange} onClose={vi.fn()} onResetLayout={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gaming Overlay' }))
    const toggle = screen.getByLabelText('Click-Through')
    expect(toggle).toBeEnabled()
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      display: expect.objectContaining({ clickThrough: true }),
    }))
    expect(screen.getByLabelText('Click-Through shortcut')).toHaveDisplayValue('Ctrl+Shift+F10')
  })

  it('autosaves network adapter and overlay visibility settings', async () => {
    const onChange = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      networkAdapters={[{ id: 'nic-1', name: 'Ethernet', kind: 'Ethernet', connected: true }]}
      onChange={onChange} onClose={vi.fn()} onResetLayout={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Network' }))
    fireEvent.change(screen.getByLabelText('Network Adapter'), { target: { value: 'nic-1' } })
    fireEvent.click(screen.getByLabelText('Show Network Metrics in Bar'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      network: expect.objectContaining({ adapterId: 'nic-1', showInBar: true, enabled: true }),
    }))
  })

  it('enables full-dashboard network monitoring when older settings omit the network key', () => {
    const restored = normalizeAppSettings({ refreshIntervalMs: 1000 } as Partial<typeof settings>)
    expect(restored.network.enabled).toBe(true)
    expect(restored.network.showDownload).toBe(true)
    expect(restored.network.showUpload).toBe(true)
    expect(restored.network.showInBar).toBe(false)
    expect(restored.network.showInMini).toBe(false)
  })

  it('portals Settings onto document.body so Appearance is outside the dashboard drag region', () => {
    const { container } = render(
      <main className="app">
        <SettingsPanel value={settings} sensorStatus="Live" displays={[]}
          onChange={vi.fn()} onClose={vi.fn()} onResetLayout={vi.fn()} />
      </main>,
    )
    const backdrop = document.body.querySelector('.settings-backdrop')
    expect(backdrop).toBeInstanceOf(HTMLElement)
    expect(container.querySelector('.settings-backdrop')).toBeNull()
    expect(backdrop?.parentElement).toBe(document.body)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.getByRole('button', { name: 'Appearance' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'Original RGB' })).toBeInTheDocument()
    expect(screen.getByText(/Choose a visual theme/)).toBeInTheDocument()
  })

  it('opens every settings category from the navigation', () => {
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={vi.fn()} onClose={vi.fn()} onResetLayout={vi.fn()} />)
    const cases: Array<[string, string | RegExp]> = [
      ['Display', 'Default display mode'],
      ['Gaming Overlay', 'Always on Top'],
      ['Network', 'Network Monitoring'],
      ['Appearance', /Choose a visual theme/],
      ['Temperature', 'CPU package'],
      ['About', /github.com\/mk-softwars\/Computer-Monitor-Dashbaord/],
      ['General', 'Start with Windows'],
    ]
    for (const [name, expected] of cases) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText(expected)).toBeInTheDocument()
    }
  })

  it('shows Appearance theme choices when settings open over Bar or Mini', async () => {
    const overlaySettings = {
      ...settings,
      display: { ...settings.display, mode: 'bar' as const },
    }
    const onChange = vi.fn()
    render(<>
      <OverlayBar snapshot={snapshot} state="live" settings={overlaySettings} style={{}}
        settingsOpen onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />
      <SettingsPanel value={overlaySettings} sensorStatus="Live" displays={[]}
        onChange={onChange} onClose={vi.fn()} onResetLayout={vi.fn()} />
    </>)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.getByRole('radio', { name: 'Original RGB' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '90s' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Coding' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Coding' }))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'coding' })))
    expect(document.documentElement.dataset.theme).toBe('coding')
  })

  it('defaults to Original RGB and applies a selected theme from Appearance', async () => {
    const onChange = vi.fn()
    render(<SettingsPanel value={settings} sensorStatus="Live" displays={[]}
      onChange={onChange} onClose={vi.fn()} onResetLayout={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(settings.theme).toBe('rgb')
    expect(screen.getByRole('radio', { name: 'Original RGB' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '90s' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Coding' })).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('radio', { name: '90s' }))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'nineties' }))
    expect(document.documentElement.dataset.theme).toBe('nineties')
    fireEvent.keyDown(screen.getByRole('radio', { name: '90s' }), { key: 'ArrowRight' })
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ theme: 'coding' })))
  })

  it('keeps overlay metrics readable in the 90s theme', () => {
    const overlaySettings = {
      ...settings,
      theme: 'nineties' as const,
      display: { ...settings.display, mode: 'bar' as const },
    }
    render(<OverlayBar snapshot={snapshot} state="live" settings={overlaySettings} style={{}}
      settingsOpen={false} onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />)
    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument()
  })

  it('shows compact overlay network speeds only when enabled', () => {
    const overlaySettings = {
      ...settings,
      display: { ...settings.display, mode: 'bar' as const },
      network: { ...settings.network, showInBar: true },
    }
    const withNetwork = {
      ...snapshot,
      network: {
        enabled: true,
        adapterId: 'nic-1',
        adapterName: 'Ethernet',
        adapterKind: 'Ethernet',
        downloadMbps: 12.4,
        uploadMbps: 1.1,
        adapters: [],
      },
    }
    const { rerender } = render(<OverlayBar snapshot={withNetwork} state="live" settings={overlaySettings} style={{}}
      settingsOpen={false} onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />)
    expect(screen.getByText('NET')).toBeInTheDocument()
    expect(screen.getByText('12↓')).toBeInTheDocument()
    expect(screen.getByText('1.1↑')).toBeInTheDocument()
    rerender(<OverlayBar snapshot={withNetwork} state="live" settings={settings} style={{}}
      settingsOpen={false} onOpenSettings={vi.fn()} onCloseSettings={vi.fn()} />)
    expect(screen.queryByText('NET')).not.toBeInTheDocument()
  })
})

const snapshot: TelemetrySnapshot = {
  timestamp: '2026-10-28T17:00:00.000Z',
  cpu: {
    name: 'Intel Core i7-9700K',
    usagePercent: 63,
    temperatureCelsius: null,
    thermalState: 'unavailable',
    coreUsagePercent: [10, 20],
  },
  gpus: [{
    id: 'gpu-0',
    name: 'NVIDIA GeForce RTX 2070',
    usagePercent: 29,
    temperatureCelsius: 34,
    hotspotTemperatureCelsius: 52,
    vramUsagePercent: 4,
    thermalState: 'normal',
    hotspotThermalState: 'normal',
  }],
  memory: { usagePercent: 59, temperatureCelsius: null, thermalState: 'unavailable' },
  storage: [{
    id: 'ssd-0',
    name: 'Local Disk',
    driveLetters: 'C:',
    kind: 'SSD',
    usedPercent: 75,
    temperatureCelsius: null,
    thermalState: 'unavailable',
  }],
  health: { status: 'ok', elevated: false, notes: [] },
}
