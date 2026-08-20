// 巧答 · 模型输出解析（宽容多级回退，保证任何情况下都有可用结果）
// 供主进程（历史存档）与渲染进程（快捷窗展示）共用

export interface ParsedReplies {
  style: string
  text: string
}

export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (esc) {
      esc = false
      continue
    }
    if (ch === '\\') {
      esc = true
      continue
    }
    if (ch === '"') inStr = !inStr
    else if (!inStr && ch === '{') depth++
    else if (!inStr && ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

export function parseReplies(text: string): ParsedReplies[] {
  const j = extractJson(text) as { replies?: { style?: string; text?: string }[] } | null
  if (j?.replies && Array.isArray(j.replies)) {
    const list = j.replies
      .map((r, i) => ({
        style: (r?.style ?? '').trim() || `回复 ${i + 1}`,
        text: (r?.text ?? '').trim()
      }))
      .filter((r) => r.text)
    if (list.length) return list
  }
  // 回退 1：按编号分隔符切分
  const numbered = text.split(/【?回复\s*[1-9１-９一二三]】?[：:]?/).filter((s) => s.trim())
  if (numbered.length > 1) {
    return numbered.map((s, i) => ({ style: `回复 ${i + 1}`, text: s.trim() }))
  }
  // 回退 2：整段作为一条
  const t = text.trim()
  return t ? [{ style: '回复', text: t }] : []
}

export function parsePlain(text: string): { text: string; terms: { term: string; explanation: string }[] } {
  const j = extractJson(text) as { text?: string; terms?: { term?: string; explanation?: string }[] } | null
  if (j && typeof j.text === 'string' && j.text.trim()) {
    const terms = Array.isArray(j.terms)
      ? j.terms
          .map((t) => ({ term: (t?.term ?? '').trim(), explanation: (t?.explanation ?? '').trim() }))
          .filter((t) => t.term)
      : []
    return { text: j.text.trim(), terms }
  }
  return { text: text.trim(), terms: [] }
}

export interface AnalyzeResult {
  emotion?: string
  intent?: string
  strategy?: string
  needs?: string[]
  risks?: string[]
}

export function parseAnalyze(text: string): AnalyzeResult | null {
  const j = extractJson(text) as Record<string, unknown> | null
  if (j && (j.emotion || j.intent || j.strategy)) {
    const out: AnalyzeResult = {}
    for (const k of ['emotion', 'intent', 'strategy'] as const) {
      if (typeof j[k] === 'string') out[k] = j[k] as string
    }
    for (const k of ['needs', 'risks'] as const) {
      if (Array.isArray(j[k])) out[k] = (j[k] as unknown[]).map((v) => String(v)).filter(Boolean)
    }
    return out
  }
  return null
}
