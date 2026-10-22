import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { synthesizeNarration } from './f5-narration.js'

export function publicAudio(entries) {
  return entries.filter(e => e.visibility === 'demo').map(({ id, name, transcript, duration, synthesizable }) => ({ id, name, transcript, duration, ...(synthesizable ? { synthesizable:true } : {}) }))
}

export function publicBoardJob(job, id) {
  const result = { id }
  for (const key of ['status','stage','progress','duration','scenes','boards','total_elapsed','current_elapsed','timings','created_at','task_name','style']) if (job[key] !== undefined) result[key] = job[key]
  if (job.error) result.error = '生成未完成，请联系作者检查模型权限、额度和服务日志。未自动重新提交。'
  if (job.status === 'done') result.result_url = `/jobs/${id}/download`
  return result
}

export function createWhiteboardApi({ root, serveFile, sendJson, fetcher = fetch, synthesize = synthesizeNarration }) {
  const service = 'http://127.0.0.1:18765'
  const jobs = new Map()
  const pending = new Set()
  const narrations = new Map()
  let narrationBusy = false
  const catalog = async () => JSON.parse(await readFile(path.join(root, 'library.json'), 'utf8'))
  async function upstream(route, options) {
    const response = await fetcher(service + route, { signal: AbortSignal.timeout(30_000), ...options })
    if (!response.ok) throw new Error('白板服务未完成请求，请检查本地服务和模型配置。')
    return response.json()
  }
  async function jobFor(id, owner) {
    const job = jobs.get(id) || await readFile(path.join(root, 'tasks', `${id}.json`), 'utf8').then(JSON.parse).catch(() => null)
    return job?.owner === owner ? job : null
  }
  async function narrationFor(id, owner) {
    if (!/^[0-9a-f-]{36}$/.test(id || '')) return null
    const cached = narrations.get(id)
    const item = cached || await readFile(path.join(root,'narrations',id,'status.json'),'utf8').then(JSON.parse).catch(()=>null)
    if (!cached && item?.status==='running') { item.status='error';item.error='配音服务已重启，请重新生成试听。' }
    return item?.owner === owner ? item : null
  }
  return async (request, response, url, owner) => {
    const route = url.pathname.replace('/api/replica/whiteboard', '')
    if (route === '/narrations' && request.method === 'POST') {
      let size=0;const chunks=[];for await(const chunk of request){const buffer=Buffer.from(chunk);size+=buffer.length;if(size>16000)return sendJson(response,413,{error:'文案过长。'});chunks.push(buffer)}
      let data; try { data=JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return sendJson(response,400,{error:'请求格式无效。'}) }
      if (!data || Object.keys(data).some(k=>!['voiceId','text','consent'].includes(k)) || data.consent!=='local-f5') return sendJson(response,400,{error:'请确认使用本地 F5 合成所选声音。'})
      const text = typeof data.text === 'string' ? data.text.trim() : ''
      if (!text || text.length>1000) return sendJson(response,400,{error:'每次旁白请输入 1–1000 字，保持自然语速。'})
      const voice = (await catalog()).find(v=>v.id===data.voiceId&&v.visibility==='demo'&&v.synthesizable)
      if (!voice) return sendJson(response,400,{error:'请选择可配音的声音。'})
      if (narrationBusy) return sendJson(response,429,{error:'本地配音正在制作，请稍后再试。'})
      narrationBusy=true
      const id=randomUUID(), directory=path.join(root,'narrations',id)
      const item={id,owner,voiceId:voice.id,text,status:'running'}
      try { await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'status.json'),JSON.stringify(item)) } catch { narrationBusy=false;return sendJson(response,500,{error:'无法保存配音任务。'}) }
      narrations.set(id,item)
      void (async()=>{
        try { Object.assign(item,await synthesize({text,voice,root},directory),{status:'done'}) }
        catch { item.status='error';item.error='本地 F5 配音未完成，请联系作者检查；没有换声或自动重试。' }
        finally { narrationBusy=false;await writeFile(path.join(directory,'status.json'),JSON.stringify(item)).catch(()=>{}) }
      })()
      return sendJson(response,202,{id,status:'running'})
    }
    const narrationMatch=route.match(/^\/narrations\/([0-9a-f-]{36})(\/audio)?$/)
    if (narrationMatch && request.method==='GET') {
      const item=await narrationFor(narrationMatch[1],owner)
      if(!item)return sendJson(response,404,{error:'配音任务不存在。'})
      if(narrationMatch[2])return item.status==='done'?serveFile(request,response,item.audioPath,'audio/wav'):sendJson(response,409,{error:'配音尚未完成。'})
      return sendJson(response,200,{id:item.id,status:item.status,duration:item.duration,error:item.error,...(item.status==='done'?{audio_url:`/narrations/${item.id}/audio`}:{})})
    }
    if (route === '/config' && request.method === 'GET') {
      const config = await upstream('/api/config')
      return sendJson(response, 200, { api_key: '', image_api_key: '', has_api_key: Boolean(config.has_api_key), has_image_api_key: Boolean(config.has_image_api_key), text_model: config.text_model, image_model: config.image_model })
    }
    if (route === '/health' && request.method === 'GET') {
      const health = await upstream('/api/health')
      return sendJson(response, 200, { ready:true, queues:{ voice:{nodes:[]},model:{waiting:health.queues?.model?.waiting??0},render:{active:health.queues?.render?.active??0} } })
    }
    if (route === '/styles' && request.method === 'GET') {
      const data = await upstream('/api/styles?page_size=100')
      return sendJson(response, 200, { items: data.items.filter(s=>s.builtin).map(({id,name,description})=>({id,name,description,builtin:true,custom:false})) })
    }
    if (route === '/voices' && request.method === 'GET') return sendJson(response, 200, { items: publicAudio(await catalog()).map(item=>({...item,filename:`${item.id}.wav`,content_type:'audio/wav',size:0})) })
    if (route === '/jobs' && request.method === 'GET') {
      const files = await readdir(path.join(root,'tasks')).catch(()=>[])
      const records = await Promise.all(files.filter(f=>/^[0-9a-f-]{36}\.json$/.test(f)).map(f=>readFile(path.join(root,'tasks',f),'utf8').then(JSON.parse)))
      const owned = records.filter(r=>r.owner===owner).slice(-20)
      const items = await Promise.all(owned.map(async r=>publicBoardJob(await upstream(`/api/jobs/${r.upstreamId}`),r.id)))
      return sendJson(response,200,{items:items.reverse(),total:items.length,pages:1,page:1})
    }
    const voiceAudio = route.match(/^\/voices\/([a-z0-9-]+)\/audio$/)
    if (voiceAudio && request.method === 'GET') {
      const item = (await catalog()).find(e=>e.id===voiceAudio[1]&&e.visibility==='demo')
      if (!item) return sendJson(response,404,{error:'音频不可用。'})
      return serveFile(request,response,path.join(root,item.file),'audio/wav')
    }
    if (route === '/library' && request.method === 'GET') {
      let configured = false
      try { const config = await upstream('/api/config'); configured = Boolean(config.has_api_key && config.has_image_api_key) } catch { /* Offline remains visible. */ }
      return sendJson(response, 200, { items: publicAudio(await catalog()), configured })
    }
    const audio = route.match(/^\/audio\/([a-z0-9-]+)$/)
    if (audio && ['GET', 'HEAD'].includes(request.method)) {
      const item = (await catalog()).find(e => e.id === audio[1] && e.visibility === 'demo')
      if (!item) return sendJson(response, 404, { error: '音频不可用。' })
      return serveFile(request, response, path.join(root, item.file), 'audio/wav')
    }
    if (route === '/jobs' && request.method === 'POST') {
      if (pending.has(owner)) return sendJson(response, 409, { error: '本次提交处理中。' })
      pending.add(owner)
      try {
        let size = 0; const chunks = []
        for await (const chunk of request) {
          size += chunk.length
          if (size > 26 * 1024 * 1024) return sendJson(response, 413, { error: '音频最多 25 MB。' })
          chunks.push(chunk)
        }
        const form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': request.headers['content-type'] || '' }, body: Buffer.concat(chunks) }).formData()
        if (form.get('consent') !== 'paid-models') return sendJson(response, 400, { error: '请确认文字和图片模型调用费用。' })
        const config = await upstream('/api/config')
        if (!config.has_api_key || !config.has_image_api_key) return sendJson(response, 409, { error: '请先在本机 CS Board 配置文本与独立图片模型。' })
        const out = new FormData()
        const selected = (await catalog()).find(e => e.id === form.get('audioId') && e.visibility === 'demo')
        const script = String(form.get('copy') || '').trim()
        let audioBlob
        const narration = await narrationFor(String(form.get('narrationId')||''),owner)
        if (form.get('narrationId')) {
          if(!narration||narration.status!=='done'||narration.text!==script||narration.voiceId!==form.get('audioId')||form.get('narrationApproved')!=='true')return sendJson(response,409,{error:'文案或声音已改变，请重新配音试听并确认。'})
          audioBlob=new Blob([await readFile(narration.audioPath)],{type:'audio/wav'})
        } else if (selected) {
          if (script.replace(/\s+/g, '') !== selected.transcript.replace(/\s+/g, '')) return sendJson(response, 409, { error: '文案已修改，请上传与新文案一致的新旁白；不会把你的文字替换为示例原文。' })
          audioBlob = new Blob([await readFile(path.join(root, selected.file))], { type: 'audio/wav' })
        } else {
          const file = form.get('audio') || form.get('reference')
          if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024 || !/\.(wav|mp3|m4a|flac|ogg)$/i.test(file.name)) return sendJson(response, 400, { error: '请选择有效成品旁白。' })
          audioBlob = file
        }
        if (!script || script.length < 10 || script.length > 5000) return sendJson(response, 400, { error: '请填写 10–5000 字的逐字文案。' })
        out.set('copy', script)
        out.set('audio_mode', 'finished')
        out.set('reference', audioBlob, 'narration.wav')
        const ratio = form.get('aspect_ratio') || '9:16'
        if (!['9:16', '16:9', '1:1'].includes(ratio)) return sendJson(response, 400, { error: '画幅无效。' })
        out.set('aspect_ratio', ratio)
        const style = String(form.get('style') || '极简粗线简笔白板风')
        const styles = await upstream('/api/styles?page_size=100')
        if (!styles.items?.some(s=>s.builtin&&s.name===style)) return sendJson(response,400,{error:'请选择内置画面风格。'})
        out.set('style', style)
        const scenes = Number(form.get('scenes_per_image') || 1)
        if (!Number.isInteger(scenes)||scenes<1||scenes>4) return sendJson(response,400,{error:'分镜数量无效。'})
        out.set('scenes_per_image',String(scenes))
        out.set('task_name',String(form.get('task_name')||'').slice(0,30))
        out.set('pen_text',String(form.get('pen_text')||'').slice(0,12))
        for (const key of ['include_key_text','include_subtitles']) out.set(key, form.get(key)==='false'?'false':'true')
        const detail=String(form.get('stroke_detail')||'detailed')
        if (!['light','standard','detailed','full'].includes(detail)) return sendJson(response,400,{error:'线条选项无效。'})
        out.set('stroke_detail',detail)
        const job = await upstream('/api/jobs', { method: 'POST', body: out })
        const id = randomUUID(), record = { id, upstreamId: job.id, owner }
        await mkdir(path.join(root, 'tasks'), { recursive: true })
        await writeFile(path.join(root, 'tasks', `${id}.json`), JSON.stringify(record))
        jobs.set(id, record)
        return sendJson(response, 202, publicBoardJob({status:'queued',progress:1,stage:'成品旁白已提交，等待画面制作'}, id))
      } catch { return sendJson(response, 502, { error: '提交失败；未自动重试，请检查白板服务。' }) }
      finally { pending.delete(owner) }
    }
    const match = route.match(/^\/jobs\/([0-9a-f-]{36})(\/download)?$/)
    if (match && request.method === 'GET') {
      const record = await jobFor(match[1], owner)
      if (!record) return sendJson(response, 404, { error: '任务不存在。' })
      if (match[2]) {
        const result = await fetcher(`${service}/api/jobs/${record.upstreamId}/download`, { signal: AbortSignal.timeout(120_000) })
        if (!result.ok) return sendJson(response, 409, { error: '成片尚未就绪。' })
        response.writeHead(200, { 'content-type': 'video/mp4', 'cache-control': 'private, no-store' })
        const { Readable } = await import('node:stream')
        const stream = Readable.fromWeb(result.body)
        response.on('close', () => stream.destroy()); stream.on('error', () => response.destroy()); stream.pipe(response)
        return
      }
      const job = await upstream(`/api/jobs/${record.upstreamId}`)
      return sendJson(response, 200, publicBoardJob(job,record.id))
    }
    return sendJson(response, 404, { error: '白板接口不存在。' })
  }
}
