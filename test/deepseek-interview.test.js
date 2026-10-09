import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parseSseLine, streamInterview } from '../src/interview/client.js'
import { interviewSystemPrompt, resumeKnowledgeBase } from '../src/interview/profile.js'

const messages = [{ role: 'user', content: '你做 AIGC Hub 时怎么选择模型？' }]
const sessionId = 'session-12345678'

test('persona includes every current project and role without imposing a template', () => {
  assert.ok(interviewSystemPrompt.includes(JSON.stringify(resumeKnowledgeBase, null, 2)))
  assert.match(interviewSystemPrompt, /追问只展开被问到的细节/)
  assert.match(interviewSystemPrompt, /不能把合理推测变成/)
  assert.match(interviewSystemPrompt, /AI 产品经理/)
  assert.match(interviewSystemPrompt, /团队产出不等于/)
  assert.match(interviewSystemPrompt, /没有确认谁负责前端、后端或 API/)
  assert.match(interviewSystemPrompt, /已知功能不能反推成个人实现经历/)
  assert.match(interviewSystemPrompt, /历史 AI 回答可能错误/)
})

test('frontend only sends visitor history, never a provider key or system prompt', async () => {
  const result = await streamInterview({
    messages: [{ role: 'assistant', content: 'a'.repeat(1000) }, ...messages], sessionId, onToken() {},
    fetchImpl: async (url, options) => {
      assert.equal(url, '/api/interview')
      assert.equal(options.headers.authorization, undefined)
      const sent = JSON.parse(options.body)
      assert.equal(sent.messages[0].content.length, 800)
      assert.ok(sent.messages.every((message) => message.role !== 'system'))
      return new Response('data: {"choices":[{"delta":{"content":"回答"}}]}\n\ndata: [DONE]', {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  assert.equal(result.mode, 'deepseek')
})

test('UTF-8 split across network chunks and a final line without newline are preserved', async () => {
  const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"content":"中文追问"}}]}\r\n\r\ndata: [DONE]')
  const tokens = []
  const result = await streamInterview({
    messages, sessionId, onToken: (token) => tokens.push(token),
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    }), { headers: { 'content-type': 'text/event-stream' } }),
  })
  assert.equal(result.mode, 'deepseek')
  assert.equal(tokens.join(''), '中文追问')
})

test('incomplete streams fail instead of replacing real output with a local answer', async () => {
  let answer = ''
  await assert.rejects(streamInterview({
    messages, sessionId,
    onToken: (token, options) => { answer = options?.replace ? token : answer + token },
    fetchImpl: async () => new Response('data: {"choices":[{"delta":{"content":"未完成的实时输出"}}]}\n\n', {
      headers: { 'content-type': 'text/event-stream' },
    }),
  }), /连接|重试/)
  assert.equal(answer, '未完成的实时输出')
})

test('aborting a request does not produce an unsolicited fallback', async () => {
  await assert.rejects(streamInterview({
    messages, sessionId, onToken() { assert.fail('no fallback after abort') },
    fetchImpl: async () => { throw new DOMException('Aborted', 'AbortError') },
  }), { name: 'AbortError' })
})

test('SSE heartbeats, malformed lines and reasoning tokens are not shown as answers', () => {
  assert.equal(parseSseLine(': keep-alive'), null)
  assert.equal(parseSseLine('data: invalid'), null)
  assert.equal(parseSseLine('data: {"choices":[{"delta":{"reasoning_content":"hidden"}}]}'), null)
})

test('legacy browser key is disabled in local and production Vite builds', () => {
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(config, /'import\.meta\.env\.VITE_DEEPSEEK_API_KEY': '\"\"'/)
  const client = readFileSync(new URL('../src/interview/client.js', import.meta.url), 'utf8')
  assert.doesNotMatch(client, /VITE_DEEPSEEK_API_KEY|Bearer|api\.deepseek\.com/)
})
