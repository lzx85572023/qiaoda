// 巧答 · LLM 客户端：按供应商类型分发、超时控制、错误归一化、连接测试

import type { Provider } from '@shared/types'
import { anthropicChat, geminiChat, openaiChat, type ChatMessage, type ChatResult } from './adapters'

export class LlmFailure extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'LlmFailure'
  }
}

export interface ChatOptions {
  provider: Provider
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  stream: boolean
  signal: AbortSignal
  onDelta?: (text: string) => void
}

const REQUEST_TIMEOUT_MS = 150_000

function friendlyNetworkError(err: unknown): LlmFailure {
  const e = err as { cause?: { code?: string; message?: string }; message?: string }
  const cause = e?.cause?.code || e?.cause?.message || e?.message || ''
  if (cause.includes('ECONNREFUSED') || cause.includes('ENOTFOUND') || cause.includes('EAI_AGAIN'))
    return new LlmFailure('network', '网络连接失败：无法访问服务商，请检查网络或代理设置')
  if (cause.includes('ETIMEDOUT')) return new LlmFailure('timeout', '请求超时，请检查网络或稍后再试')
  return new LlmFailure('network', '网络连接失败，请检查网络或代理设置')
}

export async function chat(options: ChatOptions, messages: ChatMessage[]): Promise<ChatResult> {
  const { provider } = options
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
  const params = {
    baseUrl: provider.baseUrl.trim(),
    apiKey: options.apiKey,
    model: options.model,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    stream: options.stream,
    signal,
    extraHeaders: parseLines(provider.extraHeaders),
    extraQuery: parseQuery(provider.extraQuery)
  }

  try {
    if (provider.kind === 'anthropic') return await anthropicChat(params, options.onDelta)
    if (provider.kind === 'gemini') return await geminiChat(params, options.onDelta)
    return await openaiChat(params, options.onDelta)
  } catch (err) {
    if (err instanceof LlmFailure) throw err
    if ((err as { code?: string })?.code === 'auth') {
      throw new LlmFailure((err as { code: string }).code, (err as Error).message)
    }
    if ((err as { code?: string })?.code === 'quota') {
      throw new LlmFailure('quota', (err as Error).message)
    }
    if ((err as { code?: string })?.code === 'model') {
      throw new LlmFailure('model', (err as Error).message)
    }
    if ((err as { code?: string })?.code === 'rate') {
      throw new LlmFailure('rate', (err as Error).message)
    }
    if ((err as { code?: string })?.code === 'upstream') {
      throw new LlmFailure('upstream', (err as Error).message)
    }
    if ((err as { code?: string })?.code === 'http') {
      throw new LlmFailure('http', (err as Error).message)
    }
    if ((err as Error)?.name === 'AbortError') throw new LlmFailure('aborted', '已停止生成')
    if ((err as Error)?.name === 'TimeoutError') throw new LlmFailure('timeout', '请求超时，请稍后再试')
    throw friendlyNetworkError(err)
  }
}

function parseLines(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw?.trim()) return out
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

function parseQuery(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw?.trim()) return out
  for (const pair of raw.split(/[&\r\n]/)) {
    const idx = pair.indexOf('=')
    if (idx <= 0) continue
    const k = pair.slice(0, idx).trim()
    const v = pair.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

// ---------- 连接测试 ----------
export interface TestOutcome {
  ok: boolean
  message: string
  models?: string[]
}

export async function testProvider(provider: Provider, apiKey: string): Promise<TestOutcome> {
  const headers: Record<string, string> = { ...parseLines(provider.extraHeaders) }
  try {
    if (provider.kind === 'anthropic') {
      if (apiKey) headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      const res = await fetch(`${provider.baseUrl.trim().replace(/\/+$/, '')}/v1/models`, {
        headers,
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) return { ok: false, message: `连接失败（HTTP ${res.status}）` }
      const j = (await res.json()) as { data?: { id: string }[] }
      return { ok: true, message: '连接成功', models: (j.data ?? []).map((m) => m.id).slice(0, 30) }
    }
    if (provider.kind === 'gemini') {
      if (apiKey) headers['x-goog-api-key'] = apiKey
      const res = await fetch(`${provider.baseUrl.trim().replace(/\/+$/, '')}/v1beta/models`, {
        headers,
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) return { ok: false, message: `连接失败（HTTP ${res.status}）` }
      const j = (await res.json()) as { models?: { name: string }[] }
      return {
        ok: true,
        message: '连接成功',
        models: (j.models ?? []).map((m) => m.name.replace(/^models\//, '')).slice(0, 30)
      }
    }
    // OpenAI 兼容
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
    const res = await fetch(`${provider.baseUrl.trim().replace(/\/+$/, '')}/models`, {
      headers,
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) return { ok: false, message: `连接失败（HTTP ${res.status}）：请检查密钥与地址` }
    const j = (await res.json()) as { data?: { id: string }[] }
    return { ok: true, message: '连接成功', models: (j.data ?? []).map((m) => m.id).slice(0, 30) }
  } catch {
    return { ok: false, message: '无法连接：请检查 Base URL、网络或代理设置' }
  }
}
