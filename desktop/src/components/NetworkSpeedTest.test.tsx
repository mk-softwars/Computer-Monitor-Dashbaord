import { act, fireEvent, render, screen } from '@testing-library/react'
import { NetworkSpeedTest } from './NetworkSpeedTest'

describe('NetworkSpeedTest', () => {
  afterEach(() => {
    delete window.computerMonitor
  })

  it('stays Ready until clicked and does not treat live adapter Mbps as the result', () => {
    const start = vi.fn().mockResolvedValue({ phase: 'testing' })
    render(<NetworkSpeedTest />)
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(start).not.toHaveBeenCalled()
    expect(screen.queryByText(/Download speed:/)).not.toBeInTheDocument()
  })

  it('shows Testing, disables repeat clicks, then keeps the measured result', () => {
    let emit: (progress: { phase: string; mbps?: number }) => void = () => {}
    const start = vi.fn().mockResolvedValue({ phase: 'testing' })
    window.computerMonitor = {
      startSpeedTest: start,
      cancelSpeedTest: vi.fn(),
      onSpeedTestProgress: (callback: (progress: { phase: string; mbps?: number }) => void) => {
        emit = callback
        return () => {}
      },
    } as unknown as NonNullable<typeof window.computerMonitor>

    render(<NetworkSpeedTest />)
    fireEvent.click(screen.getByRole('button', { name: 'Test Internet Speed' }))
    expect(start).toHaveBeenCalledTimes(1)
    act(() => { emit({ phase: 'testing' }) })
    expect(screen.getByText('Testing...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test Internet Speed' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel internet speed test' })).toBeEnabled()
    act(() => { emit({ phase: 'complete', mbps: 47.236 }) })
    expect(screen.getByText('Download speed: 47.24 Mbps')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Test Internet Speed' })).toBeEnabled()
  })

  it('shows Failed and Retry without fabricating a speed', () => {
    let emit: (progress: { phase: string; mbps?: number }) => void = () => {}
    window.computerMonitor = {
      startSpeedTest: vi.fn().mockResolvedValue({ phase: 'failed' }),
      cancelSpeedTest: vi.fn(),
      onSpeedTestProgress: (callback: (progress: { phase: string; mbps?: number }) => void) => {
        emit = callback
        return () => {}
      },
    } as unknown as NonNullable<typeof window.computerMonitor>

    render(<NetworkSpeedTest />)
    fireEvent.click(screen.getByRole('button', { name: 'Test Internet Speed' }))
    act(() => { emit({ phase: 'failed' }) })
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry internet speed test' })).toBeEnabled()
    expect(screen.queryByText(/Download speed:/)).not.toBeInTheDocument()
  })
})
