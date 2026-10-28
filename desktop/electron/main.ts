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
let settingsSession: { bounds: Rectangle; mode: DisplayMode } | null = null
let persistQuietUntil = 0
let clickThroughShortcutRegistered = false
let registeredClickThroughAccel: string | null = null
let nativeClickThroughApplied = false
let clickThroughError = ''
const sessionToken = randomBytes(32).toString('hex')
const DEFAULT_CLICK_THROUGH_SHORTCUT = 'CommandOrControl+Shift+F10'
const CLICK_THROUGH_SHORTCUTS = new Set([
  'CommandOrControl+Shift+F10',
  'CommandOrControl+Shift+O',
  'CommandOrControl+Alt+C',
])

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

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
  preferredDisplayId: number | null
  defaultMode: DisplayMode
  rememberPosition: boolean
  overlayAnchor: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  clickThroughShortcut: string
  bounds: Partial<Record<DisplayMode, WindowBounds>>
}

const defaultDisplayState: DisplayState = {
  schemaVersion: 3,
  mode: 'full',
  alwaysOnTop: false,
  locked: false,
  clickThrough: false,
  opacity: .9,
  panelTransparent: false,
  glassBlur: false,
  subtleFrame: true,
  textScale: 100,
  sizePreset: 'normal',
  launchLastMode: true,
  preferredDisplayId: null,
  defaultMode: 'full',
  rememberPosition: true,
  overlayAnchor: 'top-right',
  clickThroughShortcut: DEFAULT_CLICK_THROUGH_SHORTCUT,
  bounds: {},
}
let displayState: DisplayState = structuredClone(defaultDisplayState)

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadDisplayState() {
  try {
    const stored = JSON.parse(readFileSync(statePath(), 'utf8')) as Partial<DisplayState>
    const storedVersion = stored.schemaVersion ?? 1
    const legacyBounds = stored.bounds ?? {}
    const bounds = storedVersion < 2
      ? { ...legacyBounds, bar: legacyBounds.mini, mini: undefined }
      : legacyBounds
    const storedMode = storedVersion < 2 && stored.mode === 'mini' ? 'bar' : stored.mode
    displayState = {
      ...defaultDisplayState,
      ...stored,
      schemaVersion: defaultDisplayState.schemaVersion,
      mode: stored.launchLastMode === false ? (stored.defaultMode ?? 'full') : storedMode ?? 'full',
      bounds: stored.rememberPosition === false ? {} : bounds,
    }
    if (storedVersion < 3) migrateOverlayLayout()
    displayState.bounds = Object.fromEntries(Object.entries(displayState.bounds).map(([mode, value]) => (
      [mode, value ? sanitizeBounds(mode as DisplayMode, value) : value]
    ))) as DisplayState['bounds']
    displayState.clickThroughShortcut = CLICK_THROUGH_SHORTCUTS.has(displayState.clickThroughShortcut)
      ? displayState.clickThroughShortcut
      : DEFAULT_CLICK_THROUGH_SHORTCUT
  } catch {
    displayState = structuredClone(defaultDisplayState)
  }
}

function migrateOverlayLayout() {
  if (displayState.opacity < .7) displayState.opacity = .85
  displayState.panelTransparent = false
  displayState.glassBlur = false
  displayState.sizePreset = 'normal'
  displayState.bounds.mini = overlayDefaultBounds('mini')
  displayState.bounds.bar = overlayDefaultBounds('bar')
  const desktop = displayState.bounds.desktop
  if (!desktop || desktop.height < 400) {
    displayState.bounds.desktop = desktopWorkAreaBounds()
  }
}

function saveDisplayState() {
  mkdirSync(path.dirname(statePath()), { recursive: true })
  writeFileSync(statePath(), JSON.stringify(displayState, null, 2), 'utf8')
}

function desktopWorkAreaBounds(): WindowBounds {
  const area = targetDisplay().workArea
  return { x: area.x, y: area.y, width: area.width, height: area.height }
}

function presetBounds(mode: DisplayMode): WindowBounds {
  if (mode === 'full') return { width: 1600, height: 1000 }
  if (mode === 'desktop') return desktopWorkAreaBounds()
  return { width: 750, height: 85 }
}

function sizePresetBounds(mode: DisplayMode, preset: 'compact' | 'normal') {
  if (mode === 'desktop') return preset === 'compact' ? { width: 750, height: 85 } : { width: 900, height: 96 }
  return preset === 'compact' ? { width: 680, height: 78 } : { width: 750, height: 85 }
}

function minimumSize(mode: DisplayMode) {
  if (mode === 'full' || mode === 'desktop') return { width: 720, height: 520 }
  return { width: 640, height: 76 }
}

function maximumSize(mode: DisplayMode) {
  const area = targetDisplay().workArea
  if (mode === 'full' || mode === 'desktop') {
    return { width: Math.max(area.width, 1920), height: Math.max(area.height, 1200) }
  }
  return { width: 980, height: 110 }
}

function overlayMode(mode: DisplayMode) {
  return mode === 'bar' || mode === 'mini'
}

function compactMode(mode: DisplayMode) {
  return overlayMode(mode)
}

function targetDisplay() {
  const displays = screen.getAllDisplays()
  return displays.find(display => display.id === displayState.preferredDisplayId) ?? screen.getPrimaryDisplay()
}

function overlayDefaultBounds(mode: DisplayMode): WindowBounds {
  const size = presetBounds(mode)
  const area = targetDisplay().workArea
  const margin = 20
  const anchor = displayState.overlayAnchor ?? 'top-right'
  const x = anchor.endsWith('right')
    ? area.x + area.width - size.width - margin
    : area.x + margin
  const y = anchor.startsWith('bottom')
    ? area.y + area.height - size.height - margin
    : area.y + margin
  return clampToWorkArea({ width: size.width, height: size.height, x, y })
}

function nearestWorkArea(bounds: WindowBounds) {
  const displays = screen.getAllDisplays()
  const x = bounds.x
  const y = bounds.y
  if (x == null || y == null || displays.length === 0) return screen.getPrimaryDisplay().workArea
  let best = displays[0]
  let bestOverlap = -1
  for (const display of displays) {
    const area = display.workArea
    const width = Math.max(0, Math.min(x + bounds.width, area.x + area.width) - Math.max(x, area.x))
    const height = Math.max(0, Math.min(y + bounds.height, area.y + area.height) - Math.max(y, area.y))
    const overlap = width * height
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = display
    }
  }
  if (bestOverlap > 0) return best.workArea
  let nearest = displays[0]
  let distance = Number.POSITIVE_INFINITY
  for (const display of displays) {
    const area = display.workArea
    const dx = (area.x + area.width / 2) - x
    const dy = (area.y + area.height / 2) - y
    const next = dx * dx + dy * dy
    if (next < distance) {
      distance = next
      nearest = display
    }
  }
  return nearest.workArea
}

function clampToWorkArea(bounds: WindowBounds): Rectangle {
  const area = nearestWorkArea(bounds)
  const width = Math.min(Math.max(bounds.width, 1), area.width)
  const height = Math.min(Math.max(bounds.height, 1), area.height)
  const x = Math.min(Math.max(bounds.x ?? area.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(bounds.y ?? area.y, area.y), area.y + area.height - height)
  return { x, y, width, height }
}

function sanitizeBounds(mode: DisplayMode, bounds: WindowBounds) {
  if (!compactMode(mode)) return safeBounds(bounds)
  const limits = maximumSize(mode)
  const min = minimumSize(mode)
  const width = Math.min(Math.max(bounds.width, min.width), limits.width)
  const height = Math.min(Math.max(bounds.height, min.height), limits.height)
  const positioned = bounds.x == null || bounds.y == null
    ? overlayDefaultBounds(mode)
    : bounds
  return clampToWorkArea({ ...positioned, width, height })
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function resolvedModeBounds(mode: DisplayMode): WindowBounds {
  if (mode === 'desktop') {
    const stored = displayState.bounds.desktop
    if (stored && stored.width >= 720 && stored.height >= 400) return stored
    return desktopWorkAreaBounds()
  }
  return displayState.bounds[mode] ?? (compactMode(mode) ? overlayDefaultBounds(mode) : presetBounds(mode))
}

function showDashboard() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function restoreFromTray() {
  if (displayState.mode === 'desktop') {
    void applyDisplayState({ mode: 'full' }).then(() => showDashboard())
    return
  }
  showDashboard()
}

function formatClickThroughShortcut(accel = displayState.clickThroughShortcut) {
  return accel.replaceAll('CommandOrControl', 'Ctrl').replaceAll('+', ' + ')
}

function canRecoverClickThrough() {
  return Boolean(tray) || clickThroughShortcutRegistered
}

function onClickThroughShortcut() {
  if (overlayMode(displayState.mode)) {
    void applyDisplayState({ clickThrough: !displayState.clickThrough })
    return
  }
  if (displayState.mode === 'desktop') {
    void applyDisplayState({ mode: 'full' }).then(() => showDashboard())
  }
}

function registerClickThroughShortcut(): boolean {
  const accel = CLICK_THROUGH_SHORTCUTS.has(displayState.clickThroughShortcut)
    ? displayState.clickThroughShortcut
    : DEFAULT_CLICK_THROUGH_SHORTCUT
  displayState.clickThroughShortcut = accel
  if (registeredClickThroughAccel && registeredClickThroughAccel !== accel) {
    try { globalShortcut.unregister(registeredClickThroughAccel) } catch { /* empty */ }
  }
  try {
    clickThroughShortcutRegistered = globalShortcut.register(accel, onClickThroughShortcut)
    registeredClickThroughAccel = clickThroughShortcutRegistered ? accel : null
  } catch {
    clickThroughShortcutRegistered = false
    registeredClickThroughAccel = null
  }
  return clickThroughShortcutRegistered
}

function nativeClickThroughShouldIgnore() {
  if (settingsSession) return false
  if (displayState.mode === 'desktop') return true
  return overlayMode(displayState.mode) && displayState.clickThrough
}

function applyClickThrough(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) {
    nativeClickThroughApplied = false
    return false
  }
  const shouldIgnore = nativeClickThroughShouldIgnore()
  try {
    if (shouldIgnore) {
      mainWindow.setIgnoreMouseEvents(true)
      mainWindow.setFocusable(false)
    } else {
      mainWindow.setIgnoreMouseEvents(false)
      mainWindow.setFocusable(true)
    }
    nativeClickThroughApplied = shouldIgnore
    return shouldIgnore
  } catch {
    try {
      mainWindow.setIgnoreMouseEvents(false)
      mainWindow.setFocusable(true)
    } catch { /* empty */ }
    nativeClickThroughApplied = false
    return false
  }
}

function suspendClickThrough() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setFocusable(true)
  } catch { /* empty */ }
  nativeClickThroughApplied = false
}

function setPointerPassthrough(passthrough: boolean) {
  if (!passthrough) {
    suspendClickThrough()
    return
  }
  applyClickThrough()
}

function rendererDisplayState() {
  return {
    ...displayState,
    clickThroughApplied: nativeClickThroughApplied,
    clickThroughReady: canRecoverClickThrough(),
    clickThroughShortcutLabel: formatClickThroughShortcut(),
    clickThroughError: clickThroughError || undefined,
  }
}

function emitDisplayState() {
  mainWindow?.webContents.send('display-state-changed', rendererDisplayState())
  tray?.setContextMenu(buildControlMenu())
}

function applyWindowLayering() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (displayState.mode === 'desktop') {
    mainWindow.setAlwaysOnTop(false)
    return
  }
  if (displayState.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, overlayMode(displayState.mode) ? 'screen-saver' : 'floating')
    return
  }
  mainWindow.setAlwaysOnTop(false)
}

function reassertOverlayChrome() {
  applyWindowLayering()
  applyClickThrough()
}

function setTrayEnabled(enabled: boolean) {
  if (!enabled && displayState.clickThrough && !clickThroughShortcutRegistered) return true
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
  tray.on('double-click', restoreFromTray)
  return true
}

function setMode(mode: DisplayMode) {
  applyDisplayState({ mode })
  showDashboard()
}

function buildControlMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Full Dashboard', click: () => setMode('full') },
    { label: 'Show Floating Bar Monitor', click: () => setMode('bar') },
    { label: 'Show Floating Mini Monitor', click: () => setMode('mini') },
    { label: 'Desktop Background', click: () => setMode('desktop') },
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
      label: 'Click-Through',
      type: 'checkbox',
      checked: displayState.clickThrough,
      click: ({ checked }) => applyDisplayState({ clickThrough: checked }),
    },
    {
      label: 'Disable Click-Through',
      enabled: displayState.clickThrough || nativeClickThroughApplied,
      click: () => applyDisplayState({ clickThrough: false }),
    },
    {
      label: `Toggle Click-Through (${formatClickThroughShortcut()})`,
      enabled: overlayMode(displayState.mode) && clickThroughShortcutRegistered,
      click: () => applyDisplayState({ clickThrough: !displayState.clickThrough }),
    },
    {
      label: 'Gaming Overlay Settings…',
      click: () => {
        suspendClickThrough()
        mainWindow?.webContents.send('open-settings')
      },
    },
    {
      label: 'Settings…',
      click: () => mainWindow?.webContents.send('open-settings'),
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

async function applyDisplayState(patch: Partial<Omit<DisplayState, 'bounds'>>) {
  const previousMode = displayState.mode
  const previousPreferred = displayState.preferredDisplayId
  const previousAnchor = displayState.overlayAnchor
  const safePatch: Partial<Omit<DisplayState, 'bounds'>> = {
    mode: patch.mode,
    alwaysOnTop: patch.alwaysOnTop,
    locked: patch.locked,
    clickThrough: patch.clickThrough,
    opacity: patch.opacity,
    panelTransparent: patch.panelTransparent,
    glassBlur: patch.glassBlur,
    subtleFrame: patch.subtleFrame,
    textScale: patch.textScale,
    sizePreset: patch.sizePreset,
    launchLastMode: patch.launchLastMode,
    preferredDisplayId: patch.preferredDisplayId,
    defaultMode: patch.defaultMode,
    rememberPosition: patch.rememberPosition,
    overlayAnchor: patch.overlayAnchor,
    clickThroughShortcut: patch.clickThroughShortcut,
  }
  displayState = {
    ...displayState,
    ...(Object.fromEntries(Object.entries(safePatch).filter(([, value]) => value !== undefined)) as Partial<DisplayState>),
    opacity: Math.max(.1, Math.min(1, patch.opacity ?? displayState.opacity)),
    textScale: Math.max(70, Math.min(160, patch.textScale ?? displayState.textScale)),
  }
  if (patch.clickThroughShortcut) {
    displayState.clickThroughShortcut = CLICK_THROUGH_SHORTCUTS.has(patch.clickThroughShortcut)
      ? patch.clickThroughShortcut
      : displayState.clickThroughShortcut
    registerClickThroughShortcut()
  }
  if (patch.clickThrough === true && !canRecoverClickThrough()) {
    displayState.clickThrough = false
    clickThroughError = 'Click-Through needs the system tray or a working keyboard shortcut so you can turn it off.'
  } else if (patch.clickThrough !== undefined) {
    clickThroughError = ''
  }
  if (displayState.clickThrough && !clickThroughShortcutRegistered) setTrayEnabled(true)
  if (!mainWindow) {
    saveDisplayState()
    return rendererDisplayState()
  }

  if (settingsSession) {
    applyWindowLayering()
    mainWindow.setSkipTaskbar(false)
    mainWindow.setResizable(true)
    mainWindow.setMovable(true)
    mainWindow.setOpacity(1)
    applyClickThrough()
    emitDisplayState()
    saveDisplayState()
    return rendererDisplayState()
  }

  const modeChanged = Boolean(patch.mode && patch.mode !== previousMode)
  const overlayRelocate = compactMode(displayState.mode) && (
    (patch.preferredDisplayId !== undefined && patch.preferredDisplayId !== previousPreferred)
    || (patch.overlayAnchor !== undefined && patch.overlayAnchor !== previousAnchor)
  )
  if (compactMode(displayState.mode) && previousMode === 'full' && patch.alwaysOnTop === undefined) {
    displayState.alwaysOnTop = true
  }
  await fitNativeWindow({
    forceSize: modeChanged || overlayRelocate,
    bounds: overlayRelocate
      ? overlayDefaultBounds(displayState.mode)
      : modeChanged
        ? resolvedModeBounds(displayState.mode)
        : undefined,
  })
  const isFull = displayState.mode === 'full'
  const isDesktop = displayState.mode === 'desktop'
  const compact = compactMode(displayState.mode)
  const positionLocked = compact && displayState.locked
  mainWindow.setResizable(isFull || !positionLocked)
  mainWindow.setMovable(!positionLocked)
  applyWindowLayering()
  mainWindow.setSkipTaskbar(isDesktop)
  mainWindow.setOpacity(1)
  applyClickThrough()
  if (overlayMode(displayState.mode) && displayState.clickThrough && !nativeClickThroughApplied) {
    displayState.clickThrough = false
    clickThroughError = 'Windows did not enable click-through for this overlay.'
    applyClickThrough()
  }
  if (process.platform === 'win32') {
    mainWindow.setBackgroundMaterial(!compact && displayState.glassBlur ? 'acrylic' : 'none')
  }
  emitDisplayState()
  saveDisplayState()
  return rendererDisplayState()
}

async function fitNativeWindow(options: { forceSize?: boolean; bounds?: WindowBounds } = {}) {
  if (!mainWindow) return
  const compact = compactMode(displayState.mode)
  persistQuietUntil = Date.now() + 1200
  applyingBounds = true
  try {
    if (compact) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize()
      if (mainWindow.isFullScreen() || fullscreenActive) {
        fullscreenActive = false
        preFullscreenBounds = null
        mainWindow.setFullScreen(false)
        await delay(250)
      }
      const min = minimumSize(displayState.mode)
      const max = maximumSize(displayState.mode)
      mainWindow.setMaximizable(false)
      mainWindow.setMinimumSize(min.width, min.height)
      mainWindow.setMaximumSize(max.width, max.height)
      const current = mainWindow.getBounds()
      const next = sanitizeBounds(
        displayState.mode,
        options.bounds ?? displayState.bounds[displayState.mode] ?? overlayDefaultBounds(displayState.mode),
      )
      const oversized = current.width > max.width + 8 || current.height > max.height + 8
      if (options.forceSize || options.bounds || oversized) {
        mainWindow.setBounds(next)
        displayState.bounds[displayState.mode] = next
      }
      return
    }
    const min = minimumSize('full')
    const max = maximumSize('full')
    if (!fullscreenActive && mainWindow.isMaximized() && options.forceSize) {
      mainWindow.unmaximize()
    }
    mainWindow.setMaximizable(true)
    mainWindow.setMinimumSize(min.width, min.height)
    mainWindow.setMaximumSize(max.width, max.height)
    if (options.forceSize) {
      const stored = displayState.bounds.full ?? presetBounds('full')
      mainWindow.setBounds(sanitizeBounds('full', stored))
    }
  } finally {
    applyingBounds = false
  }
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
  const compact = compactMode(displayState.mode)
  const initialBounds = sanitizeBounds(displayState.mode, resolvedModeBounds(displayState.mode))
  const min = minimumSize(displayState.mode)
  const max = maximumSize(displayState.mode)
  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: min.width,
    minHeight: min.height,
    maxWidth: compact ? max.width : undefined,
    maxHeight: compact ? max.height : undefined,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: compact,
    roundedCorners: true,
    maximizable: !compact,
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
    void applyDisplayState({}).then(async () => {
      const bounds = displayState.bounds[displayState.mode]
        ?? (compactMode(displayState.mode) ? overlayDefaultBounds(displayState.mode) : presetBounds(displayState.mode))
      await fitNativeWindow({ forceSize: true, bounds })
      windowReady = true
      mainWindow?.show()
      if (compactMode(displayState.mode)) {
        setTimeout(() => {
          if (!mainWindow || !compactMode(displayState.mode)) return
          const current = mainWindow.getBounds()
          const preset = presetBounds(displayState.mode)
          if (current.width < preset.width - 16 || current.height < preset.height - 4) {
            void fitNativeWindow({
              forceSize: true,
              bounds: { ...current, width: preset.width, height: preset.height },
            }).then(() => applyClickThrough())
            return
          }
          applyClickThrough()
        }, 400)
      }
    })
  })
  mainWindow.on('minimize', () => {
    if (!minimizeToTray) return
    mainWindow?.hide()
  })
  mainWindow.on('move', () => persistCurrentBounds())
  mainWindow.on('resize', () => persistCurrentBounds())
  mainWindow.on('maximize', emitWindowChrome)
  mainWindow.on('unmaximize', emitWindowChrome)
  mainWindow.on('blur', () => {
    if (!overlayMode(displayState.mode) && displayState.mode !== 'desktop') return
    reassertOverlayChrome()
  })
  mainWindow.on('show', () => {
    if (!overlayMode(displayState.mode) && displayState.mode !== 'desktop') return
    reassertOverlayChrome()
  })
  mainWindow.on('restore', () => {
    if (!overlayMode(displayState.mode) && displayState.mode !== 'desktop') return
    reassertOverlayChrome()
  })
  mainWindow.on('enter-full-screen', () => { fullscreenActive = true; emitWindowChrome() })
  mainWindow.on('leave-full-screen', () => { fullscreenActive = false; emitWindowChrome() })
  mainWindow.on('close', (event) => {
    if (quitting || !trayEnabled || !minimizeToTray) return
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
  if (!mainWindow || !windowReady || applyingBounds || settingsSession || Date.now() < persistQuietUntil || mainWindow.isMaximized() || fullscreenActive || !displayState.rememberPosition) return
  const bounds = sanitizeBounds(displayState.mode, mainWindow.getBounds())
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
  await delay(400)
  if (preFullscreenBounds && !compactMode(displayState.mode)) {
    applyingBounds = true
    window.setBounds(safeBounds(preFullscreenBounds))
    applyingBounds = false
  } else if (compactMode(displayState.mode)) {
    await fitNativeWindow({ forceSize: true })
  }
  preFullscreenBounds = null
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
  emitWindowChrome()
  return mainWindow.isMaximized()
})
ipcMain.handle('window:setMaximized', (_event, enabled: boolean) => {
  if (!mainWindow) return false
  if (enabled) mainWindow.maximize()
  else if (mainWindow.isMaximized()) mainWindow.unmaximize()
  emitWindowChrome()
  return mainWindow.isMaximized()
})
ipcMain.handle('window:getChrome', () => ({
  maximized: Boolean(mainWindow?.isMaximized()),
  fullscreen: fullscreenActive,
}))
ipcMain.handle('window:listDisplays', () => screen.getAllDisplays().map(display => ({
  id: display.id,
  label: display.label,
  primary: display.id === screen.getPrimaryDisplay().id,
})))
ipcMain.handle('window:resetLayout', async () => {
  if (!mainWindow) return false
  await setWindowFullscreen(false)
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  const area = screen.getPrimaryDisplay().workArea
  const bounds = safeBounds({
    width: Math.min(1280, area.width - 40),
    height: Math.min(800, area.height - 40),
    x: area.x + 20,
    y: area.y + 20,
  })
  displayState.bounds.full = bounds
  applyingBounds = true
  mainWindow.setBounds(bounds)
  applyingBounds = false
  saveDisplayState()
  emitWindowChrome()
  return true
})

function emitWindowChrome() {
  mainWindow?.webContents.send('window-chrome-changed', {
    maximized: Boolean(mainWindow?.isMaximized()),
    fullscreen: fullscreenActive,
  })
}
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:prepareSettings', () => {
  if (!mainWindow) return false
  suspendClickThrough()
  if (!overlayMode(displayState.mode) || fullscreenActive) return false
  settingsSession = { bounds: mainWindow.getBounds(), mode: displayState.mode }
  const next = clampToWorkArea({
    x: settingsSession.bounds.x,
    y: settingsSession.bounds.y,
    width: Math.max(settingsSession.bounds.width, 750),
    height: 348,
  })
  applyingBounds = true
  mainWindow.setMinimumSize(640, 76)
  mainWindow.setMaximumSize(980, 420)
  mainWindow.setResizable(true)
  mainWindow.setMovable(true)
  applyWindowLayering()
  mainWindow.setSkipTaskbar(false)
  mainWindow.setBounds(next)
  applyingBounds = false
  mainWindow.show()
  mainWindow.focus()
  return true
})
ipcMain.handle('window:restoreAfterSettings', async () => {
  if (!mainWindow || !settingsSession) return false
  const session = settingsSession
  settingsSession = null
  const keepOverlay = displayState.mode === session.mode && compactMode(displayState.mode)
  const bounds = keepOverlay
    ? sanitizeBounds(displayState.mode, session.bounds)
    : sanitizeBounds(displayState.mode, displayState.bounds[displayState.mode] ?? overlayDefaultBounds(displayState.mode))
  if (keepOverlay) displayState.bounds[displayState.mode] = bounds
  await fitNativeWindow({ forceSize: true, bounds })
  await applyDisplayState({})
  return true
})
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
ipcMain.handle('display:getState', () => rendererDisplayState())
ipcMain.handle('display:setState', (_event, patch: Partial<Omit<DisplayState, 'bounds'>>) =>
  applyDisplayState(patch))
ipcMain.on('display:setPointerPassthrough', (_event, passthrough: boolean) => {
  if (typeof passthrough === 'boolean') setPointerPassthrough(passthrough)
})
ipcMain.handle('display:setSizePreset', (_event, preset: 'compact' | 'normal') => {
  if (!mainWindow || settingsSession) return null
  const size = sizePresetBounds(displayState.mode, preset)
  const current = mainWindow.getBounds()
  const bounds = sanitizeBounds(displayState.mode, { ...current, ...size })
  const min = minimumSize(displayState.mode)
  const max = maximumSize(displayState.mode)
  applyingBounds = true
  mainWindow.setMinimumSize(min.width, min.height)
  mainWindow.setMaximumSize(max.width, max.height)
  mainWindow.setBounds(bounds)
  applyingBounds = false
  displayState.bounds[displayState.mode] = bounds
  saveDisplayState()
  return bounds
})
ipcMain.handle('display:resetOverlayPosition', async () => {
  if (!mainWindow || !compactMode(displayState.mode)) return null
  const bounds = overlayDefaultBounds(displayState.mode)
  await fitNativeWindow({ forceSize: true, bounds })
  saveDisplayState()
  return bounds
})

app.on('second-instance', () => {
  applyDisplayState({ clickThrough: false })
  showDashboard()
})

app.whenReady().then(() => {
  loadDisplayState()
  setTrayEnabled(true)
  registerClickThroughShortcut()
  if (displayState.clickThrough && !canRecoverClickThrough()) {
    displayState.clickThrough = false
    clickThroughError = 'Click-Through needs the system tray or a working keyboard shortcut so you can turn it off.'
  }
  startMonitor()
  createWindow()
  screen.on('display-metrics-changed', () => {
    if (overlayMode(displayState.mode) || displayState.mode === 'desktop') reassertOverlayChrome()
  })
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  quitting = true
  if (monitor && !monitor.killed) monitor.kill()
  globalShortcut.unregisterAll()
  tray?.destroy()
})
