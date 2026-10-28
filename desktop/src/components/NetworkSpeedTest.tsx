import { useEffect, useState } from 'react'
import { formatSpeedTestMbps, type SpeedTestPhase } from '../internetSpeedTest'

export function NetworkSpeedTest() {
  const [phase, setPhase] = useState<SpeedTestPhase>('ready')
  const [mbps, setMbps] = useState<number | null>(null)

  useEffect(() => {
    return window.computerMonitor?.onSpeedTestProgress(progress => {
      if (progress.phase === 'complete' && progress.mbps != null) {
        setMbps(progress.mbps)
        setPhase('complete')
        return
      }
      if (progress.phase === 'cancelled') {
        setMbps(current => {
          setPhase(current != null ? 'complete' : 'ready')
          return current
        })
        return
      }
      setPhase(progress.phase as SpeedTestPhase)
    })
  }, [])

  const testing = phase === 'testing'
  const failed = phase === 'failed'
  const status = testing
    ? 'Testing...'
    : failed
      ? 'Failed'
      : mbps != null
        ? `Download speed: ${formatSpeedTestMbps(mbps)} Mbps`
        : 'Ready'

  return (
    <div className="network-speed-test">
      <p className={`network-speed-test__status${mbps != null && !testing && !failed ? ' is-result' : ''}`}
        role="status" aria-live="polite">
        {status}
      </p>
      <div className="network-speed-test__actions">
        <button type="button" className="button network-speed-test__button"
          aria-label={failed ? 'Retry internet speed test' : 'Test Internet Speed'}
          disabled={testing}
          onClick={() => { void window.computerMonitor?.startSpeedTest() }}>
          {failed ? 'Retry' : 'Test Internet Speed'}
        </button>
        {testing && (
          <button type="button" className="button network-speed-test__button"
            aria-label="Cancel internet speed test"
            onClick={() => { void window.computerMonitor?.cancelSpeedTest() }}>
            Cancel
          </button>
        )}
      </div>
      <small>
        Uses internet data (up to 9 MB). Result is an estimate, not the live Downloading value.
        Tests run only when you click.
      </small>
    </div>
  )
}
