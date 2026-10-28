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
  getDisplayState: () => ipcRenderer.invoke('display:getState'),
  setDisplayState: (patch: unknown) => ipcRenderer.invoke('display:setState', patch),
  setPointerPassthrough: (passthrough: boolean) => ipcRenderer.send('display:setPointerPassthrough', passthrough),
  setSizePreset: (preset: 'compact' | 'normal') => ipcRenderer.invoke('display:setSizePreset', preset),
  onDisplayStateChanged: (callback: (state: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
    ipcRenderer.on('display-state-changed', handler)
    return () => ipcRenderer.removeListener('display-state-changed', handler)
  },
  onOpenSettings: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('open-settings', handler)
    return () => ipcRenderer.removeListener('open-settings', handler)
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
