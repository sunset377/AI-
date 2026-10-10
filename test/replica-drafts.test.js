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

test('local dialogue separates requests from copy and resolves ambiguous text color', async (t) => {
  const f = await fixture(t), d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); let state = await f.wait(d.id)
  const send = async (message) => {
    const response = await f.request(`${base}/messages`, 'POST', { revision: state.revision, message, mode: 'local' })
    assert.equal(response.status, 202); state = await f.wait(d.id)
  }
  await send('背景改绿色，字改黄色')
  assert.equal(state.template.background, '#22c55e'); assert.equal(state.template.title, '')
  assert.equal(state.pendingQuestion.field, 'textColor')
  assert.equal((await f.request(`${base}/confirm`, 'POST', { revision: state.revision })).status, 409)
  await send('全部'); assert.equal(state.pendingQuestion, null); assert.equal(state.template.titleColor, '#eab308')
  assert.equal(state.messages.length, 4)
})

test('configured chat requires exact per-round consent and rejects executable patches without retries', async () => {
  const { chatReplica } = await import('../server/replica-chat.js')
  const { DEFAULT_TEMPLATE } = await import('../src/replica-template.js')
  let calls = 0, sent
  const config = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: false, director: 'private director rules', fetch: async (_, options) => { calls++; sent = JSON.parse(options.body); return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: '绿色候选，请确认', patch: { background: '#22c55e' }, questions: [] }) } }] }) } }
  const input = { message: '改绿', analysis: evidence, template: DEFAULT_TEMPLATE, history: [], images: ['PRIVATE_IMAGE'] }
  await assert.rejects(chatReplica(input, config)); assert.equal(calls, 0)
  await assert.rejects(chatReplica({ ...input, consent: { provider: 'other', shareImages: false } }, config)); assert.equal(calls, 0)
  await assert.rejects(chatReplica({ ...input, consent: { provider: 'test-model', shareImages: false } }, { ...config, apiKey: '' })); assert.equal(calls, 0)
  const authorized = { ...input, consent: { provider: 'test-model', shareImages: false } }
  assert.equal((await chatReplica(authorized, config)).patch.background, '#22c55e')
  assert.equal(JSON.stringify(sent).includes('PRIVATE_IMAGE'), false); assert.equal(sent.max_tokens, 1200)
  for (const patch of [{ command: 'shell' }, { background: 'green' }, { transcription: 'invented' }]) {
    await assert.rejects(chatReplica(authorized, { ...config, fetch: async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'test', patch, questions: [] }) } }] }) } }))
  }
  let failures = 0
  await assert.rejects(chatReplica(authorized, { ...config, fetch: async () => { failures++; throw new Error('TEST_SECRET failure') } }), (e) => !e.message.includes('TEST_SECRET'))
  assert.equal(failures, 1)
})

test('paid dialogue has no automatic replay, stays private, and shares images only by opt-in', async (t) => {
  let calls = 0, release
  const chatConfig = { baseUrl: 'https://provider.example/v1', model: 'test-model', apiKey: 'TEST_SECRET', vision: true }
  const f = await fixture(t, { chatConfig, chat: () => { calls++; return new Promise((_, reject) => { release = () => reject(new Error('TEST_SECRET')) }) } })
  const d = await f.create(), base = `/drafts/${d.id}`
  await f.request(`${base}/analyze`, 'POST', { revision: 1 }); const state = await f.wait(d.id)
  const body = { revision: state.revision, message: '背景改绿', mode: 'api', consent: { provider: 'test-model', shareImages: false } }
  assert.equal((await f.request(`${base}/messages`, 'POST', { ...body, consent: null })).status, 409); assert.equal(calls, 0)
  assert.equal((await f.request(`${base}/messages`, 'POST', body)).status, 202)
  assert.equal((await f.request(`${base}/messages`, 'POST', body)).status, 429)
  release(); const failed = await f.wait(d.id, 'failed'); assert.equal(calls, 1)
  assert.equal(failed.template.background, state.template.background); assert.equal(JSON.stringify(failed).includes('TEST_SECRET'), false)
  const health = await (await f.request('/health')).text(); assert.equal(health.includes('TEST_SECRET'), false); assert.equal(health.includes('provider.example'), false)
  const { chatReplica } = await import('../server/replica-chat.js')
  let payload
  const config = { ...chatConfig, fetch: async (_, opts) => { payload = JSON.parse(opts.body); return Response.json({ choices: [{ message: { content: '{"reply":"候选","patch":{},"questions":[]}' } }] }) } }
  const image = `data:image/png;base64,${Buffer.from('TEST-PNG').toString('base64')}`
  const input = { message: '描述', template: state.template, analysis: evidence, consent: { provider: 'test-model', shareImages: true } }
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
