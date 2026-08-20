// 巧答 · 情景管理（列表）

import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import type { Scenario } from '@shared/types'
import { Badge, Button, Card, ConfirmDialog, Empty, useToast } from '../components/ui'

export default function Scenarios({
  onEdit
}: {
  onEdit: (id: string) => void
}): React.JSX.Element {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [deleting, setDeleting] = useState<Scenario | null>(null)
  const toast = useToast()

  useEffect(() => {
    void window.qiaoda.scenarios.list().then(setScenarios)
  }, [])

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">情景</div>
          <div className="page-sub">每个平台建一个情景：角色设定、语气、知识库互不影响，快捷窗一键切换</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => onEdit('')}>
            新建情景
          </Button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <Card>
          <Empty
            icon={<Layers size={20} />}
            title="还没有情景"
            desc="创建第一个情景，比如「淘宝售后」「微信客服」，每个情景有独立的角色设定与知识库"
            action={
              <Button variant="primary" size="md" icon={<Plus size={14} />} onClick={() => onEdit('')}>
                新建情景
              </Button>
            }
          />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14
          }}
        >
          {scenarios.map((s) => (
            <Card key={s.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: `${s.color}1f`,
                    border: `1px solid ${s.color}45`,
                    fontSize: 19,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none'
                  }}
                >
                  {s.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{s.name}</div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {s.description || '暂无描述'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge tone="plain">{s.tones.length} 项语气</Badge>
                {s.knowledge.trim() && <Badge tone="accent">已配置知识库</Badge>}
                {s.templates.length > 0 && <Badge tone="plain">{s.templates.length} 条快捷指令</Badge>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Button
                  size="sm"
                  variant="soft"
                  style={{ flex: 1 }}
                  onClick={() => onEdit(s.id)}
                >
                  编辑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  onClick={() => setDeleting(s)}
                  title="删除情景"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="删除情景"
        message={`确定删除「${deleting?.name ?? ''}」吗？该情景的配置将一并删除（话术库与历史记录不受影响）。`}
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!deleting) return
          await window.qiaoda.scenarios.remove(deleting.id)
          setScenarios(await window.qiaoda.scenarios.list())
          toast('情景已删除')
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
