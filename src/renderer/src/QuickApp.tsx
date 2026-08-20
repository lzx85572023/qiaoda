// 巧答 · 快捷悬浮窗：四种模式，一键生成，随手复制收藏

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Maximize2,
  Pin,
  PinOff,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Star,
  X
} from 'lucide-react'
import type { AppSettings, GenerateResult, GenerationMode, LlmError, Scenario, Snippet } from '@shared/types'
import { MODES, POLISH_STYLES } from '@shared/constants'
import { Markdown, RiskBadges } from './components/Markdown'
import { ToastProvider, useToast } from './components/ui'
import { parseAnalyze, parsePlain, parseReplies } from '@shared/parse'
import appIcon from './assets/icon.png'

const MODE_LABEL: Record<GenerationMode, string> = {
  reply: '生成回复',
  polish: '开始润色',
  plain: '白话解释',
  analyze: '分析客户'
}

export default function QuickApp(): React.JSX.Element {
  return (
    <ToastProvider>
      <QuickInner />
    </ToastProvider>
  )
}

function QuickInner(): React.JSX.Element {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mode, setMode] = useState<GenerationMode>('reply')
  const [scenarioId, setScenarioId] = useState('')
  const [input, setInput] = useState('')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [extra, setExtra] = useState('')
  const [style, setStyle] = useState<string>(POLISH_STYLES[0].id)
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()

  const reloadScenarios = useCallback(async (): Promise<void> => {
    const list = await window.qiaoda.scenarios.list()
    setScenarios(list)
    setScenarioId((prev) => (prev && list.some((s) => s.id === prev) ? prev : (list[0]?.id ?? '')))
  }, [])

  useEffect(() => {
    void reloadScenarios()
    void window.qiaoda.settings.get().then(setSettings)
    void window.qiaoda.isQuickPinned().then(setPinned)
    const off = window.qiaoda.onQuickShown(() => {
      void reloadScenarios()
      setTimeout(() => inputRef.current?.focus(), 60)
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void window.qiaoda.hideQuick()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      off()
      window.removeEventListener('keydown', onKey)
    }
  }, [reloadScenarios])

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null

  const run = async (): Promise<void> => {
    if (!input.trim()) {
      toast(mode === 'reply' ? '先粘贴客户消息' : '先粘贴要处理的文本', 'error')
      inputRef.current?.focus()
      return
    }
    if (!scenarioId) {
      toast('请先在主窗口创建情景', 'error')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    setStreamText('')
    setCopiedIdx(null)
    try {
      const r = await window.qiaoda.generate(
        {
          mode,
          scenarioId,
          input: input.trim(),
          context: showContext && context.trim() ? context.trim() : undefined,
          extra: mode === 'reply' && extra.trim() ? extra.trim() : undefined,
          style: mode === 'polish' ? style : undefined
        },
        (delta) => setStreamText((prev) => prev + delta)
      )
      setResult(r)
    } catch (e) {
      const err = e as LlmError
      setError(err?.message ?? '生成失败，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string, idx?: number): Promise<void> => {
    await window.qiaoda.copyText(text)
    if (idx !== undefined) setCopiedIdx(idx)
    else setCopiedIdx(-1)
    toast('已复制，直接粘贴发送')
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const saveSnippet = async (text: string): Promise<void> => {
    const saved: Snippet = await window.qiaoda.snippets.save({
      id: '',
      title: (input.trim().slice(0, 24) || '未命名话术'),
      content: text,
      tags: [],
      scenarioId: scenarioId || null,
      createdAt: Date.now()
    })
    void saved
    toast('已收藏到话术库', 'success')
  }

  const replies = useMemo(() => (result && mode === 'reply' ? parseReplies(result.text) : []), [result, mode])
  const plain = useMemo(() => (result && mode === 'plain' ? parsePlain(result.text) : null), [result, mode])
  const analyze = useMemo(() => (result && mode === 'analyze' ? parseAnalyze(result.text) : null), [result, mode])
  const showLiveStream = busy && (mode === 'polish' || mode === 'plain')

  const templates = scenario?.templates ?? []

  return (
    <div className="quick-margin">
      <div className="quick-shell">
        {/* 顶部：情景切换 + 窗口操作 */}
        <div className="quick-head drag">
          <img src={appIcon} alt="" draggable={false} />
          <div className="quick-scenario no-drag" style={{ position: 'relative' }}>
            <button type="button" className="sc-drop-btn" style={{ width: '100%' }} onClick={() => setDropOpen(!dropOpen)}>
              {scenario && (
                <>
                  <span>{scenario.emoji}</span>
                  <span className="name">{scenario.name}</span>
                </>
              )}
              <ChevronDown size={13} style={{ color: 'var(--ink-3)', marginLeft: 'auto', flex: 'none' }} />
            </button>
            {dropOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDropOpen(false)} />
                <div className="drop-panel">
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="drop-item"
                      onClick={() => {
                        setScenarioId(s.id)
                        setDropOpen(false)
                        inputRef.current?.focus()
                      }}
                    >
                      <span>{s.emoji}</span>
                      <span className="name">{s.name}</span>
                      <span className="dot" style={{ background: s.color }} />
                    </button>
                  ))}
                  <button
                    type="button"
                    className="drop-item"
                    onClick={() => {
                      setDropOpen(false)
                      void window.qiaoda.showMain()
                    }}
                  >
                    <span>＋</span>
                    <span className="name">管理情景</span>
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="no-drag" style={{ display: 'flex', gap: 2, flex: 'none' }}>
            <button
              className={`icon-btn ${pinned ? 'active' : ''}`}
              title={pinned ? '取消置顶（失焦不再隐藏）' : '图钉固定'}
              onClick={async () => {
                const next = !pinned
                setPinned(next)
                await window.qiaoda.setQuickPinned(next)
              }}
            >
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
            <button className="icon-btn" title="打开主窗口" onClick={() => void window.qiaoda.showMain()}>
              <Maximize2 size={15} />
            </button>
            <button className="icon-btn" title="收起（快捷键可再次呼出）" onClick={() => void window.qiaoda.hideQuick()}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="quick-modes no-drag">
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`seg-btn ${mode === m.id ? 'active' : ''}`}
                onClick={() => {
                  setMode(m.id)
                  setResult(null)
                  setError(null)
                  setStreamText('')
                }}
                title={m.desc}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* 输入区 */}
        <div className="quick-body-area no-drag">
          <div className="quick-input-label">
            <span>
              {mode === 'reply' || mode === 'analyze' ? '客户消息 / 对话' : mode === 'polish' ? '客服草稿' : '要解释的原文'}
            </span>
            {(mode === 'reply' || mode === 'analyze') && (
              <button
                type="button"
                className="chip xs"
                onClick={() => setShowContext((v) => !v)}
                style={{ marginLeft: 'auto' }}
              >
                {showContext ? '收起上下文' : '＋ 对话上下文'}
              </button>
            )}
          </div>
          <textarea
            ref={inputRef}
            className="quick-textarea"
            rows={mode === 'reply' ? 5 : 4}
            placeholder={
              mode === 'reply'
                ? '粘贴客户说的话，或整段对话…'
                : mode === 'polish'
                  ? '粘贴你写好的草稿…'
                  : mode === 'plain'
                    ? '粘贴含专业术语的内容…'
                    : '粘贴客户消息，帮你判断情绪与意图…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) void run()
            }}
          />

          {showContext && (mode === 'reply' || mode === 'analyze') && (
            <>
              <div className="quick-input-label">
                <span>完整对话上下文（可选）</span>
              </div>
              <textarea
                className="quick-textarea"
                rows={3}
                placeholder="粘贴之前的对话，帮助模型理解来龙去脉"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </>
          )}

          {mode === 'reply' && (
            <>
              <div className="quick-input-label">
                <span>追加要求（可选）</span>
              </div>
              <input
                className="input"
                style={{ height: 32, fontSize: 13 }}
                placeholder="例如：客户要退差价，安抚并给出方案"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
              {templates.length > 0 && (
                <div className="quick-chips">
                  {templates.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="chip xs"
                      onClick={() => setExtra((prev) => (prev.includes(t.instruction) ? prev : t.instruction))}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'polish' && (
            <div className="quick-chips">
              {POLISH_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip xs ${style === s.id ? 'active' : ''}`}
                  onClick={() => setStyle(s.id)}
                  title={s.hint}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            {busy ? (
              <button className="btn primary lg block" onClick={() => window.qiaoda.abort()}>
                停止生成
              </button>
            ) : (
              <button className="btn primary lg block" onClick={() => void run()}>
                <Sparkles size={15} />
                {MODE_LABEL[mode]}
                <span style={{ opacity: 0.65, fontSize: 12, fontWeight: 400 }}>Ctrl + Enter</span>
              </button>
            )}
          </div>

          {/* 结果区 */}
          <div className="quick-results">
            {busy && !showLiveStream && (
              <div className="result-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  {mode === 'analyze' ? '正在分析客户意图…' : `正在生成 ${settings?.replyCount ?? 3} 条候选回复…`}
                </div>
              </div>
            )}
            {busy && showLiveStream && (
              <div className="result-card">
                <div className="result-text">
                  {streamText}
                  <span className="stream-caret" />
                </div>
              </div>
            )}

            {error && !busy && <div className="gen-error">{error}</div>}

            {!busy && result && mode === 'reply' && (
              <>
                {replies.map((r, i) => (
                  <div className="result-card" key={i}>
                    <div className="result-head">
                      <span className="result-style">{r.style}</span>
                      <div className="result-actions">
                        <button
                          className="icon-btn"
                          title="收藏到话术库"
                          onClick={() => void saveSnippet(r.text)}
                        >
                          <Star size={14} />
                        </button>
                        <button
                          className={`icon-btn ${copiedIdx === i ? 'active' : ''}`}
                          title="复制"
                          onClick={() => void copy(r.text, i)}
                        >
                          {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <Markdown text={r.text} />
                    <RiskBadges text={r.text} />
                  </div>
                ))}
              </>
            )}

            {!busy && result && mode === 'polish' && (
              <div className="result-card">
                <div className="result-head">
                  <span className="result-style">润色结果</span>
                  <div className="result-actions">
                    <button className="icon-btn" title="收藏到话术库" onClick={() => void saveSnippet(result.text)}>
                      <Star size={14} />
                    </button>
                    <button
                      className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`}
                      title="复制"
                      onClick={() => void copy(result.text, 0)}
                    >
                      {copiedIdx === 0 ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <Markdown text={result.text} />
                <RiskBadges text={result.text} />
              </div>
            )}

            {!busy && result && mode === 'plain' && plain && (
              <>
                <div className="result-card">
                  <div className="result-head">
                    <span className="result-style">白话版</span>
                    <div className="result-actions">
                      <button className="icon-btn" title="收藏到话术库" onClick={() => void saveSnippet(plain.text)}>
                        <Star size={14} />
                      </button>
                      <button
                        className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`}
                        title="复制"
                        onClick={() => void copy(plain.text, 0)}
                      >
                        {copiedIdx === 0 ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <Markdown text={plain.text} />
                </div>
                {plain.terms.length > 0 && (
                  <div className="result-card">
                    <div className="result-head">
                      <span className="result-style">术语对照</span>
                    </div>
                    <div className="term-list">
                      {plain.terms.map((t, i) => (
                        <div className="term-row" key={i}>
                          <span className="term-word">{t.term}</span>
                          <span className="term-expl">{t.explanation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!busy && result && mode === 'analyze' && (
              analyze ? (
                <div className="result-card">
                  <div className="result-head">
                    <span className="result-style">分析结果</span>
                  </div>
                  <div className="analyze-row">
                    <span className="analyze-label">情绪</span>
                    <span className="analyze-value">{analyze.emotion ?? '—'}</span>
                  </div>
                  <div className="analyze-row">
                    <span className="analyze-label">意图</span>
                    <span className="analyze-value">{analyze.intent ?? '—'}</span>
                  </div>
                  {Array.isArray(analyze.needs) && analyze.needs.length > 0 && (
                    <div className="analyze-row">
                      <span className="analyze-label">诉求</span>
                      <div className="analyze-value">
                        {analyze.needs.map((n, i) => (
                          <span key={i} className="badge accent" style={{ margin: '0 6px 4px 0' }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analyze.strategy && (
                    <div className="analyze-row">
                      <span className="analyze-label">策略</span>
                      <span className="analyze-value">{analyze.strategy}</span>
                    </div>
                  )}
                  {Array.isArray(analyze.risks) && analyze.risks.length > 0 && (
                    <div className="analyze-row">
                      <span className="analyze-label">风险</span>
                      <div className="analyze-value">
                        {analyze.risks.map((r, i) => (
                          <span key={i} className="badge danger" style={{ margin: '0 6px 4px 0' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="result-card">
                  <div className="result-head">
                    <span className="result-style">分析结果</span>
                    <div className="result-actions">
                      <button className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`} title="复制" onClick={() => void copy(result.text, 0)}>
                        {copiedIdx === 0 ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <Markdown text={result.text} />
                </div>
              )
            )}
          </div>
        </div>

        {/* 底部状态栏 */}
        <div className="quick-foot no-drag">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {result?.masked ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)' }}>
                <ShieldCheck size={12} />
                已脱敏
              </span>
            ) : (
              <ShieldCheck size={12} />
            )}
            {result && (
              <span style={{ marginLeft: 4 }}>
                {result.modelLabel}
                {result.usage ? ` · ${result.usage.prompt + result.usage.completion} tok` : ''} · {result.durationMs}ms
              </span>
            )}
          </span>
          <button
            className="icon-btn"
            title="设置"
            onClick={() => {
              void window.qiaoda.showMain()
            }}
          >
            <SettingsIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
