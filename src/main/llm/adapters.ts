// 巧答 · LLM 多供应商适配层
// 三套原生协议：OpenAI 兼容（覆盖 DeepSeek/OpenAI/通义/Kimi/GLM/MiniMax/硅基流动/OpenRouter/Ollama/任意网关）、
// Anthropic Messages、Google Gemini generateContent。均支持流式与非流式。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatParams {
  baseUrl: string
  apiKey: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  stream: boolean
  signal: AbortSignal
  extraHeaders: Record<string, string>
  extraQuery: Record<string, string>
}

export interface ChatResult {
  text: string
  usage: { prompt: number; completion: number } | null
}

export function buildUrl(base: string, path: string, extraQuery: Record<string, string>): string {
  const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`)
  for (const [k, v] of Object.entries(extraQuery)) {
    if (k) url.searchParams.append(k, v ?? '')
  }
  return url.toString()
}

export function parseHeaderLines(raw: string): Record<string, string> {
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

export function parseQueryLines(raw: string): Record<string, string> {
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

/** 流式读取 SSE 风格响应，逐行产出（自动处理跨 chunk 分割） */
export async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (line) yield line
    }
  }
  if (buf.trim()) yield buf.trim()
}

async function readTextSafe(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

export interface HttpError {
  code: string
  message: string
  status: number
}

/** 把 HTTP 错误转成对客服友好的中文提示 */
export async function toHttpError(res: Response): Promise<HttpError> {
  const status = res.status
  const text = await readTextSafe(res)
  let upstream = ''
  try {
    const j = JSON.parse(text)
    upstream = j?.error?.message || j?.message || ''
  } catch {
    upstream = text.slice(0, 200)
  }
  const detail = upstream ? `（${upstream}）` : ''
  if (status === 401 || status === 403) return { code: 'auth', message: `密钥无效或无权访问该模型${detail}`, status }
  if (status === 402) return { code: 'quota', message: `账户余额不足${detail}`, status }
  if (status === 404) return { code: 'model', message: `模型不存在，请检查模型名称${detail}`, status }
  if (status === 429) return { code: 'rate', message: `请求过于频繁，已被限流，请稍后再试${detail}`, status }
  if (status >= 500) return { code: 'upstream', message: `模型服务商暂时不可用（${status}）${detail}`, status }
  return { code: 'http', message: `请求失败（${status}）${detail}`, status }
}

interface OpenaiBody {
  model: string
  messages: ChatMessage[]
  stream: boolean
  temperature?: number
  max_tokens?: number
}

// ---------- OpenAI 兼容协议 ----------
export async function openaiChat(p: ChatParams, onDelta?: (t: string) => void): Promise<ChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...p.extraHeaders
  }
  if (p.apiKey) headers['Authorization'] = `Bearer ${p.apiKey}`

  const doPost = (body: OpenaiBody): Promise<Response> =>
    fetch(buildUrl(p.baseUrl, 'chat/completions', p.extraQuery), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: p.signal
    })

  const body: OpenaiBody = { model: p.model, messages: p.messages, stream: p.stream }
  if (p.temperature !== undefined) body.temperature = p.temperature
  if (p.maxTokens) body.max_tokens = p.maxTokens

  let res = await doPost(body)
  if (!res.ok && res.status === 400 && p.temperature !== undefined) {
    // 某些模型（如 deepseek-reasoner）不接受 temperature 参数 —— 自动去掉重试一次
    const retry = { ...body }
    delete retry.temperature
    res = await doPost(retry)
  }
  if (!res.ok) throw await toHttpError(res)

  if (p.stream) {
    let text = ''
    let usage: ChatResult['usage'] = null
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') break
      try {
        const j = JSON.parse(data)
        const delta = j?.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          text += delta
          onDelta?.(delta)
        }
        if (j?.usage) {
          usage = { prompt: j.usage.prompt_tokens || 0, completion: j.usage.completion_tokens || 0 }
        }
      } catch {
        /* 忽略无法解析的行 */
      }
    }
    return { text, usage }
  }

  const j = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  return {
    text: j.choices?.[0]?.message?.content ?? '',
    usage: j.usage
      ? { prompt: j.usage.prompt_tokens || 0, completion: j.usage.completion_tokens || 0 }
      : null
  }
}

// ---------- Anthropic Messages 协议 ----------
export async function anthropicChat(p: ChatParams, onDelta?: (t: string) => void): Promise<ChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...p.extraHeaders
  }
  if (p.apiKey) headers['x-api-key'] = p.apiKey

  const system = p.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const messages = p.messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content
  }))

  const body: Record<string, unknown> = {
    model: p.model,
    system: system || undefined,
    messages,
    max_tokens: p.maxTokens || 4096,
    stream: p.stream
  }
  if (p.temperature !== undefined) body.temperature = Math.min(1, Math.max(0, p.temperature))

  const res = await fetch(buildUrl(p.baseUrl, 'v1/messages', p.extraQuery), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: p.signal
  })
  if (!res.ok) throw await toHttpError(res)

  if (p.stream) {
    let text = ''
    let usage: ChatResult['usage'] = null
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      try {
        const j = JSON.parse(data)
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta' && j.delta?.text) {
          text += j.delta.text
          onDelta?.(j.delta.text)
        }
        if (j.type === 'message_delta' && j.usage) {
          usage = {
            prompt: j.usage.input_tokens || 0,
            completion: j.usage.output_tokens || 0
          }
        }
        if (j.type === 'error') {
          throw { code: 'upstream', message: `Claude 返回错误：${j.error?.message || '未知错误'}`, status: 500 }
        }
      } catch (e) {
        if ((e as { code?: string })?.code === 'upstream') throw e
      }
    }
    return { text, usage }
  }

  const j = (await res.json()) as {
    content?: { type: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  return {
    text: (j.content ?? []).map((c) => c.text ?? '').join(''),
    usage: j.usage
      ? { prompt: j.usage.input_tokens || 0, completion: j.usage.output_tokens || 0 }
      : null
  }
}

// ---------- Google Gemini 协议 ----------
export async function geminiChat(p: ChatParams, onDelta?: (t: string) => void): Promise<ChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...p.extraHeaders
  }
  if (p.apiKey) headers['x-goog-api-key'] = p.apiKey

  const system = p.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  // Gemini 要求相邻同角色消息合并
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
  for (const m of p.messages) {
    if (m.role === 'system') continue
    const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user'
    const last = contents[contents.length - 1]
    if (last && last.role === role) last.parts.push({ text: m.content })
    else contents.push({ role, parts: [{ text: m.content }] })
  }

  const body: Record<string, unknown> = {
    system_instruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      ...(p.temperature !== undefined ? { temperature: p.temperature } : {}),
      ...(p.maxTokens ? { maxOutputTokens: p.maxTokens } : {})
    }
  }

  const suffix = p.stream ? 'streamGenerateContent?alt=sse' : 'generateContent'
  const res = await fetch(buildUrl(p.baseUrl, `v1beta/models/${encodeURIComponent(p.model)}:${suffix}`, p.extraQuery), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: p.signal
  })
  if (!res.ok) throw await toHttpError(res)

  if (p.stream) {
    let text = ''
    let usage: ChatResult['usage'] = null
    for await (const line of sseLines(res)) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      try {
        const j = JSON.parse(data)
        const parts = j?.candidates?.[0]?.content?.parts
        if (Array.isArray(parts)) {
          const t = parts.map((pt: { text?: string }) => pt.text ?? '').join('')
          if (t) {
            text += t
            onDelta?.(t)
          }
        }
        if (j?.usageMetadata) {
          usage = {
            prompt: j.usageMetadata.promptTokenCount || 0,
            completion: j.usageMetadata.candidatesTokenCount || 0
          }
        }
      } catch {
        /* ignore */
      }
    }
    return { text, usage }
  }

  const j = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }
  const text = (j.candidates ?? [])
    .flatMap((c) => c.content?.parts ?? [])
    .map((pt) => pt.text ?? '')
    .join('')
  return {
    text,
    usage: j.usageMetadata
      ? { prompt: j.usageMetadata.promptTokenCount || 0, completion: j.usageMetadata.candidatesTokenCount || 0 }
      : null
  }
}
