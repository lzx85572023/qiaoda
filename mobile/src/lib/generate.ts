// 巧答移动版 · 生成服务（脱敏 → 提示词 → 调用 → 还原 → 历史），与桌面版逻辑一致

import type { GenerateRequest, GenerateResult, HistoryItem } from '../shared/types'
import { chat, LlmFailure } from '../llm/client'
import { buildPrompt, resolveTarget } from '../llm/prompt'
import { maskFields, restoreText, PII_NOTE } from '../llm/privacy'
import { historyRepo, newId, providersRepo, scenariosRepo, settingsRepo } from './store'

const TIMEOUT_MS = 150_000
let controller: AbortController | null = null

export function abortGeneration(): void {
  controller?.abort()
  controller = null
}

export async function generate(
  req: GenerateRequest,
  onDelta?: (text: string) => void
): Promise<GenerateResult> {
  const settings = settingsRepo.get()
  const scenario = scenariosRepo.list().find((s) => s.id === req.scenarioId)
  if (!scenario) throw new LlmFailure('scenario', '所选情景不存在，请重新选择')

  const target = resolveTarget(scenario, settings)
  const provider = providersRepo.list().find((p) => p.id === target.providerId)
  if (!provider) throw new LlmFailure('provider', '未找到模型供应商，请先在「设置」页配置')

  const apiKey = providersRepo.getKey(provider.id)
  if (!apiKey && provider.id !== 'ollama') {
    throw new LlmFailure('nokey', `请先在「设置」页为「${provider.name}」配置 API Key`)
  }

  const masked = settings.masking
  const m = masked ? maskFields(req) : { input: req.input, context: req.context ?? '', map: new Map<string, string>() }
  const maskedReq: GenerateRequest = { ...req, input: m.input, context: m.context }
  const { system, user } = buildPrompt(maskedReq, scenario, settings)
  const note = masked && m.map.size > 0 ? `\n${PII_NOTE}` : ''

  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), TIMEOUT_MS)
  const startedAt = Date.now()
  const modelLabel = `${provider.name} · ${target.model}`

  try {
    const result = await chat(
      {
        provider,
        apiKey,
        model: target.model,
        temperature: target.temperature,
        stream: false,
        signal: controller.signal,
        onDelta
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
    historyRepo.add(item)
    return finalResult
  } finally {
    clearTimeout(timeout)
  }
}
