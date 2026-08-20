import type { GenerationMode, Provider, ProviderKind, Scenario } from './types'

// ---------- 供应商预置（"支持所有大模型"：OpenAI 兼容协议覆盖绝大多数，
// 另实现 Anthropic 原生与 Gemini 原生协议） ----------

export interface ProviderPreset {
  id: string
  name: string
  kind: ProviderKind
  baseUrl: string
  models: string[]
  defaultModel: string
  color: string
  note: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    color: '#4D6BFE',
    note: '深度求索 · 高性价比中文模型'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    color: '#10A37F',
    note: 'GPT 系列官方接口'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-opus-4-20250514'],
    defaultModel: 'claude-sonnet-4-20250514',
    color: '#D97757',
    note: 'Claude 原生 Messages 接口'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    defaultModel: 'gemini-2.0-flash',
    color: '#4285F4',
    note: 'Gemini 原生 generateContent 接口'
  },
  {
    id: 'qwen',
    name: '阿里云通义千问',
    kind: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen3-235b-a22b'],
    defaultModel: 'qwen-plus',
    color: '#615CED',
    note: '百炼平台 OpenAI 兼容模式'
  },
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    kind: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-turbo-preview'],
    defaultModel: 'moonshot-v1-32k',
    color: '#161616',
    note: 'Moonshot AI 官方接口'
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    kind: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    defaultModel: 'glm-4-flash',
    color: '#3859FF',
    note: '智谱 AI 开放平台'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'openai',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat', 'MiniMax-Text-01'],
    defaultModel: 'abab6.5s-chat',
    color: '#F55038',
    note: 'MiniMax 开放平台'
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    kind: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['Qwen/Qwen2.5-32B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    defaultModel: 'Qwen/Qwen2.5-32B-Instruct',
    color: '#7C3AED',
    note: '聚合多家开源模型'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini'],
    defaultModel: 'openai/gpt-4o-mini',
    color: '#71717A',
    note: '一个密钥访问多家海外模型'
  },
  {
    id: 'ollama',
    name: 'Ollama（本地）',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    models: ['qwen2.5:7b', 'llama3.1:8b'],
    defaultModel: 'qwen2.5:7b',
    color: '#2F2F2F',
    note: '本地部署，无需密钥，数据不出本机'
  }
]

/** 兼容 OneAPI / NewAPI 等中转网关的预置 */
export const GATEWAY_PRESET: ProviderPreset = {
  id: 'gateway',
  name: '自定义（OpenAI 兼容）',
  kind: 'openai',
  baseUrl: 'https://your-gateway.example.com/v1',
  models: ['your-model'],
  defaultModel: 'your-model',
  color: '#8B8B83',
  note: '任意 OpenAI 兼容端点：OneAPI / NewAPI / vLLM 等'
}

export function presetToProvider(p: ProviderPreset): Provider {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    builtin: true,
    baseUrl: p.baseUrl,
    models: p.models.map((m) => ({ id: m, name: m })),
    defaultModel: p.defaultModel,
    extraHeaders: '',
    extraQuery: '',
    color: p.color,
    note: p.note
  }
}

export const ALL_PROVIDER_PRESETS = [...PROVIDER_PRESETS, GATEWAY_PRESET]

// ---------- 情景 ----------

export const SCENARIO_COLORS = [
  '#2F6B4F',
  '#3D5AA9',
  '#B4592F',
  '#7A5AA6',
  '#B28A2E',
  '#35666E',
  '#A63D5C',
  '#5C5C56'
]

export const SCENARIO_EMOJIS = [
  '💬', '🛍️', '📦', '💻', '📱', '🩺', '🏦', '✈️', '🎮', '🏠', '🚗', '📞',
  '🛒', '⚙️', '🎧', '📚', '💰', '🎁', '🧾', '🍜', '👗', '🐶', '💄', '🎬'
]

export const DEFAULT_SCENARIO_PERSONA = `你是一名经验丰富的资深客服，正在协助一位客服人员回复客户。
要求：
- 只输出可以直接发给客户的回复内容，不要输出分析过程，不要出现"作为AI"之类的表述。
- 语气自然、口语化、有温度，像真人客服在说话，避免生硬书面语和套话。
- 客户消息可能包含多轮对话上下文，注意识别客户最新的一句话/一个问题。
- 如果信息不足以确定答案，给出得体的追问或说明需要核实，绝不编造事实、价格、政策、库存。
- 除非客户主动使用专业词汇，否则避免使用任何专业术语，用普通人听得懂的话解释。
- 不做出无法保证的承诺（如确切的到货时间、赔偿金额）；涉及承诺时先说明以核实为准。`

export const TONE_OPTIONS = ['热情友好', '专业严谨', '简洁直接', '温和耐心', '幽默轻松', '正式礼貌']

// ---------- 生成模式 ----------

export interface ModeMeta {
  id: GenerationMode
  name: string
  desc: string
}

export const MODES: ModeMeta[] = [
  { id: 'reply', name: '回复', desc: '基于对话生成候选回复' },
  { id: 'polish', name: '润色', desc: '改写草稿，表达更清楚' },
  { id: 'plain', name: '白话', desc: '把术语换成客户能懂的话' },
  { id: 'analyze', name: '分析', desc: '判断情绪、意图与策略' }
]

export const MODE_META: Record<GenerationMode, ModeMeta> = Object.fromEntries(
  MODES.map((m) => [m.id, m])
) as Record<GenerationMode, ModeMeta>

export interface PolishStyle {
  id: string
  name: string
  hint: string
}

export const POLISH_STYLES: PolishStyle[] = [
  { id: 'clear', name: '更清晰', hint: '结构清楚、重点突出，可序号分点，先结论后解释' },
  { id: 'gentle', name: '更委婉', hint: '语气柔和，照顾客户感受，避免直接否定' },
  { id: 'concise', name: '更简洁', hint: '删掉冗余，精简到原来的一半以内，一句话说清重点' },
  { id: 'warm', name: '更热情', hint: '更有温度和亲切感，适当使用语气词与表情符号' },
  { id: 'formal', name: '更正式', hint: '书面化、得体，适合官方通知与政策说明' },
  { id: 'casual', name: '更口语', hint: '像朋友聊天一样自然，不生硬' }
]

// ---------- 默认情景 ----------

export function defaultScenario(): Scenario {
  const now = Date.now()
  return {
    id: 'general',
    name: '通用客服',
    emoji: '💬',
    color: SCENARIO_COLORS[0],
    description: '默认情景：适用于大多数客服对话',
    persona: DEFAULT_SCENARIO_PERSONA,
    tones: ['热情友好', '简洁直接'],
    customTone: '',
    knowledge: '',
    templates: [
      {
        id: 't1',
        name: '安抚愤怒客户',
        instruction: '客户情绪激动，先真诚致歉并共情，再给出下一步解决方案，语气要稳。'
      },
      {
        id: 't2',
        name: '催发货解释',
        instruction: '客户催发货：解释物流环节，给出预计时间，强调会跟进，不要做出绝对承诺。'
      },
      {
        id: 't3',
        name: '价格疑问',
        instruction: '客户质疑价格：说明定价构成与当前优惠，不主动承诺降价，可引导领券或活动。'
      }
    ],
    modelBinding: { mode: 'default', providerId: '', model: '' },
    tempMode: 'default',
    temperature: 0.7,
    createdAt: now,
    updatedAt: now
  }
}

// ---------- 合规 / 风险本地启发式 ----------

export interface RiskRule {
  pattern: RegExp
  label: string
  severity: 'warn' | 'danger'
}

export const RISK_RULES: RiskRule[] = [
  { pattern: /保证|担保|肯定|百分百|100%|绝对|一定没|没问题(?!.*核实)|放心/, label: '绝对化承诺', severity: 'warn' },
  { pattern: /赔|补偿|退一赔|三倍|十倍|罚款/, label: '涉及赔付金额', severity: 'danger' },
  { pattern: /(1[3-9]\d{9})|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\d{17}[\dXx])/, label: '含客户隐私信息', severity: 'danger' },
  { pattern: /密码|验证码|身份证|银行卡号/, label: '涉及敏感信息', severity: 'danger' },
  { pattern: /发.?誓|投诉你|举报|找.?领导|报警/, label: '可能激化冲突', severity: 'warn' }
]
