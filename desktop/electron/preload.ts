import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('computerMonitor', {
  getMonitorConnection: () => ipcRenderer.invoke('monitor:connection'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  setFullscreen: (enabled: boolean) => ipcRenderer.invoke('window:setFullscreen', enabled),
  setTrayEnabled: (enabled: boolean) => ipcRenderer.invoke('desktop:setTrayEnabled', enabled),
  setMinimizeToTray: (enabled: boolean) => ipcRenderer.invoke('desktop:setMinimizeToTray', enabled),
  setLaunchAtStartup: (enabled: boolean) => ipcRenderer.invoke('desktop:setLaunchAtStartup', enabled),
  getDesktopPreferences: () => ipcRenderer.invoke('desktop:getPreferences'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  prepareSettings: () => ipcRenderer.invoke('window:prepareSettings'),
  restoreAfterSettings: () => ipcRenderer.invoke('window:restoreAfterSettings'),
  getDisplayState: () => ipcRenderer.invoke('display:getState'),
  setDisplayState: (patch: unknown) => ipcRenderer.invoke('display:setState', patch),
  setPointerPassthrough: (passthrough: boolean) => ipcRenderer.send('display:setPointerPassthrough', passthrough),
  setSizePreset: (preset: 'compact' | 'normal') => ipcRenderer.invoke('display:setSizePreset', preset),
  resetOverlayPosition: () => ipcRenderer.invoke('display:resetOverlayPosition'),
  resetWindowLayout: () => ipcRenderer.invoke('window:resetLayout'),
  getWindowChrome: () => ipcRenderer.invoke('window:getChrome'),
  setMaximized: (enabled: boolean) => ipcRenderer.invoke('window:setMaximized', enabled),
  listDisplays: () => ipcRenderer.invoke('window:listDisplays'),
  onDisplayStateChanged: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('display-state-changed', handler)
    return () => ipcRenderer.removeListener('display-state-changed', handler)
  },
  onWindowChromeChanged: (callback: (chrome: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chrome: unknown) => callback(chrome)
    ipcRenderer.on('window-chrome-changed', handler)
    return () => ipcRenderer.removeListener('window-chrome-changed', handler)
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('open-settings', handler)
    return () => ipcRenderer.removeListener('open-settings', handler)
  },
  startSpeedTest: () => ipcRenderer.invoke('speedtest:start'),
  cancelSpeedTest: () => ipcRenderer.invoke('speedtest:cancel'),
  onSpeedTestProgress: (callback: (progress: { phase: string; mbps?: number; error?: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { phase: string; mbps?: number; error?: string }) => callback(progress)
    ipcRenderer.on('speedtest:progress', handler)
    return () => ipcRenderer.removeListener('speedtest:progress', handler)
  },
  onMonitorChanged: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('monitor-ready', handler)
    ipcRenderer.on('monitor-stopped', handler)
    return () => {
      ipcRenderer.removeListener('monitor-ready', handler)
      ipcRenderer.removeListener('monitor-stopped', handler)
    }
  },
})
