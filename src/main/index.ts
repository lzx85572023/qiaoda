// 巧答 · 应用入口：单实例、托盘、窗口生命周期、全局快捷键

import { app, globalShortcut, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { Store } from './store'
import { GenerationService } from './service'
import { applySettingsSideEffects, registerIpc, registerStartupHotkey } from './ipc'
import {
  createMainWindow,
  createQuickWindow,
  markQuitting,
  showMainWindow,
  showQuickWindow,
  toggleQuickWindow
} from './windows'

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  let store: Store | null = null
  let generation: GenerationService | null = null
  let tray: Tray | null = null

  app.on('second-instance', () => {
    showMainWindow()
    toggleQuickWindow()
  })

  app.whenReady().then(() => {
    store = new Store()
    store.ensureProviderPresets()
    store.ensureScenario()
    generation = new GenerationService(store)

    registerIpc(store, generation)
    createMainWindow(store)
    createQuickWindow(store)
    applySettingsSideEffects(store, store.settings.get())
    registerStartupHotkey(store.settings.get())
    tray = createTray(store)

    app.on('activate', () => showMainWindow())
  })

  app.on('before-quit', () => markQuitting())
  app.on('will-quit', () => globalShortcut.unregisterAll())

  function createTray(s: Store): Tray {
    const icon = nativeImage.createFromPath(join(app.getAppPath(), 'build', 'icon-32.png'))
    const t = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
    t.setToolTip('巧答 · AI 客服回复助手')
    const menu = Menu.buildFromTemplate([
      { label: '显示主窗口', click: () => showMainWindow() },
      { label: '呼出快捷窗', click: () => showQuickWindow() },
      { type: 'separator' },
      {
        label: '退出巧答',
        click: () => {
          markQuitting()
          app.quit()
        }
      }
    ])
    t.setContextMenu(menu)
    t.on('double-click', () => showMainWindow())
    return t
  }
}
