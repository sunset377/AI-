// Official plugin price snapshot; refresh against the supplier before changing rates.
export function videoEstimate(duration) {
  const seconds = Number(duration)
  if (!Number.isInteger(seconds) || seconds < 4 || seconds > 15) throw new Error('MiniMax H3 单次时长须为 4–15 秒整数，请调整方案。')
  return { seconds, cny: (seconds * 0.5).toFixed(2), date: '2026-09-01' }
}
