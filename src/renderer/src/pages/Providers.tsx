// 巧答 · 模型与供应商管理

import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyRound, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { Provider, ProviderModel } from '@shared/types'
import { ALL_PROVIDER_PRESETS, presetToProvider } from '@shared/constants'
import { Badge, Button, Card, ConfirmDialog, Field, Input, SaveState, Select, Textarea, useToast } from '../components/ui'

function newCustomProvider(): Provider {
  return {
    id: crypto.randomUUID(),
    name: '自定义供应商',
    kind: 'openai',
    builtin: false,
    baseUrl: '',
    models: [],
    defaultModel: '',
    extraHeaders: '',
    extraQuery: '',
    color: '#8B8B83',
    note: ''
  }
}

export default function Providers(): React.JSX.Element {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Provider | null>(null)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [keyMasked, setKeyMasked] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null)
  const [newModel, setNewModel] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()
  const draftRef = useRef<Provider | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(async () => {
    const list = await window.qiaoda.providers.list()
    setProviders(list)
    return list
  }, [])

  useEffect(() => {
    void reload().then((list) => {
      if (list.length) setSelectedId(list[0].id)
    })
  }, [reload])

  useEffect(() => {
    if (!selectedId) return
    const p = providers.find((x) => x.id === selectedId)
    setDraft(p ? { ...p } : null)
    setKeyInput('')
    setTestResult(null)
    if (p) {
      void window.qiaoda.providers.keyInfo(p.id).then((k) => {
        setKeyConfigured(k.configured)
        setKeyMasked(k.masked)
      })
    }
  }, [selectedId, providers])

  draftRef.current = draft

  const scheduleSave = useCallback(() => {
    setSaveState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const d = draftRef.current
      if (!d || !d.name.trim()) return
      await window.qiaoda.providers.save(d)
      setSaveState('saved')
    }, 650)
  }, [])

  const patch = useCallback(
    (p: Partial<Provider>) => {
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

  const saveKey = async (): Promise<void> => {
    if (!draft || !keyInput.trim()) {
      toast('请输入密钥', 'error')
      return
    }
    setSavingKey(true)
    await window.qiaoda.providers.setKey(draft.id, keyInput.trim())
    const k = await window.qiaoda.providers.keyInfo(draft.id)
    setKeyConfigured(k.configured)
    setKeyMasked(k.masked)
    setKeyInput('')
    setSavingKey(false)
    toast('密钥已保存（本机加密存储）', 'success')
  }

  const runTest = async (): Promise<void> => {
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    const r = await window.qiaoda.providers.test(draft.id)
    setTestResult(r)
    setTesting(false)
    if (r.ok) toast('连接成功', 'success')
    else toast(r.message, 'error')
  }

  if (!draft) {
    return (
      <div className="page-inner">
        <div className="page-head">
          <div>
            <div className="page-title">模型与供应商</div>
            <div className="page-sub">接入任意大模型：OpenAI 兼容协议覆盖绝大多数服务，另有 Claude 与 Gemini 原生协议</div>
          </div>
        </div>
      </div>
    )
  }

  const addModel = (): void => {
    const name = newModel.trim()
    if (!name) return
    const list: ProviderModel[] = [...draft.models, { id: name, name }]
    patch({ models: list, defaultModel: draft.defaultModel || name })
    setNewModel('')
  }

  const removeModel = (mid: string): void => {
    const models = draft.models.filter((m) => m.id !== mid)
    patch({ models, defaultModel: draft.defaultModel === mid ? '' : draft.defaultModel })
  }

  const resetBuiltin = (): void => {
    const preset = ALL_PROVIDER_PRESETS.find((p) => p.id === draft.id)
    if (!preset) return
    patch(presetToProvider(preset))
    toast('已恢复该供应商的默认配置（密钥保持不变）')
  }

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">模型与供应商</div>
          <div className="page-sub">接入任意大模型：OpenAI 兼容协议覆盖绝大多数服务，另有 Claude 与 Gemini 原生协议</div>
        </div>
        <div className="page-actions">
          <SaveState state={saveState} />
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={15} />}
            onClick={async () => {
              const p = newCustomProvider()
              await window.qiaoda.providers.save(p)
              setSelectedId(p.id)
              await reload()
            }}
          >
            添加自定义
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <div className="stack" style={{ marginTop: 0 }}>
          {providers.map((p) => (
            <Card key={p.id} className={p.id === selectedId ? 'provider-active' : ''}>
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0
                }}
                onClick={() => setSelectedId(p.id)}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: p.color,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none'
                  }}
                >
                  {p.name.slice(0, 2)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{p.name}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11.5,
                      color: 'var(--ink-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {p.note || p.kind}
                  </span>
                </span>
              </button>
            </Card>
          ))}
        </div>

        <Card title={draft.name} desc={draft.note || ''} pad={false}>
          <div className="card-body">
            <Field label="供应商名称">
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field
              label="API Key"
              right={
                draft.id === 'ollama' ? (
                  <Badge tone="plain">本地无需密钥</Badge>
                ) : keyConfigured ? (
                  <Badge tone="accent">已配置</Badge>
                ) : (
                  <Badge tone="warn">未配置</Badge>
                )
              }
              desc={
                keyConfigured
                  ? `已保存：${keyMasked} · 密钥使用系统加密存储在本机，输入新值可更换`
                  : '密钥仅保存在本机（Windows 系统级加密），不会被导出到备份文件'
              }
            >
              {draft.id !== 'ollama' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    type="password"
                    value={keyInput}
                    placeholder={keyConfigured ? '输入新密钥可更换' : '粘贴 API Key，例如 sk-…'}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveKey()
                    }}
                  />
                  <Button variant="primary" style={{ flex: 'none' }} loading={savingKey} onClick={() => void saveKey()}>
                    保存
                  </Button>
                  {keyConfigured && (
                    <Button
                      variant="ghost"
                      style={{ flex: 'none' }}
                      onClick={async () => {
                        await window.qiaoda.providers.setKey(draft.id, '')
                        setKeyConfigured(false)
                        setKeyMasked('')
                        toast('密钥已清除')
                      }}
                    >
                      清除
                    </Button>
                  )}
                </div>
              )}
            </Field>

            <Field
              label="Base URL"
              desc={`协议：${draft.kind === 'openai' ? 'OpenAI 兼容' : draft.kind === 'anthropic' ? 'Anthropic Messages' : 'Gemini generateContent'}`}
            >
              <Input value={draft.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} />
            </Field>

            <Field label="默认模型">
              <Select
                value={draft.defaultModel}
                options={[
                  ...draft.models.map((m) => ({ value: m.id, label: m.name })),
                  ...(draft.defaultModel && !draft.models.some((m) => m.id === draft.defaultModel)
                    ? [{ value: draft.defaultModel, label: `${draft.defaultModel}（自定义）` }]
                    : [])
                ]}
                onChange={(e) => patch({ defaultModel: e.target.value })}
              />
            </Field>

            <Field label="模型列表" desc="预设常用模型名称，情景绑定与全局默认从这里选择；也支持随时手输任意模型名">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {draft.models.map((m) => (
                  <span
                    key={m.id}
                    className="chip active"
                    style={{ cursor: 'default' }}
                  >
                    {m.name}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeModel(m.id)}
                    />
                  </span>
                ))}
                {draft.models.length === 0 && (
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>暂无预设模型</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={newModel}
                  placeholder="输入模型名，如 qwen-plus"
                  onChange={(e) => setNewModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addModel()
                  }}
                />
                <Button variant="soft" style={{ flex: 'none' }} onClick={addModel}>
                  添加
                </Button>
              </div>
            </Field>

            <Card title="高级（可选）" pad style={{ marginBottom: 16 }}>
              <Field label="自定义请求头" desc="每行一条，格式「Header: Value」，部分网关需要">
                <Textarea
                  rows={3}
                  value={draft.extraHeaders}
                  placeholder="X-Org-Id: 123456"
                  onChange={(e) => patch({ extraHeaders: e.target.value })}
                />
              </Field>
              <Field label="自定义 URL 参数" desc="每行一条，格式「key=value」">
                <Textarea
                  rows={3}
                  value={draft.extraQuery}
                  placeholder="group_id=xxx"
                  onChange={(e) => patch({ extraQuery: e.target.value })}
                />
              </Field>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <Button variant="soft" icon={<KeyRound size={14} />} loading={testing} onClick={() => void runTest()}>
                测试连接
              </Button>
              {draft.builtin && (
                <Button variant="ghost" icon={<RotateCcw size={13} />} onClick={resetBuiltin}>
                  恢复默认配置
                </Button>
              )}
              {!draft.builtin && (
                <Button variant="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirmDelete(true)}>
                  删除供应商
                </Button>
              )}
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  border: `1px solid ${testResult.ok ? 'var(--accent)' : 'var(--danger)'}`,
                  background: testResult.ok ? 'var(--accent-soft)' : 'var(--danger-soft)',
                  color: testResult.ok ? 'var(--accent)' : 'var(--danger)',
                  lineHeight: 1.6
                }}
              >
                {testResult.message}
                {testResult.ok && testResult.models && testResult.models.length > 0 && (
                  <>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                      共发现 {testResult.models.length} 个可用模型：
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all', userSelect: 'text' }}>
                      {testResult.models.slice(0, 12).join('、')}
                      {testResult.models.length > 12 ? ` 等 ${testResult.models.length} 个` : ''}
                    </div>
                    <Button
                      size="sm"
                      variant="soft"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const existing = new Set(draft.models.map((m) => m.id))
                        const merged = [
                          ...draft.models,
                          ...(testResult.models ?? [])
                            .filter((m) => !existing.has(m))
                            .slice(0, 30)
                            .map((m) => ({ id: m, name: m }))
                        ]
                        patch({ models: merged })
                        toast('已导入模型列表')
                      }}
                    >
                      导入这些模型
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除供应商"
        message={`确定删除「${draft.name}」吗？其密钥将一并删除，绑定该供应商的情景会回退到全局默认模型。`}
        confirmText="删除"
        danger
        onConfirm={async () => {
          await window.qiaoda.providers.remove(draft.id)
          toast('供应商已删除')
          const list = await reload()
          setSelectedId(list[0]?.id ?? null)
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
