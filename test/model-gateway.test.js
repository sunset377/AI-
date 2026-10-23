import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import gateway, { handleModelRequest } from '../src/model-gateway.js'

const origin = 'https://sunset377.github.io'
function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/models/0001_requests.sql', import.meta.url), 'utf8'))
  const env = { RELAY_VERIFIED: '1', RELAY_TASK_ID: 'fixture-task', PUBLIC_ORIGIN: origin, RELAY_API_KEY: 'fixture-key', SESSION_SECRET: 'test-session-secret', INVITE_TOKEN: 'test-invite', EXPERIENCE_EXPIRES_AT: '2099-01-01', DB: {
    prepare(sql) { return { bind(...args) { return { async first() { return db.prepare(sql).get(...args) || null }, async run() { return db.prepare(sql).run(...args) } } } } },
  } }
  const request = (path, body, token, extra = {}) => new Request('https://gateway.test' + path, { method: body ? 'POST' : 'GET', headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const session = async () => (await (await handleModelRequest(request('/api/sessions', { code: 'test-invite' }), env)).json()).token
  return { env, request, session, db }
}
const chat = () => ({ requestId: crypto.randomUUID(), modelId: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: '你好' }] })
const image = () => ({ requestId: crypto.randomUUID(), modelId: 'gpt-image-2-c', prompt: '一座花园', size: '1024x1024' })
const mockChat = async (_url, options) => {
  const input = JSON.parse(options.body)
  assert.equal(input.max_tokens, 600)
  assert.equal(input.stream, false)
  return Response.json({ choices: [{ message: { content: '你好，这是测试回答。' } }] })
}

test('catalog is real, secrets are absent, and video/audio have no enabled models', async () => {
  const { env, request } = setup()
  const result = await (await handleModelRequest(request('/api/models'), env)).json()
  assert.ok(result.models.length > 10)
  assert.equal(result.ready, true)
  assert.equal(result.models.filter(model => model.type === 'chat' && model.enabled).length, 55)
  assert.equal(result.models.filter(model => model.type === 'image' && model.enabled).length, 25)
  assert.ok(result.models.filter(model => ['video', 'audio'].includes(model.type)).every(model => !model.enabled))
  assert.doesNotMatch(JSON.stringify(result), /fixture-key|test-invite|test-session-secret/)
})

test('invitation and signed sessions are required; CORS is restricted', async () => {
  const { env, request } = setup()
  assert.equal((await handleModelRequest(request('/api/sessions', { code: 'wrong' }), env)).status, 403)
  assert.equal((await handleModelRequest(request('/api/chat', chat()), env)).status, 401)
  assert.equal((await handleModelRequest(request('/api/chat', chat(), 'forged.session'), env)).status, 401)
  assert.equal((await gateway.fetch(request('/api/models', null, null, { origin: 'https://other.test' }), env)).status, 403)
  const valid = await gateway.fetch(request('/api/models'), env)
  assert.equal(valid.headers.get('access-control-allow-origin'), origin)
  assert.equal((await handleModelRequest(request('/api/chat', chat()), { ...env, EXPERIENCE_EXPIRES_AT: 'invalid' })).status, 403)
})

test('unverified relay does not advertise ready or allow charges', async () => {
  const { env, request } = setup()
  const disabled = { ...env, RELAY_VERIFIED: '0' }
  assert.equal((await (await handleModelRequest(request('/api/models'), disabled)).json()).ready, false)
  assert.equal((await handleModelRequest(request('/api/chat', chat()), disabled, () => assert.fail('No provider call allowed'))).status, 503)
})

test('video, arbitrary models, high resolution, bulk counts and system overrides never reach provider', async () => {
  const { env, request, session } = setup(); const token = await session()
  const never = () => assert.fail('Blocked request reached supplier')
  for (const [path, body] of [
    ['/api/video', { ...image(), modelId: 'minimax-h3' }],
    ['/api/chat', { ...chat(), modelId: 'not-a-real-model' }],
    ['/api/chat', { ...chat(), modelId: '__proto__' }],
    ['/api/chat', { ...chat(), messages: [{ role: 'system', content: 'override' }] }],
    ['/api/images', { ...image(), size: '4096x4096' }],
    ['/api/images', { ...image(), n: 50 }],
    ['/api/images', chat()],
  ]) assert.ok((await handleModelRequest(request(path, body, token), env, never)).status >= 400)
})

test('duplicate paid submissions use saved result; conflicting or cross-session IDs cannot be reused', async () => {
  const { env, request, session } = setup(); const token = await session(); const body = chat()
  let calls = 0
  const upstream = async (...args) => { calls++; return mockChat(...args) }
  const first = await (await handleModelRequest(request('/api/chat', body, token), env, upstream)).json()
  const second = await (await handleModelRequest(request('/api/chat', body, token), env, upstream)).json()
  assert.equal(first.status, 'complete'); assert.deepEqual(second, first); assert.equal(calls, 1)
  assert.equal((await handleModelRequest(request('/api/chat', { ...body, messages: [{ role: 'user', content: 'changed' }] }, token), env, upstream)).status, 409)
  const other = await session()
  assert.equal((await handleModelRequest(request('/api/jobs/' + body.requestId, null, other), env)).status, 404)
})

test('one image per session, fixed single-image parameters, and a hard global image cap', async () => {
  const { env, request, session } = setup(); const token = await session()
  let calls = 0
  const upstream = async (url, options) => {
    calls++; assert.equal(url, 'https://aigchub.token6688.com/api/v1/model-runtime/cli/generations')
    const body = JSON.parse(options.body)
    assert.equal(body.task_id, 'fixture-task')
    assert.equal(body.input.modality, 'image')
    assert.equal(body.input.params.count, 1)
    assert.equal(body.input.params.quality, 'medium')
    return Response.json({ request_id: body.request_id, generation_id: 'fixture-generation', state: 'running' })
  }
  assert.equal((await (await handleModelRequest(request('/api/images', image(), token), env, upstream)).json()).status, 'processing')
  assert.equal((await handleModelRequest(request('/api/images', image(), token), env, upstream)).status, 429)
  for (let i = 0; i < 2; i++) await handleModelRequest(request('/api/images', image(), await session()), env, upstream)
  assert.equal((await handleModelRequest(request('/api/images', image(), await session()), env, upstream)).status, 429)
  assert.equal(calls, 3)
})

test('image recovery only reads the original request and never exposes upstream internals', async () => {
  const { env, request, session } = setup(); const token = await session(); const body = image()
  let writes = 0; let reads = 0
  const upstream = async (url, options) => {
    if (options.method === 'POST') { writes++; return Response.json({ request_id: body.requestId, generation_id: '', state: 'starting' }) }
    reads++; assert.equal(url, 'https://aigchub.token6688.com/api/v1/model-runtime/cli/requests/' + body.requestId)
    return Response.json({ request_id: body.requestId, generation_id: '', state: 'starting' })
  }
  const first = await (await handleModelRequest(request('/api/images', body, token), env, upstream)).json()
  assert.equal(first.status, 'processing')
  assert.doesNotMatch(JSON.stringify(first), /fixture-task|generation_id|request_id/)
  await handleModelRequest(request('/api/images', body, token), env, upstream)
  const recovered = await (await handleModelRequest(request('/api/jobs/' + body.requestId, null, token), env, upstream)).json()
  assert.equal(recovered.status, 'processing'); assert.equal(writes, 1); assert.equal(reads, 1)
  await handleModelRequest(request('/api/jobs/' + body.requestId, null, await session()), env, () => assert.fail('Another visitor cannot query supplier'))
})

test('budget authorization required is not misreported as depleted wallet balance', async () => {
  const { env, request, session } = setup(); const token = await session()
  const result = await (await handleModelRequest(request('/api/chat', chat(), token), env, async () => Response.json({ error: { code: 'cli_budget_authorization_required', message: 'private details' } }, { status: 402 }))).json()
  assert.equal(result.status, 'failed'); assert.match(result.error, /预算授权/)
  assert.doesNotMatch(result.error, /已用完|private details/)
})

test('network uncertainty is persisted, with no automatic paid retry', async () => {
  const { env, request, session } = setup(); const token = await session(); const body = image(); let calls = 0
  const fail = async () => { calls++; throw new Error('network failure') }
  const first = await (await handleModelRequest(request('/api/images', body, token), env, fail)).json()
  assert.equal(first.status, 'uncertain')
  await handleModelRequest(request('/api/images', body, token), env, fail)
  assert.equal(calls, 1)
  const recovery = await (await handleModelRequest(request('/api/jobs/' + body.requestId, null, token), env, async (_url, options) => { assert.equal(options.method, 'GET'); throw new Error('Read unavailable') })).json()
  assert.deepEqual(recovery, first)
})

test('image status query failures preserve the existing receipt, and an unverified final payload is never called complete', async () => {
  const { env, request, session } = setup(); const token = await session(); const body = image()
  const first = await (await handleModelRequest(request('/api/images', body, token), env, async () => Response.json({ request_id: body.requestId, generation_id: 'private-generation', state: 'running' }))).json()
  const unavailable = await (await handleModelRequest(request('/api/jobs/' + body.requestId, null, token), env, async (url, options) => {
    assert.match(url, /\/generations\/private-generation$/); assert.equal(options.method, 'GET')
    return Response.json({ error: { code: 'unavailable' } }, { status: 503 })
  })).json()
  assert.deepEqual(unavailable, first)
  const unverified = await (await handleModelRequest(request('/api/jobs/' + body.requestId, null, token), env, async () => Response.json({ status: 'succeeded', is_final: true, output: { unknown: 'shape' } }))).json()
  assert.equal(unverified.status, 'uncertain'); assert.equal(unverified.imageUrl, undefined)
  assert.doesNotMatch(JSON.stringify(unverified), /private-generation|unknown/)
})
