import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createReplicaApi } from '../server/replica-api.js'
import { createAuditLog } from '../server/replica-audit.js'
import { measureBackground } from '../server/replica-analysis.js'
import { buildDirectorPlan } from '../src/replica-director.js'
import { DEFAULT_TEMPLATE } from '../src/replica-template.js'

const evidence = { metadata: { width: 720, height: 1280, duration: 4, hasAudio: false }, frames: [{ id: 0, at: 0 }], background: { color: '#70adeb', coverage: 1, stable: true }, changes: [], supported: true, unknowns: ['未识别文字或语音'] }
const executablePlan = (template = { ...DEFAULT_TEMPLATE, title: '三秒看懂', benefit: '本地生成', action: '马上开始' }) => buildDirectorPlan({ requirements: ['制作一条文字卡短视频'], canvas: { width: 720, height: 1280, fps: 30 }, template })
const makeExecutable = async (f, base, state, copy = '标题：三秒看懂；卖点：本地生成；行动：马上开始') => {
  const response = await f.request(`${base}/messages`, 'POST', { revision: state.revision, message: copy, mode: 'local' })
  assert.equal(response.status, 200)
  return response.json()
}
async function fixture(t, config = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-draft-test-'))
  const analyze = async (_, dir) => { await writeFile(path.join(dir, 'frame-0.png'), 'TEST-PNG'); return evidence }
  const render = async (_, dir, update) => { await writeFile(path.join(dir, 'result.mp4'), 'TEST-MEDIA'); await update({ status: 'complete', progress: 100 }) }
  const middleware = await createReplicaApi({ directory, analyze, render, checkTools: async () => ({ ready: true }), probeDuration: async () => 4, audit: createAuditLog({ directory: path.join(directory, '.audit') }), ...config })
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
  let analyzed = await f.wait(draft.id)
  assert.equal(analyzed.analysis.metadata.duration, 4)
  analyzed = await makeExecutable(f, base, analyzed)
  const revision = analyzed.revision
  assert.equal((await f.request(`${base}/frames/0`, 'GET', undefined, { cookie: '' })).status, 404)
  assert.equal(await (await f.request(`${base}/frames/0`)).text(), 'TEST-PNG')
  assert.equal((await f.request(base, 'PATCH', { revision: revision - 1, template: { background: '#22c55e' } })).status, 409)
  assert.equal((await f.request(base, 'PATCH', { revision, template: { command: 'run' } })).status, 400)
  const jobs = []
  for (let n = 0; n < 2; n++) {
    const confirmation = await f.request(`${base}/confirm`, 'POST', { revision })
    assert.equal(confirmation.status, 200)
    const confirmed = await confirmation.json()
    const response = await f.request(`${base}/render`, 'POST', { revision })
    assert.equal(response.status, 202)
    const job = await response.json()
    assert.deepEqual(job.reference, { filename: 'source.mp4', metadata: evidence.metadata })
    assert.deepEqual(job.directorPlan, confirmed.directorPlan)
    assert.equal(job.confirmedPlanHash, confirmed.confirmedPlanHash)
    assert.match(job.inputUrl, /\/input$/)
    jobs.push(job)
    await new Promise((r) => setTimeout(r, 30))
  }
  assert.notEqual(jobs[0].id, jobs[1].id)
  assert.notEqual(jobs[0].id, draft.id)
  assert.equal((await f.request(base, 'DELETE')).status, 200)
  for (const job of jobs) for (const file of ['input', 'result']) assert.equal((await f.request(`/jobs/${job.id}/${file}`, 'GET', undefined, { range: 'bytes=0-3' })).status, 206)
})

test('text draft has no fake input and a reference replacement invalidates derived state', async (t) => {
  const f = await fixture(t)
  const response = await f.request('/drafts', 'POST', {})
  assert.equal(response.status, 201)
  let draft = await response.json(), base = `/drafts/${draft.id}`
  assert.equal(draft.schemaVersion, 3)
  assert.equal(draft.reference, null)
  assert.equal(draft.inputUrl, null)
  assert.equal(draft.analysis, null)
  assert.equal(draft.directorPlan, null)
  assert.deepEqual(draft.canvas, { width: 720, height: 1280, fps: 30 })
  assert.equal((await f.request(`${base}/input`)).status, 404)
  assert.equal((await f.request(base, 'GET', undefined, { cookie: '' })).status, 404)

  const attach = new FormData(); attach.append('video', new Blob(['first-reference']), 'first.mp4'); attach.append('revision', String(draft.revision))
  const attachedResponse = await f.request(`${base}/reference`, 'POST', attach)
  assert.equal(attachedResponse.status, 200)
  draft = await attachedResponse.json()
  assert.equal(draft.revision, 2)
  assert.deepEqual(draft.reference, { filename: 'first.mp4', metadata: null })
  assert.match(draft.inputUrl, /\/input$/)
  assert.equal(await (await f.request(`${base}/input`)).text(), 'first-reference')
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: draft.revision })).status, 202)
  draft = await f.wait(draft.id)
  assert.deepEqual(draft.reference.metadata, evidence.metadata)
  draft = await makeExecutable(f, base, draft)
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: draft.revision })).status, 200)

  const replace = new FormData(); replace.append('video', new Blob(['second-reference']), 'second.mp4'); replace.append('revision', String(draft.revision))
  const replaced = await (await f.request(`${base}/reference`, 'POST', replace)).json()
  assert.equal(replaced.revision, draft.revision + 1)
  assert.equal(replaced.analysis, null)
  assert.equal(replaced.directorPlan, null)
  assert.equal(replaced.confirmedRevision, null)
  assert.equal(replaced.voicePreview, null)
  assert.deepEqual(replaced.reference, { filename: 'second.mp4', metadata: null })
  assert.equal(await (await f.request(`${base}/input`)).text(), 'second-reference')
})

test('schema 2 draft restores as cleanup template without rewriting its saved file', async (t) => {
  const f = await fixture(t)
  const session = f.cookie.split('=')[1]
  const owner = createHash('sha256').update(session).digest('hex')
  const id = '22222222-2222-4222-8222-222222222222', dir = path.join(f.directory, id)
  await mkdir(dir)
  await writeFile(path.join(dir, 'input.mp4'), 'LEGACY')
  const saved = { id, owner, kind: 'draft', schemaVersion: 2, filename: 'legacy.mp4', createdAt: new Date().toISOString(), status: 'idle', message: '旧草稿', progress: 100, revision: 3, confirmedRevision: null, analysis: evidence, template: { background: '#70adeb', title: '旧标题', benefit: '', action: '', titleColor: '#ffffff', benefitColor: '#eab308', actionColor: '#ffffff', textMotion: 'fade', ringMotion: 'rotate', opening: 'simultaneous', duration: 4, audioMode: 'mute', narration: '' }, messages: [], pendingQuestion: null }
  await writeFile(path.join(dir, 'job.json'), JSON.stringify(saved, null, 2))
  const middleware = await createReplicaApi({ directory: f.directory, checkTools: async () => ({ ready: true }), audit: createAuditLog({ directory: path.join(f.directory, '.audit') }) })
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const restored = await (await fetch(`${origin}/api/replica/drafts/${id}`, { headers: { cookie: f.cookie } })).json()
  assert.equal(restored.schemaVersion, 3)
  assert.equal(restored.template.templateId, 'cleanup-icon')
  assert.deepEqual(restored.reference, { filename: 'legacy.mp4', metadata: evidence.metadata })
  assert.deepEqual(restored.canvas, { width: 720, height: 1280, fps: 30 })
  assert.equal(JSON.parse(await readFile(path.join(dir, 'job.json'), 'utf8')).template.templateId, undefined)
})

test('draft changes invalidate confirmation and bounded slow operations reject edits and uploads', async (t) => {
  let release
  const f = await fixture(t, { analyze: () => new Promise((r) => { release = () => r(evidence) }) })
  const d = await f.create(), base = `/drafts/${d.id}`
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: 1 })).status, 202)
  assert.equal((await f.request(base, 'PATCH', { revision: 1, template: { background: '#22c55e' } })).status, 409)
  assert.equal((await f.request(base, 'DELETE')).status, 409)
  assert.equal((await f.request(`${base}/analyze`, 'POST', { revision: 1 })).status, 429)
  release(); let analyzed = await f.wait(d.id)
  analyzed = await makeExecutable(f, base, analyzed)
  await f.request(`${base}/confirm`, 'POST', { revision: analyzed.revision })
  const changed = await (await f.request(base, 'PATCH', { revision: analyzed.revision, template: { background: '#22c55e' } })).json()
  assert.equal(changed.confirmedRevision, null)
  assert.equal(changed.revision, analyzed.revision + 1)
  assert.equal((await f.request(`${base}/render`, 'POST', { revision: changed.revision })).status, 409)
})

test('template jobs cannot be deleted while their Runtime is shutting down', { timeout: 10_000 }, async (t) => {
  const childProcess = (await import('node:child_process')).default
  const fs = (await import('node:fs')).default
  const { syncBuiltinESMExports } = await import('node:module')
  const originalExecFile = childProcess.execFile
  let release
  const down = new Promise((resolve) => {
    childProcess.execFile = (program, args, _options, callback) => {
      const stdout = args[1] === 'build' ? '{"buildId":"bld_test_cleanup"}' : /ffprobe/i.test(program) ? JSON.stringify({ streams: [{ codec_type: 'video', width: 720, height: 1280 }], format: { duration: '4' } }) : '{}'
      if (args[1] === 'runtime' && args[2] === 'down') { release = () => callback(null, { stdout, stderr: '' }); resolve() }
      else callback(null, { stdout, stderr: '' })
      return {}
    }
  })
  t.mock.method(fs, 'existsSync', () => true)
  syncBuiltinESMExports()
  t.after(() => { childProcess.execFile = originalExecFile; t.mock.restoreAll(); syncBuiltinESMExports() })
  const { renderReplica } = await import('../server/replica-render.js?cleanup-regression')
  const f = await fixture(t, { render: renderReplica, checkVoice: async () => ({ ready: false }) })
  const d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); let draft = await f.wait(d.id)
  draft = await makeExecutable(f, base, draft)
  await f.request(`${base}/confirm`, 'POST', { revision: draft.revision })
  const response = await f.request(`${base}/render`, 'POST', { revision: draft.revision })
  assert.equal(response.status, 202)
  const job = await response.json()
  await down
  try { assert.equal((await f.request(`/jobs/${job.id}`, 'DELETE')).status, 409) }
  finally { release() }
  for (let n = 0; n < 100; n++) {
    const state = await (await f.request(`/jobs/${job.id}`)).json()
    if (state.status === 'complete') break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal((await f.request(`/jobs/${job.id}`, 'DELETE')).status, 200)
})

test('draft capacity is bounded and restart keeps editable drafts but interrupts queued work', async (t) => {
  const f = await fixture(t)
  for (let n = 0; n < 10; n++) await f.create()
  const form = new FormData(); form.append('video', new Blob(['test']), 'test.mp4')
  assert.equal((await f.request('/drafts', 'POST', form)).status, 429)
  const queuedId = '11111111-1111-4111-8111-111111111111'
  await mkdir(path.join(f.directory, queuedId))
  await writeFile(path.join(f.directory, queuedId, 'job.json'), JSON.stringify({ id: queuedId, owner: 'restart', kind: 'draft', status: 'analyzing', revision: 1 }))
  await createReplicaApi({ directory: f.directory, audit: createAuditLog({ directory: path.join(f.directory, '.audit') }) })
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

test('local dialogue separates requests from copy and resolves ambiguous text color', async (t) => {
  const f = await fixture(t), d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); let state = await f.wait(d.id)
  const send = async (message) => {
    const response = await f.request(`${base}/messages`, 'POST', { revision: state.revision, message, mode: 'local' })
    assert.equal(response.status, 200); state = await response.json()
  }
  await send('背景改绿色，字改黄色')
  assert.equal(state.template.background, '#22c55e'); assert.equal(state.template.title, '')
  assert.equal(state.pendingQuestion.field, 'textColor')
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
  await send('全部'); assert.equal(state.pendingQuestion, null); assert.equal(state.template.titleColor, '#eab308')
  assert.equal(state.messages.length, 4)
})

test('text-only dialogue creates an executable plan and complex requests stay planning-only', async (t) => {
  const f = await fixture(t), created = await (await f.request('/drafts', 'POST', {})).json(), base = `/drafts/${created.id}`
  const first = await f.request(`${base}/messages`, 'POST', { revision: created.revision, message: '标题：三秒看懂；卖点：本地生成；行动：马上开始；使用通用文字卡', mode: 'local' })
  assert.equal(first.status, 200)
  let state = await first.json()
  assert.match(state.messages.at(-1).content, /依据描述，未分析原片/)
  assert.equal(state.reference, null)
  assert.equal(state.directorPlan.status, 'executable')
  assert.equal(state.directorPlan.route.kind, 'hypit-template')
  assert.match(state.directorPlan.prompt, /三秒看懂/)
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 200)
  state = await (await f.request(base)).json()
  assert.match(state.confirmedPlanHash, /^[a-f0-9]{64}$/)

  assert.equal((await f.request(`${base}/messages`, 'POST', { revision: state.revision, message: '让真人唱歌跳舞', mode: 'local' })).status, 200)
  state = await (await f.request(base)).json()
  assert.equal(state.directorPlan.status, 'planning_only')
  assert.equal(state.directorPlan.route.kind, 'model-required')
  assert.ok(state.directorPlan.requirements.includes('让真人唱歌跳舞'))
  assert.ok(state.directorPlan.blockers.length)
  assert.equal(state.confirmedRevision, null)
  assert.equal(state.confirmedPlanHash, null)
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
})

test('uploaded video over 30 seconds is rejected immediately with its actual duration', async (t) => {
  const f = await fixture(t, { probeDuration: async () => 45 })
  const form = new FormData(); form.append('video', new Blob(['long-video']), 'long.mp4')
  const response = await f.request('/drafts', 'POST', form)
  assert.equal(response.status, 422)
  const body = await response.json()
  assert.match(body.error, /45\.0 秒/)
  assert.match(body.error, /最长 30 秒/)
})

test('trim endpoint returns an independent clipped copy and never modifies the source', async (t) => {
  const f = await fixture(t, {
    probeDuration: async () => 45,
    trimVideo: async (source, output) => {
      await writeFile(output, 'TRIMMED-MP4')
      const original = await readFile(source, 'utf8')
      assert.equal(original, 'long-video')
      return output
    },
  })
  const form = new FormData()
  form.append('video', new File(['long-video'], 'long.mp4', { type: 'video/mp4' }))
  form.append('seconds', '30')
  const response = await f.request('/trim', 'POST', form)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'video/mp4')
  assert.match(await response.text(), /TRIMMED-MP4/)
})

test('trim endpoint rejects a video that already fits the 30 second limit', async (t) => {
  const f = await fixture(t, { probeDuration: async () => 20, trimVideo: async () => { throw new Error('should not trim') } })
  const form = new FormData()
  form.append('video', new File(['short-video'], 'short.mp4', { type: 'video/mp4' }))
  form.append('seconds', '30')
  const response = await f.request('/trim', 'POST', form)
  assert.equal(response.status, 400)
  assert.match((await response.json()).error, /20\.0 秒/)
})

test('confirmed text-only plan becomes an immutable job without a fake input file', async (t) => {
  let received, hadInput
  const f = await fixture(t, { render: async (job, dir, update) => {
    received = structuredClone(job)
    hadInput = await readFile(path.join(dir, 'input.mp4')).then(() => true, () => false)
    await writeFile(path.join(dir, 'result.mp4'), 'TEXT-ONLY-RESULT')
    await update({ status: 'complete', progress: 100 })
  } })
  const created = await (await f.request('/drafts', 'POST', {})).json(), base = `/drafts/${created.id}`
  let state = await makeExecutable(f, base, created)
  state = await (await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).json()
  const response = await f.request(`${base}/render`, 'POST', { revision: state.revision })
  assert.equal(response.status, 202)
  const queued = await response.json()
  assert.equal(queued.inputUrl, null)
  assert.equal(queued.reference, null)
  assert.deepEqual(queued.directorPlan, state.directorPlan)
  assert.equal(queued.confirmedPlanHash, state.confirmedPlanHash)
  assert.deepEqual(queued.canvas, state.canvas)
  for (let n = 0; n < 100; n++) {
    const job = await (await f.request(`/jobs/${queued.id}`)).json()
    if (job.status === 'complete') break
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.equal(hadInput, false)
  assert.equal(received.reference, null)
  assert.equal((await f.request(`/jobs/${queued.id}/input`)).status, 404)
  assert.equal((await f.request(base, 'DELETE')).status, 200)
  assert.equal(await (await f.request(`/jobs/${queued.id}/result`)).text(), 'TEXT-ONLY-RESULT')
})

test('render rejects a persisted confirmation whose director plan hash does not match', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-hash-test-'))
  const session = 'a'.repeat(64), owner = createHash('sha256').update(session).digest('hex')
  const id = '33333333-3333-4333-8333-333333333333', dir = path.join(directory, id), plan = executablePlan()
  await mkdir(dir)
  await writeFile(path.join(dir, 'job.json'), JSON.stringify({ id, owner, kind: 'draft', schemaVersion: 3, filename: '未命名视频方案', createdAt: new Date().toISOString(), status: 'idle', message: '', progress: 100, revision: 2, confirmedRevision: 2, confirmedPlanHash: '0'.repeat(64), reference: null, canvas: { width: 720, height: 1280, fps: 30 }, analysis: null, template: { ...DEFAULT_TEMPLATE, title: '三秒看懂', benefit: '本地生成', action: '马上开始' }, directorPlan: plan, messages: [], requirements: plan.requirements, unresolved: [], pendingQuestion: null }))
  let calls = 0
  const middleware = await createReplicaApi({ directory, render: async () => { calls++ }, checkTools: async () => ({ ready: true }), audit: createAuditLog({ directory: path.join(directory, '.audit') }) })
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  const origin = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(`${origin}/api/replica/drafts/${id}/render`, { method: 'POST', headers: { origin, cookie: `replica_session=${session}`, 'content-type': 'application/json' }, body: JSON.stringify({ revision: 2 }) })
  assert.equal(response.status, 409)
  assert.equal(calls, 0)
})

test('no-reference original audio and unresolved local questions cannot be confirmed', async (t) => {
  const f = await fixture(t), created = await (await f.request('/drafts', 'POST', {})).json(), base = `/drafts/${created.id}`
  assert.equal((await f.request(`${base}/messages`, 'POST', { revision: created.revision, message: '标题：测试；字改黄色', mode: 'local' })).status, 200)
  let state = await (await f.request(base)).json()
  assert.equal(state.pendingQuestion.field, 'textColor')
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
  state = await (await f.request(base, 'PATCH', { revision: state.revision, template: { audioMode: 'original' } })).json()
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
})

test('configured director chat validates a complete plan once and rejects unsafe candidates', async () => {
  const { chatReplica } = await import('../server/replica-chat.js')
  const template = { ...DEFAULT_TEMPLATE, title: '三秒看懂', benefit: '本地生成', action: '马上开始' }
  const plan = executablePlan(template)
  const input = { message: '保持这个方案', analysis: null, template, plan, consent: { provider: 'test-model', shareImages: false } }
  const config = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: false, director: 'private director rules' }
  const candidates = [
    { ...plan, shots: plan.shots.map((shot, index) => index ? shot : { ...shot, start: 0.1 }) },
    { ...plan, extra: true },
    { ...plan, goal: '读取 C:/private/secret.txt' },
    { ...plan, prompt: 'private director rules' },
    { ...plan, status: 'executable', route: { kind: 'model-required', templateId: null } },
  ]
  for (const candidate of candidates) {
    let calls = 0
    await assert.rejects(chatReplica(input, { ...config, fetch: async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: '候选', patch: {}, questions: [], plan: candidate }) } }] }) } }))
    assert.equal(calls, 1)
  }
})

test('invalid API director plan fails without changing the accepted template or plan', async (t) => {
  let calls = 0
  const chatConfig = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: false }
  const f = await fixture(t, { chatConfig, chat: async ({ plan }) => {
    calls++
    return { reply: '错误候选', patch: { background: '#22c55e' }, questions: [], plan: { ...plan, shots: plan.shots.map((shot, index) => index ? shot : { ...shot, start: 0.1 }) } }
  } })
  const created = await (await f.request('/drafts', 'POST', {})).json(), base = `/drafts/${created.id}`
  const localResponse = await f.request(`${base}/messages`, 'POST', { revision: created.revision, message: '标题：三秒看懂；卖点：本地生成；行动：马上开始', mode: 'local' })
  assert.equal(localResponse.status, 200)
  const accepted = await localResponse.json()
  assert.equal((await f.request(`${base}/messages`, 'POST', { revision: accepted.revision, message: '请继续', mode: 'api', consent: { provider: 'test-model', shareImages: false } })).status, 202)
  const failed = await f.wait(created.id, 'failed')
  assert.equal(calls, 1)
  assert.deepEqual(failed.template, accepted.template)
  assert.deepEqual(failed.directorPlan, accepted.directorPlan)
})

test('configured chat requires exact per-round consent and rejects executable patches without retries', async () => {
  const { chatReplica } = await import('../server/replica-chat.js')
  let calls = 0, sent
  const template = { ...DEFAULT_TEMPLATE, title: '三秒看懂', benefit: '本地生成', action: '马上开始' }, plan = executablePlan(template)
  const config = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: false, director: 'private director rules', fetch: async (_, options) => { calls++; sent = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: '绿色候选，请确认', patch: { background: '#22c55e' }, questions: [], plan }) } }] }) } }
  const input = { message: '改绿', analysis: evidence, template, plan, history: [], images: ['PRIVATE_IMAGE'] }
  await assert.rejects(chatReplica(input, config)); assert.equal(calls, 0)
  await assert.rejects(chatReplica({ ...input, consent: { provider: 'other', shareImages: false } }, config)); assert.equal(calls, 0)
  await assert.rejects(chatReplica({ ...input, consent: { provider: 'test-model', shareImages: false } }, { ...config, apiKey: '' })); assert.equal(calls, 0)
  const authorized = { ...input, consent: { provider: 'test-model', shareImages: false } }
  assert.equal((await chatReplica(authorized, config)).patch.background, '#22c55e')
  assert.equal(JSON.stringify(sent).includes('PRIVATE_IMAGE'), false); assert.equal(sent.max_tokens, 2400)
  for (const patch of [{ command: 'shell' }, { background: 'green' }, { transcription: 'invented' }]) {
    await assert.rejects(chatReplica(authorized, { ...config, fetch: async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'test', patch, questions: [], plan }) } }] }) } }))
  }
  let failures = 0
  await assert.rejects(chatReplica(authorized, { ...config, fetch: async () => { failures++; throw new Error('TEST_SECRET failure') } }), (e) => !e.message.includes('TEST_SECRET'))
  assert.equal(failures, 1)
})

test('paid dialogue has no automatic replay, stays private, and shares images only by opt-in', { timeout: 5000 }, async (t) => {
  let calls = 0, release
  const { promise: chatStarted, resolve: markChatStarted } = Promise.withResolvers()
  const chatConfig = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: true }
  const f = await fixture(t, { chatConfig, chat: () => { calls++; return new Promise((_, reject) => { release = () => reject(new Error('TEST_SECRET')); markChatStarted() }) } })
  const d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); const state = await f.wait(d.id)
  const body = { revision: state.revision, message: '背景改绿', mode: 'api', consent: { provider: 'test-model', shareImages: false } }
  assert.equal((await f.request(`${base}/messages`, 'POST', { ...body, consent: null })).status, 409); assert.equal(calls, 0)
  assert.equal((await f.request(`${base}/messages`, 'POST', body)).status, 202)
  assert.equal((await f.request(`${base}/messages`, 'POST', body)).status, 429)
  await chatStarted
  release(); const failed = await f.wait(d.id, 'failed'); assert.equal(calls, 1)
  assert.equal(failed.template.background, state.template.background); assert.equal(JSON.stringify(failed).includes('TEST_SECRET'), false)
  const health = await (await f.request('/health')).text(); assert.equal(health.includes('TEST_SECRET'), false); assert.equal(health.includes('provider.example'), false)
  const { chatReplica } = await import('../server/replica-chat.js')
  let payload
  const plan = buildDirectorPlan({ requirements: ['继续规划'], canvas: { width: 720, height: 1280, fps: 30 }, template: state.template })
  const config = { ...chatConfig, fetch: async (_, opts) => { payload = JSON.parse(opts.body); return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: '候选', patch: {}, questions: [], plan }) } }] }) } }
  const image = `data:image/png;base64,${Buffer.from('TEST-PNG').toString('base64')}`
  const input = { message: '描述', template: state.template, analysis: evidence, plan, consent: { provider: 'test-model', shareImages: true } }
  await chatReplica({ ...input, images: [image, image, image] }, config)
  assert.equal(payload.messages.at(-1).content.filter((c) => c.type === 'image_url').length, 3)
  await assert.rejects(chatReplica({ ...input, images: [image, image, image, image] }, config))
  let attempts = 0
  await assert.rejects(chatReplica({ ...input, consent: { provider: 'test-model', shareImages: false } }, { ...config, timeout: 10, fetch: (_, opts) => new Promise((_, reject) => { attempts++; opts.signal.addEventListener('abort', () => reject(opts.signal.reason)); setTimeout(() => reject(new Error('too slow')), 50) }) }))
  assert.equal(attempts, 1)
})

test('F5 readiness fails closed and its arguments cannot compress or substitute the voice', async () => {
  const { checkReplicaVoice, f5Arguments, validateProsody } = await import('../server/replica-voice.js')
  assert.equal((await checkReplicaVoice('Z:/missing/voice.json')).ready, false)
  const cfg = { model: 'F5TTS_v1_Base', speed: 1, nfe_step: 32, reference_wav: 'ref.wav', referenceText: '准确转写', checkpoint: 'local.pt', vocab: 'local.txt' }
  const args = f5Arguments(cfg, 'infer_cli.py', '试听文本', 'out')
  assert.equal(args[args.indexOf('--speed') + 1], '1'); assert.equal(args[args.indexOf('--nfe_step') + 1], '32')
  assert.equal(args.includes('--fix_duration'), false); assert.equal(args.includes('--ref_text'), true)
  assert.throws(() => f5Arguments({ ...cfg, speed: 1.2 }, 'cli', 'text', 'out'))
  assert.throws(() => validateProsody('文本', [{ field: 'title', text: '不同文本', pause: 0 }]))
})

test('voice audition approval is private, revision-bound and follows actual 18-second timing', async (t) => {
  const { createHash, randomUUID } = await import('node:crypto')
  const { planTemplate } = await import('../src/replica-template.js')
  const f = await fixture(t, { checkVoice: async () => ({ ready: true, reasons: [], commercialLicense: 'pending_verification' }), voice: async (_, dir) => {
    const id = randomUUID(), audioPath = path.join(dir, `voice-${id}.wav`), bytes = Buffer.from('TEST-WAV')
    await writeFile(audioPath, bytes)
    return { id, audioPath, sha256: createHash('sha256').update(bytes).digest('hex'), duration: 18, cues: [{ field: 'title', start: 0, end: 18 }] }
  } })
  const d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); let state = await f.wait(d.id)
  state = await makeExecutable(f, base, state, '标题：试听文本')
  assert.equal((await f.request(`${base}/voice`, 'POST', { revision: state.revision, narration: '试听文本', prosody: [{ field: 'title', text: '试听文本', pause: 0 }] })).status, 202)
  state = await f.wait(d.id); const preview = state.voicePreview
  assert.equal(preview.audioPath, undefined)
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
  assert.equal((await f.request(`${base}/voice/${preview.id}`, 'GET', undefined, { cookie: '' })).status, 404)
  assert.equal((await f.request(`${base}/voice/${preview.id}/approve`, 'POST', { revision: state.revision, sha256: 'wrong' })).status, 409)
  state = await (await f.request(`${base}/voice/${preview.id}/approve`, 'POST', { revision: state.revision, sha256: preview.sha256 })).json()
  assert.equal(state.voicePreview.approved, true)
  assert.equal(planTemplate(state.template, { width: 360, height: 640, sourceDuration: 4, voiceCues: state.voicePreview.cues }).duration, 18)
  await f.request(`${base}/confirm`, 'POST', { revision: state.revision })
  const job = await (await f.request(`${base}/render`, 'POST', { revision: state.revision })).json(); assert.equal(job.voicePreview.audioPath, undefined)
  await new Promise((r) => setTimeout(r, 30))
  state = await (await f.request(base, 'PATCH', { revision: state.revision, template: { narration: '新文本' } })).json()
  assert.equal(state.voicePreview, null); assert.equal(state.confirmedRevision, null)
  const { readFile } = await import('node:fs/promises'); assert.equal(await readFile(path.join(f.directory, job.id, 'voice.wav'), 'utf8'), 'TEST-WAV')
})

test('voice readiness cannot race concurrent edits or another voice request', async (t) => {
  const ready = [], calls = []
  let checks = 0
  const f = await fixture(t, { checkVoice: () => checks++ === 0 ? Promise.resolve({ ready: true }) : new Promise((resolve) => ready.push(resolve)), voice: async (input) => { calls.push(input); throw new Error('test stopped') } })
  const d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); let state = await f.wait(d.id)
  const body = { revision: state.revision, narration: '测试', prosody: [{ field: 'title', text: '测试', pause: 0 }] }
  const first = f.request(`${base}/voice`, 'POST', body)
  while (!ready.length) await new Promise((r) => setTimeout(r, 5))
  const second = f.request(`${base}/voice`, 'POST', body)
  await new Promise((r) => setTimeout(r, 25))
  for (const resolve of ready) resolve({ ready: true })
  const statuses = (await Promise.all([first, second])).map((r) => r.status)
  assert.equal(statuses.filter((s) => s === 202).length, 1)
  await f.wait(d.id, 'failed'); assert.equal(calls.length, 1)
  ready.length = 0
  state = await (await f.request(base)).json()
  const third = f.request(`${base}/voice`, 'POST', { ...body, revision: state.revision })
  while (!ready.length) await new Promise((r) => setTimeout(r, 5))
  const edited = await f.request(base, 'PATCH', { revision: state.revision, template: { title: '新文案' } })
  ready[0]({ ready: true })
  if (edited.status === 200) assert.equal((await third).status, 409)
  else assert.ok([409, 429].includes(edited.status))
})
