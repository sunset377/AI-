import assert from 'node:assert/strict'
import test from 'node:test'
import { streamInterview } from '../src/interview/client.js'

const messages = [{ role: 'user', content: '你平时怎么选模型和工具' }]
const sessionId = 'reliability-test-session'
const nativeTimeout = globalThis.setTimeout
const answer = 'data: {"choices":[{"delta":{"content":"真实回答"}}]}\n\ndata: [DONE]\n\n'
const sse = (body = answer) => new Response(body, { headers: { 'content-type': 'text/event-stream' } })

function fastDeadlines(t) {
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => (
    nativeTimeout(callback, delay >= 1000 ? 15 : delay, ...args)
  ))
}

async function observe(promise) {
  return Promise.race([
    promise.then((result) => ({ result }), (error) => ({ error })),
    new Promise((resolve) => nativeTimeout(() => resolve({ pending: true }), 150)),
  ])
}

test('streamInterview retries a transient connection failure and returns only live tokens', async () => {
  const tokens = []
  let attempts = 0
  const result = await streamInterview({
    messages, sessionId, onToken: (token) => tokens.push(token),
    fetchImpl: async () => {
      if (++attempts === 1) throw new TypeError('Failed to fetch')
      return sse()
    },
  })
  assert.equal(result.mode, 'deepseek')
  assert.equal(attempts, 2)
  assert.deepEqual(tokens, ['真实回答'])
})

test('streamInterview stops a hanging connection after bounded live attempts', async (t) => {
  fastDeadlines(t)
  const controller = new AbortController()
  const tokens = []
  let attempts = 0
  const run = streamInterview({
    messages, sessionId, signal: controller.signal, onToken: (token) => tokens.push(token),
    fetchImpl: (_url, { signal }) => {
      attempts++
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    },
  })
  const observed = await observe(run)
  if (observed.pending) {
    controller.abort()
    await run.catch(() => {})
  }
  assert.equal(observed.pending, undefined, 'a connection must not wait indefinitely')
  assert.match(observed.error.message, /连接|重试/)
  assert.equal(attempts, 2)
  assert.deepEqual(tokens, [])
})

test('streamInterview finishes at DONE even when the server keeps the stream open', async () => {
  const tokens = []
  let streamController
  let cancelled = false
  const run = streamInterview({
    messages, sessionId, onToken: (token) => tokens.push(token),
    fetchImpl: async () => sse(new ReadableStream({
      start(controller) {
        streamController = controller
        controller.enqueue(new TextEncoder().encode(answer))
      },
      cancel() { cancelled = true },
    })),
  })
  const observed = await observe(run)
  if (observed.pending) {
    streamController.close()
    await run
  }
  assert.equal(observed.pending, undefined, 'DONE must unlock the composer without waiting for EOF')
  assert.equal(observed.result.mode, 'deepseek')
  assert.equal(cancelled, true)
  assert.deepEqual(tokens, ['真实回答'])
})

test('streamInterview ends a stalled partial answer without inventing a replacement or retrying it', async (t) => {
  fastDeadlines(t)
  const tokens = []
  let attempts = 0
  let streamController
  let cancelled = false
  const run = streamInterview({
    messages, sessionId, onToken: (token) => tokens.push(token),
    fetchImpl: async () => {
      attempts++
      return sse(new ReadableStream({
        start(controller) {
          streamController = controller
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"尚未完成"}}]}\n\n'))
        },
        cancel() { cancelled = true },
      }))
    },
  })
  const observed = await observe(run)
  if (observed.pending) {
    streamController.close()
    await run.catch(() => {})
  }
  assert.equal(observed.pending, undefined, 'a stalled stream must not wait indefinitely')
  assert.match(observed.error.message, /连接|重试/)
  assert.equal(attempts, 1)
  assert.equal(cancelled, true)
  assert.deepEqual(tokens, ['尚未完成'])
})

test('streamInterview reports rate limits without retrying or using local answers', async () => {
  let attempts = 0
  await assert.rejects(streamInterview({
    messages, sessionId, onToken() { assert.fail('only real AI tokens are allowed') },
    fetchImpl: async () => {
      attempts++
      return Response.json({ error: 'private provider details' }, { status: 429 })
    },
  }), /稍后|频繁/)
  assert.equal(attempts, 1)
})

test('streamInterview does not start a request after the visitor cancels', async () => {
  const controller = new AbortController()
  controller.abort()
  let attempts = 0
  await assert.rejects(streamInterview({
    messages, sessionId, signal: controller.signal, onToken() {},
    fetchImpl: async () => { attempts++; return sse() },
  }), { name: 'AbortError' })
  assert.equal(attempts, 0)
})
