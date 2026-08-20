// 巧答 · 话术库

import { useEffect, useMemo, useState } from 'react'
import { Copy, Library, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { Scenario, Snippet } from '@shared/types'
import { Badge, Button, Card, ConfirmDialog, Empty, Field, Input, Modal, Select, Textarea, useToast } from '../components/ui'
import { fmtDateTime } from '../lib/util'

export default function Snippets({ scenarios }: { scenarios: Scenario[] }): React.JSX.Element {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')
  const [filterScenario, setFilterScenario] = useState('all')
  const [editing, setEditing] = useState<Snippet | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Snippet | null>(null)
  const toast = useToast()

  useEffect(() => {
    void window.qiaoda.snippets.list().then(setSnippets)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snippets
      .filter((s) => (filterScenario === 'all' ? true : s.scenarioId === filterScenario))
      .filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [snippets, query, filterScenario])

  const scenarioName = (id: string | null): string =>
    id ? (scenarios.find((s) => s.id === id)?.name ?? '未指定情景') : '通用'

  const copy = async (s: Snippet): Promise<void> => {
    await window.qiaoda.copyText(s.content)
    toast('已复制到剪贴板')
  }

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">话术库</div>
          <div className="page-sub">收藏好用的回复，需要时搜索即用；快捷窗里也能一键收藏</div>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            新建话术
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 11, top: 10, color: 'var(--ink-3)', pointerEvents: 'none' }}
          />
          <Input
            style={{ paddingLeft: 32 }}
            placeholder="搜索标题、内容或标签"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          style={{ width: 180 }}
          value={filterScenario}
          options={[
            { value: 'all', label: '全部情景' },
            ...scenarios.map((s) => ({ value: s.id, label: s.name }))
          ]}
          onChange={(e) => setFilterScenario(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <Empty
            icon={<Library size={20} />}
            title={snippets.length === 0 ? '还没有收藏的话术' : '没有匹配的话术'}
            desc={
              snippets.length === 0
                ? '在快捷窗生成回复后，点击结果卡片上的星标即可收藏到这里'
                : '换个关键词试试'
            }
            action={
              snippets.length === 0 ? (
                <Button variant="primary" size="md" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                  新建话术
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 12
          }}
        >
          {filtered.map((s) => (
            <Card key={s.id} className="snippet-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--ink-2)',
                      marginTop: 6,
                      lineHeight: 1.7,
                      userSelect: 'text',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {s.content}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2, flex: 'none' }}>
                  <Button size="sm" variant="ghost" icon={<Copy size={13} />} onClick={() => void copy(s)} title="复制" />
                  <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => setEditing(s)} title="编辑" />
                  <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setDeleting(s)} title="删除" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge tone="plain">{scenarioName(s.scenarioId)}</Badge>
                {s.tags.map((t) => (
                  <Badge key={t} tone="accent">
                    {t}
                  </Badge>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {fmtDateTime(s.createdAt)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SnippetModal
        open={creating || editing !== null}
        snippet={editing}
        scenarios={scenarios}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSaved={async (saved) => {
          setSnippets(await window.qiaoda.snippets.list())
          setCreating(false)
          setEditing(null)
          toast(saved ? '已保存' : '话术已更新', 'success')
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="删除话术"
        message={`确定删除「${deleting?.title ?? ''}」吗？`}
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!deleting) return
          await window.qiaoda.snippets.remove(deleting.id)
          setSnippets(await window.qiaoda.snippets.list())
          toast('已删除')
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function SnippetModal({
  open,
  snippet,
  scenarios,
  onClose,
  onSaved
}: {
  open: boolean
  snippet: Snippet | null
  scenarios: Scenario[]
  onClose: () => void
  onSaved: (saved: Snippet) => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [scenarioId, setScenarioId] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(snippet?.title ?? '')
    setContent(snippet?.content ?? '')
    setTags((snippet?.tags ?? []).join(', '))
    setScenarioId(snippet?.scenarioId ?? '')
  }, [open, snippet])

  return (
    <Modal
      open={open}
      title={snippet ? '编辑话术' : '新建话术'}
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
                id: snippet?.id ?? '',
                title: title.trim() || content.trim().slice(0, 24),
                content: content.trim(),
                tags: tags
                  .split(/[,，]/)
                  .map((t) => t.trim())
                  .filter(Boolean),
                scenarioId: scenarioId || null,
                createdAt: snippet?.createdAt ?? Date.now()
              })
              onSaved(saved)
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <Field label="标题" desc="留空则自动取内容开头">
        <Input value={title} placeholder="一句话标题，便于检索" onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="话术内容">
        <Textarea
          rows={7}
          value={content}
          placeholder="粘贴要收藏的回复内容"
          onChange={(e) => setContent(e.target.value)}
          autoFocus
        />
      </Field>
      <Field label="标签" desc="用逗号分隔，如：催发货, 安抚">
        <Input value={tags} placeholder="催发货, 安抚" onChange={(e) => setTags(e.target.value)} />
      </Field>
      <Field label="所属情景">
        <Select
          value={scenarioId || 'none'}
          options={[
            { value: 'none', label: '通用（所有情景可用）' },
            ...scenarios.map((s) => ({ value: s.id, label: s.name }))
          ]}
          onChange={(e) => setScenarioId(e.target.value === 'none' ? '' : e.target.value)}
        />
      </Field>
    </Modal>
  )
}
