import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSsrServer as createServer } from './helpers/vite.js'
import { parseSseLine, streamInterview } from '../src/interview/client.js'

test('parseSseLine reads Workers AI and OpenAI-compatible token shapes', () => {
  assert.deepEqual(parseSseLine('data: {"response":"你好"}'), { response: '你好' })
  assert.deepEqual(
    parseSseLine('data: {"choices":[{"delta":{"content":"世界"}}]}'),
    { response: '世界' },
  )
  assert.equal(parseSseLine('data: [DONE]'), null)
  assert.equal(parseSseLine('event: message'), null)
})

test('streamInterview emits every complete token from a chunked response', async () => {
  const encoder = new TextEncoder()
  const chunks = [
    'data: {"response":"你',
    '好"}\n\ndata: {"response":"，我是辞。"}\n\ndata: [DONE]\n\n',
  ]
  const response = new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  const tokens = []

  await streamInterview({
    messages: [{ role: 'user', content: '介绍一下你自己' }],
    sessionId: 'session-12345678',
    onToken: (token) => tokens.push(token),
    fetchImpl: async () => response,
  })

  assert.deepEqual(tokens, ['你好', '，我是辞。'])
})

test('streamInterview reports a server error without generating a local answer', async () => {
  const tokens = []
  await assert.rejects(streamInterview({
      messages: [{ role: 'user', content: '你好' }],
      sessionId: 'session-12345678',
      onToken: (token, options) => tokens.push({ token, options }),
      fetchImpl: async () => Response.json({ error: '今天的体验次数已用完，请稍后再试。' }, { status: 429 }),
    }), /稍后|频繁/)
  assert.deepEqual(tokens, [])
})

test('streamInterview rejects a missing API route instead of using resume knowledge', async () => {
  const tokens = []
  await assert.rejects(streamInterview({
    messages: [{ role: 'user', content: '为什么适合 AI Agent 岗位' }],
    sessionId: 'session-12345678',
    onToken: (token) => tokens.push(token),
    fetchImpl: async () => new Response('static host has no API route', {
      status: 405,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }),
  }), /连接|重试/)
  assert.deepEqual(tokens, [])
})

test('interview view explains the AI identity and offers starter questions', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'interview' }))

    assert.match(html, /AI 面试助手/)
    assert.doesNotMatch(html, /基于求职简历知识库/)
    assert.doesNotMatch(html, /简历知识库演示模式/)
    assert.match(html, /AI 分身/)
    assert.match(html, /定位<\/dt><dd>AI 信息流 \/ Agent 开发 \/ AIGC 赋能/)
    assert.match(html, /aria-label="推荐问题"/)
    assert.match(html, /讲一个你从0到1做的项目/)
    assert.match(html, /AI生成内容最常见的翻车问题是什么/)
    assert.match(html, /你平时怎么选模型和工具/)
    assert.match(html, /Shift \+ Enter 换行/)
    assert.match(html, /查看作品集/)
    assert.match(html, /联系本人/)
    assert.match(html, /<b>电话<\/b> 19182874015/)
    assert.match(html, /<b>微信<\/b> Sun677set/)
    assert.doesNotMatch(html, /href="tel:19182874015"/)
    assert.doesNotMatch(html, /href="mailto:980175020@qq.com"/)
  } finally {
    await vite.close()
  }
})
