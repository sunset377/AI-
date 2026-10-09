import { buildResumeFallbackAnswer } from './fallback.js'
import { interviewSystemPrompt } from './profile.js'

// DeepSeek API 配置 — 把这里的 key 换成你自己的
// 在 https://platform.deepseek.com/ 创建 API Key
const DEEPSEEK_CONFIG = {
  url: 'https://api.deepseek.com/v1/chat/completions',
  key: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
  model: 'deepseek-chat',
}

export function parseSseLine(line) {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const payload = JSON.parse(data)
    const delta = payload.choices?.[0]?.delta?.content
    return typeof delta === 'string' && delta ? { response: delta } : null
  } catch {
    return null
  }
}

// 直接从浏览器调 DeepSeek API（流式）
async function streamDeepSeek({ messages, onToken, signal }) {
  if (!DEEPSEEK_CONFIG.key) {
    throw new Error('NO_API_KEY')
  }
  const response = await fetch(DEEPSEEK_CONFIG.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_CONFIG.key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CONFIG.model,
      messages: [
        { role: 'system', content: interviewSystemPrompt },
        ...messages,
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 800,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`DeepSeek API 错误 ${response.status}: ${err.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const event = parseSseLine(line.trim())
      if (event) onToken(event.response)
    }
  }
  return { mode: 'deepseek-direct' }
}

// 先试 Cloudflare Worker，再试 DeepSeek 直连，最后本地兜底
export async function streamInterview({
  messages,
  sessionId,
  onToken,
  signal,
  fetchImpl = fetch,
}) {
  // 1) 如果配了 DeepSeek key，优先直连（浏览器流式，效果最好）
  if (DEEPSEEK_CONFIG.key) {
    try {
      return await streamDeepSeek({ messages, onToken, signal })
    } catch (err) {
      if (err.name === 'AbortError') throw err
      // CORS 或网络失败，继续走后面的逻辑
    }
  }

  // 2) 试 Cloudflare Worker（部署到 Cloudflare 后可用）
  try {
    const response = await fetchImpl('/api/interview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, sessionId }),
      signal,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const isStaticFallback = contentType.includes('text/html')
      || ([404, 405].includes(response.status) && !contentType.includes('application/json'))

    if (!isStaticFallback && response.ok && contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const event = parseSseLine(line.trim())
          if (event) onToken(event.response)
        }
      }
      return { mode: 'workers-ai' }
    }
  } catch {
    // worker 不可用，继续
  }

  // 3) 本地兜底（正则匹配 + 知识库）
  onToken(buildResumeFallbackAnswer(messages))
  return { mode: 'local-fallback' }
}
