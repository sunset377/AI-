import { buildResumeFallbackAnswer } from './fallback.js'

const INTERVIEW_API_URL = import.meta.env?.VITE_INTERVIEW_API_URL || '/api/interview'

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
  try {
    const response = await fetchImpl(INTERVIEW_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content: content.slice(0, 800) })),
        sessionId,
      }),
      signal,
    })

    if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
      await response.body?.cancel()
      throw new Error('Realtime interview unavailable')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let hasToken = false
    let completed = false
    const emitLine = (line) => {
      if (line.trim() === 'data: [DONE]') completed = true
      const event = parseSseLine(line.trim())
      if (event) {
        hasToken = true
        onToken(event.response)
      }
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        lines.forEach(emitLine)
      }
      emitLine(buffer + decoder.decode())
      if (!hasToken || !completed) throw new Error('Incomplete interview response')
      return { mode: 'deepseek' }
    } finally {
      reader.releaseLock()
    }
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error
    // Replace a partial stream rather than mixing model text with a fallback answer.
    onToken(buildResumeFallbackAnswer(messages), { replace: true })
    return { mode: 'resume-fallback' }
  }
}
