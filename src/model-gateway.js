import catalog from './model-catalog.json' with { type: 'json' }
import { MODEL_POLICY, validateModelRequest } from './model-policy.js'

const encoder = new TextEncoder()
const base = 'https://aigchub.token6688.com/v1'
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
const encode = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const decode = (text) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
const signingKey = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

async function issueSession(env) {
  const payload = encode(encoder.encode(JSON.stringify({ id: crypto.randomUUID(), exp: Date.now() + 8 * 3600_000 })))
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env.SESSION_SECRET), encoder.encode(payload))
  return `${payload}.${encode(signature)}`
}

async function readSession(request, env) {
  try {
    const [payload, signature, extra] = (request.headers.get('authorization') || '').replace(/^Bearer /, '').split('.')
    if (extra || !await crypto.subtle.verify('HMAC', await signingKey(env.SESSION_SECRET), decode(signature), encoder.encode(payload))) return null
    const session = JSON.parse(new TextDecoder().decode(decode(payload)))
    return session.exp > Date.now() && /^[a-f0-9-]{36}$/.test(session.id) ? session : null
  } catch { return null }
}

async function readJson(request, max = 30000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('请使用 JSON 提交。')
  const reader = request.body?.getReader()
  const chunks = []; let length = 0
  try {
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > max) { await reader.cancel(); throw new Error('提交内容过长。') }
      chunks.push(value)
    }
  } finally { reader?.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function publicJob(row) {
  const { relayGenerationId, ...result } = row.result ? JSON.parse(row.result) : {}
  return { id: row.id, status: row.status, ...result }
}

function imageReceipt(data, requestId, modelId, previous = {}) {
  const relayGenerationId = data.generation_id || previous.relayGenerationId || data.id
  const result = { modelId, ...(typeof relayGenerationId === 'string' && relayGenerationId.length <= 200 ? { relayGenerationId } : {}) }
  if (data.is_final === true) {
    if (data.status === 'failed') return { status: 'failed', result: { ...result, error: '上游图片任务失败，请联系作者核查结算。' } }
    if (['completed', 'succeeded'].includes(data.status) && (data.type === 'image' || data.output?.type === 'image')) {
      if (data.cdn_pending === true) return { status: 'processing', result }
      const value = data.output?.url || data.result_url
      try {
        const url = new URL(value)
        if (url.protocol === 'https:' && url.hostname === 'cdn.token6688.com' && !url.port && !url.username && !url.password) return { status: 'complete', result: { ...result, imageUrl: url.href } }
      } catch { /* Never render an unconfirmed or non-platform result URL. */ }
    }
    return { status: 'uncertain', result: { ...result, error: '图片任务已结束，成品尚未核实，请联系作者，不要重复提交。' } }
  }
  if ((data.request_id === requestId && ['starting', 'accepted', 'pending', 'running'].includes(data.state)) || (typeof data.status === 'string' && data.is_final === false)) return { status: 'processing', result }
  throw new Error('Unconfirmed image receipt')
}

export async function handleModelRequest(request, env, upstreamFetch = fetch) {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  if (origin !== env.PUBLIC_ORIGIN) return json({ error: '该访问来源未获授权。' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
  const configured = Boolean(env.RELAY_API_KEY && env.RELAY_TASK_ID && env.SESSION_SECRET && env.INVITE_TOKEN && env.DB && env.RELAY_VERIFIED === '1')
  const expiry = Date.parse(env.EXPERIENCE_EXPIRES_AT || '')
  const expired = !Number.isFinite(expiry) || Date.now() >= expiry
  if (url.pathname === '/api/models' && request.method === 'GET') {
    return json({ ...catalog, ready: configured && !expired, publicAccess: configured && !expired && env.PUBLIC_GUEST_ACCESS === '1', expiresAt: env.EXPERIENCE_EXPIRES_AT,
      models: catalog.models.map(model => ({ ...model, enabled: Boolean(MODEL_POLICY[model.id]) && model.available,
        limit: MODEL_POLICY[model.id]?.visitor || 0 })),
    })
  }
  if (!configured) return json({ error: '模型体验服务正在连接，请稍后再试。' }, 503)
  if (expired) return json({ error: '本期体验已结束，请联系作品集作者。' }, 403)
  if (url.pathname === '/api/sessions' && request.method === 'POST') {
    let input
    try { input = await readJson(request, 2000) } catch { return json({ error: '体验码格式无效。' }, 400) }
    const key = await signingKey(env.SESSION_SECRET)
    const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(env.INVITE_TOKEN))
    const publicGuest = env.PUBLIC_GUEST_ACCESS === '1' && input.code === undefined
    if (!publicGuest && (typeof input.code !== 'string' || !await crypto.subtle.verify('HMAC', key, expected, encoder.encode(input.code)))) return json({ error: '体验码无效，请使用作者提供的体验链接。' }, 403)
    return json({ token: await issueSession(env), expiresIn: 8 * 3600 })
  }
  const session = await readSession(request, env)
  if (!session) return json({ error: '请先输入体验码，或打开作者提供的体验链接。' }, 401)
  const jobId = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})$/)?.[1]
  if (jobId && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM model_requests WHERE id = ? AND session = ?').bind(jobId, session.id).first()
    if (row?.kind === 'image' && ['processing', 'uncertain'].includes(row.status)) {
      const previous = row.result ? JSON.parse(row.result) : {}
      try {
        const path = previous.relayGenerationId ? '/generations/' + encodeURIComponent(previous.relayGenerationId) : '/requests/' + jobId
        const response = await upstreamFetch('https://aigchub.token6688.com/api/v1/model-runtime/cli' + path, { method: 'GET', headers: { authorization: `Bearer ${env.RELAY_API_KEY}` }, signal: AbortSignal.timeout(20000) })
        if (response.ok) {
          const next = imageReceipt(await readJson(response, 2_000_000), jobId, previous.modelId, previous)
          row.status = next.status; row.result = JSON.stringify(next.result)
          await env.DB.prepare('UPDATE model_requests SET status = ?, result = ? WHERE id = ?').bind(row.status, row.result, jobId).run()
        } else await response.body?.cancel()
      } catch { /* Status queries never resubmit paid work or discard the previous receipt. */ }
    }
    return row ? json(publicJob(row)) : json({ error: '未找到当前访客的任务。' }, 404)
  }
  if (!['/api/chat', '/api/images'].includes(url.pathname)) return json({ error: '该功能未向访客开放。' }, 403)
  if (request.method !== 'POST') return json({ error: '请使用 POST 提交。' }, 405)
  let input
  try { input = validateModelRequest(await readJson(request, url.pathname === '/api/images' ? 7_100_000 : 30000)) } catch (error) { return json({ error: error.message }, 400) }
  if ((url.pathname === '/api/chat' ? 'chat' : 'image') !== input.type) return json({ error: '模型类型与操作不匹配。' }, 400)
  const fingerprint = encode(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(input))))
  const previous = await env.DB.prepare('SELECT * FROM model_requests WHERE id = ?').bind(input.requestId).first()
  if (previous) return previous.session === session.id && previous.fingerprint === fingerprint ? json(publicJob(previous)) : json({ error: '请求标识已使用，请新建任务。' }, 409)
  const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
  const reserved = await env.DB.prepare(`INSERT INTO model_requests (id, session, fingerprint, kind, day, status)
    SELECT ?, ?, ?, ?, ?, 'processing'
    WHERE (SELECT COUNT(*) FROM model_requests WHERE day = ? AND kind = ?) < ?
      AND (SELECT COUNT(*) FROM model_requests WHERE day = ? AND kind = ? AND session = ?) < ?
    ON CONFLICT(id) DO NOTHING RETURNING id`).bind(input.requestId, session.id, fingerprint, input.type, day,
    day, input.type, input.policy.daily, day, input.type, session.id, input.policy.visitor).first()
  if (!reserved) return json({ error: '今日体验次数已用完，或同一请求正在处理。' }, 429)
  const body = input.type === 'chat'
    ? { model: input.modelId, messages: [{ role: 'system', content: '你是刘耀华作品集的 AI 创作助手。请用中文清晰简洁地回答用户的问题。' }, ...input.messages], stream: false, max_tokens: 600 }
    : { task_id: env.RELAY_TASK_ID, request_id: input.requestId, input: { model_id: input.modelId, modality: 'image', params: input.params } }
  let result, status
  try {
    const response = await upstreamFetch(input.type === 'chat' ? base + '/chat/completions' : 'https://aigchub.token6688.com/api/v1/model-runtime/cli/generations', {
      method: 'POST', headers: { authorization: `Bearer ${env.RELAY_API_KEY}`, 'content-type': 'application/json', 'x-request-id': input.requestId },
      body: JSON.stringify(body), signal: AbortSignal.timeout(input.type === 'chat' ? 60_000 : 180_000),
    })
    if (!response.ok) {
      let code
      try { code = (await readJson(response, 4000)).error?.code } catch { /* Never expose the provider response. */ }
      console.error(JSON.stringify({ event: 'relay_rejected', status: response.status, id: input.requestId }))
      status = response.status >= 500 ? 'uncertain' : 'failed'
      result = { error: code === 'cli_budget_authorization_required' ? '作者尚未完成平台预算授权，请联系作者。' : response.status === 402 ? '作者的体验额度已用完，请联系作者。' : response.status === 429 ? '模型当前繁忙，请稍后查看任务。' : '上游未完成本次调用，请联系作者核查。' }
    } else {
      const data = await readJson(response, 2_000_000)
      const content = data.choices?.[0]?.message?.content
      if (input.type === 'image') ({ result, status } = imageReceipt(data, input.requestId, input.modelId))
      else if (typeof content === 'string' && content.trim()) { result = { text: content.slice(0, 12000), modelId: input.modelId }; status = 'complete' }
      else throw new Error('No confirmed result')
    }
  } catch {
    status = 'uncertain'
    result = { modelId: input.modelId, error: '结果尚未确认，请保留任务记录并联系作者核查，避免重复扣款。' }
  }
  await env.DB.prepare('UPDATE model_requests SET status = ?, result = ? WHERE id = ?').bind(status, JSON.stringify(result), input.requestId).run()
  return json(publicJob({ id: input.requestId, status, result: JSON.stringify(result) }))
}

export default {
  async fetch(request, env) {
    let response
    try { response = await handleModelRequest(request, env) }
    catch { response = json({ error: '体验服务暂时不可用，请保留当前任务稍后查看。' }, 503) }
    if (request.headers.get('origin') === env.PUBLIC_ORIGIN) {
      response.headers.set('access-control-allow-origin', env.PUBLIC_ORIGIN)
      response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
      response.headers.set('access-control-allow-headers', 'authorization, content-type')
      response.headers.set('vary', 'Origin')
    }
    return response
  },
}
