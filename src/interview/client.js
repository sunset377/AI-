const INTERVIEW_API_URL = import.meta.env?.VITE_INTERVIEW_API_URL || '/api/interview'
const INTERVIEW_API_URLS = [
  INTERVIEW_API_URL,
  import.meta.env?.VITE_INTERVIEW_FALLBACK_API_URL || INTERVIEW_API_URL,
]

export function parseSseLine(line) {
  if (!line.startsWith('data:')) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null
  try {
    const payload = JSON.parse(data)
    const delta = payload.choices?.[0]?.delta?.content ?? payload.response
    return typeof delta === 'string' && delta ? { response: delta } : null
  } catch {
    return null
  }
}

export async function streamInterview({
  messages,
  sessionId,
  onToken,
  signal,
  fetchImpl = fetch,
}) {
  for (let attempt = 0; attempt < INTERVIEW_API_URLS.length; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const controller = new AbortController()
    let reader
    let hasToken = false
    let completed = false
    let timedOut = false
    let retryable = true
    let failureMessage = '实时连接暂时失败，请重新提问。'
    const abort = () => {
      controller.abort()
      reader?.cancel().catch(() => {})
    }
    const expire = () => { timedOut = true; abort() }
    let deadline = setTimeout(expire, 12000)
    const totalDeadline = setTimeout(expire, 45000)
    const resetDeadline = () => {
      clearTimeout(deadline)
      deadline = setTimeout(expire, 15000)
    }
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await fetchImpl(INTERVIEW_API_URLS[attempt], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(({ role, content }) => ({ role, content: content.slice(0, 800) })),
          sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        retryable = response.ok || response.status >= 500 || response.status === 408
        if (response.status === 429) failureMessage = '提问有点频繁，请稍后再试。'
        await response.body?.cancel()
        throw new Error(failureMessage)
      }

      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      resetDeadline()
      const emitLine = (line) => {
        if (completed) return
        if (line.trim() === 'data: [DONE]') completed = true
        const event = parseSseLine(line.trim())
        if (event) {
          hasToken = true
          resetDeadline()
          onToken(event.response)
        }
      }
      while (!completed) {
        const { done, value } = await reader.read()
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        lines.forEach(emitLine)
      }
      emitLine(buffer + decoder.decode())
      if (timedOut || !hasToken || !completed) throw new Error(failureMessage)
      return { mode: 'deepseek' }
    } catch (error) {
      if (signal?.aborted || (error.name === 'AbortError' && !timedOut)) throw error
      if (retryable && !hasToken && attempt + 1 < INTERVIEW_API_URLS.length) continue
      throw new Error(timedOut ? '实时连接超时，请重新提问。' : failureMessage)
    } finally {
      clearTimeout(deadline)
      clearTimeout(totalDeadline)
      signal?.removeEventListener('abort', abort)
      if (reader) {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
    }
  }
}
