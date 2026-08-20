// 巧答 · 历史记录

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, History as HistoryIcon, Search, Star, Trash2 } from 'lucide-react'
import type { GenerationMode, HistoryItem, Scenario, Snippet } from '@shared/types'
import { MODE_META } from '@shared/constants'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, Select, Textarea, useToast } from '../components/ui'
import { fmtDateTime, truncate } from '../lib/util'
import { Markdown } from '../components/Markdown'

const PAGE_SIZE = 20

const MODE_TONE: Record<GenerationMode, 'accent' | 'warn' | 'danger' | 'plain'> = {
  reply: 'accent',
  polish: 'warn',
  plain: 'danger',
  analyze: 'plain'
}

export default function History(): React.JSX.Element {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [query, setQuery] = useState('')
  const [modeFilter, setModeFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<HistoryItem | null>(null)
  const [savingToSnippet, setSavingToSnippet] = useState<HistoryItem | null>(null)
  const toast = useToast()

  useEffect(() => {
    void window.qiaoda.history.list().then(setItems)
    void window.qiaoda.scenarios.list().then(setScenarios)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((h) => (modeFilter === 'all' ? true : h.mode === modeFilter))
      .filter(
        (h) =>
          !q ||
          h.input.toLowerCase().includes(q) ||
          h.output.toLowerCase().includes(q) ||
          h.scenarioName.toLowerCase().includes(q)
      )
      .sort((a, b) => b.ts - a.ts)
  }, [items, query, modeFilter])

  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copy = async (text: string): Promise<void> => {
    await window.qiaoda.copyText(text)
    toast('已复制到剪贴板')
  }

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">历史记录</div>
          <div className="page-sub">每次生成的输入与结果都保存在本机，可随时回看、复制、收藏</div>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="md" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)}>
            清空历史
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 11, top: 10, color: 'var(--ink-3)', pointerEvents: 'none' }}
          />
          <Input
            style={{ paddingLeft: 32 }}
            placeholder="搜索输入或输出内容"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          style={{ width: 150 }}
          value={modeFilter}
          options={[
            { value: 'all', label: '全部模式' },
            ...Object.values(MODE_META).map((m) => ({ value: m.id, label: m.name }))
          ]}
          onChange={(e) => setModeFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<HistoryIcon size={20} />}
            title={items.length === 0 ? '还没有生成记录' : '没有匹配的记录'}
            desc={items.length === 0 ? '按 Ctrl+Alt+K 呼出快捷窗，粘贴客户消息开始使用' : '换个关键词试试'}
          />
        </Card>
      ) : (
        <div className="stack" style={{ marginTop: 0 }}>
          {filtered.slice(0, visible).map((h) => (
            <Card key={h.id} pad={false}>
              <button
                type="button"
                onClick={() => toggle(h.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '12px 18px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {expanded.has(h.id) ? (
                  <ChevronDown size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                ) : (
                  <ChevronRight size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
                )}
                <Badge tone={MODE_TONE[h.mode]}>{MODE_META[h.mode]?.name ?? h.mode}</Badge>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {truncate(h.input || h.output, 60)}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>{h.scenarioName}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', flex: 'none' }}>{fmtDateTime(h.ts)}</span>
              </button>

              {expanded.has(h.id) && (
                <div style={{ padding: '4px 18px 16px 41px' }}>
                  {h.input && (
                    <div
                      style={{
                        background: 'var(--bg-soft)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        fontSize: 13,
                        color: 'var(--ink-2)',
                        marginBottom: 10,
                        lineHeight: 1.7,
                        userSelect: 'text',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {h.input}
                      {h.context && (
                        <div
                          style={{
                            borderTop: '1px dashed var(--line-strong)',
                            marginTop: 8,
                            paddingTop: 8,
                            color: 'var(--ink-3)'
                          }}
                        >
                          <span style={{ fontSize: 11.5 }}>上下文：</span>
                          {h.context}
                        </div>
                      )}
                      {h.extra && (
                        <div style={{ marginTop: 6, color: 'var(--accent)' }}>补充要求：{h.extra}</div>
                      )}
                    </div>
                  )}
                  {h.output && <Markdown text={h.output} />}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 10,
                      flexWrap: 'wrap'
                    }}
                  >
                    <Button size="sm" variant="soft" icon={<Copy size={13} />} onClick={() => void copy(h.output)}>
                      复制回复
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Star size={13} />}
                      onClick={() => setSavingToSnippet(h)}
                    >
                      收藏为话术
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirmDelete(h)}>
                      删除
                    </Button>
                    <span
                      style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}
                    >
                      {h.modelLabel}
                      {h.usage ? ` · ${h.usage.prompt + h.usage.completion} tokens` : ''} · {h.durationMs}ms
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {filtered.length > visible && (
            <div style={{ textAlign: 'center' }}>
              <Button size="md" variant="ghost" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                加载更多（还有 {filtered.length - visible} 条）
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空历史"
        message={`确定清空全部 ${items.length} 条历史记录吗？此操作不可撤销。`}
        confirmText="清空"
        danger
        onConfirm={async () => {
          await window.qiaoda.history.clear()
          setItems([])
          toast('历史已清空')
        }}
        onClose={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="删除记录"
        message="确定删除这条记录吗？"
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!confirmDelete) return
          await window.qiaoda.history.remove(confirmDelete.id)
          setItems(await window.qiaoda.history.list())
        }}
        onClose={() => setConfirmDelete(null)}
      />

      <SnippetFromHistoryModal
        item={savingToSnippet}
        scenes={scenarios}
        onClose={() => setSavingToSnippet(null)}
        onSaved={(s: Snippet) => {
          toast('已收藏到话术库', 'success')
          void s
        }}
      />
    </div>
  )
}

function SnippetFromHistoryModal({
  item,
  scenes,
  onClose,
  onSaved
}: {
  item: HistoryItem | null
  scenes: Scenario[]
  onClose: () => void
  onSaved: (s: Snippet) => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scenarioId, setScenarioId] = useState('')

  useEffect(() => {
    if (!item) return
    setTitle(item.input.trim().slice(0, 24))
    setContent(item.output)
    setScenarioId(item.scenarioId || '')
  }, [item])

  return (
    <Modal
      open={item !== null}
      title="收藏为话术"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!content.trim()}
            onClick={async () => {
              const saved = await window.qiaoda.snippets.save({
                id: '',
                title: title.trim() || content.trim().slice(0, 24),
                content: content.trim(),
                tags: [],
                scenarioId: scenarioId || null,
                createdAt: Date.now()
              })
              onSaved(saved)
              onClose()
            }}
          >
            收藏
          </Button>
        </>
      }
    >
      <Field label="标题">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="内容">
        <Textarea rows={7} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      <Field label="所属情景">
        <Select
          value={scenarioId || 'none'}
          options={[
            { value: 'none', label: '通用' },
            ...scenes.map((s) => ({ value: s.id, label: s.name }))
          ]}
          onChange={(e) => setScenarioId(e.target.value === 'none' ? '' : e.target.value)}
        />
      </Field>
    </Modal>
  )
}
