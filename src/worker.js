import { interviewSystemPrompt } from './interview/profile.js'

const MODEL = '@cf/google/gemma-4-26b-a4b-it'
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

async function handleInterview(request, env) {
  if (request.method !== 'POST') {
    return jsonError('只支持 POST 请求。', 405)
  }

  const requestOrigin = request.headers.get('origin')
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return jsonError('不允许跨站调用 AI 面试接口。', 403)
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return jsonError('请求必须使用 JSON 格式。', 415)
  }

  const payload = await request.json().catch(() => null)
  const validation = validateInterviewPayload(payload)
  if (!validation.ok) return jsonError(validation.error, 400)

  if (!env.INTERVIEW_RATE_LIMITER || !env.AI) {
    return jsonError('AI 面试服务尚未完成云端配置。', 503)
  }

  const address = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const rateKey = `${address}:${validation.sessionId}`.slice(0, 128)
  const rateLimit = await env.INTERVIEW_RATE_LIMITER.limit({ key: rateKey })
  if (!rateLimit.success) {
    return jsonError('提问速度有点快，请稍后再试。', 429)
  }

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: interviewSystemPrompt },
        ...validation.messages,
      ],
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
      chat_template_kwargs: {
        enable_thinking: false,
      },
    })
    const body = result instanceof Response ? result.body : result

    if (!body) return jsonError('AI 面试服务没有返回内容。', 503)

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    return jsonError('AI 面试服务暂时不可用，请稍后再试。', 503)
  }
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname
    if (pathname === '/api/interview') return handleInterview(request, env)

    if (!env.ASSETS) return jsonError('静态资源服务尚未配置。', 503)
    return env.ASSETS.fetch(request)
  },
}
