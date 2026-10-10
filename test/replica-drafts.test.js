import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createReplicaApi } from '../server/replica-api.js'
import { measureBackground } from '../server/replica-analysis.js'

const evidence = { metadata: { width: 720, height: 1280, duration: 4, hasAudio: false }, frames: [{ id: 0, at: 0 }], background: { color: '#70adeb', coverage: 1, stable: true }, changes: [], supported: true, unknowns: ['未识别文字或语音'] }
async function fixture(t, config = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-draft-test-'))
  const analyze = async (_, dir) => { await writeFile(path.join(dir, 'frame-0.png'), 'TEST-PNG'); return evidence }
  const render = async (_, dir, update) => { await writeFile(path.join(dir, 'result.mp4'), 'TEST-MEDIA'); await update({ status: 'complete', progress: 100 }) }
  const middleware = await createReplicaApi({ directory, analyze, render, checkTools: async () => ({ ready: true }), ...config })
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const cookie = (await fetch(`${origin}/api/replica/health`)).headers.get('set-cookie').split(';')[0]
  const request = (suffix, method = 'GET', body, extra = {}) => fetch(`${origin}/api/replica${suffix}`, { method, headers: { origin, cookie, ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extra }, body: body instanceof FormData ? body : body && JSON.stringify(body) })
  const create = async () => { const form = new FormData(); form.append('video', new Blob(['synthetic-video']), 'source.mp4'); const response = await request('/drafts', 'POST', form); assert.equal(response.status, 201); return response.json() }
  const wait = async (id, status = 'idle') => { for (let n = 0; n < 100; n++) { const state = await (await request(`/drafts/${id}`)).json(); if (state.status === status) return state; await new Promise((r) => setTimeout(r, 10)) } throw new Error('draft operation did not finish') }
  t.after(async () => { await new Promise((r) => server.close(r)); await rm(directory, { recursive: true, force: true }) })
  return { request, create, wait, directory, origin, cookie }
}

test('draft analysis and immutable versions preserve private media after deleting draft', async (t) => {
  const f = await fixture(t), draft = await f.create(), base = `/drafts/${draft.id}`
  assert.equal(draft.owner, undefined)
  assert.equal((await f.request(base, 'GET', undefined, { cookie: '' })).status, 404)
  assert.equal((await f.request(base, 'PATCH', { revision: 1, template: {} }, { origin: 'https://evil.test' })).status, 403)
  assert.equal((await f.request(`${base}/render`, 'POST', { revision: 1 })).status, 409)
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: 1 })).status, 202)
  const analyzed = await f.wait(draft.id)
  assert.equal(analyzed.analysis.metadata.duration, 4)
  const revision = analyzed.revision
  assert.equal((await f.request(`${base}/frames/0`, 'GET', undefined, { cookie: '' })).status, 404)
  assert.equal(await (await f.request(`${base}/frames/0`)).text(), 'TEST-PNG')
  assert.equal((await f.request(base, 'PATCH', { revision: revision - 1, template: { background: '#22c55e' } })).status, 409)
  assert.equal((await f.request(base, 'PATCH', { revision, template: { command: 'run' } })).status, 400)
  const jobs = []
  for (let n = 0; n < 2; n++) {
    assert.equal((await f.request(`${base}/confirm`, 'POST', { revision })).status, 200)
    const response = await f.request(`${base}/render`, 'POST', { revision })
    assert.equal(response.status, 202)
    jobs.push(await response.json())
    await new Promise((r) => setTimeout(r, 30))
  }
  assert.notEqual(jobs[0].id, jobs[1].id)
  assert.notEqual(jobs[0].id, draft.id)
  assert.equal((await f.request(base, 'DELETE')).status, 200)
  for (const job of jobs) for (const file of ['input', 'result']) assert.equal((await f.request(`/jobs/${job.id}/${file}`, 'GET', undefined, { range: 'bytes=0-3' })).status, 206)
})

test('draft changes invalidate confirmation and bounded slow operations reject edits and uploads', async (t) => {
  let release
  const f = await fixture(t, { analyze: () => new Promise((r) => { release = () => r(evidence) }) })
  const d = await f.create(), base = `/drafts/${d.id}`
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: 1 })).status, 202)
  assert.equal((await f.request(base, 'PATCH', { revision: 1, template: { background: '#22c55e' } })).status, 409)
  assert.equal((await f.request(base, 'DELETE')).status, 409)
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: 1 })).status, 429)
  release(); const analyzed = await f.wait(d.id)
  await f.request(`${base}/confirm`, 'POST', { revision: analyzed.revision })
  const changed = await (await f.request(base, 'PATCH', { revision: analyzed.revision, template: { background: '#22c55e' } })).json()
  assert.equal(changed.confirmedRevision, null)
  assert.equal(changed.revision, analyzed.revision + 1)
  assert.equal((await f.request(`${base}/render`, 'POST', { revision: changed.revision })).status, 409)
})

test('draft capacity is bounded and restart keeps editable drafts but interrupts queued work', async (t) => {
  const f = await fixture(t)
  for (let n = 0; n < 10; n++) await f.create()
  const form = new FormData(); form.append('video', new Blob(['test']), 'test.mp4')
  assert.equal((await f.request('/drafts', 'POST', form)).status, 429)
  const queuedId = '11111111-1111-4111-8111-111111111111'
  await mkdir(path.join(f.directory, queuedId))
  await writeFile(path.join(f.directory, queuedId, 'job.json'), JSON.stringify({ id: queuedId, owner: 'restart', kind: 'draft', status: 'analyzing', revision: 1 }))
  await createReplicaApi({ directory: f.directory })
  const { readFile } = await import('node:fs/promises')
  const recovered = JSON.parse(await readFile(path.join(f.directory, queuedId, 'job.json')))
  assert.equal(recovered.status, 'failed')
  const all = await (await f.request('/drafts')).json()
  assert.equal(all.drafts.filter((d) => d.status === 'idle').length, 10)
})

test('in-flight uploads count toward the global slow-operation bound', async (t) => {
  let release
  const f = await fixture(t, { analyze: () => new Promise((r) => { release = () => r(evidence) }) })
  const first = await f.create()
  const secondCookie = (await fetch(`${f.origin}/api/replica/health`)).headers.get('set-cookie').split(';')[0]
  const form = () => { const value = new FormData(); value.append('video', new Blob(['test']), 'test.mp4'); return value }
  const second = await (await f.request('/drafts', 'POST', form(), { cookie: secondCookie })).json()
  await f.request(`/drafts/${first.id}/analyze`, 'POST', { revision: 1 })
  await f.request(`/drafts/${second.id}/analyze`, 'POST', { revision: 1 }, { cookie: secondCookie })
  const pending = httpRequest(`${f.origin}/api/replica/drafts`, { method: 'POST', headers: { origin: f.origin, 'content-type': 'multipart/form-data; boundary=test', 'content-length': '100' } })
  pending.on('error', () => {}); pending.write('x')
  await new Promise((r) => setTimeout(r, 40))
  try { assert.equal((await f.request('/drafts', 'POST', form(), { cookie: '' })).status, 429) }
  finally { pending.destroy(); release(); await new Promise((r) => setTimeout(r, 30)) }
})

test('background evidence distinguishes stable flat edges from multi-color or changing edges', () => {
  const blue = Buffer.alloc(64 * 64 * 3); for (let i = 0; i < blue.length; i += 3) { blue[i] = 112; blue[i + 1] = 173; blue[i + 2] = 235 }
  assert.deepEqual(measureBackground([blue, blue]), { color: '#70adeb', coverage: 1, stable: true })
  assert.equal(measureBackground([blue, Buffer.alloc(blue.length)]).stable, false)
  const stripes = Buffer.from(blue); for (let y = 0; y < 32; y++) stripes.fill(0, y * 64 * 3, (y + 1) * 64 * 3)
  assert.equal(measureBackground([stripes]).stable, false)
})
