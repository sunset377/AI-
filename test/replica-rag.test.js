import test from 'node:test'
import assert from 'node:assert/strict'

import { createRagClient, RagUnavailableError } from '../server/replica-rag.js'

function jsonFetch(value, init = {}) {
  return async (url, options) => {
    init.requests?.push({ url, options })
    return {
      ok: true,
      status: 200,
      json: async () => value,
    }
  }
}

test('health returns ready payload and caches it', async () => {
  const requests = []
  const payload = {
    ready: true,
    warming: false,
    embedding: 'transformer',
    embedding_dim: 512,
    collections: { assets: true, methodology: true },
  }
  const client = createRagClient({ fetchImpl: jsonFetch(payload, { requests }) })
  const first = await client.health()
  const second = await client.health()
  assert.equal(first.ready, true)
  assert.equal(second.embedding_dim, 512)
})

test('health degrades to ready=false when the service is down', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED')
  }
  const client = createRagClient({ fetchImpl })
  const value = await client.health()
  assert.equal(value.ready, false)
  assert.equal(value.embedding, 'unavailable')
})

test('ingest sends owner header and body', async () => {
  const requests = []
  const client = createRagClient({ fetchImpl: jsonFetch({ upserted: 2 }, { requests }) })
  await client.ingest('owner123', 'assets', [{ id: 'a', text: 'hello' }])
  const call = requests.find((r) => r.url.includes('/v1/ingest'))
  assert.equal(call.options.headers['x-replica-owner'], 'owner123')
  assert.match(call.url, /\/v1\/ingest$/)
  const body = JSON.parse(call.options.body)
  assert.equal(body.collection, 'assets')
  assert.equal(body.items[0].id, 'a')
})

test('search forwards query and filters', async () => {
  const requests = []
  const client = createRagClient({
    fetchImpl: jsonFetch({ hits: [], rewritten_queries: [], query: 'q' }, { requests }),
  })
  await client.search('owner123', 'methodology', '美食 特写', {
    top_k: 5,
    filters: { kind: 'food' },
  })
  const call = requests.find((r) => r.url.includes('/v1/search'))
  const body = JSON.parse(call.options.body)
  assert.equal(body.query, '美食 特写')
  assert.equal(body.top_k, 5)
  assert.deepEqual(body.filters, { kind: 'food' })
})

test('a 503 response raises RagUnavailableError', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ detail: 'warming' }),
  })
  const client = createRagClient({ fetchImpl })
  await assert.rejects(
    () => client.search('o', 'methodology', 'q'),
    RagUnavailableError,
  )
})
