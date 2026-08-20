// 巧答移动版 · 本地存储（WebView localStorage，与桌面版同构的数据模型）

import type {
  AppSettings,
  HistoryItem,
  Provider,
  Scenario,
  Snippet
} from '../shared/types'
import { ALL_PROVIDER_PRESETS, defaultScenario, presetToProvider } from '../shared/constants'
import { DEFAULT_SETTINGS } from '../shared/types'

const P = 'qiaoda.'

export function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(P + key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignore */
  }
  const v = fallback()
  write(key, v)
  return v
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(P + key, JSON.stringify(value))
  } catch {
    /* 存储满等极端情况忽略 */
  }
}

function update<T>(key: string, mutate: (data: T) => void): T {
  const data = read<T>(key, () => {
    throw new Error('unreachable')
  })
  mutate(data)
  write(key, data)
  return data
}

function mobileDefaults(): AppSettings {
  return { ...DEFAULT_SETTINGS, stream: false, hotkey: null, minimizeToTray: false, autoLaunch: false }
}

function ensureProviderPresets(): void {
  const list = read<Provider[]>('providers', () => ALL_PROVIDER_PRESETS.map(presetToProvider))
  let changed = false
  for (const preset of ALL_PROVIDER_PRESETS) {
    if (!list.some((p) => p.id === preset.id)) {
      list.push(presetToProvider(preset))
      changed = true
    }
  }
  if (changed) write('providers', list)
}

function ensureScenario(): void {
  const list = read<Scenario[]>('scenarios', () => [defaultScenario()])
  if (list.length === 0) {
    list.push(defaultScenario())
    write('scenarios', list)
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// ---------- 密钥 ----------
function getKey(providerId: string): string {
  return read<Record<string, string>>('keys', () => ({}) as Record<string, string>)[providerId] ?? ''
}

function setKey(providerId: string, key: string): void {
  update<Record<string, string>>('keys', (k) => {
    if (key) k[providerId] = key
    else delete k[providerId]
  })
}

function keyMasked(providerId: string): string {
  const key = getKey(providerId)
  if (!key) return ''
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

// ---------- 各仓库 ----------
export const scenariosRepo = {
  list: (): Scenario[] => read<Scenario[]>('scenarios', () => [defaultScenario()]),
  save: (data: Scenario & { id?: string }): Scenario => {
    const existing = scenariosRepo.list().find((s) => s.id === data.id)
    if (existing) {
      const saved: Scenario = { ...existing, ...data, id: existing.id, updatedAt: Date.now() }
      update<Scenario[]>('scenarios', (list) => {
        const i = list.findIndex((s) => s.id === saved.id)
        if (i >= 0) list[i] = saved
      })
      return saved
    }
    const saved: Scenario = { ...data, id: newId(), createdAt: Date.now(), updatedAt: Date.now() }
    update<Scenario[]>('scenarios', (list) => list.unshift(saved))
    return saved
  },
  remove: (id: string): void => {
    update<Scenario[]>('scenarios', (list) => {
      const i = list.findIndex((s) => s.id === id)
      if (i >= 0) list.splice(i, 1)
    })
    ensureScenario()
  },
  reorder: (ids: string[]): void => {
    update<Scenario[]>('scenarios', (list) => {
      const byId = new Map(list.map((s) => [s.id, s]))
      const next = ids.map((id) => byId.get(id)).filter((s): s is Scenario => Boolean(s))
      list.splice(0, list.length, ...next)
    })
  }
}

export const providersRepo = {
  list: (): Provider[] => {
    ensureProviderPresets()
    return read<Provider[]>('providers', () => ALL_PROVIDER_PRESETS.map(presetToProvider))
  },
  save: (provider: Provider): void => {
    update<Provider[]>('providers', (list) => {
      const i = list.findIndex((p) => p.id === provider.id)
      if (i >= 0) list[i] = provider
      else list.push(provider)
    })
  },
  remove: (id: string): void => {
    update<Provider[]>('providers', (list) => {
      const i = list.findIndex((p) => p.id === id)
      if (i >= 0) list.splice(i, 1)
    })
  },
  keyInfo: (id: string): { configured: boolean; masked: string } => ({
    configured: Boolean(getKey(id)),
    masked: keyMasked(id)
  }),
  setKey,
  getKey
}

export const snippetsRepo = {
  list: (): Snippet[] => read<Snippet[]>('snippets', () => [] as Snippet[]),
  save: (data: Snippet & { id?: string }): Snippet => {
    const existing = snippetsRepo.list().find((s) => s.id === data.id)
    if (existing) {
      const saved: Snippet = { ...existing, ...data, id: existing.id }
      update<Snippet[]>('snippets', (list) => {
        const i = list.findIndex((s) => s.id === saved.id)
        if (i >= 0) list[i] = saved
      })
      return saved
    }
    const saved: Snippet = { ...data, id: newId(), createdAt: Date.now() }
    update<Snippet[]>('snippets', (list) => list.push(saved))
    return saved
  },
  remove: (id: string): void => {
    update<Snippet[]>('snippets', (list) => {
      const i = list.findIndex((s) => s.id === id)
      if (i >= 0) list.splice(i, 1)
    })
  }
}

export const historyRepo = {
  list: (): HistoryItem[] => read<HistoryItem[]>('history', () => [] as HistoryItem[]),
  add: (item: HistoryItem): void => {
    const limit = settingsRepo.get().historyLimit || 500
    update<HistoryItem[]>('history', (list) => {
      list.push(item)
      if (list.length > limit) list.splice(0, list.length - limit)
    })
  },
  remove: (id: string): void => {
    update<HistoryItem[]>('history', (list) => {
      const i = list.findIndex((h) => h.id === id)
      if (i >= 0) list.splice(i, 1)
    })
  },
  clear: (): void => {
    write('history', [] as HistoryItem[])
  },
  stats: (): { today: number; total: number; scenarios: number; snippets: number; recent: HistoryItem[] } => {
    const all = historyRepo.list()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    return {
      today: all.filter((h) => h.ts >= dayStart.getTime()).length,
      total: all.length,
      scenarios: scenariosRepo.list().length,
      snippets: snippetsRepo.list().length,
      recent: all.slice(-5).reverse()
    }
  }
}

export const settingsRepo = {
  get: (): AppSettings => {
    const s = read<AppSettings>('settings', mobileDefaults)
    // 兼容旧字段缺失
    return { ...mobileDefaults(), ...s }
  },
  set: (patch: Partial<AppSettings>): void => {
    update<AppSettings>('settings', (s) => Object.assign(s, patch))
  }
}
