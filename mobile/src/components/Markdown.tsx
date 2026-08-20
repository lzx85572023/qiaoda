// 巧答 · Markdown 渲染（AI 输出）与风险提示徽标

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { RISK_RULES } from '@shared/constants'

export function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

export function RiskBadges({ text }: { text: string }): React.JSX.Element | null {
  const hits = RISK_RULES.filter((r) => {
    r.pattern.lastIndex = 0
    return r.pattern.test(text)
  })
  if (hits.length === 0) return null
  const seen = new Set<string>()
  return (
    <div className="risk-row">
      {hits
        .filter((h) => {
          if (seen.has(h.label)) return false
          seen.add(h.label)
          return true
        })
        .map((h) => (
          <span
            key={h.label}
            className={`badge ${h.severity === 'danger' ? 'danger' : 'warn'}`}
            title={h.severity === 'danger' ? '建议人工核对后再发送' : '发送前建议留意'}
          >
            {h.label}
          </span>
        ))}
    </div>
  )
}
