export type ThermalState = 'unavailable' | 'normal' | 'warm' | 'hot'
export type DisplayMode = 'full' | 'bar' | 'mini' | 'desktop'

export interface DisplayState {
  mode: DisplayMode
  alwaysOnTop: boolean
  locked: boolean
  clickThrough: boolean
  opacity: number
  panelTransparent: boolean
  glassBlur: boolean
  subtleFrame: boolean
  textScale: number
  sizePreset: 'compact' | 'normal' | 'custom'
  launchLastMode: boolean
  preferredDisplayId: number | null
  defaultMode: DisplayMode
  rememberPosition: boolean
  overlayAnchor: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  clickThroughShortcut: string
  clickThroughApplied?: boolean
  clickThroughReady?: boolean
  clickThroughShortcutLabel?: string
  clickThroughError?: string
}

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
  uiScale: number
  thermalAlerts: boolean
  display: DisplayState
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
      minimize(): Promise<void>
      toggleMaximize(): Promise<boolean>
      close(): Promise<void>
      prepareSettings(): Promise<boolean>
      restoreAfterSettings(): Promise<boolean>
      getDesktopPreferences(): Promise<{
        launchAtStartup: boolean
        trayEnabled: boolean
        minimizeToTray: boolean
      }>
      getDisplayState(): Promise<DisplayState>
      setDisplayState(patch: Partial<DisplayState>): Promise<DisplayState>
      setPointerPassthrough(passthrough: boolean): void
      setSizePreset(preset: 'compact' | 'normal'): Promise<{ width: number; height: number } | null>
      resetOverlayPosition(): Promise<{ x: number; y: number; width: number; height: number } | null>
      resetWindowLayout(): Promise<boolean>
      getWindowChrome(): Promise<{ maximized: boolean; fullscreen: boolean }>
      setMaximized(enabled: boolean): Promise<boolean>
      listDisplays(): Promise<Array<{ id: number; label: string; primary: boolean }>>
      onDisplayStateChanged(callback: (state: DisplayState) => void): () => void
      onWindowChromeChanged(callback: (chrome: { maximized: boolean; fullscreen: boolean }) => void): () => void
      onOpenSettings(callback: () => void): () => void
      onMonitorChanged(callback: () => void): () => void
    }
  }
}
