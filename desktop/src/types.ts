export type ThermalState = 'unavailable' | 'normal' | 'warm' | 'hot'

export interface TelemetrySnapshot {
  timestamp: string
  cpu: {
    name: string
    usagePercent: number
    temperatureCelsius: number | null
    thermalState: ThermalState
    coreUsagePercent: number[]
  }
  gpus: Array<{
    id: string
    name: string
    usagePercent: number | null
    temperatureCelsius: number | null
    hotspotTemperatureCelsius: number | null
    vramUsagePercent: number | null
    thermalState: ThermalState
    hotspotThermalState: ThermalState
  }>
  memory: {
    usagePercent: number
    temperatureCelsius: number | null
    thermalState: ThermalState
  }
  storage: Array<{
    id: string
    name: string
    driveLetters: string
    kind: string
    usedPercent: number
    temperatureCelsius: number | null
    thermalState: ThermalState
  }>
  health: {
    status: string
    elevated: boolean
    notes: string[]
  }
}

export interface Threshold {
  warm: number
  hot: number
}

export interface AppSettings {
  refreshIntervalMs: number
  rgbIntensity: number
  reducedMotion: boolean
  fullscreen: boolean
  showTrayIcon: boolean
  minimizeToTray: boolean
  launchAtStartup: boolean
  thresholds: Record<string, Threshold>
}

export interface MonitorConnection {
  endpoint: string
  token: string
}

declare global {
  interface Window {
    computerMonitor?: {
      getMonitorConnection(): Promise<MonitorConnection | null>
      toggleFullscreen(): Promise<boolean>
      setFullscreen(enabled: boolean): Promise<boolean>
      setTrayEnabled(enabled: boolean): Promise<boolean>
      setMinimizeToTray(enabled: boolean): Promise<boolean>
      setLaunchAtStartup(enabled: boolean): Promise<boolean>
      getDesktopPreferences(): Promise<{
        launchAtStartup: boolean
        trayEnabled: boolean
        minimizeToTray: boolean
      }>
      onMonitorChanged(callback: () => void): () => void
    }
  }
}
