import { useCallback, useEffect, useRef, useState } from 'react'
import type { MonitorConnection, TelemetrySnapshot } from '../types'

export type ConnectionState = 'starting' | 'live' | 'reconnecting' | 'offline'

export function useTelemetry() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [state, setState] = useState<ConnectionState>('starting')
  const [connection, setConnection] = useState<MonitorConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | undefined>(undefined)

  const connect = useCallback(async () => {
    window.clearTimeout(retryRef.current)
    socketRef.current?.close()
    const details = await window.computerMonitor?.getMonitorConnection()
    if (!details) {
      setState('starting')
      retryRef.current = window.setTimeout(connect, 1000)
      return
    }
    setConnection(details)
    setState(previous => previous === 'live' ? 'reconnecting' : 'starting')
    const wsUrl = details.endpoint.replace(/^http/, 'ws') + `/ws?token=${encodeURIComponent(details.token)}`
    const socket = new WebSocket(wsUrl)
    socketRef.current = socket
    socket.onopen = () => setState('live')
    socket.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as TelemetrySnapshot)
        setState('live')
      } catch {
        setState('reconnecting')
      }
    }
    socket.onclose = () => {
      setState('reconnecting')
      retryRef.current = window.setTimeout(connect, 1500)
    }
    socket.onerror = () => socket.close()
  }, [])

  useEffect(() => {
    void connect()
    const unsubscribe = window.computerMonitor?.onMonitorChanged(() => void connect())
    return () => {
      unsubscribe?.()
      window.clearTimeout(retryRef.current)
      socketRef.current?.close()
    }
  }, [connect])

  return { snapshot, state, connection }
}
