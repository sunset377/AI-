// MiniMax H3 video generation client for the replica workbench.
//
// Complex live-action / character shots are produced by an explicit external
// video model tier (MiniMax H3). The flow is asynchronous:
//   createVideoTask  -> task_id
//   queryVideoTask   -> status: queued | running | succeeded | failed | cancelled
//   downloadVideo    -> save content.url to a local result.mp4
// The module never holds an API key in code; it reads the operator's
// configuration from the environment (MINIMAX_API_KEY / MINIMAX_BASE_URL).

const DEFAULT_BASE_URL = 'https://api.minimaxi.com'

export function readVideoConfig() {
  return {
    baseUrl: process.env.MINIMAX_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.MINIMAX_MODEL || 'MiniMax-H3',
    apiKey: process.env.MINIMAX_API_KEY || '',
  }
}

export function videoHealth(config) {
  let valid = false
  try {
    const url = new URL(config.baseUrl)
    valid = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  } catch {
    // Configuration is not public.
  }
  return {
    ready: Boolean(valid && config.apiKey),
    model: config.model,
    note: '按量计费；提交前展示预估，成片由 MiniMax 云端生成。',
  }
}

// Map a workbench canvas (width/height) to a MiniMax ratio token.
export function ratioForCanvas(width, height) {
  const ratio = height > width ? '9:16' : width > height ? '16:9' : '1:1'
  return ratio
}

export async function createVideoTask({ prompt, duration, resolution = '768P', ratio }, config) {
  if (!videoHealth(config).ready) throw new Error('MiniMax H3 未配置。')
  const text = String(prompt || '').trim()
  if (!text) throw new Error('缺少视频描述。')
  const seconds = Number(duration)
  if (!Number.isFinite(seconds) || seconds < 4 || seconds > 15 || !Number.isInteger(seconds)) throw new Error('MiniMax H3 仅支持 4～15 秒整数时长。')
  const payload = { model: config.model, content: [{ type: 'text', text }], duration: seconds, resolution, ratio }
  const response = await (config.fetch || fetch)(`${config.baseUrl.replace(/\/$/, '')}/v2/video_generation`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeout || 30_000),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error?.message || `MiniMax 提交失败（HTTP ${response.status}）。`)
  const taskId = json.task_id || json.taskId
  if (!taskId) throw new Error('MiniMax 未返回任务 ID。')
  return { taskId, requestId: json.request_id }
}

export async function queryVideoTask(taskId, config) {
  const response = await (config.fetch || fetch)(`${config.baseUrl.replace(/\/$/, '')}/v2/query/video_generation/${encodeURIComponent(taskId)}`, {
    headers: { authorization: `Bearer ${config.apiKey}` },
    signal: AbortSignal.timeout(config.timeout || 30_000),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error?.message || `MiniMax 查询失败（HTTP ${response.status}）。`)
  const task = json.task || {}
  return {
    status: task.status,
    url: task.content?.url || '',
    duration: task.duration,
    resolution: task.resolution,
    error: task.error,
  }
}

export async function downloadVideo(url, destination, config = {}) {
  const response = await (config.fetch || fetch)(url, { signal: AbortSignal.timeout(config.downloadTimeout || 180_000) })
  if (!response.ok) throw new Error(`成片下载失败（HTTP ${response.status}）。`)
  const chunks = []
  let bytes = 0
  for await (const chunk of response.body) {
    bytes += chunk.length
    if (bytes > 400 * 1024 * 1024) throw new Error('成片超过 400 MB，已停止下载。')
    chunks.push(Buffer.from(chunk))
  }
  await import('node:fs/promises').then(({ writeFile }) => writeFile(destination, Buffer.concat(chunks)))
  return bytes
}
