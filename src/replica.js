export const REPLICA_LIMITS = { seconds: 15, bytes: 25 * 1024 * 1024, captions: 1000 }

export function validateReplicaOptions(input) {
  if (!input || !['original', 'fast', 'highlight'].includes(input.opening) || !['blue', 'clean'].includes(input.style)) {
    throw new Error('请选择有效的开头节奏和视觉包装。')
  }
  const start = Number(input.highlightStart ?? 0)
  if (!Number.isFinite(start) || start < 0 || start > REPLICA_LIMITS.seconds) throw new Error('亮点时间无效。')
  if (typeof input.title !== 'string' || input.title.length > 40 || typeof input.captions !== 'string' || input.captions.length > REPLICA_LIMITS.captions) {
    throw new Error('开头标题最多 40 字，字幕最多 1000 字。')
  }
  const lines = input.captions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > 30 || lines.some((line) => line.length > 60)) throw new Error('字幕最多 30 行，每行最多 60 字。')
  return { opening: input.opening, style: input.style, highlightStart: start, title: input.title.trim(), captions: lines.join('\n'), keepAudio: input.keepAudio !== false }
}

export function planReplica(duration, options) {
  if (!Number.isFinite(duration) || duration < 0.5 || duration > REPLICA_LIMITS.seconds + 0.05) throw new Error('请选择 0.5～15 秒的视频，建议先用 3～5 秒片段。')
  // Work on the same 30 fps clock used by Hypit's Normalize surface.
  const end = Math.floor(duration * 30) / 30
  const hookEnd = Math.min(1, end)
  let segments
  if (options.opening === 'highlight') {
    const start = Math.round(options.highlightStart * 30) / 30
    if (start >= end - 1 / 30) throw new Error('亮点时间必须位于视频结束之前。')
    const stop = Math.min(start + 1, end)
    segments = [{ start, end: stop, rate: 1 }, { start: 0, end: start, rate: 1 }, { start: stop, end, rate: 1 }]
  } else if (options.opening === 'fast') {
    segments = [{ start: 0, end: hookEnd, rate: 1.35 }, { start: hookEnd, end, rate: 1 }]
  } else {
    segments = [{ start: 0, end, rate: 1 }]
  }
  segments = segments.filter((segment) => segment.end - segment.start >= 1 / 30 - 1e-6)
  const outputDuration = segments.reduce((sum, segment) => sum + (segment.end - segment.start) / segment.rate, 0)
  const lines = options.captions.split('\n').filter(Boolean)
  if (lines.length && outputDuration / lines.length < 0.5) throw new Error('字幕过多，每条至少保留 0.5 秒阅读时间。')
  const captions = lines.map((text, index) => ({ text, start: index * outputDuration / lines.length, end: (index + 1) * outputDuration / lines.length }))
  return { segments, outputDuration, captions, cost: 0, subtitleTiming: 'manual-even' }
}

export function mapOutputToSource(time, plan) {
  let cursor = 0
  for (const segment of plan.segments) {
    const length = (segment.end - segment.start) / segment.rate
    if (time < cursor + length) return segment.start + Math.max(0, time - cursor) * segment.rate
    cursor += length
  }
  return plan.segments.at(-1).end
}
