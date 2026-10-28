import { useCallback, useEffect, useRef, useState } from 'react'
import type { MonitorConnection, TelemetrySnapshot } from '../types'

export type ConnectionState = 'starting' | 'live' | 'reconnecting' | 'offline'

export function useTelemetry() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null)
  const [state, setState] = useState<ConnectionState>('starting')
  const [connection, setConnection] = useState<MonitorConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<number | undefined>(undefined)
  const connectionAttemptRef = useRef(0)

  const connect = useCallback(async () => {
    const attempt = ++connectionAttemptRef.current
    window.clearTimeout(retryRef.current)
    const previous = socketRef.current
    if (previous) {
      socketRef.current = null
      previous.onopen = null
      previous.onmessage = null
      previous.onclose = null
      previous.onerror = null
      previous.close()
    }
    const details = await window.computerMonitor?.getMonitorConnection()
    if (attempt !== connectionAttemptRef.current) return
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
    socket.onopen = () => {
      if (socketRef.current === socket) setState('live')
    }
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return
      try {
        setSnapshot(JSON.parse(event.data) as TelemetrySnapshot)
        setState('live')
      } catch {
        setState('reconnecting')
      }
    }
    socket.onclose = () => {
      if (socketRef.current !== socket) return
      socketRef.current = null
      setState('reconnecting')
      retryRef.current = window.setTimeout(connect, 1500)
    }
    socket.onerror = () => {
      if (socketRef.current === socket) socket.close()
    }
  }, [])

  useEffect(() => {
    void connect()
    const unsubscribe = window.computerMonitor?.onMonitorChanged(() => void connect())
    return () => {
      unsubscribe?.()
      connectionAttemptRef.current += 1
      window.clearTimeout(retryRef.current)
      const socket = socketRef.current
      socketRef.current = null
      if (socket) {
        socket.onopen = null
        socket.onmessage = null
        socket.onclose = null
        socket.onerror = null
        socket.close()
      }
    }
  }, [connect])

  return { snapshot, state, connection }
}
