// 巧答 · 生成服务：脱敏 → 提示词 → 流式调用 → 还原 → 历史记录

import type { GenerateRequest, GenerateResult, HistoryItem, DeltaEvent } from '@shared/types'
import { chat, LlmFailure } from './llm/client'
import { buildPrompt, resolveTarget } from './llm/prompt'
import { maskFields, restoreText, PII_NOTE } from './privacy'
import { newId, type Store } from './store'

export class GenerationService {
  private controller: AbortController | null = null

  constructor(private store: Store) {}

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }

  async generate(
    req: GenerateRequest,
    send: (event: DeltaEvent) => void
  ): Promise<GenerateResult> {
    const settings = this.store.settings.get()
    const scenario = this.store.scenarios.get().find((s) => s.id === req.scenarioId)
    if (!scenario) throw new LlmFailure('scenario', '所选情景不存在，请重新选择')

    const target = resolveTarget(scenario, settings)
    const provider = this.store.providers.get().find((p) => p.id === target.providerId)
    if (!provider) throw new LlmFailure('provider', '未找到模型供应商，请先在「模型」页配置')

    const apiKey = this.store.getKey(provider.id) ?? ''
    if (!apiKey && provider.id !== 'ollama') {
      throw new LlmFailure('nokey', `请先在「模型」页为「${provider.name}」配置 API Key`)
    }

    const masked = settings.masking
    const m = masked ? maskFields(req) : { input: req.input, context: req.context ?? '', map: new Map<string, string>() }
    const maskedReq: GenerateRequest = { ...req, input: m.input, context: m.context }
    const { system, user } = buildPrompt(maskedReq, scenario, settings)
    const note = masked && m.map.size > 0 ? `\n${PII_NOTE}` : ''

    this.controller = new AbortController()
    const startedAt = Date.now()
    const modelLabel = `${provider.name} · ${target.model}`

    const result = await chat(
      {
        provider,
        apiKey,
        model: target.model,
        temperature: target.temperature,
        stream: settings.stream,
        signal: this.controller.signal,
        onDelta: (text) => send({ type: 'delta', text })
      },
      [
        { role: 'system', content: system },
        { role: 'user', content: user + note }
      ]
    )

    const text = masked ? restoreText(result.text, m.map) : result.text
    const finalResult: GenerateResult = {
      text,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      modelLabel,
      masked: masked && m.map.size > 0
    }

    const item: HistoryItem = {
      id: newId(),
      ts: Date.now(),
      mode: req.mode,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      modelLabel,
      input: req.input,
      context: req.context ?? '',
      extra: req.extra ?? '',
      style: req.style ?? '',
      output: text,
      usage: result.usage,
      durationMs: finalResult.durationMs
    }
    this.store.addHistory(item)

    send({ type: 'done', result: finalResult })
    return finalResult
  }
}
