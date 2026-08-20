// 巧答 · 窗口管理：主窗口 + 快捷悬浮窗（透明无边框、置顶、全局快捷键呼出，无需任何无障碍权限）

import { BrowserWindow, app, screen, type NativeTheme } from 'electron'
import { join } from 'node:path'
import type { Store } from './store'

const PRELOAD = join(__dirname, '../preload/index.js')

function appIcon(): string {
  return join(app.getAppPath(), 'build', 'icon.png')
}

function loadPage(win: BrowserWindow, page: 'index' | 'quick'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(`${devUrl}/${page}.html`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

let mainWindow: BrowserWindow | null = null
let quickWindow: BrowserWindow | null = null
let quickPinned = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getQuickWindow(): BrowserWindow | null {
  return quickWindow
}

export function createMainWindow(store: Store): BrowserWindow {
  const saved = store.quick.get().mainBounds
  const win = new BrowserWindow({
    width: saved?.width ?? 1120,
    height: saved?.height ?? 760,
    x: saved?.x,
    y: saved?.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon(),
    backgroundColor: '#F6F5F2',
    title: '巧答',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#F6F5F2', symbolColor: '#23231F', height: 44 },
    webPreferences: {
      preload: PRELOAD,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.on('ready-to-show', () => win.show())
  win.on('close', (e) => {
    const { minimizeToTray } = store.settings.get()
    if (minimizeToTray && !isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('resize', saveMainBounds)
  win.on('move', saveMainBounds)
  function saveMainBounds(): void {
    if (win.isMaximized() || win.isMinimized() || win.isFullScreen()) return
    const b = win.getBounds()
    store.quick.update((q) => {
      q.mainBounds = { x: b.x, y: b.y, width: b.width, height: b.height }
    })
  }
  loadPage(win, 'index')
  mainWindow = win
  return win
}

export function createQuickWindow(store: Store): BrowserWindow {
  const WIDTH = 432
  const HEIGHT = 660
  const saved = store.quick.get().quickBounds
  let x: number
  let y: number
  if (saved) {
    x = saved.x
    y = saved.y
  } else {
    const wa = screen.getPrimaryDisplay().workArea
    x = wa.x + wa.width - WIDTH - 20
    y = wa.y + wa.height - HEIGHT - 20
  }

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: store.settings.get().alwaysOnTop,
    hasShadow: false,
    icon: appIcon(),
    title: '巧答 · 快捷窗',
    webPreferences: {
      preload: PRELOAD,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setAlwaysOnTop(store.settings.get().alwaysOnTop, 'floating')

  win.on('blur', () => {
    const { hideOnBlur } = store.settings.get()
    if (hideOnBlur && !quickPinned && quickWindow && !quickWindow.isDestroyed()) {
      quickWindow.hide()
    }
  })
  win.on('move', () => {
    const b = win.getBounds()
    store.quick.update((q) => {
      q.quickBounds = { x: b.x, y: b.y }
    })
  })
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('quick:shown')
  })
  loadPage(win, 'quick')
  quickWindow = win
  return win
}

export function showQuickWindow(): void {
  if (!quickWindow || quickWindow.isDestroyed()) return
  if (!quickWindow.isVisible()) quickWindow.show()
  quickWindow.focus()
  quickWindow.webContents.send('quick:shown')
}

export function hideQuickWindow(): void {
  if (quickWindow && !quickWindow.isDestroyed()) quickWindow.hide()
}

export function toggleQuickWindow(): void {
  if (quickWindow && !quickWindow.isDestroyed() && quickWindow.isVisible() && quickWindow.isFocused()) {
    hideQuickWindow()
  } else {
    showQuickWindow()
  }
}

export function setQuickPinned(pinned: boolean): void {
  quickPinned = pinned
}

export function isQuickPinned(): boolean {
  return quickPinned
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

/** 供"退出流程"与 close 事件协调 */
let isQuitting = false
export function markQuitting(): void {
  isQuitting = true
}

/** 主题切换时同步标题栏按钮颜色与窗口背景 */
export function applyTheme(theme: NonNullable<NativeTheme['themeSource']>): void {
  const dark = theme === 'dark'
  const overlay = { color: dark ? '#161614' : '#F6F5F2', symbolColor: dark ? '#E8E7E2' : '#23231F', height: 44 }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.setTitleBarOverlay(overlay)
    } catch {
      /* 部分平台不支持 */
    }
    mainWindow.setBackgroundColor(dark ? '#161614' : '#F6F5F2')
  }
  // 快捷窗为透明窗口，无需设置背景色
}
