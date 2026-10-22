import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { startPortfolio } from '../server/portfolio-server.js'
import { videoEstimate } from '../src/video-cost.js'
import { runTool } from '../server/replica-render.js'

test('fresh visitors open every view and the audio library without credentials', async t => {
  const server = await startPortfolio({ port: 0 })
  if (!server.listening) await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  for (const view of ['gateway', 'portfolio', 'interview', 'studio', 'replica']) {
    const response = await fetch(`${base}/?view=${view}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /id="root"/)
    assert.equal(response.headers.get('set-cookie'), null)
  }
  const library = await fetch(`${base}/api/replica/whiteboard/voices`)
  assert.equal(library.status, 200)
  const { items } = await library.json()
  assert.ok(items.length >= 2)
  assert.ok(items.every(item => item.id !== 'personal' && !item.source && !item.file))
  for (const route of ['/.env.local', '/.backups/private.json', '/api/replica/whiteboard/audio/personal']) {
    assert.equal((await fetch(base + route)).status, 404)
  }
  assert.equal((await fetch(base + '/demo-login', { method: 'POST' })).status, 404)
})

test('production preview streams interview requests through the private gateway', async t => {
  const realFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://ci-interview-gateway.pages.dev/api/interview')
    assert.equal(options.headers.origin, 'https://sunset377.github.io')
    assert.equal(options.headers['content-type'], 'application/json')
    assert.deepEqual(JSON.parse(await new Response(options.body).text()), {
      sessionId: 'session-12345678',
      messages: [{ role: 'user', content: '测试问题' }],
    })
    return new Response('data: {"response":"连接正常"}\n\ndata: [DONE]\n\n', {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' },
    })
  })
  const server = await startPortfolio({ port: 0 })
  if (!server.listening) await once(server, 'listening')
  t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await realFetch(`http://127.0.0.1:${server.address().port}/api/interview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: 'session-12345678', messages: [{ role: 'user', content: '测试问题' }] }),
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  assert.match(await response.text(), /连接正常/)
})

test('Windows subprocesses expand literal USERPROFILE temporary paths', { skip: process.platform !== 'win32' }, async () => {
  const { stdout } = await runTool(process.execPath, ['-e', 'process.stdout.write(process.env.TEMP)'], { env: { TEMP: '%USERPROFILE%/AppData/Local/Temp' } })
  assert.equal(stdout, process.env.USERPROFILE + '/AppData/Local/Temp')
})
test('video quote rejects silent duration truncation and gives dated estimate', () => {
  assert.deepEqual(videoEstimate(8), { seconds: 8, cny: '4.00', date: '2026-09-01' })
  for (const n of [0, 3, 4.5, 16, 30]) assert.throws(() => videoEstimate(n))
})
