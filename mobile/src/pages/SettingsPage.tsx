// 巧答移动版 · 设置（模型默认 / 供应商管理 / 隐私 / 数据）

import { useEffect, useState } from 'react'
import { ArrowLeft, Download, KeyRound, Upload } from 'lucide-react'
import type { AppSettings, Provider } from '@shared/types'
import { Badge, Button, Card, Field, Input, Select, Textarea, Toggle, useToast } from '../components/ui'

export default function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const toast = useToast()

  const reload = async (): Promise<void> => {
    setSettings(await window.qiaoda.settings.get())
    setProviders(await window.qiaoda.providers.list())
  }

  useEffect(() => {
    void reload()
  }, [])

  if (!settings) {
    return <div className="m-page m-hint">加载中…</div>
  }

  if (editingProvider) {
    return (
      <ProviderEditor
        id={editingProvider}
        providers={providers}
        onBack={() => {
          setEditingProvider(null)
          void reload()
        }}
      />
    )
  }

  const patch = (p: Partial<AppSettings>): void => {
    void window.qiaoda.settings.set(p)
    setSettings((prev) => (prev ? { ...prev, ...p } : prev))
  }

  const defaultProvider = providers.find((p) => p.id === settings.defaultProviderId) ?? null
  const defaultModelOptions = defaultProvider
    ? [
        ...defaultProvider.models.map((m) => ({ value: m.id, label: m.name })),
        ...(!defaultProvider.models.some((m) => m.id === settings.defaultModel)
          ? [{ value: settings.defaultModel, label: `${settings.defaultModel}（自定义）` }]
          : [])
      ]
    : []

  return (
    <div className="m-page">
      <div className="m-page-head">
        <div style={{ flex: 1 }}>
          <div className="m-page-title">设置</div>
          <div className="m-page-sub">模型、隐私与数据管理</div>
        </div>
      </div>

      <div className="m-section-label">供应商与密钥</div>
      <Card pad={false}>
        <div className="card-body" style={{ padding: '8px 16px 12px' }}>
          {providers.map((p) => (
            <ProviderRow key={p.id} provider={p} onClick={() => setEditingProvider(p.id)} />
          ))}
        </div>
      </Card>
      <div className="m-hint" style={{ marginTop: 8 }}>
        支持 DeepSeek、OpenAI、Claude、Gemini、通义、Kimi、GLM、MiniMax、Ollama
        本地模型及任意 OpenAI 兼容网关。密钥仅保存在本机应用存储中。
      </div>

      <div className="m-section-label">默认生成配置</div>
      <Card>
        <Field label="默认供应商">
          <Select
            value={settings.defaultProviderId}
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(e) => {
              const p = providers.find((x) => x.id === e.target.value)
              patch({ defaultProviderId: e.target.value, defaultModel: p?.defaultModel ?? '' })
            }}
          />
        </Field>
        <Field label="默认模型" desc="未单独指定模型的情景使用它">
          <Select
            value={settings.defaultModel}
            options={defaultModelOptions}
            onChange={(e) => patch({ defaultModel: e.target.value })}
          />
        </Field>
        <Field label="候选回复数量">
          <Select
            value={String(settings.replyCount)}
            options={[
              { value: '1', label: '1 条（更快）' },
              { value: '2', label: '2 条' },
              { value: '3', label: '3 条（默认）' }
            ]}
            onChange={(e) => patch({ replyCount: Number(e.target.value) })}
          />
        </Field>
        <Field label={`温度：${settings.temperature.toFixed(1)}`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => patch({ temperature: Number(e.target.value) })}
            style={{ width: '100%' }}
          />
        </Field>
      </Card>

      <div className="m-section-label">隐私</div>
      <Card pad={false}>
        <div className="card-body">
          <Toggle
            checked={settings.masking}
            onChange={(v) => patch({ masking: v })}
            label="发送前自动脱敏"
            desc="手机号、邮箱、身份证号、银行卡号先打码再发给模型"
          />
          <Field label="历史记录保留条数">
            <Input
              type="number"
              min={20}
              max={5000}
              value={settings.historyLimit}
              onChange={(e) => patch({ historyLimit: Math.max(20, Number(e.target.value) || 500) })}
            />
          </Field>
        </div>
      </Card>

      <div className="m-section-label">数据</div>
      <Card pad={false}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="soft"
              icon={<Download size={15} />}
              onClick={async () => {
                const r = await window.qiaoda.exportData()
                toast(r.message, r.ok ? 'success' : 'error')
              }}
            >
              导出备份（复制为 JSON）
            </Button>
            <Button
              variant="ghost"
              icon={<Upload size={15} />}
              onClick={async () => {
                const r = await window.qiaoda.importData()
                toast(r.message, r.ok ? 'success' : 'error')
              }}
            >
              从剪贴板导入
            </Button>
          </div>
        </div>
      </Card>

      <div className="m-section-label">关于</div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon.png" alt="" style={{ width: 40, height: 40, borderRadius: 11 }} />
          <div>
            <div style={{ fontWeight: 600 }}>巧答 · AI 客服回复助手</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>v1.0.0（安卓版）</div>
          </div>
        </div>
        <div className="m-hint" style={{ marginTop: 10 }}>
          不读取屏幕、不注入输入，无任何无障碍 / 录屏权限；仅在你点击「复制」时写入剪贴板。
          所有数据保存在本机应用存储中。
        </div>
      </Card>
    </div>
  )
}

function ProviderRow({
  provider,
  onClick
}: {
  provider: Provider
  onClick: () => void
}): React.JSX.Element {
  const [keyInfo, setKeyInfo] = useState<{ configured: boolean; masked: string }>({ configured: false, masked: '' })

  useEffect(() => {
    void window.qiaoda.providers.keyInfo(provider.id).then(setKeyInfo)
  }, [provider.id])

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        border: 'none',
        background: 'transparent',
        padding: '9px 0',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: provider.color,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none'
        }}
      >
        {provider.name.slice(0, 2)}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{provider.name}</span>
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
          {provider.note || provider.kind}
        </span>
      </span>
      <Badge tone={provider.id === 'ollama' || keyInfo.configured ? 'accent' : 'warn'}>
        {provider.id === 'ollama' ? '本地' : keyInfo.configured ? '已配置' : '未配置'}
      </Badge>
    </button>
  )
}

function ProviderEditor({
  id,
  providers,
  onBack
}: {
  id: string
  providers: Provider[]
  onBack: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<Provider | null>(null)
  const [keyConfigured, setKeyConfigured] = useState(false)
  const [keyMasked, setKeyMasked] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [newModel, setNewModel] = useState('')
  const toast = useToast()

  useEffect(() => {
    const p = providers.find((x) => x.id === id)
    setDraft(p ? { ...p } : null)
    if (p) {
      void window.qiaoda.providers.keyInfo(p.id).then((k) => {
        setKeyConfigured(k.configured)
        setKeyMasked(k.masked)
      })
    }
  }, [id, providers])

  if (!draft) return <div className="m-page m-hint">加载中…</div>

  const patch = (p: Partial<Provider>): void => {
    const next = { ...draft, ...p }
    setDraft(next)
    void window.qiaoda.providers.save(next)
  }

  const saveKey = async (): Promise<void> => {
    if (!keyInput.trim()) {
      toast('请输入密钥', 'error')
      return
    }
    await window.qiaoda.providers.setKey(draft.id, keyInput.trim())
    const k = await window.qiaoda.providers.keyInfo(draft.id)
    setKeyConfigured(k.configured)
    setKeyMasked(k.masked)
    setKeyInput('')
    toast('密钥已保存（仅存本机）', 'success')
  }

  const runTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    const r = await window.qiaoda.providers.test(draft.id)
    setTestResult(r)
    setTesting(false)
    toast(r.message, r.ok ? 'success' : 'error')
  }

  return (
    <div className="m-page">
      <div className="m-page-head">
        <Button size="sm" variant="ghost" icon={<ArrowLeft size={15} />} onClick={onBack}>
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <div className="m-page-title">{draft.name}</div>
          <div className="m-page-sub">
            {draft.kind === 'openai' ? 'OpenAI 兼容协议' : draft.kind === 'anthropic' ? 'Anthropic 协议' : 'Gemini 协议'}
          </div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 0 }}>
        <Card title="API Key">
          {keyConfigured && (
            <div className="m-hint" style={{ marginBottom: 10 }}>
              已保存：{keyMasked} · 输入新值可更换
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              type="password"
              value={keyInput}
              placeholder={keyConfigured ? '输入新密钥' : '粘贴 API Key'}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <Button variant="primary" style={{ flex: 'none' }} onClick={() => void saveKey()}>
              保存
            </Button>
          </div>
          {keyConfigured && (
            <Button
              size="sm"
              variant="ghost"
              style={{ marginTop: 8 }}
              onClick={async () => {
                await window.qiaoda.providers.setKey(draft.id, '')
                setKeyConfigured(false)
                setKeyMasked('')
                toast('密钥已清除')
              }}
            >
              清除密钥
            </Button>
          )}
        </Card>

        <Card title="连接配置">
          <Field label="Base URL">
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
          <Field label="模型列表" desc="预设常用模型，也支持手输任意模型名">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {draft.models.map((m) => (
                <span key={m.id} className="chip active" style={{ cursor: 'default' }}>
                  {m.name}
                  <span
                    style={{ cursor: 'pointer', marginLeft: 2 }}
                    onClick={() =>
                      patch({
                        models: draft.models.filter((x) => x.id !== m.id),
                        defaultModel: draft.defaultModel === m.id ? '' : draft.defaultModel
                      })
                    }
                  >
                    ✕
                  </span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={newModel}
                placeholder="输入模型名，如 qwen-plus"
                onChange={(e) => setNewModel(e.target.value)}
              />
              <Button
                variant="soft"
                style={{ flex: 'none' }}
                onClick={() => {
                  const name = newModel.trim()
                  if (!name) return
                  patch({
                    models: [...draft.models, { id: name, name }],
                    defaultModel: draft.defaultModel || name
                  })
                  setNewModel('')
                }}
              >
                添加
              </Button>
            </div>
          </Field>
          <Field label="自定义请求头（可选）" desc="每行一条「Header: Value」，部分网关需要">
            <Textarea
              rows={3}
              value={draft.extraHeaders}
              placeholder="X-Org-Id: 123456"
              onChange={(e) => patch({ extraHeaders: e.target.value })}
            />
          </Field>
          <Field label="自定义 URL 参数（可选）" desc="每行一条「key=value」">
            <Textarea
              rows={3}
              value={draft.extraQuery}
              placeholder="group_id=xxx"
              onChange={(e) => patch({ extraQuery: e.target.value })}
            />
          </Field>
          <Button variant="soft" icon={<KeyRound size={14} />} loading={testing} onClick={() => void runTest()}>
            测试连接
          </Button>
          {testResult && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                border: `1px solid ${testResult.ok ? 'var(--accent)' : 'var(--danger)'}`,
                background: testResult.ok ? 'var(--accent-soft)' : 'var(--danger-soft)',
                color: testResult.ok ? 'var(--accent)' : 'var(--danger)'
              }}
            >
              {testResult.message}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
