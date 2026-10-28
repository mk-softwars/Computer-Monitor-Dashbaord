import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('computerMonitor', {
  getMonitorConnection: () => ipcRenderer.invoke('monitor:connection'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  setFullscreen: (enabled: boolean) => ipcRenderer.invoke('window:setFullscreen', enabled),
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
