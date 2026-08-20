// 巧答 · IPC 接口：渲染进程可调用的全部能力

import { app, clipboard, dialog, ipcMain, nativeTheme, globalShortcut, shell } from 'electron'
import { writeFileSync, readFileSync } from 'node:fs'
import type {
  AppSettings,
  DeltaEvent,
  ExportBundle,
  GenerateRequest,
  KeyInfo,
  Provider,
  Scenario,
  Snippet,
  TestResult
} from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { testProvider } from './llm/client'
import { newId, type Store } from './store'
import { GenerationService } from './service'
import {
  applyTheme,
  getQuickWindow,
  hideQuickWindow,
  isQuickPinned,
  markQuitting,
  setQuickPinned,
  showMainWindow,
  showQuickWindow
} from './windows'
import { LlmFailure } from './llm/client'

const EXPORT_FORMAT_VERSION = 1

function toLlmError(err: unknown): { code: string; message: string } {
  if (err instanceof LlmFailure) return { code: err.code, message: err.message }
  return { code: 'unknown', message: err instanceof Error ? err.message : '发生未知错误' }
}

export function registerIpc(store: Store, generation: GenerationService): void {
  // ---------- 应用 ----------
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    encryption: store.encryptionAvailable()
  }))

  ipcMain.handle('app:copyText', (_e, text: string) => {
    clipboard.writeText(String(text ?? ''))
  })

  ipcMain.handle('app:showMain', () => showMainWindow())
  ipcMain.handle('app:showQuick', () => showQuickWindow())
  ipcMain.handle('app:hideQuick', () => hideQuickWindow())
  ipcMain.handle('app:setQuickPinned', (_e, pinned: boolean) => setQuickPinned(pinned))
  ipcMain.handle('app:isQuickPinned', () => isQuickPinned())
  ipcMain.handle('app:openDataDir', () => {
    void shell.openPath(app.getPath('userData'))
  })
  ipcMain.handle('app:quit', () => {
    markQuitting()
    app.quit()
  })

  ipcMain.handle('app:exportData', async () => {
    const r = await dialog.showSaveDialog({
      title: '导出数据备份',
      defaultPath: `巧答数据备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }]
    })
    if (r.canceled || !r.filePath) return { ok: false, message: '已取消' }
    const bundle: ExportBundle = {
      app: 'qiaoda',
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: Date.now(),
      scenarios: store.scenarios.get(),
      snippets: store.snippets.get(),
      history: store.history.get(),
      providers: store.providers.get(),
      settings: store.settings.get()
    }
    writeFileSync(r.filePath, JSON.stringify(bundle, null, 2), 'utf8')
    return { ok: true, message: `已导出到 ${r.filePath}` }
  })

  ipcMain.handle('app:importData', async () => {
    const r = await dialog.showOpenDialog({
      title: '导入数据备份',
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (r.canceled || !r.filePaths[0]) return { ok: false, message: '已取消' }
    try {
      const raw = JSON.parse(readFileSync(r.filePaths[0], 'utf8')) as Partial<ExportBundle>
      if (!raw || raw.app !== 'qiaoda' || typeof raw.formatVersion !== 'number') {
        return { ok: false, message: '不是有效的巧答备份文件' }
      }
      const scenarios = Array.isArray(raw.scenarios) ? (raw.scenarios as Scenario[]) : []
      const snippets = Array.isArray(raw.snippets) ? (raw.snippets as Snippet[]) : []
      const history = Array.isArray(raw.history) ? raw.history : []
      const providers = Array.isArray(raw.providers) ? (raw.providers as Provider[]) : []
      store.scenarios.update(() => scenarios)
      store.snippets.update(() => snippets)
      store.history.update(() => history)
      if (providers.length) {
        store.providers.update(() => providers)
        store.ensureProviderPresets()
      }
      if (raw.settings) {
        store.settings.update(() => ({ ...DEFAULT_SETTINGS, ...raw.settings }))
        applySettingsSideEffects(store, store.settings.get())
      }
      return {
        ok: true,
        message: `导入成功：情景 ${scenarios.length} 个、话术 ${snippets.length} 条、历史 ${history.length} 条（API 密钥未包含在备份中）`
      }
    } catch (err) {
      return { ok: false, message: `导入失败：${err instanceof Error ? err.message : '文件无法解析'}` }
    }
  })

  // ---------- 情景 ----------
  ipcMain.handle('scenario:list', () => store.scenarios.get())
  ipcMain.handle('scenario:save', (_e, data: Scenario & { id?: string }) => {
    const existing = store.scenarios.get().find((s) => s.id === data.id)
    if (existing) {
      const saved: Scenario = { ...existing, ...data, id: existing.id, updatedAt: Date.now() }
      store.scenarios.update((list) => {
        const idx = list.findIndex((s) => s.id === saved.id)
        if (idx >= 0) list[idx] = saved
      })
      return saved
    }
    const saved: Scenario = {
      ...data,
      id: newId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    store.scenarios.update((list) => list.unshift(saved))
    return saved
  })
  ipcMain.handle('scenario:remove', (_e, id: string) => {
    store.scenarios.update((list) => {
      const idx = list.findIndex((s) => s.id === id)
      if (idx >= 0) list.splice(idx, 1)
    })
    if (store.scenarios.get().length === 0) store.ensureScenario()
  })
  ipcMain.handle('scenario:reorder', (_e, ids: string[]) => {
    store.scenarios.update((list) => {
      const byId = new Map(list.map((s) => [s.id, s]))
      const next = ids.map((id) => byId.get(id)).filter((s): s is Scenario => Boolean(s))
      list.splice(0, list.length, ...next)
    })
  })

  // ---------- 供应商 ----------
  ipcMain.handle('provider:list', () => store.providers.get())
  ipcMain.handle('provider:save', (_e, provider: Provider) => {
    store.providers.update((list) => {
      const idx = list.findIndex((p) => p.id === provider.id)
      if (idx >= 0) list[idx] = provider
      else list.push(provider)
    })
  })
  ipcMain.handle('provider:remove', (_e, id: string) => {
    store.providers.update((list) => {
      const idx = list.findIndex((p) => p.id === id)
      if (idx >= 0) list.splice(idx, 1)
    })
  })
  ipcMain.handle('provider:keyInfo', (_e, id: string): KeyInfo => {
    const masked = store.keyMasked(id)
    return { configured: Boolean(store.getKey(id)), masked }
  })
  ipcMain.handle('provider:setKey', (_e, id: string, key: string) => {
    store.setKey(id, key.trim())
  })
  ipcMain.handle('provider:test', async (_e, id: string): Promise<TestResult> => {
    const provider = store.providers.get().find((p) => p.id === id)
    if (!provider) return { ok: false, message: '供应商不存在' }
    const key = store.getKey(id) ?? ''
    if (!key && id !== 'ollama') return { ok: false, message: '请先填写 API Key' }
    return testProvider(provider, key)
  })

  // ---------- 话术库 ----------
  ipcMain.handle('snippet:list', () => store.snippets.get())
  ipcMain.handle('snippet:save', (_e, data: Snippet & { id?: string }) => {
    const existing = store.snippets.get().find((s) => s.id === data.id)
    if (existing) {
      const saved: Snippet = { ...existing, ...data, id: existing.id }
      store.snippets.update((list) => {
        const idx = list.findIndex((s) => s.id === saved.id)
        if (idx >= 0) list[idx] = saved
      })
      return saved
    }
    const saved: Snippet = { ...data, id: newId(), createdAt: Date.now() }
    store.snippets.update((list) => list.push(saved))
    return saved
  })
  ipcMain.handle('snippet:remove', (_e, id: string) => {
    store.snippets.update((list) => {
      const idx = list.findIndex((s) => s.id === id)
      if (idx >= 0) list.splice(idx, 1)
    })
  })

  // ---------- 历史 ----------
  ipcMain.handle('history:list', () => store.history.get())
  ipcMain.handle('history:remove', (_e, id: string) => {
    store.history.update((list) => {
      const idx = list.findIndex((h) => h.id === id)
      if (idx >= 0) list.splice(idx, 1)
    })
  })
  ipcMain.handle('history:clear', () => {
    store.history.update((list) => {
      list.splice(0, list.length)
    })
  })
  ipcMain.handle('history:stats', () => {
    const all = store.history.get()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const today = all.filter((h) => h.ts >= dayStart.getTime()).length
    return {
      today,
      total: all.length,
      scenarios: store.scenarios.get().length,
      snippets: store.snippets.get().length,
      recent: all.slice(-5).reverse()
    }
  })

  // ---------- 设置 ----------
  ipcMain.handle('settings:get', () => store.settings.get())
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    store.settings.update((s) => Object.assign(s, patch))
    applySettingsSideEffects(store, store.settings.get())
  })

  // ---------- LLM ----------
  ipcMain.handle('llm:generate', async (event, req: GenerateRequest, genId: string) => {
    const send = (payload: DeltaEvent): void => {
      if (!event.sender.isDestroyed()) event.sender.send('llm:event', { genId, ...payload })
    }
    try {
      await generation.generate(req, send)
      return { ok: true }
    } catch (err) {
      const error = toLlmError(err)
      send({ type: 'error', error })
      return { ok: false, error }
    }
  })
  ipcMain.on('llm:abort', () => generation.abort())

  // ---------- 全局快捷键（重新绑定） ----------
  ipcMain.handle('hotkey:set', (_e, accelerator: string | null) => {
    globalShortcut.unregisterAll()
    if (!accelerator) return { ok: true, message: '已禁用全局快捷键' }
    try {
      const ok = globalShortcut.register(accelerator, () => showQuickWindow())
      return ok
        ? { ok: true, message: `已设置为 ${accelerator}` }
        : { ok: false, message: `快捷键 ${accelerator} 注册失败，可能已被其他应用占用` }
    } catch {
      return { ok: false, message: `快捷键 ${accelerator} 格式无效` }
    }
  })
}

export function applySettingsSideEffects(store: Store, settings: AppSettings): void {
  nativeTheme.themeSource = settings.theme
  applyTheme(settings.theme)
  app.setLoginItemSettings({ openAtLogin: settings.autoLaunch })
  getQuickWindow()?.setAlwaysOnTop(settings.alwaysOnTop, 'floating')
}

export function registerStartupHotkey(settings: AppSettings): void {
  if (!settings.hotkey) return
  try {
    globalShortcut.register(settings.hotkey, () => showQuickWindow())
  } catch {
    /* 启动时注册失败静默处理，用户可在设置中重新配置 */
  }
}
