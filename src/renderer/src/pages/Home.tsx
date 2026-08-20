// 巧答 · 工作台

import { useEffect, useState } from 'react'
import { ArrowRight, MessageSquareText, Sparkles, Zap } from 'lucide-react'
import type { Stats } from '@shared/types'
import { Badge, Button, Card, Kbd } from '../components/ui'
import { fmtTime, relTime, todayLabel, truncate } from '../lib/util'
import { MODE_META } from '@shared/constants'
import type { Route } from '../App'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export default function Home({
  onNavigate,
  version
}: {
  onNavigate: (r: Route) => void
  version: string
}): React.JSX.Element {
  const [stats, setStats] = useState<Stats | null>(null)
  const [hotkey, setHotkey] = useState<string | null>(null)

  useEffect(() => {
    void window.qiaoda.history.stats().then(setStats)
    void window.qiaoda.settings.get().then((s) => setHotkey(s.hotkey))
  }, [])

  const statItems = [
    { label: '今日生成', value: stats?.today ?? 0 },
    { label: '累计生成', value: stats?.total ?? 0 },
    { label: '情景', value: stats?.scenarios ?? 0 },
    { label: '话术', value: stats?.snippets ?? 0 }
  ]

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">
            {greeting()}，开始今天的客服工作
          </div>
          <div className="page-sub">{todayLabel()} · 巧答 v{version}</div>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none'
            }}
          >
            <Zap size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>快捷窗随时待命</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
              在任意客服系统里按快捷键呼出，粘贴对话即可生成回复，不打断当前工作
            </div>
          </div>
          {hotkey && <Kbd>{hotkey.replace('Ctrl+', 'Ctrl ').replace('Alt+', 'Alt ')}</Kbd>}
          <Button variant="primary" icon={<MessageSquareText size={15} />} onClick={() => void window.qiaoda.showQuick()}>
            打开快捷窗
          </Button>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
        {statItems.map((s) => (
          <Card key={s.label}>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, letterSpacing: 0 }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14, marginTop: 14, alignItems: 'start' }}>
        <Card title="最近生成" pad={false}>
          <div style={{ padding: '6px 22px 16px' }}>
            {!stats || stats.recent.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '14px 0', textAlign: 'center' }}>
                还没有生成记录，按快捷键呼出快捷窗试试吧
              </div>
            ) : (
              stats.recent.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 0',
                    borderBottom: '1px solid var(--line)'
                  }}
                >
                  <Badge tone="accent">{MODE_META[h.mode]?.name ?? h.mode}</Badge>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {truncate(h.input, 40)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>{relTime(h.ts)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="快速上手" pad={false}>
          <div style={{ padding: '8px 22px 16px' }}>
            {[
              { t: '回复', d: '粘贴客户消息，生成多条候选回复，一键复制' },
              { t: '润色', d: '把不清楚的草稿改写成清晰、得体的表达' },
              { t: '白话', d: '把专业术语换成客户听得懂的大白话' },
              { t: '分析', d: '快速判断客户情绪与意图，给出应对策略' }
            ].map((f) => (
              <div key={f.t} style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
                <span style={{ color: 'var(--accent)', flex: 'none', fontSize: 13, fontWeight: 600, width: 34 }}>
                  {f.t}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>{f.d}</span>
              </div>
            ))}
            <Button
              variant="soft"
              size="sm"
              style={{ marginTop: 8 }}
              icon={<ArrowRight size={13} />}
              onClick={() => onNavigate({ name: 'scenarios' })}
            >
              配置我的情景
            </Button>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: 'var(--ink-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Sparkles size={12} />
        所有数据仅保存在本机；发送给模型的内容默认自动脱敏
      </div>
    </div>
  )
}
