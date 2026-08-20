// 巧答 · 数据存储层
// 全部数据保存在 userData 下的 JSON 文件（原子写入：tmp + rename）。
// API 密钥使用 Electron safeStorage（Windows DPAPI）加密后单独存放。

import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppSettings, HistoryItem, Provider, Scenario, Snippet } from '../shared/types'
import { ALL_PROVIDER_PRESETS, defaultScenario, presetToProvider } from '../shared/constants'
import { DEFAULT_SETTINGS } from '../shared/types'

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function atomicWrite(file: string, text: string): void {
  const tmp = `${file}.tmp`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, file)
}

class JsonFile<T> {
  private cache: T | null = null
  constructor(
    private file: string,
    private fallback: () => T
  ) {}

  load(): T {
    if (this.cache !== null) return this.cache
    if (existsSync(this.file)) {
      try {
        this.cache = JSON.parse(readFileSync(this.file, 'utf8')) as T
        return this.cache as T
      } catch {
        // 文件损坏时回退默认值，并备份损坏文件
        try {
          renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
        } catch {
          /* ignore */
        }
      }
    }
    this.cache = this.fallback()
    this.save()
    return this.cache as T
  }

  get(): T {
    return this.load()
  }

  save(): void {
    if (this.cache === null) return
    atomicWrite(this.file, JSON.stringify(this.cache, null, 2))
  }

  update(mutate: (data: T) => void): T {
    const data = this.load()
    mutate(data)
    this.save()
    return data
  }
}

export interface QuickState {
  quickBounds: { x: number; y: number } | null
  mainBounds: { x: number; y: number; width: number; height: number } | null
}

export class Store {
  scenarios: JsonFile<Scenario[]>
  providers: JsonFile<Provider[]>
  snippets: JsonFile<Snippet[]>
  history: JsonFile<HistoryItem[]>
  settings: JsonFile<AppSettings>
  quick: JsonFile<QuickState>
  private keys: JsonFile<Record<string, string>>

  constructor() {
    const dir = join(app.getPath('userData'), 'data')
    ensureDir(dir)

    this.scenarios = new JsonFile<Scenario[]>(join(dir, 'scenarios.json'), () => [defaultScenario()])
    this.providers = new JsonFile<Provider[]>(join(dir, 'providers.json'), () =>
      ALL_PROVIDER_PRESETS.map(presetToProvider)
    )
    this.snippets = new JsonFile<Snippet[]>(join(dir, 'snippets.json'), () => [])
    this.history = new JsonFile<HistoryItem[]>(join(dir, 'history.json'), () => [])
    this.settings = new JsonFile<AppSettings>(join(dir, 'settings.json'), () => ({ ...DEFAULT_SETTINGS }))
    this.quick = new JsonFile<QuickState>(join(dir, 'quick.json'), () => ({
      quickBounds: null,
      mainBounds: null
    }))
    this.keys = new JsonFile<Record<string, string>>(join(dir, 'keys.json'), () => ({}))
  }

  /** 首次使用 / 升级时补齐内置供应商预置 */
  ensureProviderPresets(): void {
    this.providers.update((list) => {
      for (const preset of ALL_PROVIDER_PRESETS) {
        if (!list.some((p) => p.id === preset.id)) list.push(presetToProvider(preset))
      }
    })
  }

  ensureScenario(): void {
    const list = this.scenarios.get()
    if (list.length === 0) {
      this.scenarios.update((l) => l.push(defaultScenario()))
    }
  }

  // ---------- 密钥（safeStorage 加密） ----------
  getKey(providerId: string): string | null {
    const enc = this.keys.get()[providerId]
    if (!enc) return null
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'))
      }
    } catch {
      /* 解密失败视为未配置 */
    }
    return null
  }

  setKey(providerId: string, key: string): void {
    this.keys.update((k) => {
      if (!key) {
        delete k[providerId]
        return
      }
      if (safeStorage.isEncryptionAvailable()) {
        k[providerId] = safeStorage.encryptString(key).toString('base64')
      } else {
        // 极少数环境无系统加密能力时，退化为 base64 存储并在 UI 提示
        k[providerId] = Buffer.from(key, 'utf8').toString('base64')
      }
    })
  }

  keyMasked(providerId: string): string {
    const key = this.getKey(providerId)
    if (!key) return ''
    if (key.length <= 8) return '****'
    return `${key.slice(0, 4)}****${key.slice(-4)}`
  }

  encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  // ---------- 历史（带上限修剪） ----------
  addHistory(item: HistoryItem): void {
    const limit = this.settings.get().historyLimit || 500
    this.history.update((list) => {
      list.push(item)
      if (list.length > limit) list.splice(0, list.length - limit)
    })
  }
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
