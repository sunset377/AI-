import test from 'node:test'
import assert from 'node:assert/strict'
import { createVideoTask, downloadVideo, queryVideoTask, ratioForCanvas, readVideoConfig, videoHealth } from '../server/replica-video.js'

const config = { baseUrl: 'https://api.minimax.cn', model: 'MiniMax-H3', apiKey: 'test-key' }

test('video health requires a valid https base and a key', () => {
  assert.equal(videoHealth(config).ready, true)
  assert.equal(videoHealth({ baseUrl: 'https://api.minimax.cn', model: 'MiniMax-H3', apiKey: '' }).ready, false)
  assert.equal(videoHealth({ baseUrl: 'http://api.minimax.cn', model: 'MiniMax-H3', apiKey: 'k' }).ready, false)
  assert.equal(videoHealth({ baseUrl: 'https://api.minimax.cn?x=1', model: 'MiniMax-H3', apiKey: 'k' }).ready, false)
})

test('ratio maps the workbench canvas to a MiniMax token', () => {
  assert.equal(ratioForCanvas(720, 1280), '9:16')
  assert.equal(ratioForCanvas(1280, 720), '16:9')
  assert.equal(ratioForCanvas(1024, 1024), '1:1')
})

test('createVideoTask submits and returns the task id', async () => {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url, headers: options.headers, body: JSON.parse(options.body) })
    return { ok: true, json: async () => ({ task_id: '424010985738629', request_id: 'r1' }) }
  }
  const result = await createVideoTask({ prompt: '口红特写镜头', duration: 5, ratio: '9:16' }, { ...config, fetch })
  assert.equal(result.taskId, '424010985738629')
  assert.equal(calls[0].url, 'https://api.minimax.cn/v2/video_generation')
  assert.equal(calls[0].headers.authorization, 'Bearer test-key')
  assert.equal(calls[0].body.model, 'MiniMax-H3')
  assert.equal(calls[0].body.duration, 5)
  assert.equal(calls[0].body.ratio, '9:16')
  assert.equal(calls[0].body.content[0].type, 'text')
})

test('createVideoTask rejects invalid durations and missing prompt', async () => {
  await assert.rejects(createVideoTask({ prompt: '', duration: 5, ratio: '9:16' }, config), /缺少视频描述/)
  await assert.rejects(createVideoTask({ prompt: 'x', duration: 3, ratio: '9:16' }, config), /4～15/)
  await assert.rejects(createVideoTask({ prompt: 'x', duration: 16, ratio: '9:16' }, config), /4～15/)
  await assert.rejects(createVideoTask({ prompt: 'x', duration: 5.5, ratio: '9:16' }, config), /4～15/)
})

test('createVideoTask surfaces provider errors', async () => {
  const fetch = async () => ({ ok: false, status: 402, json: async () => ({ error: { message: 'insufficient balance (1008)' } }) })
  await assert.rejects(createVideoTask({ prompt: 'x', duration: 5, ratio: '9:16' }, { ...config, fetch }), /insufficient balance/)
})

test('queryVideoTask parses status and content url', async () => {
  const fetch = async (url) => {
    assert.match(url, /\/v2\/query\/video_generation\/424010985738629$/)
    return { ok: true, json: async () => ({ task: { status: 'succeeded', content: { url: 'https://cdn.example.com/out.mp4' }, duration: 5, resolution: '768P' } }) }
  }
  const state = await queryVideoTask('424010985738629', { ...config, fetch })
  assert.equal(state.status, 'succeeded')
  assert.equal(state.url, 'https://cdn.example.com/out.mp4')
})

test('downloadVideo writes the body to the destination', async (t) => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const dir = await mkdtemp(path.join(tmpdir(), 'replica-video-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const body = Buffer.from('FAKE-MP4')
  const fetch = async () => ({ ok: true, body: (async function* () { yield body })() })
  const dest = path.join(dir, 'result.mp4')
  const bytes = await downloadVideo('https://cdn.example.com/out.mp4', dest, { ...config, fetch })
  assert.equal(bytes, body.length)
  assert.deepEqual(await readFile(dest), body)
})
