import { render, screen } from '@testing-library/react'
import { NeonGauge } from './NeonGauge'
import { ThermalStatus } from './ThermalStatus'

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
})
