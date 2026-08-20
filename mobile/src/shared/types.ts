// 巧答 · 全应用共享类型（主进程 / preload / 渲染进程共用）

export type ThemePref = 'system' | 'light' | 'dark'
export type ProviderKind = 'openai' | 'anthropic' | 'gemini'
export type GenerationMode = 'reply' | 'polish' | 'plain' | 'analyze'
export type BindMode = 'default' | 'custom'

export interface ProviderModel {
  id: string
  name: string
}

export interface Provider {
  id: string
  name: string
  kind: ProviderKind
  builtin: boolean
  baseUrl: string
  models: ProviderModel[]
  defaultModel: string
  /** 自定义请求头，"Key: Value" 每行一条 */
  extraHeaders: string
  /** 自定义 URL 查询参数，"key=value" 每行一条 */
  extraQuery: string
  /** 列表头像底色 */
  color: string
  note?: string
}

export interface PromptTemplate {
  id: string
  name: string
  instruction: string
}

export interface ModelBinding {
  mode: BindMode
  providerId: string
  model: string
}

export interface Scenario {
  id: string
  name: string
  emoji: string
  color: string
  description: string
  /** 角色设定（系统提示词的主体） */
  persona: string
  /** 语气规则（预置项） */
  tones: string[]
  /** 自定义语气补充 */
  customTone: string
  /** 知识库（产品信息 / 政策 / FAQ） */
  knowledge: string
  /** 快捷指令模板 */
  templates: PromptTemplate[]
  modelBinding: ModelBinding
  tempMode: BindMode
  temperature: number
  createdAt: number
  updatedAt: number
}

export interface Snippet {
  id: string
  title: string
  content: string
  tags: string[]
  scenarioId: string | null
  createdAt: number
}

export interface Usage {
  prompt: number
  completion: number
}

export interface HistoryItem {
  id: string
  ts: number
  mode: GenerationMode
  scenarioId: string
  scenarioName: string
  modelLabel: string
  input: string
  context: string
  extra: string
  style: string
  output: string
  usage: Usage | null
  durationMs: number
}

export interface AppSettings {
  theme: ThemePref
  /** 全局快捷键（Electron accelerator，null 表示禁用） */
  hotkey: string | null
  hideOnBlur: boolean
  alwaysOnTop: boolean
  masking: boolean
  minimizeToTray: boolean
  autoLaunch: boolean
  historyLimit: number
  stream: boolean
  replyCount: number
  defaultProviderId: string
  defaultModel: string
  temperature: number
}

export interface GenerateRequest {
  mode: GenerationMode
  scenarioId: string
  input: string
  context?: string
  extra?: string
  style?: string
}

export interface GenerateResult {
  text: string
  usage: Usage | null
  durationMs: number
  modelLabel: string
  masked: boolean
}

export interface LlmError {
  code: string
  message: string
}

export interface Stats {
  today: number
  total: number
  scenarios: number
  snippets: number
  recent: HistoryItem[]
}

export interface KeyInfo {
  configured: boolean
  masked: string
}

export interface TestResult {
  ok: boolean
  message: string
  models?: string[]
}

export interface ExportBundle {
  app: string
  formatVersion: number
  exportedAt: number
  scenarios: Scenario[]
  snippets: Snippet[]
  history: HistoryItem[]
  providers: Provider[]
  settings: AppSettings
}

/** 生成请求的进度事件 */
export type DeltaEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; result: GenerateResult }
  | { type: 'error'; error: LlmError }

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  hotkey: 'Ctrl+Alt+K',
  hideOnBlur: true,
  alwaysOnTop: true,
  masking: true,
  minimizeToTray: true,
  autoLaunch: false,
  historyLimit: 500,
  stream: true,
  replyCount: 3,
  defaultProviderId: 'deepseek',
  defaultModel: 'deepseek-chat',
  temperature: 0.7
}
