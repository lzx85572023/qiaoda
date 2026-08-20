// 巧答移动版 · window.qiaoda 桥接实现（与桌面 preload 相同的 API 面）

import { Clipboard } from '@capacitor/clipboard'
import type {
  AppSettings,
  ExportBundle,
  GenerateRequest,
  GenerateResult,
  HistoryItem,
  KeyInfo,
  Provider,
  Scenario,
  Snippet,
  TestResult
} from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'
import { testProvider } from '../llm/client'
import { abortGeneration, generate } from './generate'
import { historyRepo, providersRepo, scenariosRepo, settingsRepo, snippetsRepo } from './store'

const EXPORT_FORMAT_VERSION = 1

async function noop(): Promise<void> {
  return undefined
}

async function exportData(): Promise<{ ok: boolean; message: string }> {
  const bundle: ExportBundle = {
    app: 'qiaoda',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: Date.now(),
    scenarios: scenariosRepo.list(),
    snippets: snippetsRepo.list(),
    history: historyRepo.list(),
    providers: providersRepo.list(),
    settings: settingsRepo.get()
  }
  await Clipboard.write({ string: JSON.stringify(bundle) })
  return { ok: true, message: '备份 JSON 已复制到剪贴板（不含 API 密钥）' }
}

async function importData(): Promise<{ ok: boolean; message: string }> {
  try {
    const { value } = await Clipboard.read()
    if (!value) return { ok: false, message: '剪贴板为空：请先复制备份 JSON' }
    const raw = JSON.parse(value) as Partial<ExportBundle>
    if (!raw || raw.app !== 'qiaoda' || typeof raw.formatVersion !== 'number') {
      return { ok: false, message: '剪贴板内容不是有效的巧答备份' }
    }
    if (Array.isArray(raw.scenarios)) localStorage.setItem('qiaoda.scenarios', JSON.stringify(raw.scenarios))
    if (Array.isArray(raw.snippets)) localStorage.setItem('qiaoda.snippets', JSON.stringify(raw.snippets))
    if (Array.isArray(raw.history)) localStorage.setItem('qiaoda.history', JSON.stringify(raw.history))
    if (Array.isArray(raw.providers)) localStorage.setItem('qiaoda.providers', JSON.stringify(raw.providers))
    if (raw.settings) {
      localStorage.setItem('qiaoda.settings', JSON.stringify({ ...DEFAULT_SETTINGS, ...raw.settings }))
    }
    return {
      ok: true,
      message: `导入成功：情景 ${Array.isArray(raw.scenarios) ? raw.scenarios.length : 0} 个、话术 ${Array.isArray(raw.snippets) ? raw.snippets.length : 0} 条、历史 ${Array.isArray(raw.history) ? raw.history.length : 0} 条`
    }
  } catch (e) {
    return { ok: false, message: `导入失败：${e instanceof Error ? e.message : '内容无法解析'}` }
  }
}

export interface MobileBridge {
  info: () => Promise<{ version: string; dataDir: string; encryption: boolean }>
  copyText: (text: string) => Promise<void>
  clipboardRead: () => Promise<string>
  showMain: () => Promise<void>
  showQuick: () => Promise<void>
  hideQuick: () => Promise<void>
  setQuickPinned: (p: boolean) => Promise<void>
  isQuickPinned: () => Promise<boolean>
  openDataDir: () => Promise<void>
  exportData: () => Promise<{ ok: boolean; message: string }>
  importData: () => Promise<{ ok: boolean; message: string }>
  quit: () => Promise<void>
  scenarios: {
    list: () => Promise<Scenario[]>
    save: (s: Scenario) => Promise<Scenario>
    remove: (id: string) => Promise<void>
    reorder: (ids: string[]) => Promise<void>
  }
  providers: {
    list: () => Promise<Provider[]>
    save: (p: Provider) => Promise<void>
    remove: (id: string) => Promise<void>
    keyInfo: (id: string) => Promise<KeyInfo>
    setKey: (id: string, key: string) => Promise<void>
    test: (id: string) => Promise<TestResult>
  }
  snippets: {
    list: () => Promise<Snippet[]>
    save: (s: Snippet) => Promise<Snippet>
    remove: (id: string) => Promise<void>
  }
  history: {
    list: () => Promise<HistoryItem[]>
    remove: (id: string) => Promise<void>
    clear: () => Promise<void>
    stats: () => Promise<{ today: number; total: number; scenarios: number; snippets: number; recent: HistoryItem[] }>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (patch: Partial<AppSettings>) => Promise<void>
  }
  hotkey: { set: (accel: string | null) => Promise<{ ok: boolean; message: string }> }
  generate: (req: GenerateRequest, onDelta: (text: string) => void) => Promise<GenerateResult>
  abort: () => void
  onQuickShown: (cb: () => void) => () => void
}

export function installBridge(): void {
  const bridge: MobileBridge = {
    info: async () => ({
      version: '1.0.0',
      dataDir: '本机应用存储（WebView localStorage）',
      encryption: false
    }),
    copyText: async (text: string) => {
      await Clipboard.write({ string: String(text ?? '') })
    },
    clipboardRead: async () => {
      const { value } = await Clipboard.read()
      return value ?? ''
    },
    showMain: noop,
    showQuick: noop,
    hideQuick: noop,
    setQuickPinned: noop,
    isQuickPinned: async () => false,
    openDataDir: noop,
    exportData,
    importData,
    quit: noop,
    scenarios: {
      list: async () => scenariosRepo.list(),
      save: async (s) => scenariosRepo.save(s),
      remove: async (id) => scenariosRepo.remove(id),
      reorder: async (ids) => scenariosRepo.reorder(ids)
    },
    providers: {
      list: async () => providersRepo.list(),
      save: async (p) => providersRepo.save(p),
      remove: async (id) => providersRepo.remove(id),
      keyInfo: async (id) => providersRepo.keyInfo(id),
      setKey: async (id, key) => providersRepo.setKey(id, key.trim()),
      test: async (id) => {
        const provider = providersRepo.list().find((p) => p.id === id)
        if (!provider) return { ok: false, message: '供应商不存在' }
        const key = providersRepo.getKey(id)
        if (!key && id !== 'ollama') return { ok: false, message: '请先填写 API Key' }
        return testProvider(provider, key)
      }
    },
    snippets: {
      list: async () => snippetsRepo.list(),
      save: async (s) => snippetsRepo.save(s),
      remove: async (id) => snippetsRepo.remove(id)
    },
    history: {
      list: async () => historyRepo.list(),
      remove: async (id) => historyRepo.remove(id),
      clear: async () => historyRepo.clear(),
      stats: async () => historyRepo.stats()
    },
    settings: {
      get: async () => settingsRepo.get(),
      set: async (patch) => settingsRepo.set(patch)
    },
    hotkey: {
      set: async () => ({ ok: true, message: '移动端无需全局快捷键' })
    },
    generate: async (req, onDelta) => generate(req, onDelta),
    abort: () => abortGeneration(),
    onQuickShown: () => () => undefined
  }

  ;(window as unknown as { qiaoda: MobileBridge }).qiaoda = bridge
}
