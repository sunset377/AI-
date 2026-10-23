import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startPortfolio } from '../server/portfolio-server.js'
import { createAuditLog } from '../server/replica-audit.js'
import { videoEstimate } from '../src/video-cost.js'
import { runTool } from '../server/replica-render.js'

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'portfolio-invite-'))
  await writeFile(path.join(directory, 'library.json'), JSON.stringify([
    { id: 'sample-a', name: '测试音色 A', visibility: 'demo', transcript: '测试文字 A', file: 'fixture-a.wav', source: 'private-reference-a.wav' },
    { id: 'sample-b', name: '测试音色 B', visibility: 'demo', transcript: '测试文字 B', file: 'fixture-b.wav' },
    { id: 'personal', name: '私有测试条目', visibility: 'private', file: 'personal.wav' },
  ]))
  const server = await startPortfolio({ port: 0, quotaPath: path.join(directory, 'quota.json'), replicaOptions: {
    directory: path.join(directory, 'jobs'), whiteboardRoot: directory,
    audit: createAuditLog({ directory: path.join(directory, 'audit') }),
  } })
  if (!server.listening) await once(server, 'listening')
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  return server
}

test('fresh visitors open every view and only the provided public audio catalog without credentials', async t => {
  const server = await fixture(t)
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
  assert.deepEqual(items.map(item => item.id), ['sample-a', 'sample-b'])
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
  const server = await fixture(t)
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
