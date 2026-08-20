// 巧答 · 隐私脱敏：发送给模型前自动打码，输出后还原。
// 占位符采用 ASCII 安全形式 <PII1>，提示词要求模型保持原样。

export interface MaskResult {
  text: string
  map: Map<string, string>
}

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b1[3-9]\d{9}\b/g, label: '手机号' },
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: '邮箱' },
  { re: /\b\d{17}[\dXx]\b/g, label: '身份证号' },
  { re: /\b\d{13,19}\b/g, label: '银行卡号' }
]

export function maskText(input: string): MaskResult {
  const map = new Map<string, string>()
  let text = input
  let n = 0
  for (const { re } of PATTERNS) {
    re.lastIndex = 0
    text = text.replace(re, (match) => {
      if (!map.has(match)) {
        n += 1
        map.set(match, `<PII${n}>`)
      }
      return map.get(match) as string
    })
  }
  return { text, map }
}

export function maskFields(req: { input: string; context?: string }): {
  input: string
  context: string
  map: Map<string, string>
} {
  const r1 = maskText(req.input)
  const map = new Map(r1.map)
  let context = req.context ?? ''
  if (context) {
    const r2 = maskText(context)
    for (const [k, v] of r2.map) {
      if (!map.has(k)) map.set(k, v)
    }
    context = r2.text
  }
  return { input: r1.text, context, map }
}

export function restoreText(text: string, map: Map<string, string>): string {
  if (map.size === 0) return text
  let out = text
  for (const [original, token] of map) {
    out = out.split(token).join(original)
  }
  return out
}

export const PII_NOTE =
  '（注意：以上文本中的 <PIIn> 是已脱敏的客户隐私信息占位符，回复时请保持占位符原样，不要改写、删除或补全，不要输出真实个人信息。）'
