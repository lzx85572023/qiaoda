// 巧答 · 情景编辑器（自动保存）

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Plus, RotateCcw, Trash2 } from 'lucide-react'
import type { Provider, Scenario } from '@shared/types'
import {
  DEFAULT_SCENARIO_PERSONA,
  SCENARIO_COLORS,
  SCENARIO_EMOJIS,
  TONE_OPTIONS,
  defaultScenario
} from '@shared/constants'
import { Button, Card, Chip, ConfirmDialog, Field, Input, SaveState, Select, Textarea, useToast } from '../components/ui'

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

export default function ScenarioEditor({
  id,
  onBack,
  onSaved
}: {
  id: string | null
  onBack: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<Scenario | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
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
      const ps = await window.qiaoda.providers.list()
      if (alive) setProviders(ps)
    })()
    return () => {
      alive = false
      if (timerRef.current) clearTimeout(timerRef.current)
      // 卸载时兜底保存（已删除的情景除外）
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
      try {
        const saved = await window.qiaoda.scenarios.save(d)
        setDraft((prev) => (prev ? { ...prev, id: saved.id } : prev))
        onSaved()
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
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
    return (
      <div className="page-inner" style={{ color: 'var(--ink-3)' }}>
        加载中…
      </div>
    )
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
    <div className="page-inner">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button size="sm" variant="ghost" icon={<ArrowLeft size={14} />} onClick={onBack}>
            返回
          </Button>
          <div>
            <div className="page-title">{draft.name.trim() || '未命名情景'}</div>
            <div className="page-sub">
              <SaveState state={saveState} />
            </div>
          </div>
        </div>
        {id && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirmDelete(true)}>
            删除
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>
        <div className="stack">
          <Card title="基本信息">
            <Field label="情景名称">
              <Input
                value={draft.name}
                placeholder="例如：淘宝售后 / 微信客服 / 软件技术支持"
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
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: draft.emoji === e ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                      background: draft.emoji === e ? 'var(--accent-soft)' : 'var(--bg-soft)',
                      fontSize: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="主题色">
              <div style={{ display: 'flex', gap: 8 }}>
                {SCENARIO_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ color: c })}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: c,
                      border: draft.color === c ? '2px solid var(--ink)' : '2px solid transparent',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  />
                ))}
              </div>
            </Field>
            <Field label="情景描述" desc="一句话说明这个情景服务的场景，会随提示词提供给模型">
              <Input
                value={draft.description}
                placeholder="例如：天猫旗舰店售后，处理退换货、物流、差评安抚"
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
          </Card>

          <Card
            title="角色设定"
            desc="模型回复的底层人设与行为准则，写得越具体，回复越像你"
            actions={
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw size={13} />}
                onClick={() => patch({ persona: DEFAULT_SCENARIO_PERSONA })}
              >
                恢复默认
              </Button>
            }
          >
            <Textarea
              value={draft.persona}
              rows={10}
              onChange={(e) => patch({ persona: e.target.value })}
            />
          </Card>

          <Card title="语气规则" desc="生成回复时强制遵循的语气风格，可多选并补充自定义要求">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TONE_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  active={draft.tones.includes(t)}
                  onClick={() =>
                    patch({
                      tones: draft.tones.includes(t)
                        ? draft.tones.filter((x) => x !== t)
                        : [...draft.tones, t]
                    })
                  }
                >
                  {t}
                </Chip>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Input
                value={draft.customTone}
                placeholder="补充语气要求，例如：称呼客户为「亲」，多用波浪号"
                onChange={(e) => patch({ customTone: e.target.value })}
              />
            </div>
          </Card>

          <Card
            title="知识库"
            desc="产品信息、售后政策、FAQ……模型回答以这里的内容为准，没有的内容不会编造"
          >
            <Textarea
              value={draft.knowledge}
              rows={7}
              placeholder={'例如：\n- 支持 7 天无理由退货，运费险由平台承担\n- 发货时效：现货 48 小时内发出，预售以页面为准\n- 保修：整机一年，主要部件三年'}
              onChange={(e) => patch({ knowledge: e.target.value })}
            />
          </Card>

          <Card title="快捷指令" desc="快捷窗生成回复时可一键追加的要求，应对常见场景">
            {draft.templates.map((t, idx) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <Input
                  style={{ width: 170, flex: 'none' }}
                  value={t.name}
                  placeholder="指令名称"
                  onChange={(e) => {
                    const templates = [...draft.templates]
                    templates[idx] = { ...t, name: e.target.value }
                    patch({ templates })
                  }}
                />
                <Input
                  style={{ flex: 1 }}
                  value={t.instruction}
                  placeholder="指令内容，例如：客户催发货，解释物流并给出预计时间"
                  onChange={(e) => {
                    const templates = [...draft.templates]
                    templates[idx] = { ...t, instruction: e.target.value }
                    patch({ templates })
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={13} />}
                  onClick={() => patch({ templates: draft.templates.filter((x) => x.id !== t.id) })}
                  title="删除指令"
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="soft"
              icon={<Plus size={13} />}
              onClick={() =>
                patch({
                  templates: [
                    ...draft.templates,
                    { id: crypto.randomUUID(), name: '', instruction: '' }
                  ]
                })
              }
            >
              添加快捷指令
            </Button>
          </Card>
        </div>

        <div className="stack">
          <Card title="模型" desc="该情景使用的模型，可跟随全局默认">
            <Field label="模型来源">
              <Select
                value={draft.modelBinding.mode}
                options={[
                  { value: 'default', label: '跟随全局默认' },
                  { value: 'custom', label: '为此情景单独指定' }
                ]}
                onChange={(e) =>
                  patch({
                    modelBinding: {
                      ...draft.modelBinding,
                      mode: e.target.value as 'default' | 'custom'
                    }
                  })
                }
              />
            </Field>
            {draft.modelBinding.mode === 'custom' && (
              <>
                <Field label="供应商">
                  <Select
                    value={draft.modelBinding.providerId}
                    options={providers.map((p) => ({
                      value: p.id,
                      label: p.name
                    }))}
                    onChange={(e) =>
                      patch({
                        modelBinding: {
                          mode: 'custom',
                          providerId: e.target.value,
                          model:
                            providers.find((p) => p.id === e.target.value)?.defaultModel ?? ''
                        }
                      })
                    }
                  />
                </Field>
                <Field label="模型名称" desc="可从列表选择，也可直接输入">
                  <Select
                    value={draft.modelBinding.model}
                    options={bindingModelOptions}
                    onChange={(e) =>
                      patch({
                        modelBinding: { ...draft.modelBinding, model: e.target.value }
                      })
                    }
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

          <Card title="使用提示" pad>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              在快捷窗右上角切换情景，每个情景的回复风格与知识库相互独立。多平台客服建议每个平台建立一个情景，例如：
              <ul style={{ paddingLeft: 18, marginTop: 4 }}>
                <li>电商售后：强调退换货政策与安抚</li>
                <li>软件支持：术语白话解释 + 分步骤指导</li>
                <li>官方客服：正式礼貌 + 合规表达</li>
              </ul>
            </div>
          </Card>
        </div>
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
          onSaved()
          onBack()
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
