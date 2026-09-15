export function parseSseLine(line) {
  if (!line.startsWith('data:')) return null

  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return null

  try {
    const payload = JSON.parse(data)
    const response = payload.response ?? payload.choices?.[0]?.delta?.content
    return typeof response === 'string' && response ? { response } : null
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
  const response = await fetchImpl('/api/interview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, sessionId }),
    signal,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? 'AI 面试服务暂时不可用，请稍后再试。')
  }

  if (!response.body) throw new Error('AI 面试服务没有返回内容，请稍后再试。')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emitLines = (lines) => {
    for (const line of lines) {
      const event = parseSseLine(line.trim())
      if (event) onToken(event.response)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    emitLines(lines)
  }

  buffer += decoder.decode()
  if (buffer) emitLines([buffer])
}
