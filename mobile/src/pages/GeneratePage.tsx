// 巧答移动版 · 生成页（回复 / 润色 / 白话 / 分析）

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Loader2,
  ShieldCheck,
  Sparkles,
  Star
} from 'lucide-react'
import type { AppSettings, GenerateResult, GenerationMode, LlmError, Scenario, Snippet } from '../shared/types'
import { MODES, POLISH_STYLES } from '../shared/constants'
import { Markdown, RiskBadges } from '../components/Markdown'
import { useToast } from '../components/ui'
import { parseAnalyze, parsePlain, parseReplies } from '../shared/parse'

const MODE_LABEL: Record<GenerationMode, string> = {
  reply: '生成回复',
  polish: '开始润色',
  plain: '白话解释',
  analyze: '分析客户'
}

export default function GeneratePage(): React.JSX.Element {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mode, setMode] = useState<GenerationMode>('reply')
  const [scenarioId, setScenarioId] = useState('')
  const [input, setInput] = useState('')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [extra, setExtra] = useState('')
  const [style, setStyle] = useState<string>(POLISH_STYLES[0].id)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const toast = useToast()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    void window.qiaoda.scenarios.list().then((list) => {
      setScenarios(list)
      setScenarioId((prev) => (prev && list.some((s) => s.id === prev) ? prev : (list[0]?.id ?? '')))
    })
    void window.qiaoda.settings.get().then(setSettings)
  }, [])

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? null

  const pasteFromClipboard = async (): Promise<void> => {
    try {
      const text = await window.qiaoda.clipboardRead()
      if (!text.trim()) {
        toast('剪贴板是空的', 'error')
        return
      }
      setInput(text.trim())
      toast('已粘贴剪贴板内容')
    } catch {
      toast('无法读取剪贴板', 'error')
    }
  }

  const run = async (): Promise<void> => {
    if (!input.trim()) {
      toast(mode === 'reply' ? '先粘贴客户消息' : '先粘贴要处理的文本', 'error')
      inputRef.current?.focus()
      return
    }
    if (!scenarioId) {
      toast('请先创建情景', 'error')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
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
        () => undefined
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
    setCopiedIdx(idx ?? -1)
    toast('已复制，回客服软件长按粘贴')
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const saveSnippet = async (text: string): Promise<void> => {
    const saved: Snippet = await window.qiaoda.snippets.save({
      id: '',
      title: input.trim().slice(0, 24) || '未命名话术',
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
  const templates = scenario?.templates ?? []

  return (
    <div className="m-page">
      {/* 情景选择 */}
      <div className="m-sc-wrap">
        <button type="button" className="m-sc-btn" onClick={() => setDropOpen(!dropOpen)}>
          <span>{scenario?.emoji ?? '💬'}</span>
          <span className="name">{scenario?.name ?? '选择情景'}</span>
          <ChevronDown size={15} style={{ color: 'var(--ink-3)', flex: 'none' }} />
        </button>
        {dropOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDropOpen(false)} />
            <div className="drop-panel" style={{ position: 'absolute' }}>
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="drop-item"
                  onClick={() => {
                    setScenarioId(s.id)
                    setDropOpen(false)
                  }}
                >
                  <span>{s.emoji}</span>
                  <span className="name">{s.name}</span>
                  <span className="dot" style={{ background: s.color }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 模式切换 */}
      <div className="m-gen-modes" style={{ marginTop: 12 }}>
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
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* 输入 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <span className="m-hint" style={{ flex: 1 }}>
          {mode === 'reply' || mode === 'analyze' ? '客户消息 / 对话' : mode === 'polish' ? '客服草稿' : '要解释的原文'}
        </span>
        <button type="button" className="m-paste-btn" onClick={() => void pasteFromClipboard()}>
          <ClipboardPaste size={13} />
          从剪贴板粘贴
        </button>
        {(mode === 'reply' || mode === 'analyze') && (
          <button type="button" className="m-paste-btn" onClick={() => setShowContext((v) => !v)}>
            {showContext ? '收起上下文' : '＋ 上下文'}
          </button>
        )}
      </div>
      <textarea
        ref={inputRef}
        className="m-gen-input"
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
      />

      {showContext && (mode === 'reply' || mode === 'analyze') && (
        <textarea
          className="m-gen-input"
          style={{ minHeight: 70, marginTop: 10 }}
          placeholder="之前的对话上下文（可选）"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      )}

      {mode === 'reply' && (
        <>
          <input
            className="input"
            style={{ marginTop: 10 }}
            placeholder="追加要求（可选）：如「客户要退差价，安抚并给方案」"
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
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {busy ? (
          <button className="btn primary lg block" onClick={() => window.qiaoda.abort()}>
            停止生成
          </button>
        ) : (
          <button className="btn primary lg block" onClick={() => void run()}>
            <Sparkles size={16} />
            {MODE_LABEL[mode]}
          </button>
        )}
      </div>

      {/* 结果 */}
      <div className="m-results">
        {busy && (
          <div className="result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontSize: 13.5 }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              {mode === 'analyze' ? '正在分析客户意图…' : `正在生成 ${settings?.replyCount ?? 3} 条候选回复…`}
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
                    <button className="icon-btn" title="收藏到话术库" onClick={() => void saveSnippet(r.text)}>
                      <Star size={15} />
                    </button>
                    <button
                      className={`icon-btn ${copiedIdx === i ? 'active' : ''}`}
                      title="复制"
                      onClick={() => void copy(r.text, i)}
                    >
                      {copiedIdx === i ? <Check size={15} /> : <Copy size={15} />}
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
                  <Star size={15} />
                </button>
                <button
                  className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`}
                  title="复制"
                  onClick={() => void copy(result.text, 0)}
                >
                  {copiedIdx === 0 ? <Check size={15} /> : <Copy size={15} />}
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
                    <Star size={15} />
                  </button>
                  <button
                    className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`}
                    title="复制"
                    onClick={() => void copy(plain.text, 0)}
                  >
                    {copiedIdx === 0 ? <Check size={15} /> : <Copy size={15} />}
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
                <div className="result-actions">
                  <button
                    className={`icon-btn ${copiedIdx === 0 ? 'active' : ''}`}
                    title="复制"
                    onClick={() => void copy(result.text, 0)}
                  >
                    {copiedIdx === 0 ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
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
                    {copiedIdx === 0 ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
              <Markdown text={result.text} />
            </div>
          )
        )}

        {result && (
          <div className="m-meta-row">
            {result.masked && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--accent)' }}>
                <ShieldCheck size={12} />
                已脱敏
              </span>
            )}
            <span>
              {result.modelLabel}
              {result.usage ? ` · ${result.usage.prompt + result.usage.completion} tok` : ''} · {result.durationMs}ms
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
