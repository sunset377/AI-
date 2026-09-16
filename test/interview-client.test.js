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
  assert.match(buildResumeFallbackAnswer('说说你的不足'), /大型多人协作经验仍需积累/)
  assert.match(buildResumeFallbackAnswer('你有几年大厂经验'), /暂未收录/)
  assert.doesNotMatch(buildResumeFallbackAnswer('请做一下自我介绍'), /简历知识库演示/)
  assert.match(buildResumeFallbackAnswer('他是本科生吗'), /四川大学视觉传达设计本科，2026年毕业/)
  assert.match(buildResumeFallbackAnswer('你现在都会哪些AI工具'), /Codex、Claude Code/)
  assert.match(buildResumeFallbackAnswer('为什么从视觉设计转向 AI 应用'), /不是完全割裂的转行/)
  assert.match(buildResumeFallbackAnswer('Agent 和普通聊天机器人有什么区别'), /受约束的工作流/)
  assert.match(buildResumeFallbackAnswer('怎么降低 Agent 幻觉'), /结构化输入/)
  assert.match(buildResumeFallbackAnswer('如何评测一个 Agent'), /任务成功率/)
  assert.match(buildResumeFallbackAnswer('没有正式实习怎么证明自己'), /2026届/)
  assert.doesNotMatch(buildResumeFallbackAnswer('说说你平时怎样推进事情'), /没有足够信息/)
})

test('static fallback keeps short follow-up questions connected to recent context', () => {
  const answer = buildResumeFallbackAnswer([
    { role: 'user', content: '你现在都会哪些AI工具' },
    { role: 'assistant', content: '上一轮回答' },
    { role: 'user', content: '具体怎么用的？' },
  ])

  assert.match(answer, /Codex、Claude Code/)
})

test('static fallback prioritizes a new explicit question over older conversation topics', () => {
  const answer = buildResumeFallbackAnswer([
    { role: 'user', content: '你的优势与不足是什么' },
    { role: 'assistant', content: '上一轮回答' },
    { role: 'user', content: '你毕业于哪个学校' },
  ])

  assert.match(answer, /四川大学视觉传达设计本科，2026年毕业/)
  assert.doesNotMatch(answer, /大型多人协作经验仍需积累/)
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
    assert.match(html, /你常用哪些 AI 工具/)
    assert.match(html, /为什么从视觉设计转向 AI 应用/)
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
