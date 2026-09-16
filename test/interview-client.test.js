import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { parseSseLine, streamInterview } from '../src/interview/client.js'
import { buildResumeFallbackAnswer } from '../src/interview/fallback.js'

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

test('streamInterview surfaces the server error message', async () => {
  await assert.rejects(
    streamInterview({
      messages: [{ role: 'user', content: '你好' }],
      sessionId: 'session-12345678',
      onToken() {},
      fetchImpl: async () => Response.json({ error: '今天的体验次数已用完，请稍后再试。' }, { status: 429 }),
    }),
    /今天的体验次数已用完/,
  )
})

test('resume fallback optimizes common interview questions without inventing facts', () => {
  assert.match(buildResumeFallbackAnswer('为什么适合 AI Agent 岗位'), /服装一键复刻爆款视频工作台/)
  assert.match(buildResumeFallbackAnswer('说说你的不足'), /简历资料没有记录/)
  assert.match(buildResumeFallbackAnswer('你有几年大厂经验'), /暂未收录/)
  assert.doesNotMatch(buildResumeFallbackAnswer('请做一下自我介绍'), /简历知识库演示/)
})

test('streamInterview uses resume knowledge when a static host has no API route', async () => {
  const tokens = []
  const result = await streamInterview({
    messages: [{ role: 'user', content: '为什么适合 AI Agent 岗位' }],
    sessionId: 'session-12345678',
    onToken: (token) => tokens.push(token),
    fetchImpl: async () => new Response('static host has no API route', {
      status: 405,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    }),
  })

  assert.equal(result.mode, 'resume-fallback')
  assert.doesNotMatch(tokens.join(''), /简历知识库演示/)
  assert.match(tokens.join(''), /岗位价值/)
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
    assert.match(html, /AI Agent \/ AI应用开发工程师/)
    assert.match(html, /请做一下自我介绍/)
    assert.match(html, /为什么适合 AI Agent 岗位/)
    assert.match(html, /你如何设计可靠的 Agent 工作流/)
    assert.match(html, /Shift \+ Enter 换行/)
    assert.match(html, /查看作品集/)
    assert.match(html, /联系本人/)
    assert.match(html, /href="tel:19182874015"/)
    assert.match(html, /href="mailto:980175020@qq.com"/)
  } finally {
    await vite.close()
  }
})
