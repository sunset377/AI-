import WhiteboardStudio from './WhiteboardStudio'
import { useEffect, useMemo, useRef, useState } from 'react'
import { REPLICA_LIMITS, planReplica, validateReplicaOptions } from '../../replica'
import './ReplicaWorkbench.css'
import TemplateEditor from './TemplateEditor'

const API = (import.meta.env.VITE_REPLICA_API_URL || '/api/replica').replace(/\/$/, '')
const modes = [
  { value: 'original', icon: '01', title: '原片顺序', caption: '保留完整顺序，用标题、字幕与包装改变观感。', color: 'blue' },
  { value: 'fast', icon: '02', title: '紧凑开场', caption: '前 1 秒加速至 1.35 倍，随后回到原片节奏。', color: 'coral' },
  { value: 'highlight', icon: '03', title: '亮点前置', caption: '把你选中的 1 秒片段移到开头，其余画面不重复。', color: 'violet' },
]

export async function requestApi(path, options) {
  let response
  try { response = await fetch(`${API}${path}`, { credentials: 'include', ...options }) }
  catch { throw new Error('视频执行服务连接中断，请检查服务后重试。') }
  let data
  try { data = await response.json() } catch { throw new Error('此页面尚未连接视频执行服务，仍可选择视频并本地预览。') }
  if (!response.ok) throw new Error(data.error || '视频执行服务暂时不可用。')
  return data
}

function mediaUrl(url) { return url ? `${API}${url.replace('/api/replica', '')}` : undefined }

function StyledPreview({ url, plan, options }) {
  const video = useRef(null)
  const segmentIndex = useRef(0)
  const [time, setTime] = useState(0)
  useEffect(() => {
    segmentIndex.current = 0
    setTime(0)
    if (video.current && plan) {
      video.current.pause()
      video.current.currentTime = plan.segments[0].start
      video.current.playbackRate = plan.segments[0].rate
    }
  }, [plan, url])
  const updateTime = (reachedEnd = false) => {
    if (!plan) return
    const element = video.current
    const index = segmentIndex.current
    const segment = plan.segments[index]
    const offset = plan.segments.slice(0, index).reduce((sum, item) => sum + (item.end - item.start) / item.rate, 0)
    setTime(offset + Math.max(0, element.currentTime - segment.start) / segment.rate)
    if ((!element.paused || reachedEnd) && element.currentTime >= segment.end - 0.02) {
      if (index + 1 < plan.segments.length) {
        segmentIndex.current++
        const next = plan.segments[index + 1]
        element.currentTime = next.start
        element.playbackRate = next.rate
        if (reachedEnd) element.play().catch(() => {})
      } else { element.pause(); setTime(plan.outputDuration) }
    }
  }
  const start = () => {
    if (!plan || !video.current) return
    segmentIndex.current = 0
    video.current.currentTime = plan.segments[0].start
    video.current.playbackRate = plan.segments[0].rate
    setTime(0)
    video.current.play().catch(() => {})
  }
  const cue = plan?.captions.find((item) => time >= item.start && time < item.end)
  return <>
    <div className={`rwStyledVideo rwStyledVideo--${options.style}`}>
      <video ref={video} src={url} playsInline muted={!options.keepAudio} preload="metadata" onTimeUpdate={() => updateTime()}
        onLoadedMetadata={() => { if (plan) video.current.currentTime = plan.segments[0].start }} onEnded={() => updateTime(true)} aria-label="包装效果预览" />
      {options.title && time < Math.min(1.5, plan?.outputDuration || 1.5) && <span className="rwPreviewTitle">{options.title}</span>}
      {cue && <span className="rwPreviewCaption">{cue.text}</span>}
    </div>
    <div className="rwPreviewControls"><button type="button" onClick={start} disabled={!plan}>播放完整预览</button><button type="button" onClick={() => video.current?.pause()}>暂停</button><span>{time.toFixed(1)} / {(plan?.outputDuration || 0).toFixed(1)} s</span></div>
    <p className="rwHint">预览在浏览器中播放；导出时会烧录字幕与包装，精确剪辑由 Hypit 执行。</p>
  </>
}

export function ResultComparison({ currentJob, mediaUrl }) {
  return <div className={`rwCompare ${currentJob.inputUrl ? '' : 'rwCompare--outputOnly'}`}>
    {currentJob.inputUrl ? <div><p className="rwEyebrow">01 / 原片</p><video src={mediaUrl(currentJob.inputUrl)} controls playsInline preload="metadata" aria-label="对比原片" /></div> : <div className="rwNoSource"><p className="rwEyebrow">REFERENCE</p><strong>本次无参考原片</strong><span>这个版本从文字方案开始，由本地 Hypit 绘制。</span></div>}
    <div><p className="rwEyebrow">{currentJob.inputUrl ? '02' : '01'} / 复刻版</p>{currentJob.resultUrl ? <video src={mediaUrl(currentJob.resultUrl)} controls playsInline preload="metadata" aria-label="Hypit 复刻成片" /> : <div className="rwPending"><span>{currentJob.status === 'failed' ? '!' : 'R'}</span><p>{currentJob.status === 'failed' ? '本次任务未生成可用成片' : '实际生成完成后显示成片'}</p></div>}</div>
  </div>
}

export default function ReplicaWorkbench({ onBack, initialRequirement = '' }) {
  useEffect(() => {
    const previous = document.title
    document.title = '视频复刻工作台'
    return () => { document.title = previous }
  }, [])
  const [tab, setTab] = useState('template')
  const [file, setFile] = useState(null)
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [options, setOptions] = useState({ opening: 'fast', highlightStart: 0, title: '', captions: '', style: 'blue', keepAudio: true })
  const [health, setHealth] = useState(null)
  const [whiteboardHandoff, setWhiteboardHandoff] = useState(null)
  const [checking, setChecking] = useState(false)
  const [jobs, setJobs] = useState([])
  const [audit, setAudit] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pollError, setPollError] = useState('')
  const fileInput = useRef(null)
  const requestInFlight = useRef(false)
  const selected = jobs.find((job) => job.id === selectedId)
  const active = jobs.find((job) => !['complete', 'failed', 'submission_uncertain'].includes(job.status))
  const busy = uploading || !!active
  const preview = useMemo(() => {
    if (!duration) return { plan: null, error: '' }
    try { return { plan: planReplica(duration, validateReplicaOptions(options)), error: '' } }
    catch (error) { return { plan: null, error: error.message } }
  }, [duration, options])

  useEffect(() => {
    if (!file) { setUrl(''); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  const connect = async () => {
    setChecking(true)
    try {
      const result = await requestApi('/health')
      setHealth(result)
      setJobs((await requestApi('/jobs')).jobs); setAudit((await requestApi('/audit?limit=50')).entries); setPollError('')
    } catch (error) { setHealth({ ready: false, planning: { ready: false }, render: { ready: false }, error: error.message }) }
    finally { setChecking(false) }
  }

  useEffect(() => { connect() }, [])
  useEffect(() => {
    if (!active || !health?.planning?.ready) return
    let disposed = false
    let controller
    const timer = window.setInterval(async () => {
      if (requestInFlight.current) return
      requestInFlight.current = true
      controller = new AbortController()
      try {
        const result = await requestApi('/jobs', { signal: controller.signal })
        if (!disposed) { setJobs(result.jobs); setPollError('') }
      } catch (error) { if (!disposed) setPollError(error.message) }
      finally { requestInFlight.current = false }
    }, 1500)
    return () => { disposed = true; window.clearInterval(timer); controller?.abort() }
  }, [active?.id, health?.planning?.ready])

  const choose = (candidate) => {
    if (!candidate || busy) return
    setError('')
    setDuration(0)
    if (!/\.(mp4|mov|webm|m4v)$/i.test(candidate.name) || candidate.size > REPLICA_LIMITS.bytes || !candidate.size) {
      setFile(null)
      setError('请选择不超过 25 MB 的 MP4、MOV 或 WebM 视频。')
      return
    }
    setFile(candidate)
    setSelectedId(null)
    setOptions((current) => ({ ...current, highlightStart: 0 }))
  }

  const submit = async () => {
    if (!file || !preview.plan || busy || !health?.ready) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('video', file)
      form.append('options', JSON.stringify(validateReplicaOptions(options)))
      const job = await requestApi('/jobs', { method: 'POST', body: form })
      setJobs((previous) => [job, ...previous])
      setSelectedId(job.id)
      setTab('result')
    } catch (error) { setError(error.message) }
    finally { setUploading(false) }
  }

  const remove = async (job) => {
    if (!window.confirm('永久删除此任务的上传、成片和工作数据？草稿和你的原始视频不受影响。')) return
    try {
      await requestApi(`/jobs/${job.id}`, { method: 'DELETE' })
      setJobs((previous) => previous.filter((item) => item.id !== job.id))
      if (selectedId === job.id) setSelectedId(null)
    } catch (error) { setError(error.message) }
  }

  const field = (name, value) => setOptions((previous) => ({ ...previous, [name]: value }))
  const currentJob = selected || active
  return (
    <main className="replicaWorkbench">
      <aside className="rwRail">
        <button className="rwBrand" type="button" onClick={onBack} aria-label="返回视频智能体"><span className="rwBrandMark">R</span><strong>MOMOCO 视频导演</strong></button>
        <div className="rwRailCopy"><p>ONE IDEA IN</p><div>Plan it.<br />Make it real.</div><span>说出想法，可选一段参考。</span></div>
        <nav className="rwNav" aria-label="工作台导航">
          {[
            ['template', 'R', '导演 Agent', '想法 · 对话 · 方案 · 成片'],
            ['whiteboard', '声', '白板与音频库', '试听 · 成品旁白 · 白板视频'],
            ['create', '剪', '原片剪辑包装', '旧版 · 节奏 · 字幕包装'],
            ['result', '▶', '结果工作台', '真实成片 · 原片对比'],
            ['history', '记', '运行记录', '状态 · 任务 · 文件管理'],
            ['engine', 'API', '执行与模型', '本地优先 · 按需升级'],
          ].map(([id, icon, title, subtitle]) => <button key={id} type="button" className={tab === id ? 'isActive' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setError('') }}><span className="rwNavIcon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span></button>)}
        </nav>
        <div className="rwRailFoot"><span className="rwDot" /><div><strong>默认零模型调用费</strong><small>Hypit 剪辑 · 本地包装<br />复杂镜头另行升级</small></div></div>
        <button className="rwBack" type="button" onClick={onBack}>← {initialRequirement ? '返回白板智能体' : '返回作品集'}</button>
      </aside>

      <div className="rwMain">
        <header className="rwHeader"><div><p className="rwEyebrow">HYPIT VIDEO WORKBENCH · 03</p><h1>{({ template: '看懂结构，做出你的版本。', create: '留住画面，换个开场。', result: '你的新版本，在这里。', history: '每一次制作，都有记录。', engine: '本地先做，按需升级。' })[tab]}</h1><p className="rwIntro">{({ template: '先输入想法，参考视频可选。导演 Agent 会反馈、追问并生成结构化方案；支持的图形模板确认后由本地 Hypit 制作成片。', create: '上传一个短片，调整开头节奏、字幕和视觉包装。先做一个版本，满意后再导出。', result: '有参考时并排对比；无参考时直接展示真实成片。', history: '只展示当前浏览器的任务。文件保存在执行服务，可在任务完成后删除。', engine: '本地模板和剪辑不调用视频大模型；可选语言模型每轮确认后才发出请求。' })[tab]}</p></div><span className={`rwStatus ${health?.ready ? 'isReady' : ''}`}><i />{checking ? '检查执行服务' : health?.ready ? '本地执行器已连接' : '仅本地预览'}</span></header>

        {error && <p className="rwAlert" role="alert">{error}</p>}
        {pollError && <p className="rwAlert" role="alert">{pollError} 已提交任务不会自动重试。<button type="button" onClick={connect}>重新连接</button></p>}

        <div hidden={tab !== 'template'}><TemplateEditor initialRequirement={initialRequirement} onWhiteboard={(copy) => { setWhiteboardHandoff({ copy }); setTab('whiteboard') }} health={health} requestApi={requestApi} mediaUrl={mediaUrl} jobBusy={busy} onJob={(job) => { setJobs((all) => [job, ...all]); setSelectedId(job.id); setTab('result') }} /></div>

        <div hidden={tab !== 'whiteboard'}><WhiteboardStudio requestApi={requestApi} mediaUrl={mediaUrl} handoff={whiteboardHandoff} /></div>

        {tab === 'create' && <>
          <div className="rwCreateGrid">
            <section className="rwPanel rwSource" aria-labelledby="rw-source-title">
              <div className="rwPanelHead"><div><p className="rwEyebrow">REFERENCE VIDEO</p><h2 id="rw-source-title">先放入你的原片</h2></div><span className="rwPill">01 / 输入</span></div>
              <input ref={fileInput} className="rwFileInput" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" aria-label="选择参考视频" disabled={busy} onChange={(event) => { choose(event.target.files[0]); event.target.value = '' }} />
              {url ? <div className="rwUploaded"><video src={url} controls playsInline preload="metadata" aria-label="参考视频原片" onLoadedMetadata={(event) => {
                const value = event.currentTarget.duration
                if (!Number.isFinite(value) || value < 0.5 || value > REPLICA_LIMITS.seconds + 0.05) { setDuration(0); setError(`视频时长 ${Number.isFinite(value) ? value.toFixed(1) : '未知'} 秒，最长 ${REPLICA_LIMITS.seconds} 秒；请更换视频，或改用导演 Agent 截取前 ${REPLICA_LIMITS.seconds} 秒。`) } else { setDuration(value); setError('') }
              }} onError={() => { setDuration(0); setError('浏览器无法播放这段视频，请更换为 H.264 编码的 MP4。') }} /><div className="rwFileMeta"><strong>{file?.name}</strong><span>{duration ? `${duration.toFixed(1)} 秒 · ` : ''}{(file.size / 1024 / 1024).toFixed(1)} MB</span></div><button type="button" className="rwSecondary" disabled={busy} onClick={() => fileInput.current.click()}>更换视频</button></div> :
                <button className={`rwDropzone${dragging ? ' isDragging' : ''}`} type="button" disabled={busy} onClick={() => fileInput.current.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}><span className="rwUploadIcon">↑</span><strong>把源视频放在这里</strong><span>拖入文件，或点击选择视频</span><small>MP4 / MOV / WebM · 最长 30 秒 · 最大 25 MB<br />建议用 3～5 秒片段开始体验</small><span className="rwChooseButton">选择视频 ↗</span></button>}
              <div className="rwSourceNote"><span>原片画面保留</span><p>调整剪辑顺序和节奏，不自动替换人物、场景或声音身份。</p></div>
            </section>

            <section className="rwPanel rwEditor" aria-labelledby="rw-editor-title">
              <div className="rwPanelHead"><div><p className="rwEyebrow">MAKE YOUR VERSION</p><h2 id="rw-editor-title">给它一个新的节奏</h2></div><span className="rwPill rwFree">¥ 0 模型费</span></div>
              <fieldset className="rwModes" disabled={busy}><legend>开头方式</legend>{modes.map((mode) => <label className={`rwMode ${options.opening === mode.value ? 'isSelected' : ''}`} key={mode.value}><input type="radio" name="opening" value={mode.value} checked={options.opening === mode.value} onChange={() => field('opening', mode.value)} /><span className={`rwModeIcon ${mode.color}`}>{mode.icon}</span><span><strong>{mode.title}</strong><small>{mode.caption}</small></span><span className="rwRadio" /></label>)}</fieldset>
              {options.opening === 'highlight' && <label className="rwField rwSlider">从原片第 {options.highlightStart.toFixed(1)} 秒取亮点<input type="range" min="0" max={Math.max(0, duration - 0.1)} step="0.1" value={options.highlightStart} disabled={busy} onChange={(event) => field('highlightStart', Number(event.target.value))} /></label>}
              <div className="rwTextFields"><label className="rwField">开头标题 <span>可选 · 前 1.5 秒</span><input value={options.title} maxLength={40} placeholder="写一句让人停下来的话" disabled={busy} onChange={(event) => field('title', event.target.value)} /></label><label className="rwField">字幕文案 <span>可选 · 每行一条</span><textarea value={options.captions} maxLength={1000} rows={3} placeholder={'把你的字幕写在这里\n每行一句，自动均分显示时间'} disabled={busy} onChange={(event) => field('captions', event.target.value)} /></label><p className="rwHint">字幕按成片时长均分，不自动识别原片语音；亮点前置后，请按新顺序填写文案。</p></div>
              <div className="rwAppearance"><label className="rwField">视觉包装<select value={options.style} disabled={busy} onChange={(event) => field('style', event.target.value)}><option value="blue">蓝紫轻包装</option><option value="clean">简洁字幕</option></select></label><label className="rwAudio"><input type="checkbox" checked={options.keepAudio} disabled={busy} onChange={(event) => field('keepAudio', event.target.checked)} />保留原音轨</label></div>
              {preview.error && <p className="rwAlert" role="alert">{preview.error}</p>}
              <div className="rwSubmitRow"><div><strong>{busy ? '正在制作一个真实版本' : preview.plan ? `预计 ${preview.plan.outputDuration.toFixed(1)} 秒成片` : '等待参考视频'}</strong><small>{health?.ready ? 'Hypit 执行 · 无视频模型 API 调用' : '可先看包装预览；导出需要执行服务'}</small></div><button type="button" className="rwPrimary" onClick={submit} disabled={!preview.plan || busy || !health?.ready}>{uploading ? '上传中…' : active ? '处理中…' : '制作这个版本'}<span>→</span></button></div>
              {!health?.ready && <p className="rwHint rwServiceHint">{health?.error || '正在检查执行服务…'}<button type="button" onClick={() => setTab('engine')}>查看连接状态</button></p>}
            </section>
          </div>
          {url && <section className="rwPanel rwPreviewPanel"><div className="rwPanelHead"><div><p className="rwEyebrow">TRY BEFORE YOU EXPORT</p><h2>先看看包装效果</h2></div><span className="rwPill">浏览器预览</span></div><StyledPreview url={url} plan={preview.plan} options={options} /></section>}
        </>}

        {tab === 'result' && <section className="rwPanel rwResults">
          <div className="rwPanelHead"><div><p className="rwEyebrow">REAL OUTPUT</p><h2>{currentJob?.filename || '等待你的第一个版本'}</h2></div>{currentJob && <span className={`rwPill ${currentJob.kind === 'video' ? '' : 'rwFree'}`}>{currentJob.kind === 'video' ? 'MiniMax 按量计费' : '¥ 0 模型费'}</span>}</div>
          {!currentJob ? <div className="rwEmpty"><span className="rwUploadIcon">▶</span><h3>先制作一个版本</h3><p>实际成片完成后，会在这里显示对比和下载。</p><button className="rwPrimary" type="button" onClick={() => setTab('create')}>去上传视频 →</button></div> : <>
            <div className={`rwJobStatus ${['failed', 'submission_uncertain'].includes(currentJob.status) ? 'isFailed' : ''}`} role="status"><strong>{currentJob.message}</strong><span>{currentJob.progress}%</span><progress max="100" value={currentJob.progress} /></div>
            {currentJob.status === 'submission_uncertain' && <p className="rwAlert">MiniMax 创建请求结果不确定，已停止自动提交。请先在平台任务列表对账，不要重新点击生成。</p>}
            {currentJob.directorPlan && <div className="rwTaskCard"><p className="rwEyebrow">TASK PLAN</p><p className="rwTaskPlan">方案已定：{currentJob.directorPlan.route.kind === 'hypit-template' ? `本地 Hypit 模板 · ${currentJob.directorPlan.canvas.width}×${currentJob.directorPlan.canvas.height} · ${currentJob.directorPlan.canvas.duration} 秒 · 零模型费` : `${currentJob.directorPlan.canvas.width}×${currentJob.directorPlan.canvas.height} · ${currentJob.directorPlan.canvas.duration} 秒 · ${currentJob.video?.model || 'MiniMax-H3'} 云端生成`}，现在生成。</p>{currentJob.directorPlan.prompt && <details className="rtSection"><summary>视频指令</summary><p className="rtTaskPrompt">{currentJob.directorPlan.prompt}</p></details>}</div>}
            <ResultComparison currentJob={currentJob} mediaUrl={mediaUrl} />
            {currentJob.status === 'complete' && currentJob.directorPlan?.shots?.length > 0 && <div className="rwQcCard"><p className="rwEyebrow">OUTPUT CHECK</p><h3>成片质检 · 镜头核对</h3><ol>{currentJob.directorPlan.shots.map((shot) => <li key={shot.id}><strong>{shot.start.toFixed(0)}–{shot.end.toFixed(0)} 秒</strong><span>{shot.task}{shot.visual ? ` · ${shot.visual.slice(0, 60)}` : ''}</span></li>)}</ol><p className="rwHint">以上为提交时的镜头规划；生成结果以实际画面为准。当前版本未接入 AI 逐帧质检，不声称自动验证文字与字幕。</p></div>}
            <div className="rwResultFoot"><p>{currentJob.result ? (currentJob.kind === 'video' ? `${currentJob.video?.resolution || 'MiniMax'} · ${currentJob.result.duration.toFixed(1)} 秒 · 云端生成` : `${currentJob.result.width} × ${currentJob.result.height} · ${currentJob.result.duration.toFixed(1)} 秒 · ${currentJob.result.audio ? '含所选音轨' : '无音轨'}`) : '不会用演示视频替代生成结果。'}</p><div>{currentJob.resultUrl && <a className="rwPrimary" href={`${mediaUrl(currentJob.resultUrl)}?download=1`}>下载 MP4 ↓</a>}<button type="button" className="rwSecondary" disabled={busy} onClick={() => { setSelectedId(null); setTab(currentJob.kind === 'template' || currentJob.kind === 'video' ? 'template' : 'create') }}>调整并新建版本</button></div></div>
            {currentJob.plan && <div className="rwTimeline"><p className="rwEyebrow">复刻执行方案</p>{currentJob.plan.kind === 'template' ? currentJob.plan.events.map((cue, index) => <div key={index}><span>{String(index + 1).padStart(2, '0')}</span><strong>{({ title: '开场钩子', benefit: '利益点', action: '行动引导' })[cue.field]}</strong><small>{cue.start.toFixed(2)}–{cue.end.toFixed(2)} 秒 · 模板重绘</small></div>) : currentJob.plan.segments.map((segment, index) => <div key={index}><span>{String(index + 1).padStart(2, '0')}</span><strong>原片 {segment.start.toFixed(2)}–{segment.end.toFixed(2)} 秒</strong><small>{segment.rate} 倍速 · 原片画面</small></div>)}</div>}
          </>}
        </section>}

        {tab === 'history' && <section className="rwPanel rwHistory"><div className="rwPanelHead"><div><p className="rwEyebrow">RUN HISTORY</p><h2>本浏览器的运行记录</h2></div><button className="rwSecondary" type="button" disabled={checking} onClick={connect}>刷新</button></div>{!jobs.length ? <div className="rwEmpty"><h3>还没有运行记录</h3><p>创建一次真实任务后，状态和成片会出现在这里。</p></div> : jobs.map((job) => <article className="rwHistoryRow" key={job.id}><div><strong>{job.filename}</strong><small>{new Date(job.createdAt).toLocaleString('zh-CN')} · {job.message}</small></div><span className="rwPill">{({ complete: '已完成', failed: '失败', queued: '等待中', validating: '检查中', planning: '计划中', processing: '剪辑中', packaging: '包装中' })[job.status]}</span><div className="rwHistoryActions"><button type="button" onClick={() => { setSelectedId(job.id); setTab('result') }}>查看</button><button type="button" disabled={!['complete', 'failed'].includes(job.status)} onClick={() => remove(job)}>删除文件</button></div></article>)}<p className="rwHint">删除会移除该任务的上传和成片文件，无法撤销。原始文件仍保留在你的电脑中。</p><div className="rwAudit"><div className="rwPanelHead"><div><p className="rwEyebrow">CALL AUDIT</p><h2>模型调用审计</h2></div><span className="rwPill">{audit.length ? `${audit.length} 条` : '空'}</span></div>{!audit.length ? <p className="rwHint">每次外发对话、渲染、旁白或记忆写入都会记录在这里，含模型、费用与内容摘要。</p> : <ol className="rwAuditList">{audit.map((entry) => <li key={entry.id}><div><strong>{entry.summary}</strong><small>{new Date(entry.at).toLocaleString('zh-CN')} · {entry.provider} · {entry.model}</small></div><span className={`rwPill ${entry.fee ? '' : 'rwFree'}`}>{entry.fee ? `¥${entry.fee}（${entry.feeUnit}）` : entry.feeUnit}</span>{entry.failed && <span className="rwPill">未完成</span>}</li>)}</ol>}<p className="rwHint">审计与运行记录分开保存，只保留最近 300 条；费用为估算基准，实际以供应商账单为准。</p></div></section>}

        {tab === 'engine' && <>
          <div className="rwEngineGrid"><section className="rwEngineHero"><p className="rwEyebrow">LOCAL FIRST · HYPIT</p><h2>先用原片，<br />再为新镜头付费。</h2><p>开头剪辑、节奏重排交给 Hypit。字幕和轻包装在本地完成，不需要视频模型密钥。</p><span className="rwEngineGlyph">H</span><div className="rwEngineTags"><span>HYPIT</span><span>LOCAL</span><span>ZERO MODEL FEE</span></div></section><section className="rwPanel rwConnection"><p className="rwEyebrow">EXECUTION STATUS</p><h2>视频执行服务</h2><span className={`rwStatus ${health?.ready ? 'isReady' : ''}`}><i />{health?.ready ? `Hypit ${health.version}` : '尚未连接'}</span><p>{health?.ready ? '视频会上传到当前执行服务，Hypit 在服务所在电脑上制作。' : health?.error || '正在检查连接…'}</p><button className="rwPrimary" type="button" disabled={checking} onClick={connect}>{checking ? '检查中…' : '重新检查连接'} →</button></section></div>
          <section className="rwPanel rwUpgrade"><div><p className="rwEyebrow">OPTIONAL MODEL UPGRADE</p><h2>复杂镜头，按需付费升级</h2><p>{health?.video?.ready ? `换人物、新场景和复杂动作由 ${health.video.model} 云端生成：方案确认后提交，按量计费（以供应商账单为准），成片自动下载到工作台。` : '换人物、新场景和复杂动作需要视频生成模型。当前版本已实现原片剪辑与包装；MiniMax H3 尚未配置密钥，不会产生模型费用。'}</p></div><span className={`rwPill ${health?.video?.ready ? 'rwFree' : ''}`}>{health?.video?.ready ? '已启用' : '本期未启用'}</span></section>
          <section className="rwPanel rwRoutingTable"><div className="rwPanelHead"><div><p className="rwEyebrow">MODEL ROUTING</p><h2>显式模型路由目录</h2></div><span className="rwPill">本地优先</span></div>{health?.routing?.providers ? <div className="rwRouteGrid">{Object.values(health.routing.providers).map((provider) => <article key={provider.id}><div><strong>{provider.label}</strong><small>{provider.task}</small></div><span className={`rwPill ${provider.fee === 0 ? 'rwFree' : ''}`}>{provider.fee === 0 ? provider.feeUnit : provider.feeUnit}</span><p>{provider.note}</p>{provider.enabled ? <em>可用</em> : <em className="rwMuted">未启用</em>}</article>)}</div> : <p className="rwHint">连接执行服务后显示模型路由目录。</p>}<p className="rwHint">每次请求都会显式展示本次路由与预估费用；外发模型必须先确认，本地路径零模型费。</p></section>
          <section className="rwPanel rwRuntimeHelp"><p className="rwEyebrow">LOCAL PREVIEW / DEPLOYMENT</p><h2>本机体验与在线使用</h2><p>在作品集项目运行 <code>npm run dev</code> 或 <code>npm run preview</code>，即可使用已安装的 Hypit 与 FFmpeg。静态网页不能独立分析或制作 MP4；公网执行服务尚未部署。</p><p>模板模式有六帧抽样及背景测量，没有 OCR/ASR。{health?.chat?.ready ? `可选对话模型：${health.chat.model}，每轮授权计费。` : '对话 API 未配置，本地向导仍可使用。'}{health?.video?.ready ? `复杂镜头模型：${health.video.model}，提交前展示预估、生成后自动下载。` : '复杂镜头模型未配置。'}原版导演 Skill：{health?.chat?.directorReady ? '已读取，用于规划' : '未读取'}。本人 F5：{health?.voice?.ready ? '文件准备就绪，仍需实际试听认可' : health?.voice?.reasons?.join('；') || '尚未准备好'}。</p></section>
        </>}
        <footer className="rwFooter"><span>HYPIT WORKBENCH / 原片低成本复刻</span><span>先看效果，再决定下一步。</span></footer>
      </div>
    </main>
  )
}
