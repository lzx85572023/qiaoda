// 巧答移动版 · 情景管理（列表 + 编辑器）

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Layers, Plus, Trash2 } from 'lucide-react'
import type { Provider, Scenario } from '@shared/types'
import {
  DEFAULT_SCENARIO_PERSONA,
  SCENARIO_COLORS,
  SCENARIO_EMOJIS,
  TONE_OPTIONS,
  defaultScenario
} from '@shared/constants'
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Field,
  Input,
  SaveState,
  Select,
  Textarea,
  useToast
} from '../components/ui'

function freshScenario(): Scenario {
  const base = defaultScenario()
  return {
    ...base,
    id: '',
    name: '',
    emoji: '💬',
    color: SCENARIO_COLORS[Math.floor(Math.random() * SCENARIO_COLORS.length)],
    description: ''
  }
}

export default function ScenariosPage(): React.JSX.Element {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [deleting, setDeleting] = useState<Scenario | null>(null)
  const toast = useToast()

  const reload = useCallback(async () => {
    setScenarios(await window.qiaoda.scenarios.list())
  }, [])

  useEffect(() => {
    void reload()
    void window.qiaoda.providers.list().then(setProviders)
  }, [reload])

  return (
    <div className="m-page">
      {view === 'list' ? (
        <>
          <div className="m-page-head">
            <div style={{ flex: 1 }}>
              <div className="m-page-title">情景</div>
              <div className="m-page-sub">每个平台一个情景，角色与知识库互不影响</div>
            </div>
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditingId(null)
                setView('edit')
              }}
            >
              新建
            </Button>
          </div>

          {scenarios.length === 0 ? (
            <Card>
              <div className="empty" style={{ padding: '40px 20px' }}>
                <div className="icon">
                  <Layers size={20} />
                </div>
                <div className="title">还没有情景</div>
                <div className="desc">创建第一个情景，比如「淘宝售后」「微信客服」</div>
              </div>
            </Card>
          ) : (
            <div className="stack" style={{ marginTop: 0 }}>
              {scenarios.map((s) => (
                <Card key={s.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      className="m-scene-card"
                      style={{ flex: 1, minWidth: 0 }}
                      onClick={() => {
                        setEditingId(s.id)
                        setView('edit')
                      }}
                    >
                      <span
                        className="m-scene-emoji"
                        style={{ background: `${s.color}1f`, border: `1px solid ${s.color}45` }}
                      >
                        {s.emoji}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: 14.5 }}>{s.name}</span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 12,
                            color: 'var(--ink-3)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {s.description || '暂无描述'}
                        </span>
                      </span>
                    </button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setDeleting(s)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    <Badge tone="plain">{s.tones.length} 项语气</Badge>
                    {s.knowledge.trim() && <Badge tone="accent">已配置知识库</Badge>}
                    {s.templates.length > 0 && <Badge tone="plain">{s.templates.length} 条快捷指令</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <ScenarioEditor
          id={editingId}
          providers={providers}
          onBack={() => {
            void reload()
            setView('list')
          }}
          onSaved={() => void reload()}
          onDeleted={() => {
            void reload()
            setView('list')
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="删除情景"
        message={`确定删除「${deleting?.name ?? ''}」吗？`}
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!deleting) return
          await window.qiaoda.scenarios.remove(deleting.id)
          await reload()
          toast('情景已删除')
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function ScenarioEditor({
  id,
  providers,
  onBack,
  onSaved,
  onDeleted
}: {
  id: string | null
  providers: Provider[]
  onBack: () => void
  onSaved: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<Scenario | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()
  const draftRef = useRef<Scenario | null>(null)
  const deletedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      if (id) {
        const list = await window.qiaoda.scenarios.list()
        const found = list.find((s) => s.id === id)
        if (alive && found) setDraft(found)
      } else {
        setDraft(freshScenario())
      }
    })()
    return () => {
      alive = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (deletedRef.current) return
      const d = draftRef.current
      if (d && d.name.trim()) void window.qiaoda.scenarios.save(d)
    }
  }, [id])

  draftRef.current = draft

  const scheduleSave = useCallback(() => {
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const d = draftRef.current
      if (!d || !d.name.trim()) return
      await window.qiaoda.scenarios.save(d)
      setDraft((prev) => (prev ? { ...prev, id: prev.id || '' } : prev))
      onSaved()
      setSaveState('saved')
    }, 650)
  }, [onSaved])

  const patch = useCallback(
    (p: Partial<Scenario>) => {
      setDraft((prev) => {
        if (!prev) return prev
        const next = { ...prev, ...p }
        draftRef.current = next
        return next
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  if (!draft) {
    return <div className="m-hint">加载中…</div>
  }

  const bindingProvider = providers.find((p) => p.id === draft.modelBinding.providerId) ?? null
  const bindingModelOptions = bindingProvider
    ? [
        ...bindingProvider.models.map((m) => ({ value: m.id, label: m.name })),
        ...(!bindingProvider.models.some((m) => m.id === draft.modelBinding.model)
          ? [{ value: draft.modelBinding.model, label: `${draft.modelBinding.model}（自定义）` }]
          : [])
      ]
    : []

  return (
    <div>
      <div className="m-page-head">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={15} />} onClick={onBack}>
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <div className="m-page-title">{draft.name.trim() || '未命名情景'}</div>
          <div className="m-page-sub">
            <SaveState state={saveState} />
          </div>
        </div>
        {id && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)} />
        )}
      </div>

      <div className="stack" style={{ marginTop: 0 }}>
        <Card title="基本信息">
          <Field label="情景名称">
            <Input
              value={draft.name}
              placeholder="例如：淘宝售后 / 微信客服"
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>
          <Field label="图标">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SCENARIO_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => patch({ emoji: e })}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: draft.emoji === e ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                    background: draft.emoji === e ? 'var(--accent-soft)' : 'var(--bg-soft)',
                    fontSize: 17,
                    cursor: 'pointer'
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <Field label="主题色">
            <div style={{ display: 'flex', gap: 9 }}>
              {SCENARIO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ color: c })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: draft.color === c ? '2px solid var(--ink)' : '2px solid transparent',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="情景描述">
            <Input
              value={draft.description}
              placeholder="例如：天猫旗舰店售后，处理退换货与物流"
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>
        </Card>

        <Card
          title="角色设定"
          desc="模型回复的底层人设与行为准则"
          actions={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patch({ persona: DEFAULT_SCENARIO_PERSONA })}
            >
              恢复默认
            </Button>
          }
        >
          <Textarea
            value={draft.persona}
            rows={9}
            onChange={(e) => patch({ persona: e.target.value })}
          />
        </Card>

        <Card title="语气规则">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TONE_OPTIONS.map((t) => (
              <Chip
                key={t}
                active={draft.tones.includes(t)}
                onClick={() =>
                  patch({
                    tones: draft.tones.includes(t) ? draft.tones.filter((x) => x !== t) : [...draft.tones, t]
                  })
                }
              >
                {t}
              </Chip>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <Input
              value={draft.customTone}
              placeholder="补充语气要求，例如：称呼客户为「亲」"
              onChange={(e) => patch({ customTone: e.target.value })}
            />
          </div>
        </Card>

        <Card title="知识库" desc="产品信息、售后政策、FAQ，模型不编造">
          <Textarea
            value={draft.knowledge}
            rows={6}
            placeholder={'例如：\n- 支持 7 天无理由退货\n- 现货 48 小时内发货'}
            onChange={(e) => patch({ knowledge: e.target.value })}
          />
        </Card>

        <Card title="快捷指令" desc="生成回复时可一键追加的要求">
          {draft.templates.map((t, idx) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <Input
                style={{ width: 130, flex: 'none' }}
                value={t.name}
                placeholder="名称"
                onChange={(e) => {
                  const templates = [...draft.templates]
                  templates[idx] = { ...t, name: e.target.value }
                  patch({ templates })
                }}
              />
              <Input
                style={{ flex: 1 }}
                value={t.instruction}
                placeholder="指令内容"
                onChange={(e) => {
                  const templates = [...draft.templates]
                  templates[idx] = { ...t, instruction: e.target.value }
                  patch({ templates })
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 size={14} />}
                onClick={() => patch({ templates: draft.templates.filter((x) => x.id !== t.id) })}
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="soft"
            icon={<Plus size={13} />}
            onClick={() =>
              patch({ templates: [...draft.templates, { id: crypto.randomUUID(), name: '', instruction: '' }] })
            }
          >
            添加
          </Button>
        </Card>

        <Card title="模型">
          <Field label="模型来源">
            <Select
              value={draft.modelBinding.mode}
              options={[
                { value: 'default', label: '跟随全局默认' },
                { value: 'custom', label: '为此情景单独指定' }
              ]}
              onChange={(e) =>
                patch({ modelBinding: { ...draft.modelBinding, mode: e.target.value as 'default' | 'custom' } })
              }
            />
          </Field>
          {draft.modelBinding.mode === 'custom' && (
            <>
              <Field label="供应商">
                <Select
                  value={draft.modelBinding.providerId}
                  options={providers.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(e) =>
                    patch({
                      modelBinding: {
                        mode: 'custom',
                        providerId: e.target.value,
                        model: providers.find((p) => p.id === e.target.value)?.defaultModel ?? ''
                      }
                    })
                  }
                />
              </Field>
              <Field label="模型名称">
                <Select
                  value={draft.modelBinding.model}
                  options={bindingModelOptions}
                  onChange={(e) => patch({ modelBinding: { ...draft.modelBinding, model: e.target.value } })}
                />
              </Field>
            </>
          )}
          <Field label="温度">
            <Select
              value={draft.tempMode}
              options={[
                { value: 'default', label: '跟随全局默认' },
                { value: 'custom', label: '自定义' }
              ]}
              onChange={(e) => patch({ tempMode: e.target.value as 'default' | 'custom' })}
            />
          </Field>
          {draft.tempMode === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={draft.temperature}
                onChange={(e) => patch({ temperature: Number(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ width: 34, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13 }}>
                {draft.temperature.toFixed(1)}
              </span>
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除情景"
        message={`确定删除「${draft.name || '未命名情景'}」吗？`}
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (draft.id) {
            deletedRef.current = true
            await window.qiaoda.scenarios.remove(draft.id)
            toast('情景已删除')
          }
          onDeleted()
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
