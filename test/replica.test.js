import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createServer } from 'node:http'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer as createViteServer } from 'vite'
import { readView } from '../src/navigation.js'
import { planReplica, validateReplicaOptions, mapOutputToSource } from '../src/replica.js'
import { createAss, createHypitSources } from '../server/replica-render.js'
import { createReplicaApi } from '../server/replica-api.js'

const options = { opening: 'fast', highlightStart: 0, style: 'blue', title: '新开场', captions: '第一句\n第二句', keepAudio: true }

test('highlight moves exactly one source interval without losing or duplicating the rest', () => {
  for (const start of [0, 0.5, 2, 3.9]) {
    const plan = planReplica(4, { ...options, opening: 'highlight', highlightStart: start })
    assert.ok(Math.abs(plan.outputDuration - 4) < 1e-6)
    const sorted = [...plan.segments].sort((a, b) => a.start - b.start)
    assert.equal(sorted[0].start, 0)
    assert.equal(sorted.at(-1).end, 4)
    for (let i = 1; i < sorted.length; i++) assert.equal(sorted[i].start, sorted[i - 1].end)
    assert.equal(mapOutputToSource(0, plan), plan.segments[0].start)
  }
  const fast = planReplica(4, options)
  assert.equal(fast.segments[0].rate, 1.35)
  assert.equal(fast.segments[1].rate, 1)
  assert.equal(fast.captions[0].end, fast.captions[1].start)
  assert.equal(fast.captions.at(-1).end, fast.outputDuration)
})

test('trust boundary rejects invalid timing, huge captions and unsupported options', () => {
  assert.equal(validateReplicaOptions(options).keepAudio, true)
  for (const patch of [{ opening: 'unknown' }, { style: 'unknown' }, { highlightStart: Infinity }, { title: 'x'.repeat(41) }, { captions: 'x'.repeat(1001) }, { captions: 'x'.repeat(61) }]) assert.throws(() => validateReplicaOptions({ ...options, ...patch }))
  for (const duration of [NaN, Infinity, 0, 20]) assert.throws(() => planReplica(duration, options))
  assert.throws(() => planReplica(4, { ...options, opening: 'highlight', highlightStart: 4 }))
  assert.throws(() => planReplica(1, { ...options, captions: 'a\nb\nc' }))
})

test('subtitle text cannot inject ASS commands, and Hypit only demands local media operations', () => {
  const plan = planReplica(4, { ...options, captions: '{\\pos(0,0)}不要覆盖\n安全字幕' })
  const ass = createAss(720, 1280, plan, options)
  assert.doesNotMatch(ass, /\{\\pos/)
  assert.match(ass, /安全字幕/)
  const source = createHypitSources(plan.segments, true)
  assert.match(source.author, /audio="default"/)
  assert.match(source.author, /Retime rate="1.35"/)
  assert.doesNotMatch(source.author, /http|seedance|minimax|hypihub|speech|transcribe/i)
  assert.equal((source.run.match(/<target/g) || []).length, plan.segments.length)
})

test('replica route and SSR keep the blue workbench available without a backend or API key', async () => {
  assert.equal(readView({ search: '?view=replica' }), 'replica')
  const vite = await createViteServer({ appType: 'custom', cacheDir: '.codex-run/replica-tests/legacy-cache', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'replica' }))
    assert.match(html, /看懂结构，做出你的版本/)
    assert.match(html, /选择模板参考视频/)
    assert.match(html, /type="file"/)
    assert.match(html, /修改需求/)
    assert.match(html, /仅本地预览/)
    assert.match(html, /disabled=""[^>]*>制作模板成片/)
    assert.doesNotMatch(html, /type="password"|API KEY|模型已生成/)
    const portfolio = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))
    assert.match(portfolio, /href="\?view=replica"[^>]*>打开视频复刻工作台/)
  } finally { await vite.close() }
})

test('local API enforces origin, owner, upload bounds, media ranges and terminal deletion', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-api-test-'))
  let renders = 0
  const middleware = await createReplicaApi({ directory, checkTools: async () => ({ ready: true, version: 'test' }), render: async (job, taskDir, update) => {
    renders++
    await writeFile(path.join(taskDir, 'result.mp4'), 'TEST-MEDIA-ONLY')
    await update({ status: 'complete', progress: 100 })
  } })
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end() }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  const health = await fetch(`${origin}/api/replica/health`)
  const cookie = health.headers.get('set-cookie').split(';')[0]
  assert.match(health.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.equal((await fetch(`${origin}/api/replica/jobs`, { method: 'POST', headers: { origin: 'https://attacker.test' } })).status, 403)
  const makeForm = (name = 'sample.mp4', settings = options) => { const form = new FormData(); form.append('video', new Blob(['synthetic-test-input']), name); form.append('options', JSON.stringify(settings)); return form }
  const submit = (body) => fetch(`${origin}/api/replica/jobs`, { method: 'POST', headers: { origin, cookie }, body })
  assert.equal((await submit(makeForm('../not-video.exe'))).status, 400)
  assert.equal((await submit(makeForm('sample.mp4', { ...options, opening: 'invalid' }))).status, 400)
  const created = await submit(makeForm())
  assert.equal(created.status, 202)
  const job = await created.json()
  assert.equal(job.owner, undefined)
  await new Promise((resolve) => setTimeout(resolve, 80))
  const state = await fetch(`${origin}/api/replica/jobs/${job.id}`, { headers: { cookie } })
  assert.equal((await state.json()).status, 'complete')
  assert.equal((await fetch(`${origin}/api/replica/jobs/${job.id}`)).status, 404)
  const media = `${origin}/api/replica/jobs/${job.id}/result`
  assert.equal((await fetch(media)).status, 404)
  const ranged = await fetch(media, { headers: { cookie, range: 'bytes=0-3' } })
  assert.equal(ranged.status, 206)
  assert.equal(await ranged.text(), 'TEST')
  assert.equal((await fetch(media, { headers: { cookie, range: 'bytes=999-1000' } })).status, 416)
  const suffix = await fetch(media, { headers: { cookie, range: 'bytes=-4' } })
  assert.equal(await suffix.text(), 'ONLY')
  assert.equal((await fetch(`${origin}/api/replica/jobs/${job.id}`, { method: 'DELETE', headers: { origin, cookie } })).status, 200)
  assert.equal((await fetch(media, { headers: { cookie } })).status, 404)
  assert.equal(renders, 1)
})
