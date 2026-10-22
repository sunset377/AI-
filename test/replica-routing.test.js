import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createReplicaApi } from '../server/replica-api.js'
import { createAuditLog } from '../server/replica-audit.js'
import { PROVIDERS, estimateChatCost, providerList, routeFor } from '../server/replica-routing.js'
test('model catalogue is explicit and the local tier is the default route', () => {
  const ids = providerList().map((p) => p.id)
  assert.deepEqual(ids, ['local', 'deepseek', 'minimax-h3'])
  assert.equal(PROVIDERS.local.enabled, true)
  assert.equal(PROVIDERS['minimax-h3'].enabled, false)
  const local = routeFor({ mode: 'local', chatReady: false })
  assert.equal(local.id, 'local')
  assert.equal(local.fee, 0)
  const api = routeFor({ mode: 'api', chatReady: true })
  assert.equal(api.id, 'deepseek')
  const degraded = routeFor({ mode: 'api', chatReady: false })
  assert.equal(degraded.id, 'local')
})

test('chat cost estimate is bounded and labelled as an estimate', () => {
  const estimate = estimateChatCost('做一条美食短视频')
  assert.equal(estimate.currency, '元')
  assert.ok(estimate.inputTokens > 0 && estimate.inputTokens < 5000)
  assert.ok(estimate.fee > 0 && estimate.fee < 1)
  assert.match(estimate.note, /估算/)
})

test('audit log appends, lists newest first and persists across instances', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-audit-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const audit = createAuditLog({ directory })
  await audit.append({ kind: 'chat', provider: 'local', fee: 0, summary: 'first', owner: 'a' })
  await audit.append({ kind: 'chat', provider: 'deepseek', fee: 0.004, summary: 'second', owner: 'b' })
  const listed = await audit.list({ limit: 10 })
  assert.equal(listed.length, 2)
  assert.equal(listed[0].summary, 'second')
  assert.equal(listed[1].summary, 'first')
  assert.equal(listed[0].owner, 'b')
  // A new instance reads the persisted JSONL back.
  const reloaded = createAuditLog({ directory })
  const again = await reloaded.list({ limit: 10 })
  assert.equal(again.length, 2)
  assert.equal(again[0].summary, 'second')
})

async function fixture(t, config = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-routing-test-'))
  const ragCalls = []
  const ragClient = {
    health: async () => ({ ready: true, embedding: 'hash', embedding_dim: 512, model: 'test-embed' }),
    search: async (owner, collection, query, options) => { ragCalls.push({ owner, collection, query, options }); return { hits: [], rewritten_queries: [query] } },
    ingest: async (owner, collection, items) => { ragCalls.push({ owner, collection, items }); return { ok: true } },
  }
  const render = async (_, dir, update) => { await writeFile(path.join(dir, 'result.mp4'), 'TEST-MEDIA'); await update({ status: 'complete', progress: 100 }) }
  const middleware = await createReplicaApi({ directory, render, checkTools: async () => ({ ready: true }), probeDuration: async () => 4, ragClient, audit: createAuditLog({ directory: path.join(directory, '.audit') }), videoConfig: { baseUrl: 'https://api.minimax.cn', model: 'MiniMax-H3', apiKey: '' }, ...config })
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const cookie = (await fetch(`${origin}/api/replica/health`)).headers.get('set-cookie').split(';')[0]
  const request = (suffix, method = 'GET', body, extra = {}) => fetch(`${origin}/api/replica${suffix}`, { method, headers: { origin, cookie, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extra }, body: body instanceof FormData ? body : body && JSON.stringify(body) })
  t.after(async () => { await new Promise((r) => server.close(r)); await rm(directory, { recursive: true, force: true }) })
  return { request, directory, origin, cookie, ragCalls }
}

test('health exposes the model routing catalogue', async (t) => {
  const f = await fixture(t)
  const body = await (await f.request('/health')).json()
  assert.ok(body.routing?.providers?.local)
  assert.ok(body.routing?.providers?.deepseek)
  assert.equal(body.routing.providers['minimax-h3'].enabled, false)
})

test('audit endpoint lists calls and hides the owner hash', async (t) => {
  const f = await fixture(t)
  const created = await f.request('/drafts', 'POST', {})
  const draft = await created.json()
  await f.request(`/drafts/${draft.id}/messages`, 'POST', { revision: 1, message: '标题：三秒看懂；卖点：本地生成；行动：马上开始', mode: 'local' })
  const entries = (await (await f.request('/audit?limit=20')).json()).entries
  assert.equal(entries.length, 1)
  assert.equal(entries[0].provider, 'local')
  assert.equal(entries[0].fee, 0)
  assert.ok(!('owner' in entries[0]))
  assert.match(entries[0].summary, /本地规划/)
  const anonymous = await fetch(`${f.origin}/api/replica/audit?limit=20`)
  assert.deepEqual((await anonymous.json()).entries, [])
})

test('one-click auto mode resolves explicit copy into an executable plan', async (t) => {
  const f = await fixture(t)
  const created = await f.request('/drafts', 'POST', {})
  const draft = await created.json()
  const response = await f.request(`/drafts/${draft.id}/messages`, 'POST', { revision: 1, message: '标题：三秒看懂；卖点：本地生成；行动：马上开始', mode: 'local', auto: true })
  const result = await response.json()
  assert.equal(result.status, 'idle')
  assert.equal(result.directorPlan.status, 'executable')
  assert.equal(result.directorPlan.route.kind, 'hypit-template')
  assert.equal(result.pendingQuestion, null)
  assert.deepEqual(result.directorPlan.requirements, ['标题：三秒看懂；卖点：本地生成；行动：马上开始'])
})

test('one-click auto mode never invents missing copy', async (t) => {
  const f = await fixture(t)
  const created = await f.request('/drafts', 'POST', {})
  const draft = await created.json()
  const response = await f.request(`/drafts/${draft.id}/messages`, 'POST', { revision: 1, message: '我想做一条美食视频', mode: 'local', auto: true })
  const result = await response.json()
  assert.equal(result.directorPlan.status, 'planning_only')
  assert.ok(result.directorPlan.blockers.some((b) => /缺少/.test(b)))
  // The leading sentence may be lifted as title copy from the user's own words,
  // but missing benefit/action are never invented.
  assert.equal(result.template.benefit, '')
  assert.equal(result.template.action, '')
})

test('memory is ingested per owner and injected into local planning evidence', async (t) => {
  const f = await fixture(t)
  const saved = await f.request('/rag/memory', 'POST', { item_id: 'pref-background', text: '#22c55e', meta: { kind: 'background' } })
  assert.equal((await saved.json()).saved, true)
  const ingest = f.ragCalls.find((c) => c.collection === 'memory' && c.items[0]?.id === 'pref-background')
  assert.ok(ingest)
  const created = await f.request('/drafts', 'POST', {})
  const draft = await created.json()
  const response = await f.request(`/drafts/${draft.id}/messages`, 'POST', { revision: 1, message: '标题：三秒看懂；卖点：本地生成；行动：马上开始', mode: 'local', memory: [{ text: '#22c55e', meta: { kind: 'background' } }, { text: '偏好暖色调与大字排版', meta: { kind: 'style' } }] })
  const result = await response.json()
  assert.equal(result.template.background, '#22c55e')
  assert.ok(result.directorPlan.reference.evidence.some((e) => /记忆偏好/.test(e.text)))
})

test('rag search accepts the memory collection and forwards to the client', async (t) => {
  const f = await fixture(t)
  await f.request('/rag/search', 'POST', { collection: 'memory', query: '我的偏好', top_k: 2 })
  assert.ok(f.ragCalls.some((c) => c.collection === 'memory'))
})
