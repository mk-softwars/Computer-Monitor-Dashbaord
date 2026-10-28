import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray, type Rectangle } from 'electron'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null
let monitor: ChildProcessWithoutNullStreams | null = null
let tray: Tray | null = null
let endpoint: string | null = null
let screenshotCaptured = false
let minimizeToTray = false
let trayEnabled = true
let quitting = false
let applyingBounds = false
let windowReady = false
let fullscreenActive = false
let preFullscreenBounds: Rectangle | null = null
const sessionToken = randomBytes(32).toString('hex')

app.setAppUserModelId('app.computermonitor.dashboard')

type DisplayMode = 'full' | 'bar' | 'mini' | 'desktop'
type WindowBounds = { x?: number; y?: number; width: number; height: number }
type DisplayState = {
  schemaVersion: number
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
  bounds: Partial<Record<DisplayMode, WindowBounds>>
}

const defaultDisplayState: DisplayState = {
  schemaVersion: 2,
  mode: 'full',
  alwaysOnTop: false,
  locked: false,
  clickThrough: false,
  opacity: 1,
  panelTransparent: false,
  glassBlur: false,
  subtleFrame: true,
  textScale: 100,
  sizePreset: 'normal',
  launchLastMode: true,
  bounds: {},
}
let displayState: DisplayState = structuredClone(defaultDisplayState)

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadDisplayState() {
  try {
    const stored = JSON.parse(readFileSync(statePath(), 'utf8')) as Partial<DisplayState>
    const legacyBounds = stored.bounds ?? {}
    const isLegacy = stored.schemaVersion !== defaultDisplayState.schemaVersion
    const bounds = isLegacy
      ? { ...legacyBounds, bar: legacyBounds.mini, mini: undefined }
      : legacyBounds
    const storedMode = isLegacy && stored.mode === 'mini' ? 'bar' : stored.mode
    displayState = {
      ...defaultDisplayState,
      ...stored,
      schemaVersion: defaultDisplayState.schemaVersion,
      mode: stored.launchLastMode === false ? 'full' : storedMode ?? 'full',
      bounds,
    }
  } catch {
    displayState = structuredClone(defaultDisplayState)
  }
}

function saveDisplayState() {
  mkdirSync(path.dirname(statePath()), { recursive: true })
  writeFileSync(statePath(), JSON.stringify(displayState, null, 2), 'utf8')
}

function presetBounds(mode: DisplayMode): WindowBounds {
  if (mode === 'full') return { width: 1600, height: 1000 }
  if (mode === 'desktop') return { width: 960, height: 104 }
  if (mode === 'mini') return { width: 540, height: 57 }
  return { width: 920, height: 96 }
}

function sizePresetBounds(mode: DisplayMode, preset: 'compact' | 'normal') {
  if (mode === 'mini') {
    return preset === 'compact' ? { width: 540, height: 57 } : { width: 690, height: 72 }
  }
  return preset === 'compact' ? { width: 720, height: 76 } : { width: 920, height: 96 }
}

function minimumSize(mode: DisplayMode) {
  if (mode === 'full') return { width: 900, height: 600 }
  if (mode === 'mini') return { width: 480, height: 52 }
  return { width: 680, height: 68 }
}

function safeBounds(bounds: WindowBounds) {
  const displays = screen.getAllDisplays()
  const intersects = displays.some(({ workArea }) => {
    const x = bounds.x ?? workArea.x
    const y = bounds.y ?? workArea.y
    return x < workArea.x + workArea.width && x + bounds.width > workArea.x &&
      y < workArea.y + workArea.height && y + bounds.height > workArea.y
  })
  if (intersects) return bounds
  const area = screen.getPrimaryDisplay().workArea
  return {
    width: Math.min(bounds.width, area.width),
    height: Math.min(bounds.height, area.height),
    x: area.x + Math.round((area.width - Math.min(bounds.width, area.width)) / 2),
    y: area.y + Math.round((area.height - Math.min(bounds.height, area.height)) / 2),
  }
}

function showDashboard() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function setPointerPassthrough(passthrough: boolean) {
  if (!mainWindow) return
  const ignoreMouse = displayState.mode !== 'full' && displayState.clickThrough && passthrough
  mainWindow.setIgnoreMouseEvents(ignoreMouse, { forward: true })
  mainWindow.setFocusable(!ignoreMouse)
}

function setTrayEnabled(enabled: boolean) {
  if (!enabled && displayState.clickThrough) return true
  trayEnabled = enabled
  if (!enabled) {
    tray?.destroy()
    tray = null
    minimizeToTray = false
    return false
  }
  if (tray) return true
  const packagedIcon = path.join(__dirname, '../dist/app-icon.png')
  const developmentIcon = path.resolve(__dirname, '../public/app-icon.png')
  const icon = nativeImage.createFromPath(app.isPackaged ? packagedIcon : developmentIcon)
  tray = new Tray(icon.resize({ width: 20, height: 20 }))
  tray.setToolTip('Computer Monitor Dashboard')
  tray.setContextMenu(buildControlMenu())
  tray.on('double-click', showDashboard)
  return true
}

function setMode(mode: DisplayMode) {
  applyDisplayState(mode === 'full' ? { mode, clickThrough: false } : { mode })
  showDashboard()
}

function buildControlMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Full Dashboard', click: () => setMode('full') },
    { label: 'Show Floating Bar Monitor', click: () => setMode('bar') },
    { label: 'Show Floating Mini Monitor', click: () => setMode('mini') },
    { label: 'Desktop Widget Mode', click: () => setMode('desktop') },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: displayState.alwaysOnTop,
      click: ({ checked }) => applyDisplayState({ alwaysOnTop: checked }),
    },
    {
      label: 'Lock Position',
      type: 'checkbox',
      checked: displayState.locked,
      click: ({ checked }) => applyDisplayState({ locked: checked }),
    },
    {
      label: 'Click Through',
      type: 'checkbox',
      checked: displayState.clickThrough,
      click: ({ checked }) => applyDisplayState({ clickThrough: checked }),
    },
    {
      label: 'Transparency',
      submenu: [
        { label: 'High — 75%', opacity: .25 },
        { label: 'Medium — 50%', opacity: .5 },
        { label: 'Low — 25%', opacity: .75 },
        { label: 'None — 0%', opacity: 1 },
      ].map(level => ({
        label: level.label,
        type: 'radio' as const,
        checked: Math.abs(displayState.opacity - level.opacity) < .02 && !displayState.panelTransparent,
        click: () => applyDisplayState({ opacity: level.opacity, panelTransparent: false }),
      })),
    },
    {
      label: 'Transparency Settings…',
      click: () => {
        setMode('full')
        mainWindow?.webContents.send('open-settings')
      },
    },
    {
      label: 'Settings…',
      click: () => {
        setMode('full')
        mainWindow?.webContents.send('open-settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Exit Application',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ])
}

function applyDisplayState(patch: Partial<Omit<DisplayState, 'bounds'>>) {
  const previousMode = displayState.mode
  displayState = {
    ...displayState,
    ...patch,
    opacity: Math.max(.2, Math.min(1, patch.opacity ?? displayState.opacity)),
    textScale: Math.max(70, Math.min(160, patch.textScale ?? displayState.textScale)),
  }
  if (displayState.clickThrough) setTrayEnabled(true)
  if (!mainWindow) {
    saveDisplayState()
    return displayState
  }

  if (patch.mode && patch.mode !== previousMode) {
    const bounds = safeBounds(displayState.bounds[patch.mode] ?? presetBounds(patch.mode))
    applyingBounds = true
    mainWindow.setBounds(bounds)
    applyingBounds = false
  }
  const isFull = displayState.mode === 'full'
  const isDesktop = displayState.mode === 'desktop'
  if (!isFull && fullscreenActive) void setWindowFullscreen(false)
  const minimum = minimumSize(displayState.mode)
  const positionLocked = !isFull && displayState.locked
  mainWindow.setMinimumSize(minimum.width, minimum.height)
  mainWindow.setResizable(!positionLocked)
  mainWindow.setMovable(!positionLocked)
  mainWindow.setAlwaysOnTop(!isDesktop && displayState.alwaysOnTop, 'floating')
  mainWindow.setSkipTaskbar(isDesktop)
  // Transparency is rendered on the panel background so telemetry text remains crisp.
  mainWindow.setOpacity(1)
  setPointerPassthrough(displayState.clickThrough)
  if (process.platform === 'win32') {
    mainWindow.setBackgroundMaterial(displayState.glassBlur ? 'acrylic' : 'none')
  }
  mainWindow.webContents.send('display-state-changed', displayState)
  tray?.setContextMenu(buildControlMenu())
  saveDisplayState()
  return displayState
}

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
  const initialBounds = safeBounds(displayState.bounds[displayState.mode] ?? presetBounds(displayState.mode))
  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: minimumSize(displayState.mode).width,
    minHeight: minimumSize(displayState.mode).height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    applyDisplayState({})
    const targetBounds = safeBounds(displayState.bounds[displayState.mode] ?? presetBounds(displayState.mode))
    applyingBounds = true
    mainWindow?.setBounds(targetBounds)
    applyingBounds = false
    windowReady = true
    mainWindow?.show()
  })
  mainWindow.on('minimize', () => {
    if (!minimizeToTray) return
    mainWindow?.hide()
  })
  mainWindow.on('move', () => persistCurrentBounds())
  mainWindow.on('resize', () => persistCurrentBounds())
  mainWindow.on('enter-full-screen', () => { fullscreenActive = true })
  mainWindow.on('leave-full-screen', () => { fullscreenActive = false })
  mainWindow.on('close', (event) => {
    if (quitting || !trayEnabled) return
    event.preventDefault()
    mainWindow?.hide()
  })
  mainWindow.on('closed', () => {
    windowReady = false
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
    const isAllowed = app.isPackaged ? url.startsWith('file:') : Boolean(allowed && url.startsWith(allowed))
    if (!isAllowed) event.preventDefault()
  })
  mainWindow.webContents.on('context-menu', () => {
    buildControlMenu().popup({ window: mainWindow ?? undefined })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function persistCurrentBounds() {
  if (!mainWindow || !windowReady || applyingBounds || mainWindow.isMaximized() || fullscreenActive) return
  const bounds = mainWindow.getBounds()
  displayState.bounds[displayState.mode] = bounds
  const preset = sizePresetBounds(displayState.mode, displayState.sizePreset === 'compact' ? 'compact' : 'normal')
  const matchesPreset = displayState.sizePreset !== 'custom' &&
    bounds.width === preset.width && bounds.height === preset.height
  if (displayState.mode !== 'full' && !matchesPreset && displayState.sizePreset !== 'custom') {
    displayState.sizePreset = 'custom'
    mainWindow.webContents.send('display-state-changed', displayState)
  }
  saveDisplayState()
}

async function setWindowFullscreen(enabled: boolean) {
  if (!mainWindow) return false
  if (fullscreenActive === enabled) return enabled
  const window = mainWindow
  if (enabled) {
    preFullscreenBounds = window.getBounds()
    fullscreenActive = true
    window.setFullScreen(true)
    await new Promise(resolve => setTimeout(resolve, 400))
    if (!window.isFullScreen()) {
      const display = screen.getDisplayMatching(preFullscreenBounds)
      window.setBounds(display.bounds)
    }
    return true
  }
  fullscreenActive = false
  window.setFullScreen(false)
  await new Promise(resolve => setTimeout(resolve, 400))
  if (preFullscreenBounds) {
    applyingBounds = true
    window.setBounds(safeBounds(preFullscreenBounds))
    applyingBounds = false
    preFullscreenBounds = null
  }
  return false
}

ipcMain.handle('monitor:connection', () => endpoint ? { endpoint, token: sessionToken } : null)
ipcMain.handle('window:toggleFullscreen', async () => {
  if (!mainWindow) return false
  return setWindowFullscreen(!fullscreenActive)
})
ipcMain.handle('window:setFullscreen', (_event, enabled: boolean) => setWindowFullscreen(enabled))
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return false
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
  return mainWindow.isMaximized()
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('desktop:setTrayEnabled', (_event, enabled: boolean) => setTrayEnabled(enabled))
ipcMain.handle('desktop:setMinimizeToTray', (_event, enabled: boolean) => {
  minimizeToTray = enabled && Boolean(tray)
  return minimizeToTray
})
ipcMain.handle('desktop:setLaunchAtStartup', (_event, enabled: boolean) => {
  if (!app.isPackaged) return false
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
  return app.getLoginItemSettings().openAtLogin
})
ipcMain.handle('desktop:getPreferences', () => ({
  launchAtStartup: app.isPackaged && app.getLoginItemSettings().openAtLogin,
  trayEnabled: Boolean(tray),
  minimizeToTray,
}))
ipcMain.handle('display:getState', () => displayState)
ipcMain.handle('display:setState', (_event, patch: Partial<Omit<DisplayState, 'bounds'>>) =>
  applyDisplayState(patch))
ipcMain.on('display:setPointerPassthrough', (_event, passthrough: boolean) => {
  if (typeof passthrough === 'boolean') setPointerPassthrough(passthrough)
})
ipcMain.handle('display:setSizePreset', (_event, preset: 'compact' | 'normal') => {
  if (!mainWindow) return null
  const size = sizePresetBounds(displayState.mode, preset)
  const current = mainWindow.getBounds()
  const bounds = safeBounds({ ...current, ...size })
  applyingBounds = true
  mainWindow.setBounds(bounds)
  applyingBounds = false
  displayState.bounds[displayState.mode] = bounds
  saveDisplayState()
  return bounds
})

app.whenReady().then(() => {
  loadDisplayState()
  setTrayEnabled(true)
  startMonitor()
  createWindow()
  globalShortcut.register('CommandOrControl+Shift+F10', () => {
    applyDisplayState({ clickThrough: false, locked: false })
    showDashboard()
  })
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  quitting = true
  if (monitor && !monitor.killed) monitor.kill()
  globalShortcut.unregisterAll()
  tray?.destroy()
})
