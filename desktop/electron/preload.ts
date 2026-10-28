import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('computerMonitor', {
  getMonitorConnection: () => ipcRenderer.invoke('monitor:connection'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  setFullscreen: (enabled: boolean) => ipcRenderer.invoke('window:setFullscreen', enabled),
  setTrayEnabled: (enabled: boolean) => ipcRenderer.invoke('desktop:setTrayEnabled', enabled),
  setMinimizeToTray: (enabled: boolean) => ipcRenderer.invoke('desktop:setMinimizeToTray', enabled),
  setLaunchAtStartup: (enabled: boolean) => ipcRenderer.invoke('desktop:setLaunchAtStartup', enabled),
  getDesktopPreferences: () => ipcRenderer.invoke('desktop:getPreferences'),
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
