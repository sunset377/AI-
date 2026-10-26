import test from 'node:test'
import assert from 'node:assert/strict'
import edge from '../pages-api/public/_worker.js'

test('reachable Pages entry forwards model requests unchanged to the private model service', async () => {
  const id = 'e3ed21fb-27f5-4812-bd51-c010b7d3a589'
  for (const [path, method] of [['/api/models', 'GET'], ['/api/sessions', 'POST'], ['/api/chat', 'POST'], ['/api/images', 'POST'], ['/api/jobs/' + id, 'GET'], ['/api/chat', 'OPTIONS']]) {
    const request = new Request('https://ci-interview-gateway.pages.dev' + path, {
      method, headers: { origin: 'https://sunset377.github.io', authorization: 'Bearer visitor-fixture', 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify({ requestId: id }) } : {}),
    })
    const response = await edge.fetch(request, {
      MODEL_API: { fetch: async forwarded => { assert.equal(forwarded, request); return new Response('model service') } },
      INTERVIEW_API: { fetch: async () => new Response('interview service') },
    })
    assert.equal(await response.text(), 'model service', path)
  }
})

test('existing interview and storyboard entry continue using the interview service', async () => {
  for (const path of ['/api/interview', '/api/storyboard', '/']) {
    const request = new Request('https://ci-interview-gateway.pages.dev' + path)
    const response = await edge.fetch(request, {
      MODEL_API: { fetch: async () => { throw new Error('Wrong service') } },
      INTERVIEW_API: { fetch: async forwarded => { assert.equal(forwarded, request); return new Response('interview service') } },
    })
    assert.equal(await response.text(), 'interview service')
  }
})
