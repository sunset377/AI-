import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { REPLICA_LIMITS, validateReplicaOptions } from '../src/replica.js'
import { checkReplicaTools, HYPIT_PROJECT, renderReplica } from './replica-render.js'
import { DEFAULT_TEMPLATE, validateTemplate, guideTemplate } from '../src/replica-template.js'
import { analyzeReplica } from './replica-analysis.js'
import { chatReplica, readReplicaChatConfig, replicaChatHealth } from './replica-chat.js'

const finalStates = new Set(['complete', 'failed'])
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const digest = (value) => createHash('sha256').update(value).digest('hex')

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  response.end(JSON.stringify(body))
}

export async function createReplicaApi({ directory = path.join(HYPIT_PROJECT, 'jobs'), render = renderReplica, checkTools = checkReplicaTools, analyze = analyzeReplica, chatConfig, chat = chatReplica } = {}) {
  await mkdir(directory, { recursive: true })
  chatConfig ||= await readReplicaChatConfig()
  const jobs = new Map()
  const drafts = new Map()
  const uploads = new Set()
  const writes = new Map()
  const draftBusy = (d) => ['queued', 'analyzing', 'chatting', 'voicing', 'deleting', 'rendering'].includes(d.status)
  const active = () => [...jobs.values()].filter((j) => !finalStates.has(j.status)).concat([...drafts.values()].filter(draftBusy))
  const capacity = (owner) => uploading < 2 && active().length + uploads.size < 3 && !uploads.has(owner) && !active().some((d) => d.owner === owner)
  let uploading = 0
  let queue = Promise.resolve()
  let healthAt = 0
  let health

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
      if (job.kind === 'draft' ? draftBusy(job) : !finalStates.has(job.status)) {
        Object.assign(job, { status: 'failed', message: '执行服务已重启，此任务已中断。请重新创建任务。' })
        await persist(job)
      }
      ;(job.kind === 'draft' ? drafts : jobs).set(job.id, job)
    } catch { /* A partially uploaded job is not a usable task. */ }
  }

  function publicJob(job) {
    const { owner, ...visible } = job
    return { ...visible, inputUrl: `/api/replica/jobs/${job.id}/input`, resultUrl: job.status === 'complete' ? `/api/replica/jobs/${job.id}/result` : null }
  }

  function publicDraft(draft) {
    const { id, filename, createdAt, status, message, progress, revision, confirmedRevision, analysis, template, messages, pendingQuestion, error } = draft
    return { id, kind: 'draft', filename, createdAt, status, message, progress, revision, confirmedRevision, analysis, template, messages, pendingQuestion, error, inputUrl: `/api/replica/drafts/${id}/input`, frames: analysis?.frames.map((frame) => ({ ...frame, url: `/api/replica/drafts/${id}/frames/${frame.id}` })) || [] }
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

      if (url.pathname === '/api/replica/drafts' && request.method === 'GET') return sendJson(response, 200, { drafts: [...drafts.values()].filter((d) => d.owner === owner).map(publicDraft) })
      if (url.pathname === '/api/replica/drafts' && request.method === 'POST') {
        if (!capacity(owner) || drafts.size + uploads.size >= 50 || [...drafts.values()].filter((d) => d.owner === owner).length >= 10) return sendJson(response, 429, { error: '草稿或操作已达上限，请等待或清理草稿。' })
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
          await writeFile(path.join(draftDirectory, 'input.mp4'), Buffer.from(await video.arrayBuffer()))
          const draft = { id, owner, kind: 'draft', schemaVersion: 2, filename: path.basename(video.name).slice(0, 200), createdAt: new Date().toISOString(), status: 'idle', message: '请先分析原片，再确认文案。', progress: 0, revision: 1, confirmedRevision: null, analysis: null, template: { ...DEFAULT_TEMPLATE }, messages: [], pendingQuestion: null }
          await persist(draft); drafts.set(id, draft); return sendJson(response, 201, publicDraft(draft))
        } finally { uploading--; uploads.delete(owner); if (draftDirectory && !drafts.has(path.basename(draftDirectory))) await rm(draftDirectory, { recursive: true, force: true }) }
      }
      const draftMatch = url.pathname.match(/^\/api\/replica\/drafts\/([a-f0-9-]+)(?:\/(input|analyze|confirm|render|messages|frames\/[0-5]))?$/)
      if (draftMatch && idPattern.test(draftMatch[1])) {
        const draft = drafts.get(draftMatch[1])
        if (!draft || draft.owner !== owner) return sendJson(response, 404, { error: '草稿不存在。' })
        const dir = path.join(directory, draft.id), operation = draftMatch[2]
        if (!operation && request.method === 'GET') return sendJson(response, 200, publicDraft(draft))
        if (['input', ...[0, 1, 2, 3, 4, 5].map((i) => `frames/${i}`)].includes(operation) && ['GET', 'HEAD'].includes(request.method)) {
          if (operation !== 'input' && !draft.analysis?.frames.some((f) => `frames/${f.id}` === operation)) return sendJson(response, 404, { error: '代表帧尚未就绪。' })
          return serveFile(request, response, path.join(dir, operation === 'input' ? 'input.mp4' : `frame-${operation.split('/')[1]}.png`), operation === 'input' ? 'video/mp4' : 'image/png')
        }
        if (!operation && request.method === 'DELETE') {
          if (draftBusy(draft)) return sendJson(response, 409, { error: '操作中的草稿不能删除。' })
          draft.status = 'deleting'; await (writes.get(draft.id) || Promise.resolve()); await rm(dir, { recursive: true }); drafts.delete(draft.id); return sendJson(response, 200, { deleted: true })
        }
        if (request.method !== 'POST' && !(request.method === 'PATCH' && !operation)) return sendJson(response, 405, { error: '不支持此操作。' })
        let body
        try { body = await jsonBody(request) } catch { return sendJson(response, 400, { error: '请求格式无效或过大。' }) }
        const allowed = operation === 'messages' ? ['revision', 'message', 'mode', 'consent'] : !operation ? ['revision', 'template'] : ['revision']
        if (Object.keys(body).some((key) => !allowed.includes(key))) return sendJson(response, 400, { error: '请求包含无效字段。' })
        if (['analyze', 'render', 'messages'].includes(operation) && !capacity(owner)) return sendJson(response, 429, { error: '请等待当前操作完成。' })
        if (draftBusy(draft)) return sendJson(response, 409, { error: '操作中的草稿不能修改。' })
        if (!Number.isInteger(body.revision) || body.revision !== draft.revision) return sendJson(response, 409, { error: '方案已更新，请刷新后重新确认。' })
        if (!operation && request.method === 'PATCH') {
          let template
          try { if (!body.template || typeof body.template !== 'object' || Array.isArray(body.template)) throw new Error(); template = validateTemplate({ ...draft.template, ...body.template }) } catch { return sendJson(response, 400, { error: '模板配置无效。' }) }
          Object.assign(draft, { template, revision: draft.revision + 1, confirmedRevision: null, voicePreview: null, pendingQuestion: null, status: 'idle', error: null })
          await persist(draft); return sendJson(response, 200, publicDraft(draft))
        }
        if (operation === 'messages') {
          if (!draft.analysis || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 || !['local', 'api'].includes(body.mode)) return sendJson(response, 400, { error: '先分析，再填写 1～2000 字修改需求并选择模式。' })
          if (body.mode === 'api' && (!replicaChatHealth(chatConfig).ready || body.consent?.provider !== chatConfig.model || typeof body.consent.shareImages !== 'boolean' || (body.consent.shareImages && !chatConfig.vision))) return sendJson(response, 409, { error: '模型未就绪，或本轮外发尚未确认。' })
          draft.status = 'chatting'; draft.confirmedRevision = null; draft.error = null; await persist(draft)
          enqueue(draft, async (update) => {
            let result
            try {
              if (body.mode === 'local') {
                const guide = guideTemplate(body.message, draft.template, { pendingQuestion: draft.pendingQuestion })
                result = { ...guide, reply: [Object.keys(guide.patch).length ? '已提出模板修改，请检查预览后确认。' : '请补充具体修改。', ...guide.questions.map((q) => q.text), ...guide.unhandled.map((s) => `本地向导未处理：${s}。请使用编辑控件，或选择已配置的模型讨论。`)].join('\n') }
              } else {
                const images = body.consent.shareImages ? await Promise.all(draft.analysis.frames.filter((_, i) => [0, 2, 5].includes(i)).slice(0, 3).map(async (f) => `data:image/png;base64,${(await readFile(path.join(dir, `frame-${f.id}.png`))).toString('base64')}`)) : []
                result = await chat({ message: body.message, template: draft.template, analysis: draft.analysis, history: draft.messages, images, consent: body.consent }, chatConfig)
              }
              const template = validateTemplate({ ...draft.template, ...result.patch })
              const pendingQuestion = result.questions[0] || (result.unhandled?.length ? { field: 'clarification', text: '仍有未处理要求；请通过编辑控件明确方案，再确认。' } : null)
              await update({ template, revision: draft.revision + 1, voicePreview: null, pendingQuestion, messages: [...draft.messages.slice(-10), { role: 'user', content: body.message }, { role: 'assistant', content: result.reply, mode: body.mode }], status: 'idle', message: '本轮方案已返回，请确认。' })
            } catch {
              await update({ status: 'failed', error: '本轮对话失败；没有修改模板或自动重试。', messages: [...draft.messages.slice(-10), { role: 'user', content: body.message }, { role: 'assistant', content: '本轮未完成。再次发送将是新请求，可能再次计费。', failed: true }], message: '本轮未完成。' })
            }
          })
          return sendJson(response, 202, publicDraft(draft))
        }
        if (operation === 'analyze') {
          Object.assign(draft, { status: 'analyzing', confirmedRevision: null, voicePreview: null, error: null }); await persist(draft)
          enqueue(draft, async (update) => {
            const analysis = await analyze(path.join(dir, 'input.mp4'), dir, update)
            const template = validateTemplate({ ...draft.template, background: analysis.background.stable ? analysis.background.color : draft.template.background, duration: analysis.metadata.duration })
            await update({ analysis, template, revision: draft.revision + 1, status: 'idle', progress: 100, message: '测量已完成；请确认原片文案。' })
          })
          return sendJson(response, 202, publicDraft(draft))
        }
        if (operation === 'confirm') {
          if (!draft.analysis || draft.pendingQuestion || draft.template.audioMode === 'voice') return sendJson(response, 409, { error: '请先完成分析、未处理需求和声音确认。' })
          draft.confirmedRevision = draft.revision; await persist(draft); return sendJson(response, 200, publicDraft(draft))
        }
        if (operation === 'render') {
          if (!draft.analysis || draft.confirmedRevision !== draft.revision) return sendJson(response, 409, { error: '请先确认当前方案。' })
          draft.status = 'rendering'
          const id = randomUUID(), taskDir = path.join(directory, id)
          try {
            await mkdir(taskDir); await copyFile(path.join(dir, 'input.mp4'), path.join(taskDir, 'input.mp4'))
            const job = { id, owner, kind: 'template', filename: draft.filename, createdAt: new Date().toISOString(), status: 'queued', message: '等待 Hypit 模板执行', progress: 0, cost: 0, template: structuredClone(draft.template), source: structuredClone(draft.analysis.metadata), draftRevision: draft.revision }
            await persist(job); jobs.set(id, job)
            enqueue(job, (update) => render(job, taskDir, update)); return sendJson(response, 202, publicJob(job))
          } finally { draft.status = 'idle' }
        }
        return sendJson(response, 405, { error: '不支持此操作。' })
      }

      if (url.pathname === '/api/replica/health' && request.method === 'GET') {
        if (!health || Date.now() - healthAt > 30_000) {
          healthAt = Date.now()
          health = await checkTools().catch((error) => ({ ready: false, error: error.message.startsWith('本地执行器') ? error.message : '本地执行服务尚未准备好 Hypit 和 FFmpeg。' }))
        }
        return sendJson(response, 200, { ...health, chat: replicaChatHealth(chatConfig) })
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
