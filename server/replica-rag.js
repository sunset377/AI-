// Node client for the local Replica RAG microservice.
//
// Wraps the RAG service HTTP endpoints (health / ingest / search / delete) with
// short timeouts and caching. Every method degrades gracefully when the Python
// service is down: health reports `ready: false` and the caller is expected to
// keep planning with session-only material rather than blocking the user.
//

const DEFAULT_BASE_URL = process.env.RAG_URL || 'http://127.0.0.1:8765'
const HEALTH_TIMEOUT_MS = 2500
const REQUEST_TIMEOUT_MS = 20000

const DOWN_HEALTH = {
  ready: false,
  warming: false,
  embedding: 'unavailable',
  embedding_dim: null,
  collections: {},
}

export class RagUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RagUnavailableError'
  }
}

export function createRagClient({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  let healthCache = null

  async function request(path, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    let response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      throw new RagUnavailableError(error?.message || 'RAG 请求失败。')
    }
    if (response.status === 503) {
      throw new RagUnavailableError('RAG 服务正在预热。')
    }
    if (!response.ok) {
      let detail = ''
      try {
        detail = (await response.json())?.detail || ''
      } catch {
        /* ignore body errors */
      }
      throw new Error(detail || `RAG 请求失败 (${response.status})。`)
    }
    return response.json()
  }

  async function health({ force = false } = {}) {
    const ttl = healthCache?.value?.ready ? 15000 : 3000
    if (!force && healthCache && Date.now() - healthCache.at < ttl) {
      return healthCache.value
    }
    try {
      const value = await request('/health', { method: 'GET' }, HEALTH_TIMEOUT_MS)
      healthCache = { at: Date.now(), value }
      return value
    } catch (error) {
      const value = { ...DOWN_HEALTH }
      healthCache = { at: Date.now(), value }
      return value
    }
  }

  async function ingest(owner, collection, items) {
    return request('/v1/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-replica-owner': owner },
      body: JSON.stringify({ collection, items }),
    })
  }

  async function search(owner, collection, query, options = {}) {
    return request('/v1/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-replica-owner': owner },
      body: JSON.stringify({
        collection,
        query,
        top_k: options.top_k,
        filters: options.filters,
        rewrite: options.rewrite !== false,
      }),
    })
  }

  async function remove(owner, collection, payload) {
    return request('/v1/items', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'x-replica-owner': owner },
      body: JSON.stringify({ collection, ...payload }),
    })
  }

  // Kick off a health probe immediately so the first user request does not wait.
  const primed = health()

  return {
    ready: () => primed.then(() => health()).then((value) => value.ready),
    health,
    ingest,
    search,
    remove,
  }
}
