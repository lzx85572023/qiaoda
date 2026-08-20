// 巧答 · 设置

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FolderOpen, Keyboard, Upload } from 'lucide-react'
import type { AppSettings, Provider } from '@shared/types'
import { Badge, Button, Card, Field, Input, Kbd, Select, Toggle, useToast } from '../components/ui'
import appIcon from '../assets/icon.png'

interface AppInfo {
  version: string
  dataDir: string
  encryption: boolean
}

export default function Settings({
  onSettingsChanged
}: {
  onSettingsChanged: (s: AppSettings) => void
}): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [hotkeyDraft, setHotkeyDraft] = useState<string | null>(null)
  const [hotkeyMsg, setHotkeyMsg] = useState('')
  const [savingHotkey, setSavingHotkey] = useState(false)
  const toast = useToast()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef<AppSettings | null>(null)

  useEffect(() => {
    void window.qiaoda.settings.get().then((s) => {
      setSettings(s)
      setHotkeyDraft(s.hotkey)
    })
    void window.qiaoda.providers.list().then(setProviders)
    void window.qiaoda.info().then(setInfo)
  }, [])

  settingsRef.current = settings

  const patch = useCallback((p: Partial<AppSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...p }
      settingsRef.current = next
      return next
    })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const s = settingsRef.current
      if (!s) return
      void window.qiaoda.settings.set(s).then(() => onSettingsChanged(s))
    }, 400)
  }, [onSettingsChanged])

  if (!settings || !info) {
    return (
      <div className="page-inner">
        <div className="page-head">
          <div className="page-title">设置</div>
        </div>
      </div>
    )
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

  const saveHotkey = async (): Promise<void> => {
    setSavingHotkey(true)
    const r = await window.qiaoda.hotkey.set(hotkeyDraft)
    setHotkeyMsg(r.message)
    setSavingHotkey(false)
    toast(r.message, r.ok ? 'success' : 'error')
    if (r.ok) patch({ hotkey: hotkeyDraft })
  }

  return (
    <div className="page-inner">
      <div className="page-head">
        <div>
          <div className="page-title">设置</div>
          <div className="page-sub">偏好与数据管理，改动即时生效</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }}>
        <div className="stack" style={{ marginTop: 0 }}>
          <Card title="通用">
            <Field label="外观主题">
              <Select
                value={settings.theme}
                options={[
                  { value: 'system', label: '跟随系统' },
                  { value: 'light', label: '浅色' },
                  { value: 'dark', label: '深色' }
                ]}
                onChange={(e) => patch({ theme: e.target.value as AppSettings['theme'] })}
              />
            </Field>
            <Toggle
              checked={settings.minimizeToTray}
              onChange={(v) => patch({ minimizeToTray: v })}
              label="关闭主窗口时最小化到托盘"
              desc="关闭后应用仍在后台，可用全局快捷键呼出快捷窗"
            />
            <Toggle
              checked={settings.autoLaunch}
              onChange={(v) => patch({ autoLaunch: v })}
              label="开机自动启动"
              desc="登录 Windows 后自动在后台运行"
            />
            <Field label="历史记录保留条数" desc="超出后自动删除最早的记录">
              <Input
                type="number"
                min={20}
                max={5000}
                value={settings.historyLimit}
                onChange={(e) => patch({ historyLimit: Math.max(20, Number(e.target.value) || 500) })}
              />
            </Field>
          </Card>

          <Card title="快捷窗">
            <Field label="全局快捷键" desc="在任意应用内按下即可呼出/收起快捷窗（系统级快捷键，不需要无障碍或录屏权限）">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <HotkeyInput
                  value={hotkeyDraft}
                  onChange={(v) => {
                    setHotkeyDraft(v)
                    setHotkeyMsg('')
                  }}
                />
                <Button variant="primary" loading={savingHotkey} onClick={() => void saveHotkey()}>
                  应用
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setHotkeyDraft(null)
                    setHotkeyMsg('')
                  }}
                >
                  禁用
                </Button>
              </div>
              {hotkeyMsg && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-2)' }}>{hotkeyMsg}</div>
              )}
            </Field>
            <Toggle
              checked={settings.hideOnBlur}
              onChange={(v) => patch({ hideOnBlur: v })}
              label="失焦自动隐藏"
              desc="点击快捷窗以外的区域时自动收起（图钉固定时除外）"
            />
            <Toggle
              checked={settings.alwaysOnTop}
              onChange={(v) => patch({ alwaysOnTop: v })}
              label="快捷窗置顶显示"
            />
            <Toggle
              checked={settings.masking}
              onChange={(v) => patch({ masking: v })}
              label="发送前自动脱敏"
              desc="手机号、邮箱、身份证号、银行卡号会先打码再发给模型，结果自动还原"
            />
          </Card>

          <Card title="生成">
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
            <Field label="默认模型" desc="未单独指定模型的情景将使用该模型；也可手输任意模型名">
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
            <Field label="默认温度" desc="越高越发散，越低越稳定；0.7 适合大多数客服场景">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(e) => patch({ temperature: Number(e.target.value) })}
                  style={{ flex: 1 }}
                />
                <span style={{ width: 34, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13 }}>
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
            </Field>
            <Toggle
              checked={settings.stream}
              onChange={(v) => patch({ stream: v })}
              label="流式输出"
              desc="生成过程中实时显示文字，体感更快"
            />
          </Card>

          <Card title="数据">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                variant="soft"
                icon={<Download size={14} />}
                onClick={async () => {
                  const r = await window.qiaoda.exportData()
                  toast(r.message, r.ok ? 'success' : 'error')
                }}
              >
                导出备份
              </Button>
              <Button
                variant="ghost"
                icon={<Upload size={14} />}
                onClick={async () => {
                  const r = await window.qiaoda.importData()
                  toast(r.message, r.ok ? 'success' : 'error')
                }}
              >
                导入备份
              </Button>
              <Button
                variant="ghost"
                icon={<FolderOpen size={14} />}
                onClick={() => void window.qiaoda.openDataDir()}
              >
                打开数据目录
              </Button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.7 }}>
              数据目录：{info.dataDir}
              <br />
              备份包含情景、话术、历史与供应商配置，不包含 API 密钥。
            </div>
          </Card>
        </div>

        <div className="stack" style={{ marginTop: 0 }}>
          <Card title="关于" pad>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={appIcon}
                alt=""
                style={{ width: 44, height: 44, borderRadius: 12 }}
                draggable={false}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>巧答 · AI 客服回复助手</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>v{info.version}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.8, marginTop: 12 }}>
              多情景 · 多模型 · 桌面快捷窗的客服副驾。
              <br />
              所有数据保存在本机。
            </div>
            <div style={{ marginTop: 10 }}>
              {info.encryption ? (
                <Badge tone="accent">密钥系统级加密存储</Badge>
              ) : (
                <Badge tone="warn">当前系统不支持加密存储</Badge>
              )}
            </div>
          </Card>

          <Card title="权限说明" pad>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.8 }}>
              <ul style={{ paddingLeft: 18 }}>
                <li>不读取屏幕、不注入输入，无任何无障碍/录屏权限</li>
                <li>全局快捷键仅用于呼出快捷窗</li>
                <li>剪贴板仅在你点击「复制」时写入</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------- 快捷键捕获输入 ---------- */
function HotkeyInput({
  value,
  onChange
}: {
  value: string | null
  onChange: (v: string | null) => void
}): React.JSX.Element {
  const [capturing, setCapturing] = useState(false)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const mods: string[] = []
    if (e.ctrlKey) mods.push('Ctrl')
    if (e.altKey) mods.push('Alt')
    if (e.shiftKey) mods.push('Shift')
    if (e.metaKey) mods.push('Super')
    if (e.key === 'Escape') {
      setCapturing(false)
      return
    }
    const key = e.code
    if (key.startsWith('Key')) mods.push(key.slice(3))
    else if (key.startsWith('Digit')) mods.push(key.slice(5))
    else if (key === 'Space') mods.push('Space')
    else if (key.startsWith('F') && key.length <= 3) mods.push(key)
    else return
    if (mods.some((m) => m === 'Ctrl' || m === 'Alt' || m === 'Super')) {
      onChange(mods.join('+'))
      setCapturing(false)
    }
  }

  return (
    <div
      tabIndex={0}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 170,
        height: 36,
        padding: '0 12px',
        background: 'var(--bg-soft)',
        border: capturing ? '1px solid var(--accent)' : '1px solid transparent',
        boxShadow: capturing ? '0 0 0 3px var(--accent-soft)' : 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        outline: 'none',
        fontSize: 13
      }}
    >
      <Keyboard size={14} style={{ color: 'var(--ink-3)' }} />
      {capturing ? (
        <span style={{ color: 'var(--ink-3)' }}>按下组合键…</span>
      ) : value ? (
        <Kbd>{value}</Kbd>
      ) : (
        <span style={{ color: 'var(--ink-3)' }}>未设置</span>
      )}
    </div>
  )
}
