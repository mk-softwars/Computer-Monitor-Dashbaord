import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null
let monitor: ChildProcessWithoutNullStreams | null = null
let endpoint: string | null = null
let screenshotCaptured = false
const sessionToken = randomBytes(32).toString('hex')

function captureDashboardIfRequested() {
  const target = process.env.DASHBOARD_SCREENSHOT_PATH
  if (!target || screenshotCaptured || !mainWindow) return
  screenshotCaptured = true
  setTimeout(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const image = await mainWindow.webContents.capturePage()
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, image.toPNG())
  }, 4000)
}

function startMonitor() {
  const isPackaged = app.isPackaged
  const localDotnet = path.resolve(__dirname, '../../.dotnet/dotnet.exe')
  const executable = isPackaged
    ? path.join(process.resourcesPath, 'monitor', 'ComputerMonitor.Service.exe')
    : existsSync(localDotnet) ? localDotnet : 'dotnet'
  const args = isPackaged
    ? []
    : ['run', '--project', path.resolve(__dirname, '../../monitor/ComputerMonitor.Service.csproj'), '--no-launch-profile']

  monitor = spawn(executable, args, {
    env: { ...process.env, COMPUTER_MONITOR_TOKEN: sessionToken },
    windowsHide: true,
  })

  let buffered = ''
  monitor.stdout.on('data', (chunk) => {
    buffered += chunk.toString()
    const lines = buffered.split(/\r?\n/)
    buffered = lines.pop() ?? ''
    for (const line of lines) {
      const match = line.match(/^MONITOR_READY (http:\/\/127\.0\.0\.1:\d+)$/)
      if (match) {
        endpoint = match[1]
        mainWindow?.webContents.send('monitor-ready')
        captureDashboardIfRequested()
      }
    }
  })
  monitor.stderr.on('data', (chunk) => console.error(`[monitor] ${chunk}`))
  monitor.on('error', (error) => {
    console.error('Unable to start monitor service:', error)
    endpoint = null
    mainWindow?.webContents.send('monitor-stopped')
  })
  monitor.on('exit', () => {
    endpoint = null
    mainWindow?.webContents.send('monitor-stopped')
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#05030D',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
    const isAllowed = app.isPackaged ? url.startsWith('file:') : Boolean(allowed && url.startsWith(allowed))
    if (!isAllowed) event.preventDefault()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

ipcMain.handle('monitor:connection', () => endpoint ? { endpoint, token: sessionToken } : null)
ipcMain.handle('window:toggleFullscreen', () => {
  if (!mainWindow) return false
  mainWindow.setFullScreen(!mainWindow.isFullScreen())
  return mainWindow.isFullScreen()
})
ipcMain.handle('window:setFullscreen', (_event, enabled: boolean) => {
  mainWindow?.setFullScreen(enabled)
  return mainWindow?.isFullScreen() ?? false
})

app.whenReady().then(() => {
  startMonitor()
  createWindow()
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  if (monitor && !monitor.killed) monitor.kill()
})
