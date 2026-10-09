import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import worker from '../src/worker.js'
import { validateStoryboard } from '../src/storyboard.js'

const storyboard = {
  shots: Array.from({ length: 4 }, (_, index) => ({
    number: String(index + 1).padStart(2, '0'), timeRange: `${index * 5}—${index * 5 + 5}秒`,
    duration: 5, scene: '雨夜公寓', task: '建立悬念', timing: '0–2秒环境；2–5秒人物',
    camera: '50mm中景缓推', action: '人物看向门', audio: '雨声', assets: 'C01角色；S01公寓',
  })),
  assets: [{ id: 'C01', type: '角色', name: '主角身份锚' }],
  totalDuration: 20,
}
const env = {
  DEEPSEEK_API_KEY: 'test-provider-secret',
  INTERVIEW_ORIGIN: 'https://sunset377.github.io',
  INTERVIEW_RATE_LIMITER: { async limit() { return { success: true } } },
}
const request = (script = '雨夜，主角发现门口一封匿名信。') => new Request('https://worker.test/api/storyboard', {
  method: 'POST', headers: { origin: env.INTERVIEW_ORIGIN, 'content-type': 'application/json' },
  body: JSON.stringify({ script }),
})

test('storyboard validation rejects malformed, truncated or unrenderable model output', () => {
  assert.equal(validateStoryboard(storyboard), true)
  for (const invalid of [null, {}, { ...storyboard, shots: [] }, { ...storyboard, assets: ['C01'] },
    { ...storyboard, totalDuration: 500 }, { ...storyboard, shots: [{ ...storyboard.shots[0], camera: {} }, ...storyboard.shots.slice(1)] },
    { ...storyboard, shots: storyboard.shots.map((shot) => ({ ...shot, duration: 100 })) }]) {
    assert.equal(validateStoryboard(invalid), false)
  }
})

test('storyboard API calls DeepSeek privately and returns only validated JSON for the page', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions')
    const input = JSON.parse(options.body)
    assert.equal(input.stream, false)
    assert.equal(input.response_format.type, 'json_object')
    assert.equal(input.thinking.type, 'disabled')
    assert.equal(input.max_tokens, 3000)
    assert.match(input.messages[0].content, /只规划文字/)
    assert.equal(input.messages[1].content, '雨夜，主角发现门口一封匿名信。')
    return Response.json({ choices: [{ message: { content: JSON.stringify(storyboard) } }] })
  })
  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), env.INTERVIEW_ORIGIN)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.deepEqual(await response.json(), storyboard)
})

test('invalid scripts and limits are rejected before a paid provider request', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { assert.fail('provider must not be called') })
  assert.equal((await worker.fetch(request(''), env)).status, 400)
  assert.equal((await worker.fetch(request('a'.repeat(2501)), env)).status, 400)
  const denied = { ...env, INTERVIEW_RATE_LIMITER: { async limit() { return { success: false } } } }
  assert.equal((await worker.fetch(request(), denied)).status, 429)
  assert.equal((await worker.fetch(new Request('https://worker.test/api/storyboard', {
    method: 'OPTIONS', headers: { origin: env.INTERVIEW_ORIGIN },
  }), env)).status, 204)
})

test('bad provider JSON cannot crash the frontend or pretend generation succeeded', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: '{"shots":[]}' } }] }))
  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 503)
  assert.doesNotMatch(await response.text(), /test-provider-secret/)
})

test('portfolio exposes both demos immediately after the hero and hides provider branding in interview', async () => {
  const vite = await createServer({ appType: 'custom', cacheDir: 'node_modules/.vite-storyboard-tests', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const portfolio = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))
    const ids = ['home', 'director', 'script-demo', 'about', 'works'].map((id) => portfolio.indexOf(`id="${id}"`))
    assert.ok(ids.every((position, index) => position >= 0 && (index === 0 || position > ids[index - 1])))
    assert.match(portfolio, /运行流水线演示/)
    assert.match(portfolio, /输入剧本生成分镜/)
    assert.match(portfolio, /href="#director"/)
    assert.match(portfolio, /href="#script-input"/)
    assert.equal((portfolio.match(/id="script-input"/g) ?? []).length, 1)
    assert.equal((portfolio.match(/id="script-demo"/g) ?? []).length, 1)
    assert.doesNotMatch(portfolio, /调用DeepSeek|API Key/)
    const interview = renderToStaticMarkup(React.createElement(App, { initialView: 'interview' }))
    assert.match(interview, /AI助手时刻在线/)
    assert.doesNotMatch(interview, /DeepSeek|断线资料库兜底|interviewAnswerSource/)
  } finally {
    await vite.close()
  }
})
