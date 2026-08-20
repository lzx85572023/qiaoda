// 巧答 · 提示词构建：按模式与情景组装系统/用户消息，并解析模型输出

import type { AppSettings, GenerateRequest, Scenario } from '@shared/types'
import { POLISH_STYLES } from '@shared/constants'

export interface ResolvedTarget {
  providerId: string
  model: string
  temperature: number
}

/** 解析本次生成使用的模型与温度：情景自定义 > 全局默认 */
export function resolveTarget(scenario: Scenario, settings: AppSettings): ResolvedTarget {
  const binding = scenario.modelBinding
  const providerId = binding.mode === 'custom' && binding.providerId ? binding.providerId : settings.defaultProviderId
  const model = binding.mode === 'custom' && binding.model ? binding.model : settings.defaultModel
  const temperature = scenario.tempMode === 'custom' ? scenario.temperature : settings.temperature
  return { providerId, model, temperature }
}

function toneText(scenario: Scenario): string {
  const parts = [...scenario.tones]
  if (scenario.customTone?.trim()) parts.push(scenario.customTone.trim())
  return parts.length ? parts.join('、') : '自然、得体、有温度'
}

function personaBlock(scenario: Scenario): string {
  const lines: string[] = []
  lines.push(`【客服情景】${scenario.name}`)
  if (scenario.description?.trim()) lines.push(`情景说明：${scenario.description.trim()}`)
  lines.push('')
  lines.push(`【角色设定】${scenario.persona.trim() || '你是一名资深客服回复助手，输出可直接发给客户的回复。'}`)
  lines.push(`【语气要求】${toneText(scenario)}`)
  if (scenario.knowledge?.trim()) {
    lines.push('')
    lines.push(`【知识库】以下为必须遵守的产品信息与政策，回答以知识库为准，知识库没有的内容不得编造：`)
    lines.push(scenario.knowledge.trim())
  } else {
    lines.push('')
    lines.push('【知识库】未配置。信息不足时必须追问或说明需要核实，不得编造事实、价格、政策。')
  }
  return lines.join('\n')
}

const OUTPUT_RULES = [
  '直接输出可发送给客户的回复，不要输出分析过程，不要出现"作为AI""抱歉，我"之类面向客服的话。',
  '语言自然口语化，像真人客服在说话，避免生硬书面语和套话。',
  '除非客户主动使用专业词汇，否则避免任何专业术语，用普通人听得懂的话解释。',
  '不做出无法保证的承诺（如确切到货时间、赔偿金额）；涉及承诺时说明以核实为准。'
]

function replyStyles(count: number): { name: string; focus: string }[] {
  const all = [
    { name: '标准', focus: '标准得体，先致意再解答，条理清楚' },
    { name: '热情', focus: '热情亲切，多用温度表达与共情' },
    { name: '简洁', focus: '简洁直接，一两句话说清重点' }
  ]
  return all.slice(0, Math.min(3, Math.max(1, count)))
}

export interface BuiltPrompt {
  system: string
  user: string
}

export function buildPrompt(req: GenerateRequest, scenario: Scenario, settings: AppSettings): BuiltPrompt {
  const base = personaBlock(scenario)
  const input = req.input.trim()

  if (req.mode === 'reply') {
    const styles = replyStyles(settings.replyCount)
    const styleSpec = styles.map((s, i) => `第 ${i + 1} 条风格为「${s.name}」，侧重：${s.focus}`).join('；')
    const system = [
      base,
      '',
      '【任务】根据客户消息生成回复建议。',
      ...OUTPUT_RULES,
      `共生成 ${styles.length} 条候选回复，要求：${styleSpec}。`,
      '',
      '【输出格式】只输出一个 JSON 对象，不要任何其他文字、不要代码块、不要解释：',
      `{"replies":[{"style":"${styles[0].name}","text":"回复正文"},...]}`,
      'text 为可直接发送的回复正文；若信息不足，text 写成得体的追问或核实说明。'
    ].join('\n')
    const user = [
      '客户消息 / 对话：',
      input,
      req.context?.trim() ? `\n完整对话上下文：\n${req.context.trim()}` : '',
      req.extra?.trim() ? `\n补充要求：${req.extra.trim()}` : ''
    ]
      .filter(Boolean)
      .join('\n')
    return { system, user }
  }

  if (req.mode === 'polish') {
    const style = POLISH_STYLES.find((s) => s.id === req.style) ?? POLISH_STYLES[0]
    const system = [
      base,
      '',
      '【任务】把客服起草的回复改写得更适合发送给客户。',
      `本次改写方向：${style.name}——${style.hint}。`,
      ...OUTPUT_RULES,
      '',
      '【输出格式】只输出改写后的文本本身，不要任何解释、不要代码块、不要引号包裹。'
    ].join('\n')
    const user = `客服草稿：\n${input}`
    return { system, user }
  }

  if (req.mode === 'plain') {
    const system = [
      base,
      '',
      '【任务】把客服要发送的内容改写成普通客户能听懂的大白话。',
      '要求：',
      '- 把专业术语替换为通俗说法，必要时给出生活化比喻；',
      '- 拆分长句，逻辑顺序清楚，先结论后解释；',
      '- 保持原意完整，不得改变或省略关键信息（时间、金额、条件、责任）；',
      '- 保持礼貌与客服身份。',
      '',
      '【输出格式】只输出一个 JSON 对象，不要任何其他文字、不要代码块：',
      '{"text":"改写后的大白话","terms":[{"term":"原文术语","explanation":"通俗解释"}]}',
      'terms 只列出原文中真正出现的专业术语并给出解释；原文没有术语时 terms 为空数组。'
    ].join('\n')
    const user = `原文：\n${input}`
    return { system, user }
  }

  // analyze
  const system = [
    base,
    '',
    '【任务】分析客户消息，帮助客服判断如何应对。',
    '',
    '【输出格式】只输出一个 JSON 对象，不要任何其他文字、不要代码块：',
    '{"emotion":"客户情绪（一句话）","intent":"主要意图（一句话）","needs":["诉求1","诉求2"],"strategy":"建议的回复策略与要点","risks":["风险提示（如情绪升级、过度承诺等，没有则为空数组）"]}'
  ].join('\n')
  const user = ['客户消息 / 对话：', input, req.context?.trim() ? `\n完整对话上下文：\n${req.context.trim()}` : '']
    .filter(Boolean)
    .join('\n')
  return { system, user }
}
