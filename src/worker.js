import { interviewSystemPrompt } from './interview/profile.js'
import { directorSystemPrompt, validateStoryboard } from './storyboard.js'

const MODEL = 'deepseek-flash'
const blockedRequest = /system\s*prompt|api\s*key|secret|密钥|系统提示|内部配置|绕过.{0,8}(规则|限制)/i

function jsonError(error, status) {
  return Response.json(
    { error },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    },
  )
}

export function validateInterviewPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: '请求内容无效。' }
  }

  const { messages, sessionId } = payload
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(sessionId)) {
    return { ok: false, error: '会话标识无效，请刷新页面后重试。' }
  }

  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 10) {
    return { ok: false, error: '每次最多保留最近 10 条对话。' }
  }

  const normalized = []
  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role)) {
      return { ok: false, error: '对话角色无效。' }
    }

    if (typeof message.content !== 'string') {
      return { ok: false, error: '问题内容无效。' }
    }

    const content = message.content.trim()
    if (!content || content.length > 800) {
      return { ok: false, error: '每条消息需要在 1 到 800 个字符之间。' }
    }

    normalized.push({ role: message.role, content })
  }

  if (normalized.at(-1)?.role !== 'user') {
    return { ok: false, error: '最后一条消息必须是访客问题。' }
  }

  if (blockedRequest.test(normalized.at(-1).content)) {
    return { ok: false, error: '这个问题涉及内部安全信息，请改问个人经历或作品。' }
  }

  return { ok: true, messages: normalized, sessionId }
}

async function handleAIRequest(request, env) {
  const isStoryboard = new URL(request.url).pathname === '/api/storyboard'
  const requestOrigin = request.headers.get('origin')
  if (!requestOrigin || (requestOrigin !== new URL(request.url).origin && requestOrigin !== env.INTERVIEW_ORIGIN)) {
    return jsonError('不允许跨站调用 AI 面试接口。', 403)
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      },
    })
  }

  if (request.method !== 'POST') {
    return jsonError('只支持 POST 请求。', 405)
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('请求必须使用 JSON 格式。', 415)
  }

  let text = ''
  let bytes = 0
  const reader = request.body?.getReader()
  const decoder = new TextDecoder()
  try {
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 40000) {
        await reader.cancel()
        return jsonError('对话内容过长，请清空后重试。', 413)
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } catch {
    return jsonError('请求内容无效。', 400)
  } finally {
    reader?.releaseLock()
  }
  let payload
  try { payload = JSON.parse(text) } catch { payload = null }
  const script = typeof payload?.script === 'string' ? payload.script.trim() : ''
  const validation = isStoryboard
    ? { ok: script.length > 0 && script.length <= 2500, error: '剧本需要在 1 到 2500 个字符之间。' }
    : validateInterviewPayload(payload)
  if (!validation.ok) return jsonError(validation.error, 400)

  if (!env.INTERVIEW_RATE_LIMITER || !env.DEEPSEEK_API_KEY) {
    return jsonError('AI 面试服务尚未完成云端配置。', 503)
  }

  const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
  try {
    const rateLimit = await env.INTERVIEW_RATE_LIMITER.limit({ key: address })
    if (!rateLimit.success) return jsonError('提问速度有点快，请稍后再试。', 429)

    const result = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: isStoryboard
          ? [{ role: 'system', content: directorSystemPrompt }, { role: 'user', content: script }]
          : [{ role: 'system', content: interviewSystemPrompt }, ...validation.messages],
        temperature: 0.45,
        max_tokens: isStoryboard ? 3000 : 600,
        stream: !isStoryboard,
        ...(isStoryboard ? { response_format: { type: 'json_object' } } : {}),
        thinking: { type: 'disabled' },
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    })
    if (!result.ok || !result.body || !result.headers.get('content-type')?.includes(isStoryboard ? 'application/json' : 'text/event-stream')) {
      console.error(JSON.stringify({ message: 'deepseek upstream unavailable', status: result.status }))
      await result.body?.cancel()
      return jsonError('实时 AI 暂时不可用，请稍后再试。', result.status === 429 ? 429 : 503)
    }

    if (isStoryboard) {
      const completion = await result.json()
      const storyboard = JSON.parse(completion.choices?.[0]?.message?.content ?? '')
      if (!validateStoryboard(storyboard)) return jsonError('分镜结果不完整，请重新生成。', 503)
      return Response.json(storyboard, {
        headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
      })
    }

    return new Response(result.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    console.error(JSON.stringify({ message: 'interview request failed' }))
    return jsonError('AI 面试服务暂时不可用，请稍后再试。', 503)
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname
    if (pathname === '/api/interview' || pathname === '/api/storyboard') {
      const response = await handleAIRequest(request, env)
      const origin = request.headers.get('origin')
      if (origin && (origin === new URL(request.url).origin || origin === env.INTERVIEW_ORIGIN)) {
        response.headers.set('access-control-allow-origin', origin)
        response.headers.set('vary', 'Origin')
      }
      return response
    }

    if (!env.ASSETS) return jsonError('静态资源服务尚未配置。', 503)
    return env.ASSETS.fetch(request)
  },
}
