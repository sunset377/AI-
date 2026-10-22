import { createWhiteboardApi } from './whiteboard-api.js'
import { videoEstimate } from '../src/video-cost.js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPLICA_LIMITS, validateReplicaOptions } from '../src/replica.js'
import { checkReplicaTools, HYPIT_PROJECT, probeVideoDuration, renderReplica, trimReplicaVideo } from './replica-render.js'
import { DEFAULT_TEMPLATE, validateTemplate, guideTemplate } from '../src/replica-template.js'
import { buildDirectorPlan, validateDirectorPlan } from '../src/replica-director.js'
import { analyzeReplica } from './replica-analysis.js'
import { chatReplica, readReplicaChatConfig, replicaChatHealth } from './replica-chat.js'
import { checkReplicaVoice, createVoicePreview, validateProsody } from './replica-voice.js'
import { createRagClient } from './replica-rag.js'
import { PROVIDERS, estimateChatCost, routeFor } from './replica-routing.js'
import { createAuditLog } from './replica-audit.js'
import { createVideoTask, downloadVideo, queryVideoTask, ratioForCanvas, readVideoConfig, videoHealth } from './replica-video.js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// The replica API is a Node-side service; Vite only injects VITE_* variables
// into the browser build. Load the operator's local .env.local (gitignored)
// into process.env when a key is not already set, without ever exposing it.
function loadLocalEnv(root = projectRoot) {
  const file = path.join(root, '.env.local')
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/)
      if (!match) continue
      const key = match[1]
      if (process.env[key] !== undefined) continue
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      process.env[key] = value
    }
  } catch {
    // No .env.local is fine; external configuration still works.
  }
}

const finalStates = new Set(['complete', 'failed'])
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const digest = (value) => createHash('sha256').update(value).digest('hex')
const defaultCanvas = () => ({ width: 720, height: 1280, fps: 30 })
const canvasFromMetadata = ({ width, height }) => {
  const scale = Math.min(1, 1280 / Math.max(width, height))
  return { width: Math.floor(width * scale / 2) * 2, height: Math.floor(height * scale / 2) * 2, fps: 30 }
}
const planReference = (analysis) => analysis ? {
  summary: `已测量参考视频：${analysis.metadata.width}×${analysis.metadata.height}，${analysis.metadata.duration} 秒；未自动识别文字、语音、人物或剧情。`,
  evidence: [
    { source: 'observed', text: `参考视频尺寸 ${analysis.metadata.width}×${analysis.metadata.height}，时长 ${analysis.metadata.duration} 秒。` },
    ...(analysis.background?.stable ? [{ source: 'observed', text: `边缘区域检测到稳定背景色 ${analysis.background.color}。` }] : []),
    ...(analysis.unknowns || []).slice(0, 10).map((text) => ({ source: 'observed', text })),
  ],
} : null

// One-click auto mode: extract explicit copy (标题/卖点/行动 or quoted / leading
// sentences) so a complete requirement can go straight to an executable plan.
// Missing copy is never invented — it stays as a blocker for the user to fill.
function autoResolveCopy(message, template) {
  const patch = {}
  const fieldKeys = { title: ['标题', '开场', '开场钩子'], benefit: ['卖点', '利益点'], action: ['行动', '行动引导'] }
  const segments = message.split(/[；;]/).map((s) => s.trim()).filter(Boolean)
  for (const segment of segments) {
    const match = segment.match(/^([^：:]{1,8})[：:](.+)$/)
    if (!match) continue
    const label = match[1].trim()
    const value = match[2].trim().slice(0, 40)
    if (!value) continue
    for (const [field, keys] of Object.entries(fieldKeys)) {
      if (template[field] || patch[field]) continue
      if (keys.some((key) => label.includes(key))) patch[field] = value
    }
  }
  if (template.title && template.benefit && template.action) return patch
  const quoted = [...message.matchAll(/[「"']([^「"'']{2,40})[」"']/g)].map((m) => m[1].trim()).filter(Boolean)
  const sentences = message.split(/[。！？!?\n]+/).map((s) => s.trim()).filter((s) => s.length >= 2 && !/^(标题|开场|卖点|利益点|行动|背景|底色|文字|颜色)/.test(s))
  const fallback = { title: quoted[0] || sentences[0], benefit: quoted[1] || sentences[1], action: quoted[2] || sentences[2] }
  for (const [field, value] of Object.entries(fallback)) if (!template[field] && !patch[field] && value) patch[field] = value.slice(0, 40)
  return patch
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(body))
}

export async function createReplicaApi({ directory = path.join(HYPIT_PROJECT, 'jobs'), render = renderReplica, checkTools = checkReplicaTools, analyze = analyzeReplica, probeDuration = probeVideoDuration, trimVideo = trimReplicaVideo, chatConfig, chat = chatReplica, checkVoice = checkReplicaVoice, voice = createVoicePreview, ragClient = createRagClient(), audit = createAuditLog({ directory: path.join(HYPIT_PROJECT, 'jobs', '.audit') }), videoConfig, submitVideo = createVideoTask, queryVideo = queryVideoTask, fetchVideo = downloadVideo } = {}) {
  loadLocalEnv()
  await mkdir(directory, { recursive: true })
  chatConfig ||= await readReplicaChatConfig()
  videoConfig ||= readVideoConfig()
  const jobs = new Map()
  const drafts = new Map()
  const uploads = new Set()
  const writes = new Map()
  const draftBusy = (d) => ['queued', 'analyzing', 'chatting', 'voicing', 'deleting', 'rendering'].includes(d.status)
  const active = () => [...jobs.values()].filter((j) => !finalStates.has(j.status)).concat([...drafts.values()].filter(draftBusy))
  const capacity = (owner) => uploading < 2 && active().length + uploads.size < 3 && !uploads.has(owner) && !active().some((d) => d.owner === owner)
  let uploading = 0
  let queue = Promise.resolve()
  let healthCache = null
  let healthPending = null

  async function persist(job) {
    const filename = path.join(directory, job.id, 'job.json')
    const json = JSON.stringify(job, null, 2)
    const pending = (writes.get(job.id) || Promise.resolve()).catch(() => {}).then(async () => { await writeFile(`${filename}.tmp`, json); await rename(`${filename}.tmp`, filename) })
    writes.set(job.id, pending)
    try { await pending } finally { if (writes.get(job.id) === pending) writes.delete(job.id) }
  }

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || !idPattern.test(entry.name)) continue
    try {
      const job = JSON.parse(await readFile(path.join(directory, entry.name, 'job.json'), 'utf8'))
      if (job.id !== entry.name || typeof job.owner !== 'string') continue
      if (job.kind === 'draft' && job.schemaVersion === 2) {
        const metadata = job.analysis?.metadata || null
        Object.assign(job, { schemaVersion: 3, template: validateTemplate({ ...job.template, templateId: 'cleanup-icon' }), reference: existsSync(path.join(directory, entry.name, 'input.mp4')) ? { filename: job.filename, metadata } : null, canvas: metadata ? canvasFromMetadata(metadata) : defaultCanvas(), directorPlan: null, confirmedPlanHash: null })
      }
      if (job.kind === 'draft' && job.schemaVersion === 3) {
        job.requirements ||= []
        job.unresolved ||= []
        job.confirmedPlanHash ||= null
      }
      if (job.kind === 'draft' ? draftBusy(job) : !finalStates.has(job.status)) {
        Object.assign(job, { status: 'failed', message: '执行服务已重启，此任务已中断。请重新创建任务。' })
        await persist(job)
      }
      ;(job.kind === 'draft' ? drafts : jobs).set(job.id, job)
    } catch { /* A partially uploaded job is not a usable task. */ }
  }

  function publicJob(job) {
    const { owner, ...visible } = job
    return { ...visible, inputUrl: job.reference === null ? null : `/api/replica/jobs/${job.id}/input`, resultUrl: job.status === 'complete' ? `/api/replica/jobs/${job.id}/result` : null }
  }

  function publicDraft(draft) {
    const { id, schemaVersion, filename, createdAt, status, message, progress, revision, confirmedRevision, confirmedPlanHash, reference, canvas, analysis, template, directorPlan, messages, pendingQuestion, error } = draft
    const preview = draft.voicePreview
    const voicePreview = preview ? { id: preview.id, sha256: preview.sha256, duration: preview.duration, cues: preview.cues, prosody: preview.prosody, approved: preview.approved, revision: preview.revision, url: `/api/replica/drafts/${id}/voice/${preview.id}` } : null
    return { id, kind: 'draft', schemaVersion, filename, createdAt, status, message, progress, revision, confirmedRevision, confirmedPlanHash, reference, canvas, analysis, template, directorPlan, messages, pendingQuestion, error, voicePreview, inputUrl: reference ? `/api/replica/drafts/${id}/input` : null, frames: analysis?.frames.map((frame) => ({ ...frame, url: `/api/replica/drafts/${id}/frames/${frame.id}` })) || [] }
  }

  async function jsonBody(request) {
    let bytes = 0; const chunks = []
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 16_000) throw new Error('请求过大。'); chunks.push(chunk) }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('请求格式无效。')
    return value
  }

  function enqueue(resource, work) {
    const update = async (patch) => { Object.assign(resource, patch); await persist(resource) }
    queue = queue.then(async () => {
      try { await work(update) } catch { await update({ status: 'failed', message: '操作失败，请检查素材、模型配置或执行服务；没有自动重试。', error: '操作未完成。' }) }
    }).catch(() => {})
  }

  // 工具健康检查：并发请求共享同一个探测；成功缓存 30s、失败缓存 5s；调用方无需等待探测完成。
  function toolHealth() {
    const ttl = healthCache?.value?.ready ? 30_000 : 5_000
    if (!healthCache || Date.now() - healthCache.at > ttl) {
      if (!healthPending) {
        healthPending = checkTools()
          .catch((error) => ({ ready: false, engine: null, error: error.message.startsWith('本地执行器') ? error.message : '本地执行服务尚未准备好 Hypit 和 FFmpeg。' }))
          .then((value) => { healthCache = { at: Date.now(), value }; return value })
          .finally(() => { healthPending = null })
      }
    }
    return { tools: healthCache ? healthCache.value : { ready: false, warming: true } }
  }

  async function serveFile(request, response, file, type, download) {
    const { size } = await stat(file)
    const headers = { 'content-type': type, 'cache-control': 'private, no-store', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff' }
    if (download) headers['content-disposition'] = `attachment; filename="${download}"`
    let start = 0, end = size - 1
    if (request.headers.range) {
      const range = request.headers.range.match(/^bytes=(\d*)-(\d*)$/)
      if (!range || (!range[1] && !range[2])) { response.writeHead(416, { 'content-range': `bytes */${size}` }); return response.end() }
      start = !range[1] ? Math.max(0, size - Number(range[2])) : Number(range[1])
      if (range[1] && range[2]) end = Math.min(end, Number(range[2]))
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { response.writeHead(416, { 'content-range': `bytes */${size}` }); return response.end() }
      headers['content-range'] = `bytes ${start}-${end}/${size}`
    }
    response.writeHead(request.headers.range ? 206 : 200, { ...headers, 'content-length': end - start + 1 })
    if (request.method === 'HEAD') return response.end()
    const stream = createReadStream(file, { start, end }); response.on('close', () => stream.destroy()); stream.on('error', () => response.destroy()); return stream.pipe(response)
  }

  const whiteboard = createWhiteboardApi({ root: path.join(projectRoot, '.local-audio'), serveFile, sendJson })

  return async function replicaMiddleware(request, response, next) {
    const url = new URL(request.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/replica/')) return next()
    try {
      // Bind uploads and deletion to the page's origin; no permissive CORS proxy.
      const allowedOrigin = process.env.REPLICA_PUBLIC_ORIGIN || `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`
      if (request.headers.origin && request.headers.origin !== allowedOrigin) return sendJson(response, 403, { error: '此来源不能访问复刻服务。' })
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin !== allowedOrigin) return sendJson(response, 403, { error: '请从工作台页面提交任务。' })
      const cookie = request.headers.cookie?.match(/(?:^|;\s*)replica_session=([a-f0-9]{64})(?:;|$)/)?.[1]
      const session = cookie || randomBytes(32).toString('hex')
      if (!cookie) response.setHeader('set-cookie', `replica_session=${session}; HttpOnly; SameSite=Strict; Path=/api/replica/; Max-Age=604800${allowedOrigin.startsWith('https:') ? '; Secure' : ''}`)
      const owner = digest(session)
      if (url.pathname.startsWith('/api/replica/whiteboard/')) return await whiteboard(request, response, url, owner)

      if (url.pathname === '/api/replica/drafts' && request.method === 'GET') return sendJson(response, 200, { drafts: [...drafts.values()].filter((d) => d.owner === owner).map(publicDraft) })
      if (url.pathname === '/api/replica/trim' && request.method === 'POST') {
        if (!capacity(owner)) return sendJson(response, 429, { error: '请等待当前操作完成。' })
        const length = Number(request.headers['content-length'])
        if (!Number.isFinite(length) || length <= 0 || length > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' })
        if (!request.headers['content-type']?.startsWith('multipart/form-data; boundary=')) return sendJson(response, 415, { error: '请上传视频文件。' })
        uploading++; uploads.add(owner)
        const pending = await mkdir(path.join(directory, `.trim-${owner.slice(0, 12)}-${randomBytes(4).toString('hex')}`), { recursive: true })
        let served = false
        try {
          let bytes = 0; const chunks = []
          for await (const chunk of request) { bytes += chunk.length; if (bytes > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' }); chunks.push(chunk) }
          let form
          try { form = await new Request('http://localhost/trim', { method: 'POST', headers: { 'content-type': request.headers['content-type'] }, body: Buffer.concat(chunks) }).formData() } catch { return sendJson(response, 400, { error: '视频上传不完整。' }) }
          const video = form.get('video'), requested = Number(form.get('seconds'))
          if (!(video instanceof File) || !video.size || video.size > REPLICA_LIMITS.bytes || !/\.(mp4|mov|webm|m4v)$/i.test(video.name)) return sendJson(response, 400, { error: '请选择不超过 25 MB 的视频。' })
          const source = path.join(pending, 'source.mp4')
          await writeFile(source, Buffer.from(await video.arrayBuffer()))
          const sourceSeconds = await probeDuration(source).catch(() => null)
          if (sourceSeconds === null) return sendJson(response, 415, { error: '无法读取视频时长；请确认文件未损坏后重试。' })
          if (sourceSeconds <= REPLICA_LIMITS.seconds + 0.05) return sendJson(response, 400, { error: `视频时长 ${sourceSeconds.toFixed(1)} 秒，未超过 ${REPLICA_LIMITS.seconds} 秒，无需截取。` })
          const trimSeconds = Number.isFinite(requested) && requested > 0 && requested <= REPLICA_LIMITS.seconds ? Math.min(requested, sourceSeconds) : REPLICA_LIMITS.seconds
          const output = path.join(pending, 'trimmed.mp4')
          await trimVideo(source, output, trimSeconds)
          served = true
          response.on('close', () => { uploads.delete(owner); rm(pending, { recursive: true, force: true }).catch(() => {}) })
          return serveFile(request, response, output, 'video/mp4')
        } catch {
          return sendJson(response, 500, { error: '截取失败；请确认 FFmpeg 可用后重试。' })
        } finally {
          uploading--
          if (!served) { uploads.delete(owner); await rm(pending, { recursive: true, force: true }) }
        }
      }
      if (url.pathname === '/api/replica/drafts' && request.method === 'POST') {
        if (!capacity(owner) || drafts.size + uploads.size >= 50 || [...drafts.values()].filter((d) => d.owner === owner).length >= 10) return sendJson(response, 429, { error: '草稿或操作已达上限，请等待或清理草稿。' })
        if (request.headers['content-type']?.startsWith('application/json')) {
          let body
          try { body = await jsonBody(request) } catch { return sendJson(response, 400, { error: '请求格式无效或过大。' }) }
          if (Object.keys(body).length) return sendJson(response, 400, { error: '新会话不接受额外字段。' })
          const id = randomUUID(), draftDirectory = path.join(directory, id)
          await mkdir(draftDirectory)
          const draft = { id, owner, kind: 'draft', schemaVersion: 3, filename: '未命名视频方案', createdAt: new Date().toISOString(), status: 'idle', message: '告诉导演你想做什么；参考视频可稍后添加。', progress: 0, revision: 1, confirmedRevision: null, confirmedPlanHash: null, reference: null, canvas: defaultCanvas(), analysis: null, template: { ...DEFAULT_TEMPLATE }, directorPlan: null, messages: [], requirements: [], unresolved: [], pendingQuestion: null }
          await persist(draft); drafts.set(id, draft); return sendJson(response, 201, publicDraft(draft))
        }
        const length = Number(request.headers['content-length'])
        if (!Number.isFinite(length) || length <= 0 || length > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' })
        if (!request.headers['content-type']?.startsWith('multipart/form-data; boundary=')) return sendJson(response, 415, { error: '请上传视频文件。' })
        uploading++; uploads.add(owner); let draftDirectory
        try {
          let bytes = 0; const chunks = []
          for await (const chunk of request) { bytes += chunk.length; if (bytes > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' }); chunks.push(chunk) }
          let form
          try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'content-type': request.headers['content-type'] }, body: Buffer.concat(chunks) }).formData() } catch { return sendJson(response, 400, { error: '视频上传不完整。' }) }
          const video = form.get('video')
          if (!(video instanceof File) || !video.size || video.size > REPLICA_LIMITS.bytes || !/\.(mp4|mov|webm|m4v)$/i.test(video.name)) return sendJson(response, 400, { error: '请选择不超过 25 MB 的视频。' })
          const id = randomUUID(); draftDirectory = path.join(directory, id); await mkdir(draftDirectory)
          const inputPath = path.join(draftDirectory, 'input.mp4')
          await writeFile(inputPath, Buffer.from(await video.arrayBuffer()))
          const uploadedSeconds = await probeDuration(inputPath).catch(() => null)
          if (uploadedSeconds === null) {
            await rm(draftDirectory, { recursive: true, force: true })
            return sendJson(response, 415, { error: '无法读取视频时长；请确认文件未损坏后重试。' })
          }
          if (uploadedSeconds > REPLICA_LIMITS.seconds) {
            await rm(draftDirectory, { recursive: true, force: true })
            return sendJson(response, 422, { error: `视频时长 ${uploadedSeconds.toFixed(1)} 秒，最长 ${REPLICA_LIMITS.seconds} 秒；请缩短后重新上传。` })
          }
          const filename = path.basename(video.name).slice(0, 200)
          const draft = { id, owner, kind: 'draft', schemaVersion: 3, filename, createdAt: new Date().toISOString(), status: 'idle', message: '请先分析参考，再告诉导演你的目标。', progress: 0, revision: 1, confirmedRevision: null, confirmedPlanHash: null, reference: { filename, metadata: null }, canvas: defaultCanvas(), analysis: null, template: { ...DEFAULT_TEMPLATE }, directorPlan: null, messages: [], requirements: [], unresolved: [], pendingQuestion: null }
          await persist(draft); drafts.set(id, draft); return sendJson(response, 201, publicDraft(draft))
        } finally { uploading--; uploads.delete(owner); if (draftDirectory && !drafts.has(path.basename(draftDirectory))) await rm(draftDirectory, { recursive: true, force: true }) }
      }
      const draftMatch = url.pathname.match(/^\/api\/replica\/drafts\/([a-f0-9-]+)(?:\/(input|reference|analyze|confirm|render|messages|video-submit|voice|voice\/[a-f0-9-]+(?:\/approve)?|frames\/[0-5]))?$/)
      if (draftMatch && idPattern.test(draftMatch[1])) {
        const draft = drafts.get(draftMatch[1])
        if (!draft || draft.owner !== owner) return sendJson(response, 404, { error: '草稿不存在。' })
        const dir = path.join(directory, draft.id), operation = draftMatch[2]
        if (!operation && request.method === 'GET') return sendJson(response, 200, publicDraft(draft))
        if (operation?.startsWith('voice/')) {
          const preview = draft.voicePreview
          if (!preview || preview.id !== operation.split('/')[1]) return sendJson(response, 404, { error: '试听不存在或已因修改失效。' })
          if (!operation.endsWith('/approve') && ['GET', 'HEAD'].includes(request.method)) return serveFile(request, response, preview.audioPath, 'audio/wav')
        }
        if (['input', ...[0, 1, 2, 3, 4, 5].map((i) => `frames/${i}`)].includes(operation) && ['GET', 'HEAD'].includes(request.method)) {
          if (operation === 'input' && !draft.reference) return sendJson(response, 404, { error: '当前会话没有参考视频。' })
          if (operation !== 'input' && !draft.analysis?.frames.some((f) => `frames/${f.id}` === operation)) return sendJson(response, 404, { error: '代表帧尚未就绪。' })
          return serveFile(request, response, path.join(dir, operation === 'input' ? 'input.mp4' : `frame-${operation.split('/')[1]}.png`), operation === 'input' ? 'video/mp4' : 'image/png')
        }
        if (!operation && request.method === 'DELETE') {
          if (draftBusy(draft)) return sendJson(response, 409, { error: '操作中的草稿不能删除。' })
          draft.status = 'deleting'; await (writes.get(draft.id) || Promise.resolve()); await rm(dir, { recursive: true }); drafts.delete(draft.id); return sendJson(response, 200, { deleted: true })
        }
        if (operation === 'reference' && request.method === 'POST') {
          if (!capacity(owner)) return sendJson(response, 429, { error: '请等待当前操作完成。' })
          if (draftBusy(draft)) return sendJson(response, 409, { error: '操作中的草稿不能修改。' })
          const length = Number(request.headers['content-length'])
          if (!Number.isFinite(length) || length <= 0 || length > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' })
          if (!request.headers['content-type']?.startsWith('multipart/form-data; boundary=')) return sendJson(response, 415, { error: '请上传视频文件。' })
          uploading++; uploads.add(owner); const pending = path.join(dir, 'input.pending')
          try {
            let bytes = 0; const chunks = []
            for await (const chunk of request) { bytes += chunk.length; if (bytes > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' }); chunks.push(chunk) }
            let form
            try { form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'content-type': request.headers['content-type'] }, body: Buffer.concat(chunks) }).formData() } catch { return sendJson(response, 400, { error: '视频上传不完整。' }) }
            const video = form.get('video'), revision = Number(form.get('revision'))
            if (!Number.isInteger(revision) || revision !== draft.revision) return sendJson(response, 409, { error: '方案已更新，请刷新后重新选择参考。' })
            if (!(video instanceof File) || !video.size || video.size > REPLICA_LIMITS.bytes || !/\.(mp4|mov|webm|m4v)$/i.test(video.name)) return sendJson(response, 400, { error: '请选择不超过 25 MB 的视频。' })
            await writeFile(pending, Buffer.from(await video.arrayBuffer()))
            const replacementSeconds = await probeDuration(pending).catch(() => null)
            if (replacementSeconds === null) return sendJson(response, 415, { error: '无法读取视频时长；请确认文件未损坏后重试。' })
            if (replacementSeconds > REPLICA_LIMITS.seconds) return sendJson(response, 422, { error: `视频时长 ${replacementSeconds.toFixed(1)} 秒，最长 ${REPLICA_LIMITS.seconds} 秒；请缩短后重新上传。` })
            await copyFile(pending, path.join(dir, 'input.mp4'))
            const filename = path.basename(video.name).slice(0, 200)
            Object.assign(draft, { filename, reference: { filename, metadata: null }, analysis: null, directorPlan: null, unresolved: [], template: validateTemplate({ ...draft.template, audioMode: 'mute' }), revision: draft.revision + 1, confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, pendingQuestion: null, status: 'idle', progress: 0, message: '参考视频已更新，请先分析。', error: null })
            await persist(draft); return sendJson(response, 200, publicDraft(draft))
          } finally { uploading--; uploads.delete(owner); await rm(pending, { force: true }).catch(() => {}) }
        }
        if (request.method !== 'POST' && !(request.method === 'PATCH' && !operation)) return sendJson(response, 405, { error: '不支持此操作。' })
        let body
        try { body = await jsonBody(request) } catch { return sendJson(response, 400, { error: '请求格式无效或过大。' }) }
        const allowed = operation === 'video-submit' ? ['revision', 'confirmCostCny'] : operation === 'messages' ? ['revision', 'message', 'mode', 'consent', 'auto', 'memory'] : operation === 'voice' ? ['revision', 'narration', 'prosody'] : operation?.endsWith('/approve') ? ['revision', 'sha256'] : !operation ? ['revision', 'template'] : ['revision']
        if (Object.keys(body).some((key) => !allowed.includes(key))) return sendJson(response, 400, { error: '请求包含无效字段。' })
        if ((['analyze', 'render', 'voice'].includes(operation) || (operation === 'messages' && body.mode === 'api')) && !capacity(owner)) return sendJson(response, 429, { error: '请等待当前操作完成。' })
        if (draftBusy(draft)) return sendJson(response, 409, { error: '操作中的草稿不能修改。' })
        if (!Number.isInteger(body.revision) || body.revision !== draft.revision) return sendJson(response, 409, { error: '方案已更新，请刷新后重新确认。' })
        if (!operation && request.method === 'PATCH') {
          let template
          try { if (!body.template || typeof body.template !== 'object' || Array.isArray(body.template)) throw new Error(); template = validateTemplate({ ...draft.template, ...body.template }) } catch { return sendJson(response, 400, { error: '模板配置无效。' }) }
          let directorPlan = draft.directorPlan
          if (draft.directorPlan?.route?.kind === 'hypit-template' || (!draft.directorPlan && draft.requirements?.length)) {
            try { directorPlan = buildDirectorPlan({ requirements: draft.requirements, reference: planReference(draft.analysis), canvas: draft.canvas, template, blockers: draft.unresolved }) } catch { directorPlan = null }
          }
          Object.assign(draft, { template, directorPlan, revision: draft.revision + 1, confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, pendingQuestion: null, status: 'idle', error: null })
          await persist(draft); return sendJson(response, 200, publicDraft(draft))
        }
        if (operation === 'voice') {
          try { validateProsody(body.narration, body.prosody) } catch { return sendJson(response, 400, { error: '请核对旁白文字、句段与停顿。' }) }
          if (!(await checkVoice()).ready) return sendJson(response, 409, { error: '本人 F5 配置、转写或本地权重未就绪。' })
          // Readiness awaits local IO; another request may have edited or occupied this draft meanwhile.
          if (!capacity(owner)) return sendJson(response, 429, { error: '请等待当前操作完成。' })
          if (draftBusy(draft) || body.revision !== draft.revision) return sendJson(response, 409, { error: '方案已更新或正在操作，请刷新后重新确认。' })
          Object.assign(draft, { status: 'voicing', confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, error: null }); await persist(draft)
          enqueue(draft, async (update) => {
            const preview = await voice({ narration: body.narration, prosody: body.prosody }, dir)
            await audit.append({ kind: 'voice', provider: 'local-f5', model: 'f5-tts', fee: 0, feeUnit: '零模型费（本地权重）', summary: `生成旁白试听：${body.narration.slice(0, 40)}${body.narration.length > 40 ? '…' : ''}`, draftId: draft.id, owner })
            const template = validateTemplate({ ...draft.template, narration: body.narration, audioMode: 'voice' })
            const revision = draft.revision + 1
            const directorPlan = draft.requirements?.length ? buildDirectorPlan({ requirements: draft.requirements, reference: planReference(draft.analysis), canvas: draft.canvas, template, questions: draft.pendingQuestion ? [{ field: draft.pendingQuestion.field, text: draft.pendingQuestion.text }] : [], blockers: draft.unresolved }) : null
            await update({ template, directorPlan, revision, confirmedPlanHash: null, voicePreview: { ...preview, prosody: structuredClone(body.prosody), revision, approved: false }, status: 'idle', message: '试听已生成，听审认可后才可用于成片。' })
          })
          return sendJson(response, 202, publicDraft(draft))
        }
        if (operation?.endsWith('/approve')) {
          const preview = draft.voicePreview
          if (preview.revision !== draft.revision || body.sha256 !== preview.sha256 || digest(await readFile(preview.audioPath)) !== preview.sha256) return sendJson(response, 409, { error: '试听版本或校验值不一致，请重新生成。' })
          preview.approved = true; await persist(draft); return sendJson(response, 200, publicDraft(draft))
        }
        if (operation === 'messages') {
          if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || !['local', 'api'].includes(body.mode)) return sendJson(response, 400, { error: '请填写 1～2000 字需求并选择模式。' })
          if (body.mode === 'api') {
            if (!replicaChatHealth(chatConfig).ready || body.consent?.provider !== chatConfig.model || typeof body.consent.shareImages !== 'boolean' || (body.consent.shareImages && !chatConfig.vision)) return sendJson(response, 409, { error: '模型未就绪，或本轮外发尚未确认。' })
            if (body.consent.shareImages && !draft.analysis?.frames.length) return sendJson(response, 409, { error: '参考视频尚未分析，不能发送代表帧。' })
            draft.status = 'chatting'; draft.confirmedRevision = null; draft.confirmedPlanHash = null; draft.error = null; await persist(draft)
            enqueue(draft, async (update) => {
              let result, requirements
              try {
                requirements = [...(draft.requirements || []), body.message.trim()].slice(-20)
                await audit.append({ kind: 'chat', provider: 'deepseek', model: chatConfig.model, fee: estimateChatCost(body.message).fee, feeUnit: '元（估算）', summary: `外发对话：${body.message.slice(0, 60)}${body.message.length > 60 ? '…' : ''}`, draftId: draft.id, owner })
                const images = body.consent.shareImages ? await Promise.all(draft.analysis.frames.filter((_, i) => [0, 2, 5].includes(i)).slice(0, 3).map(async (f) => `data:image/png;base64,${(await readFile(path.join(dir, `frame-${f.id}.png`))).toString('base64')}`)) : []
                result = await chat({ message: body.message, template: draft.template, analysis: draft.analysis, plan: draft.directorPlan, history: draft.messages, images, consent: body.consent }, chatConfig)
                const template = validateTemplate({ ...draft.template, ...result.patch })
                const pendingQuestion = result.questions[0] || (result.unhandled?.length ? { field: 'clarification', text: '仍有未处理要求；请通过编辑控件明确方案，再确认。' } : null)
                const questions = result.questions.map(({ field, text }) => ({ field, text }))
                let directorPlan = validateDirectorPlan(result.plan)
                directorPlan = directorPlan.route.kind === 'hypit-template'
                  ? buildDirectorPlan({ requirements, reference: planReference(draft.analysis), canvas: draft.canvas, template, questions, blockers: directorPlan.blockers })
                  : validateDirectorPlan({ ...directorPlan, requirements, reference: planReference(draft.analysis), questions })
                await update({ template, directorPlan, requirements, unresolved: directorPlan.blockers, revision: draft.revision + 1, confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, pendingQuestion, messages: [...draft.messages.slice(-10), { role: 'user', content: body.message }, { role: 'assistant', content: result.reply, mode: 'api' }], status: 'idle', message: '本轮方案已返回，请确认。' })
              } catch {
                await audit.append({ kind: 'chat', provider: 'deepseek', model: chatConfig.model, fee: estimateChatCost(body.message).fee, feeUnit: '元（估算）', summary: `外发对话未完成：${body.message.slice(0, 60)}${body.message.length > 60 ? '…' : ''}`, draftId: draft.id, owner, failed: true })
                await update({ status: 'failed', error: '本轮对话失败；没有修改模板或自动重试。', message: '本轮未完成。' })
              }
            })
            return sendJson(response, 202, publicDraft(draft))
          }
          // 本地向导为纯本地计算：直接处理，不占用全局渲染队列，也不被无关成片任务阻塞。
          Object.assign(draft, { status: 'chatting', confirmedRevision: null, confirmedPlanHash: null, error: null }); await persist(draft)
          try {
            const requirements = [...(draft.requirements || []), body.message.trim()].slice(-20)
            const memory = Array.isArray(body.memory) ? body.memory.filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(0, 5).map((m) => ({ text: m.text.trim().slice(0, 500), meta: m.meta && typeof m.meta === 'object' ? m.meta : {} })) : []
            const memoryPatch = {}
            for (const m of memory) {
              if (m.meta?.kind === 'background' && /^#[a-f0-9]{6}$/i.test(m.text)) memoryPatch.background = m.text.toLowerCase()
              if (m.meta?.kind === 'duration') { const n = Number(m.text); if (Number.isFinite(n) && n >= 0.5 && n <= 30) memoryPatch.duration = n }
            }
            const guide = guideTemplate(body.message, { ...draft.template, ...memoryPatch }, { pendingQuestion: draft.pendingQuestion })
            const autoPatch = body.auto === true ? autoResolveCopy(body.message, { ...draft.template, ...memoryPatch, ...guide.patch }) : {}
            const template = validateTemplate({ ...draft.template, ...memoryPatch, ...guide.patch, ...autoPatch })
            const unresolved = [...guide.unhandled]
            if (body.auto === true) {
              for (const [field, label] of [['title', '开场信息'], ['benefit', '核心信息'], ['action', '行动信息']]) {
                if (!template[field]) unresolved.push(`缺少${label}文案（${field === 'title' ? '标题' : field === 'benefit' ? '卖点' : '行动引导'}：…）。`)
              }
            }
            const pendingQuestion = guide.questions[0] || (unresolved.length ? { field: 'clarification', text: '仍有未处理要求；请通过编辑控件明确方案，再确认。' } : null)
            const questions = guide.questions.map(({ field, text }) => ({ field, text }))
            const reference = planReference(draft.analysis)
            const memoryReference = memory.length ? { summary: reference?.summary || '依据描述，未分析原片。', evidence: [...(reference?.evidence || []), ...memory.slice(0, 3).map((m) => ({ source: 'user', text: `记忆偏好（${m.meta?.kind || '用户偏好'}）：${m.text}` }))] } : reference
            const directorPlan = validateDirectorPlan(buildDirectorPlan({ requirements, reference: memoryReference, canvas: draft.canvas, template, questions, blockers: unresolved }))
            await audit.append({ kind: 'chat', provider: 'local', model: 'local-wizard', fee: 0, feeUnit: '零模型费', summary: `本地规划：${body.message.slice(0, 60)}${body.message.length > 60 ? '…' : ''}${body.auto === true ? '（一键全自动）' : ''}`, draftId: draft.id, owner })
            const evidenceNote = draft.analysis ? '依据参考视频的技术测量规划；文字、语音、人物和剧情仍未自动识别。' : '依据描述，未分析原片。'
            const autoNote = body.auto === true ? (directorPlan.status === 'executable' ? '已自动生成可执行方案；可在方案区直接确认并制作成片。' : '已自动提炼文案；仍缺的部分已列为待补项，不会编造。') : ''
            const reply = [evidenceNote, Object.keys(guide.patch).length || Object.keys(autoPatch).length ? '已提出模板修改，请检查预览后确认。' : '请补充具体修改。', autoNote, ...guide.questions.map((q) => q.text), ...unresolved.map((s) => `本地向导未处理：${s}。复杂镜头仅保留为待规划方案，不会假报成片。`)].join('\n')
            Object.assign(draft, {
              template, directorPlan, requirements, unresolved: directorPlan.blockers, revision: draft.revision + 1,
              confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, pendingQuestion,
              messages: [...draft.messages.slice(-10), { role: 'user', content: body.message }, { role: 'assistant', content: reply, mode: 'local' }],
              status: 'idle', message: body.auto === true ? '自动方案已返回。' : '本轮方案已返回，请确认。', error: null,
            })
            await persist(draft)
            return sendJson(response, 200, publicDraft(draft))
          } catch {
            Object.assign(draft, {
              status: 'failed', error: '本轮对话失败；没有修改模板或自动重试。',
              messages: [...draft.messages.slice(-10), { role: 'user', content: body.message }, { role: 'assistant', content: '本轮未完成。再次发送将是新请求。', failed: true }],
              message: '本轮未完成。',
            })
            await persist(draft)
            return sendJson(response, 200, publicDraft(draft))
          }
        }
        if (operation === 'analyze') {
          if (!draft.reference) return sendJson(response, 409, { error: '当前会话没有可分析的参考视频。' })
          Object.assign(draft, { status: 'analyzing', confirmedRevision: null, confirmedPlanHash: null, voicePreview: null, error: null }); await persist(draft)
          enqueue(draft, async (update) => {
            const analysis = await analyze(path.join(dir, 'input.mp4'), dir, update)
            const template = validateTemplate({ ...draft.template, background: analysis.background.stable ? analysis.background.color : draft.template.background, duration: Math.min(30, analysis.metadata.duration), ...(analysis.metadata.hasAudio ? {} : { audioMode: 'mute' }) })
            const canvas = canvasFromMetadata(analysis.metadata)
            const directorPlan = draft.requirements?.length ? buildDirectorPlan({ requirements: draft.requirements, reference: planReference(analysis), canvas, template, questions: draft.pendingQuestion ? [{ field: draft.pendingQuestion.field, text: draft.pendingQuestion.text }] : [], blockers: draft.unresolved }) : null
            await update({ analysis, reference: { ...draft.reference, metadata: analysis.metadata }, canvas, directorPlan, confirmedPlanHash: null, template, revision: draft.revision + 1, status: 'idle', progress: 100, message: '测量已完成；语义和文案仍需确认。' })
          })
          return sendJson(response, 202, publicDraft(draft))
        }
        if (operation === 'confirm') {
          let plan
          try { plan = validateDirectorPlan(draft.directorPlan) } catch { return sendJson(response, 409, { error: '请先完成可执行导演方案。' }) }
          if (plan.questions.length || draft.pendingQuestion || (plan.route.kind === 'hypit-template' && plan.blockers.length)) return sendJson(response, 409, { error: '请先解决未处理需求，再确认方案。' })
          if (plan.route.kind === 'hypit-template') {
            if (plan.status !== 'executable' || (!draft.reference && draft.template.audioMode === 'original') || (draft.template.audioMode === 'voice' && (!draft.voicePreview?.approved || draft.voicePreview.revision !== draft.revision))) return sendJson(response, 409, { error: '请先解决未处理需求、声音或生产路径。' })
          } else if (!plan.prompt || !plan.prompt.trim()) {
            return sendJson(response, 409, { error: '复杂镜头方案尚未完善，无法确认提交。' })
          }
          draft.confirmedRevision = draft.revision; draft.confirmedPlanHash = digest(JSON.stringify(plan)); await persist(draft); return sendJson(response, 200, publicDraft(draft))
        }
        if (operation === 'video-submit') {
          if (!videoHealth(videoConfig).ready) return sendJson(response, 409, { error: 'MiniMax H3 未配置或未启用。' })
          let directorPlan
          try { directorPlan = validateDirectorPlan(draft.directorPlan) } catch { return sendJson(response, 409, { error: '请先完成导演方案。' }) }
          if (directorPlan.route.kind === 'hypit-template') return sendJson(response, 409, { error: '图形模板方案请走本地 Hypit 渲染。' })
          if (directorPlan.status !== 'executable' && directorPlan.route.kind !== 'model-required' && directorPlan.route.kind !== 'video-model') return sendJson(response, 409, { error: '复杂镜头方案尚未就绪，无法提交生成。' })
          if (draft.confirmedRevision !== draft.revision || draft.confirmedPlanHash !== digest(JSON.stringify(directorPlan))) return sendJson(response, 409, { error: '请先确认当前方案后再提交生成。' })
          let estimate
          try { estimate = videoEstimate(directorPlan.canvas.duration) } catch (e) { return sendJson(response, 400, { error: e.message }) }
          if (body.confirmCostCny !== estimate.cny) return sendJson(response, 409, { error: '请确认当前方案的 MiniMax 费用预估。' })
          const seconds = estimate.seconds
          const ratio = ratioForCanvas(directorPlan.canvas.width, directorPlan.canvas.height)
          draft.status = 'submitting'
          const id = randomUUID(), taskDir = path.join(directory, id)
          try {
            await mkdir(taskDir)
            const job = { id, owner, kind: 'video', filename: draft.filename, createdAt: new Date().toISOString(), status: 'queued', message: '等待 MiniMax H3 生成', progress: 5, cost: null, taskId: null, directorPlan: structuredClone(directorPlan), canvas: structuredClone(directorPlan.canvas), draftRevision: draft.revision, video: { provider: 'minimax-h3', model: videoConfig.model, duration: seconds, ratio, resolution: '768P' } }
            await persist(job); jobs.set(id, job)
            await audit.append({ kind: 'video', provider: 'minimax-h3', model: videoConfig.model, fee: 0, feeUnit: '按量计费（以供应商账单为准）', summary: `提交 MiniMax 生成：${job.filename} · ${seconds} 秒 · ${ratio}`, draftId: draft.id, jobId: id, owner })
            enqueue(job, async (update) => {
              try {
                const { taskId } = await submitVideo({ prompt: directorPlan.prompt, duration: seconds, resolution: '768P', ratio }, videoConfig)
                await update({ taskId, status: 'running', message: `已提交 MiniMax（任务 ${taskId}），正在生成。`, progress: 10 })
                let last = 'queued'
                for (let attempt = 0; attempt < 90; attempt++) {
                  await new Promise((resolve) => setTimeout(resolve, 10_000))
                  const state = await queryVideo(taskId, videoConfig)
                  last = state.status
                  if (state.status === 'succeeded') {
                    await fetchVideo(state.url, path.join(taskDir, 'result.mp4'), videoConfig)
                    const videoSeconds = await probeDuration(path.join(taskDir, 'result.mp4')).catch(() => null)
                    await update({ status: 'complete', progress: 100, message: 'MiniMax 成片已生成并下载，请观看确认。', result: videoSeconds ? { duration: videoSeconds, audio: false } : null })
                    await audit.append({ kind: 'video', provider: 'minimax-h3', model: videoConfig.model, fee: 0, feeUnit: '按量计费（以供应商账单为准）', summary: `MiniMax 成片完成：${job.filename} · ${seconds} 秒`, draftId: draft.id, jobId: id, owner })
                    return
                  }
                  if (state.status === 'failed' || state.status === 'cancelled') throw new Error(state.error || `MiniMax 任务${state.status}。`)
                  await update({ progress: Math.min(90, 15 + attempt * 2), message: `MiniMax 生成中（${state.status}）。` })
                }
                throw new Error(`MiniMax 任务超时（最后状态 ${last}）。`)
              } catch (error) {
                await update({ status: 'failed', message: error.message, error: error.message, progress: job.progress })
                await audit.append({ kind: 'video', provider: 'minimax-h3', model: videoConfig.model, fee: 0, feeUnit: '按量计费（以供应商账单为准）', summary: `MiniMax 生成未完成：${job.filename}`, draftId: draft.id, jobId: id, owner, failed: true })
              }
            })
            return sendJson(response, 202, publicJob(job))
          } finally { draft.status = 'idle' }
        }
        if (operation === 'render') {
          let directorPlan
          try { directorPlan = validateDirectorPlan(draft.directorPlan) } catch { return sendJson(response, 409, { error: '请先确认当前可执行方案。' }) }
          const confirmedPlanHash = digest(JSON.stringify(directorPlan))
          if (draft.confirmedRevision !== draft.revision || draft.confirmedPlanHash !== confirmedPlanHash || directorPlan.status !== 'executable' || directorPlan.route.kind !== 'hypit-template' || (!draft.reference && draft.template.audioMode === 'original')) return sendJson(response, 409, { error: '当前方案、版本或确认校验值不一致。' })
          draft.status = 'rendering'
          const id = randomUUID(), taskDir = path.join(directory, id)
          try {
            await mkdir(taskDir)
            if (draft.reference) await copyFile(path.join(dir, 'input.mp4'), path.join(taskDir, 'input.mp4'))
            const job = { id, owner, kind: 'template', filename: draft.filename, createdAt: new Date().toISOString(), status: 'queued', message: '等待 Hypit 模板执行', progress: 0, cost: 0, template: structuredClone(draft.template), directorPlan: structuredClone(directorPlan), confirmedPlanHash, canvas: structuredClone(draft.canvas), reference: structuredClone(draft.reference), draftRevision: draft.revision }
            if (draft.template.audioMode === 'voice') {
              if (!draft.voicePreview?.approved || draft.voicePreview.revision !== draft.revision) return sendJson(response, 409, { error: '请先认可当前旁白试听。' })
              const { audioPath, ...preview } = draft.voicePreview
              await copyFile(audioPath, path.join(taskDir, 'voice.wav')); job.voicePreview = structuredClone(preview)
            }
            await persist(job); jobs.set(id, job)
            await audit.append({ kind: 'render', provider: 'local', model: 'hypit', fee: 0, feeUnit: '零模型费', summary: `本地渲染成片：${job.filename} · ${directorPlan.route.kind}`, draftId: draft.id, jobId: id, owner })
            enqueue(job, (update) => render(job, taskDir, update)); return sendJson(response, 202, publicJob(job))
          } finally { draft.status = 'idle' }
        }
        return sendJson(response, 405, { error: '不支持此操作。' })
      }

      if (url.pathname === '/api/replica/health' && request.method === 'GET') {
        const { tools } = toolHealth()
        const render = { ready: tools.ready, engine: tools.engine, version: tools.version, media: tools.media, paidGeneration: tools.paidGeneration, warming: tools.warming === true }
        const chat = replicaChatHealth(chatConfig)
        const video = videoHealth(videoConfig)
        const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([id, provider]) => [id, { ...provider, enabled: id === 'deepseek' ? chat.ready : id === 'minimax-h3' ? video.ready : provider.enabled }]))
        return sendJson(response, 200, { ...tools, planning: { ready: true }, render, chat, video, voice: await checkVoice(), rag: await ragClient.health(), routing: { providers } })
      }

      if (url.pathname === '/api/replica/rag/search' && request.method === 'POST') {
        let body
        try { body = await jsonBody(request) } catch (error) { return sendJson(response, 400, { error: error.message }) }
        const query = typeof body.query === 'string' ? body.query.trim() : ''
        const collection = ['assets', 'methodology', 'memory'].includes(body.collection) ? body.collection : 'methodology'
        const ragHealth = await ragClient.health()
        if (!query) return sendJson(response, 200, { ready: false, hits: [], query, rewritten_queries: [] })
        if (!ragHealth.ready) {
          return sendJson(response, 200, { ready: false, hits: [], query, rewritten_queries: [] })
        }
        try {
          const result = await ragClient.search(owner, collection, query, {
            top_k: body.top_k,
            filters: body.filters,
            rewrite: body.rewrite !== false,
          })
          return sendJson(response, 200, { ready: true, query, ...result })
        } catch (error) {
          return sendJson(response, 200, { ready: false, hits: [], query, rewritten_queries: [], error: error.message })
        }
      }

      if (url.pathname === '/api/replica/rag/memory' && request.method === 'POST') {
        let body
        try { body = await jsonBody(request) } catch (error) { return sendJson(response, 400, { error: error.message }) }
        const itemId = typeof body.item_id === 'string' && body.item_id ? String(body.item_id).slice(0, 80) : ''
        const text = typeof body.text === 'string' && body.text.trim() ? body.text.trim().slice(0, 2000) : ''
        if (!itemId || !text) return sendJson(response, 400, { error: '请提供 item_id 与记忆文本。' })
        const ragHealth = await ragClient.health()
        if (!ragHealth.ready) return sendJson(response, 200, { saved: false, ready: false, error: '知识库未就绪；偏好已保留在本轮会话。' })
        const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : {}
        try {
          await ragClient.ingest(owner, 'memory', [{ id: itemId, text, metadata: meta }])
          await audit.append({ kind: 'memory', provider: 'local-rag', model: ragHealth.model || 'bge-small-zh-v1.5', fee: 0, feeUnit: '零模型费', summary: `保存偏好记忆：${itemId} · ${text.slice(0, 40)}${text.length > 40 ? '…' : ''}`, owner })
          return sendJson(response, 200, { saved: true })
        } catch (error) {
          return sendJson(response, 200, { saved: false, error: error.message })
        }
      }

      if (url.pathname === '/api/replica/audit' && request.method === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200)
        const entries = (await audit.list({ limit })).filter(entry => entry.owner === owner).map(({ owner, ...visible }) => visible)
        return sendJson(response, 200, { entries })
      }

      if (url.pathname === '/api/replica/jobs' && request.method === 'GET') {
        return sendJson(response, 200, { jobs: [...jobs.values()].filter((job) => job.owner === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicJob) })
      }

      if (url.pathname === '/api/replica/jobs' && request.method === 'POST') {
        if (!capacity(owner)) return sendJson(response, 429, { error: '执行器正在处理任务，请完成后再上传。' })
        const active = [...jobs.values()].some((job) => job.owner === owner && !finalStates.has(job.status))
        if (active) return sendJson(response, 429, { error: '请等待当前复刻任务完成。' })
        const length = Number(request.headers['content-length'])
        if (!Number.isFinite(length) || length > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' })
        if (!request.headers['content-type']?.startsWith('multipart/form-data; boundary=')) return sendJson(response, 415, { error: '请上传视频文件。' })
        uploading++; uploads.add(owner)
        let jobDirectory
        try {
          const chunks = []
          let bytes = 0
          for await (const chunk of request) {
            bytes += chunk.length
            if (bytes > REPLICA_LIMITS.bytes + 64_000) return sendJson(response, 413, { error: '视频最多 25 MB。' })
            chunks.push(chunk)
          }
          let form
          try {
            form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'content-type': request.headers['content-type'] }, body: Buffer.concat(chunks) }).formData()
          } catch { return sendJson(response, 400, { error: '视频上传不完整，请重新选择文件。' }) }
          const video = form.get('video')
          if (!(video instanceof File) || !video.size || video.size > REPLICA_LIMITS.bytes || !/\.(mp4|mov|webm|m4v)$/i.test(video.name)) return sendJson(response, 400, { error: '请选择不超过 25 MB 的 MP4、MOV 或 WebM 视频。' })
          let options
          try { options = validateReplicaOptions(JSON.parse(form.get('options'))) } catch (error) { return sendJson(response, 400, { error: error instanceof SyntaxError ? '复刻选项格式无效。' : error.message }) }
          const id = randomUUID()
          jobDirectory = path.join(directory, id)
          await mkdir(jobDirectory)
          await writeFile(path.join(jobDirectory, 'input.mp4'), Buffer.from(await video.arrayBuffer()))
          const job = { id, owner, filename: path.basename(video.name).slice(0, 200), options, createdAt: new Date().toISOString(), status: 'queued', message: '视频已收到，等待本地执行器', progress: 0, cost: 0 }
          await persist(job)
          jobs.set(id, job)
          const update = async (patch) => { Object.assign(job, patch); await persist(job) }
          queue = queue.then(async () => {
            try { await render(job, jobDirectory, update) } catch (error) {
              const message = /^(请选择|字幕|亮点|开头|成片|本地执行器)/.test(error.message) && error.message.length < 160 ? error.message : '视频处理失败，请确认文件可播放，并检查本地执行服务。'
              await update({ status: 'failed', message, progress: job.progress, error: message })
              await writeFile(path.join(jobDirectory, 'error.log'), `${error.message}\n`).catch(() => {})
            }
          }).catch(() => {})
          return sendJson(response, 202, publicJob(job))
        } catch (error) {
          if (jobDirectory && !jobs.has(path.basename(jobDirectory))) await rm(jobDirectory, { recursive: true, force: true })
          throw error
        } finally { uploading--; uploads.delete(owner) }
      }

      const match = url.pathname.match(/^\/api\/replica\/jobs\/([a-f0-9-]+)(?:\/(input|result))?$/)
      if (!match || !idPattern.test(match[1])) return sendJson(response, 404, { error: '任务不存在。' })
      const job = jobs.get(match[1])
      if (!job || job.owner !== owner) return sendJson(response, 404, { error: '任务不存在。' })
      const jobDirectory = path.join(directory, job.id)
      if (!match[2] && request.method === 'GET') return sendJson(response, 200, publicJob(job))
      if (!match[2] && request.method === 'DELETE') {
        if (!finalStates.has(job.status)) return sendJson(response, 409, { error: '运行中的任务暂不能删除。' })
        // id is a generated UUID and jobDirectory is one direct child of this service's jobs directory.
        await rm(jobDirectory, { recursive: true })
        jobs.delete(job.id)
        return sendJson(response, 200, { deleted: true })
      }
      if (match[2] && ['GET', 'HEAD'].includes(request.method)) {
        if (match[2] === 'input' && job.reference === null) return sendJson(response, 404, { error: '此任务没有参考原片。' })
        if (match[2] === 'result' && job.status !== 'complete') return sendJson(response, 409, { error: '视频尚未完成。' })
        const file = path.join(jobDirectory, `${match[2] === 'input' ? 'input' : 'result'}.mp4`)
        const { size } = await stat(file)
        const headers = { 'content-type': 'video/mp4', 'cache-control': 'private, no-store', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff' }
        if (url.searchParams.has('download')) headers['content-disposition'] = `attachment; filename="replica-${job.id}.mp4"`
        let start = 0
        let end = size - 1
        if (request.headers.range) {
          const range = request.headers.range.match(/^bytes=(\d*)-(\d*)$/)
          if (!range || (!range[1] && !range[2])) { response.writeHead(416, { 'content-range': `bytes */${size}` }); return response.end() }
          if (!range[1]) start = Math.max(0, size - Number(range[2]))
          else start = Number(range[1])
          if (range[1] && range[2]) end = Math.min(end, Number(range[2]))
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) { response.writeHead(416, { 'content-range': `bytes */${size}` }); return response.end() }
          headers['content-range'] = `bytes ${start}-${end}/${size}`
        }
        response.writeHead(request.headers.range ? 206 : 200, { ...headers, 'content-length': end - start + 1 })
        if (request.method === 'HEAD') return response.end()
        const stream = createReadStream(file, { start, end })
        response.on('close', () => stream.destroy())
        stream.on('error', () => response.destroy())
        return stream.pipe(response)
      }
      return sendJson(response, 405, { error: '不支持此操作。' })
    } catch {
      if (!response.headersSent) sendJson(response, 500, { error: '复刻服务暂时不可用，请稍后重试。' })
      else response.destroy()
    }
  }
}

export function replicaApiPlugin() {
  return { name: 'portfolio-replica-api', apply: 'serve',
    async configureServer(server) { server.middlewares.use(await createReplicaApi()) },
    async configurePreviewServer(server) { server.middlewares.use(await createReplicaApi()) },
  }
}
