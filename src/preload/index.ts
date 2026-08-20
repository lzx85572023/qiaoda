// 巧答 · preload：contextBridge 安全桥接，渲染进程唯一的能力入口

import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  DeltaEvent,
  GenerateRequest,
  GenerateResult,
  HistoryItem,
  KeyInfo,
  LlmError,
  Provider,
  Scenario,
  Snippet,
  Stats,
  TestResult
} from '@shared/types'

export interface AppInfo {
  version: string
  dataDir: string
  encryption: boolean
}

const api = {
  // ---- 应用 ----
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke('app:copyText', text),
  showMain: (): Promise<void> => ipcRenderer.invoke('app:showMain'),
  showQuick: (): Promise<void> => ipcRenderer.invoke('app:showQuick'),
  hideQuick: (): Promise<void> => ipcRenderer.invoke('app:hideQuick'),
  setQuickPinned: (pinned: boolean): Promise<void> => ipcRenderer.invoke('app:setQuickPinned', pinned),
  isQuickPinned: (): Promise<boolean> => ipcRenderer.invoke('app:isQuickPinned'),
  openDataDir: (): Promise<void> => ipcRenderer.invoke('app:openDataDir'),
  exportData: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('app:exportData'),
  importData: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('app:importData'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),

  // ---- 情景 ----
  scenarios: {
    list: (): Promise<Scenario[]> => ipcRenderer.invoke('scenario:list'),
    save: (s: Scenario): Promise<Scenario> => ipcRenderer.invoke('scenario:save', s),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('scenario:remove', id),
    reorder: (ids: string[]): Promise<void> => ipcRenderer.invoke('scenario:reorder', ids)
  },

  // ---- 供应商 ----
  providers: {
    list: (): Promise<Provider[]> => ipcRenderer.invoke('provider:list'),
    save: (p: Provider): Promise<void> => ipcRenderer.invoke('provider:save', p),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('provider:remove', id),
    keyInfo: (id: string): Promise<KeyInfo> => ipcRenderer.invoke('provider:keyInfo', id),
    setKey: (id: string, key: string): Promise<void> => ipcRenderer.invoke('provider:setKey', id, key),
    test: (id: string): Promise<TestResult> => ipcRenderer.invoke('provider:test', id)
  },

  // ---- 话术库 ----
  snippets: {
    list: (): Promise<Snippet[]> => ipcRenderer.invoke('snippet:list'),
    save: (s: Snippet): Promise<Snippet> => ipcRenderer.invoke('snippet:save', s),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('snippet:remove', id)
  },

  // ---- 历史 ----
  history: {
    list: (): Promise<HistoryItem[]> => ipcRenderer.invoke('history:list'),
    remove: (id: string): Promise<void> => ipcRenderer.invoke('history:remove', id),
    clear: (): Promise<void> => ipcRenderer.invoke('history:clear'),
    stats: (): Promise<Stats> => ipcRenderer.invoke('history:stats')
  },

  // ---- 设置 ----
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<void> => ipcRenderer.invoke('settings:set', patch)
  },
  hotkey: {
    set: (accel: string | null): Promise<{ ok: boolean; message: string }> =>
      ipcRenderer.invoke('hotkey:set', accel)
  },

  // ---- 生成 ----
  generate: (
    req: GenerateRequest,
    onDelta: (text: string) => void
  ): Promise<GenerateResult> => {
    const genId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    return new Promise<GenerateResult>((resolve, reject) => {
      const handler = (_e: Electron.IpcRendererEvent, payload: DeltaEvent & { genId: string }): void => {
        if (payload.genId !== genId) return
        if (payload.type === 'delta') {
          onDelta(payload.text)
        } else if (payload.type === 'done') {
          ipcRenderer.removeListener('llm:event', handler)
          resolve(payload.result)
        } else if (payload.type === 'error') {
          ipcRenderer.removeListener('llm:event', handler)
          reject(payload.error as LlmError)
        }
      }
      ipcRenderer.on('llm:event', handler)
      ipcRenderer
        .invoke('llm:generate', req, genId)
        .then((r: { ok: boolean; error?: LlmError }) => {
          if (r && r.ok === false && r.error) {
            ipcRenderer.removeListener('llm:event', handler)
            reject(r.error)
          }
        })
        .catch(() => {
          ipcRenderer.removeListener('llm:event', handler)
          reject({ code: 'ipc', message: '与主进程通信失败' } as LlmError)
        })
    })
  },
  abort: (): void => {
    ipcRenderer.send('llm:abort')
  },

  // ---- 事件 ----
  onQuickShown: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('quick:shown', handler)
    return () => ipcRenderer.removeListener('quick:shown', handler)
  }
}

export type QiaodaApi = typeof api

contextBridge.exposeInMainWorld('qiaoda', api)
