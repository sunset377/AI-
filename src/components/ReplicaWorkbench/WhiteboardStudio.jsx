import { useEffect, useState } from 'react'

export default function WhiteboardStudio({ requestApi, mediaUrl, handoff }) {
  const [library, setLibrary] = useState([])
  const [configured, setConfigured] = useState(false)
  const [selected, setSelected] = useState('')
  const [audio, setAudio] = useState(null)
  const [copy, setCopy] = useState('')
  const [ratio, setRatio] = useState('9:16')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  async function refresh() {
    try {
      const data = await requestApi('/whiteboard/library')
      setLibrary(data.items); setConfigured(data.configured); setError('')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (handoff) { setSelected(''); setCopy(handoff.copy); setConsent(false) }
  }, [handoff])
  useEffect(() => {
    if (!job?.id || ['done', 'complete', 'completed', 'error', 'cancelled'].includes(job.status)) return
    let disposed = false, running = false
    const timer = setInterval(async () => {
      if (running) return
      running = true
      try { const data = await requestApi(`/whiteboard/jobs/${job.id}`); if (!disposed) { setJob(data); setError('') } }
      catch (e) { if (!disposed) setError(e.message) }
      finally { running = false }
    }, 2500)
    return () => { disposed = true; clearInterval(timer) }
  }, [job?.id, job?.status])
  const entry = library.find(item => item.id === selected)
  const active = job && !['done', 'complete', 'completed', 'error', 'cancelled'].includes(job.status)
  const completed = ['done', 'complete', 'completed'].includes(job?.status)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const form = new FormData()
      if (entry) form.set('audioId', entry.id)
      else { form.set('audio', audio); form.set('copy', copy) }
      form.set('aspect_ratio', ratio); form.set('consent', consent ? 'paid-models' : '')
      const result = await requestApi('/whiteboard/jobs', { method: 'POST', body: form })
      setJob({ id: result.id, status: 'queued', stage: '等待画面制作', progress: 0 })
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <section className="rwPanel">
    <p className="rwEyebrow">CS BOARD · AUDIO LIBRARY</p>
    <h2>用一段旁白，制作白板视频</h2>
    <p>选择已完成的音频，或上传你自己的完整旁白。文案与声音逐字对应，画面跟随声音展开。</p>
    <div className="rwRouteGrid">{library.map(item => <article key={item.id}>
      <h3>{item.name}</h3><p>{item.duration} 秒 · 已有片段演示</p>
      <audio controls preload="none" src={mediaUrl(`/api/replica/whiteboard/audio/${item.id}`)} aria-label={`${item.name}试听`} style={{ width: '100%' }} />
      <button className="rwSecondary" type="button" disabled={busy || active} onClick={() => { setSelected(item.id); setConsent(false) }}>{selected === item.id ? '已选择这段音频' : '使用这段音频'}</button>
    </article>)}</div>
    <p className="rwHint">选择片段只使用其已有内容。新主题需要上传对应的新旁白。本人音色保存在私有本地库，尚未开放访客访问。</p>
    <form onSubmit={submit}>
      <fieldset disabled={busy || active} style={{ border: 0, padding: 0, display: 'grid', gap: 16 }}>
        <label>上传完整旁白（最多 25 MB、5 分钟）<input type="file" accept=".wav,.mp3,.m4a,.flac,.ogg" onChange={e => { setAudio(e.target.files[0] || null); setSelected(''); setConsent(false) }} /></label>
        <label>逐字文案<textarea rows={5} maxLength={5000} value={entry?.transcript ?? copy} readOnly={Boolean(entry)} onChange={e => { setCopy(e.target.value); setConsent(false) }} style={{ display: 'block', width: '100%' }} /></label>
        <label>视频画幅 <select value={ratio} onChange={e => { setRatio(e.target.value); setConsent(false) }}><option value="9:16">竖屏 9:16</option><option value="16:9">横屏 16:9</option><option value="1:1">方形 1:1</option></select></label>
        <p>白板制作会调用已配置的文本与图片模型，按供应商实际用量计费；当前尚无可靠总价预估。复杂镜头继续使用“导演 Agent”中的 MiniMax H3 入口。</p>
        <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />确认文案与音频一致，同意本次文案外发及文字、图片模型计费</label>
        <button className="rwPrimary" disabled={!configured || !consent || (!entry && (!audio || copy.trim().length < 10))}>{busy ? '提交中…' : '制作白板视频'}</button>
      </fieldset>
    </form>
    {!configured && <p role="status">画面模型尚未就绪。请在本机 CS Board 的 API 设置中配置文本与图片模型，然后<button type="button" onClick={refresh}>刷新状态</button>。</p>}
    {error && <p role="alert">{error}</p>}
    {job && <div aria-live="polite"><h3>{job.stage || '等待任务状态'}</h3><progress value={job.progress || 0} max="100" /><p>{job.error}</p>{completed && <><video controls src={mediaUrl(`/api/replica/whiteboard/jobs/${job.id}/download`)} style={{ width: '100%', maxHeight: 480 }} /><a href={mediaUrl(`/api/replica/whiteboard/jobs/${job.id}/download`)} download="whiteboard.mp4">下载成片</a></>}</div>}
  </section>
}
