import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TEMPLATE, planTemplate, validateTemplate } from '../../replica-template'
import { renderTemplateSvg } from '../../replica-template-visual'

const busyStates = ['queued', 'analyzing', 'chatting', 'voicing', 'rendering']
const copyFields = [['title', '开场钩子文案'], ['benefit', '利益点文案'], ['action', '行动引导文案']]

export default function TemplateEditor({ health, requestApi, mediaUrl, onJob, jobBusy = false }) {
  const [file, setFile] = useState(null), [localUrl, setLocalUrl] = useState('')
  const [draft, setDraft] = useState(null), [drafts, setDrafts] = useState([])
  const [template, setTemplate] = useState({ ...DEFAULT_TEMPLATE })
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const [requirement, setRequirement] = useState(''), [mode, setMode] = useState('local'), [shareImages, setShareImages] = useState(false)
  const [replaceReference, setReplaceReference] = useState(false)
  const [prosody, setProsody] = useState({ title: '', benefit: '', action: '' }), [pause, setPause] = useState(0.25)
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const generation = useRef(0), fileInput = useRef(null), previewId = useRef(null)
  const busy = pending || jobBusy || busyStates.includes(draft?.status)
  const dirty = draft && JSON.stringify(template) !== JSON.stringify(draft.template)
  const acceptDraft = (value) => {
    setDraft(value); setTemplate(value.template)
    setDrafts((all) => [value, ...all.filter((d) => d.id !== value.id)])
    if (value.voicePreview?.id !== previewId.current) {
      previewId.current = value.voicePreview?.id || null
      const parts = value.voicePreview?.prosody || []
      setProsody(Object.fromEntries(copyFields.map(([field]) => [field, parts.find((p) => p.field === field)?.text || ''])))
      setPause(parts[0]?.pause ?? 0.25)
    }
  }
  useEffect(() => {
    if (!file) { setLocalUrl(''); return }
    const url = URL.createObjectURL(file); setLocalUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (!health?.ready) return
    let disposed = false
    requestApi('/drafts').then((data) => { if (!disposed) setDrafts(data.drafts) }).catch((e) => { if (!disposed) setError(e.message) })
    return () => { disposed = true }
  }, [health?.ready])
  useEffect(() => {
    if (!draft || !busyStates.includes(draft.status)) return
    const token = generation.current, controller = new AbortController(); let inFlight = false
    const timer = window.setInterval(async () => {
      if (inFlight) return; inFlight = true
      try {
        const value = await requestApi(`/drafts/${draft.id}`, { signal: controller.signal })
        if (!controller.signal.aborted && generation.current === token) acceptDraft(value)
      } catch (e) { if (!controller.signal.aborted && generation.current === token) setError(e.message) }
      finally { inFlight = false }
    }, 700)
    return () => { window.clearInterval(timer); controller.abort() }
  }, [draft?.id, draft?.status])
  const preview = useMemo(() => {
    if (!draft) return { plan: null }
    try {
      const source = draft.analysis?.metadata
      const plan = planTemplate(template, { width: draft.canvas.width, height: draft.canvas.height, sourceDuration: source?.duration, hasAudio: Boolean(source?.hasAudio), voiceCues: draft.voicePreview?.cues })
      return { plan }
    } catch (e) { return { plan: null, error: e.message } }
  }, [draft?.analysis, draft?.voicePreview, template])
  useEffect(() => { setTime(0); setPlaying(false) }, [template, draft?.id])
  useEffect(() => {
    if (!playing || !preview.plan) return
    const started = performance.now() - time * 1000
    const timer = window.setInterval(() => {
      const next = Math.min(preview.plan.duration, (performance.now() - started) / 1000)
      setTime(next); if (next >= preview.plan.duration) setPlaying(false)
    }, 1000 / 30)
    return () => window.clearInterval(timer)
  }, [playing, preview.plan])
  useEffect(() => () => { generation.current++ }, [])

  const choose = (candidate) => {
    if (!candidate) return
    if (!/\.(mp4|mov|webm|m4v)$/i.test(candidate.name) || !candidate.size || candidate.size > 25 * 1024 * 1024) { setFile(null); setError('请选择不超过 25 MB 的 MP4、MOV 或 WebM。'); return }
    generation.current++; setPending(false); setPlaying(false); setError('')
    if (draft) {
      const replace = window.confirm('确定：替换当前会话的参考视频；取消：用这个视频新建会话。')
      setReplaceReference(replace)
      if (!replace) { setDraft(null); setTemplate({ ...DEFAULT_TEMPLATE }) }
    } else setReplaceReference(false)
    setFile(candidate)
  }
  const operate = async (operation, body = {}) => {
    if (!draft || busy) return
    const token = generation.current; setPending(true); setError('')
    try {
      const value = await requestApi(`/drafts/${draft.id}${operation ? `/${operation}` : ''}`, { method: operation ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: draft.revision, ...body }) })
      if (generation.current !== token) return
      if (operation === 'render') onJob(value)
      else acceptDraft(value)
      if (operation === 'messages') setRequirement('')
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const waitDraft = async (id, token) => {
    for (let count = 0; count < 120; count++) {
      const value = await requestApi(`/drafts/${id}`)
      if (generation.current !== token) throw new Error('会话已切换。')
      acceptDraft(value)
      if (!busyStates.includes(value.status)) return value
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    }
    throw new Error('分析等待超时，请恢复会话后重试。')
  }
  const restore = async (id) => {
    if (!id) return
    const token = ++generation.current; setPending(true); setFile(null); setDraft(null); setError('')
    try { const value = await requestApi(`/drafts/${id}`); if (generation.current === token) acceptDraft(value) }
    catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const newSession = () => {
    generation.current++; setPending(false); setDraft(null); setFile(null); setReplaceReference(false); setTemplate({ ...DEFAULT_TEMPLATE }); setRequirement(''); setError(''); setPlaying(false)
  }
  const removeDraft = async () => {
    if (!draft || busy || !window.confirm('永久删除此草稿、输入和试听？已制作的独立成片不受影响。')) return
    const token = generation.current; setPending(true)
    try {
      await requestApi(`/drafts/${draft.id}`, { method: 'DELETE' })
      if (generation.current === token) { setDrafts((all) => all.filter((d) => d.id !== draft.id)); generation.current++; setDraft(null); setFile(null); setTemplate({ ...DEFAULT_TEMPLATE }); setPending(false) }
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const save = () => {
    try { validateTemplate(template); operate('', { template }) } catch (e) { setError(e.message) }
  }
  const submitTurn = async () => {
    if (!requirement.trim() || busy || dirty || !health?.ready) return
    if (mode === 'api' && !window.confirm(`本轮使用 ${health.chat.model}，外发测量、文案、需求和最近对话${shareImages ? '及最多三张代表帧' : '，不附图片'}。费用由工作台所有者承担，金额以供应商为准；不自动重试。确认发送？`)) return
    const token = generation.current; setPending(true); setError('')
    try {
      let current = draft
      if (!current) {
        if (file) { const form = new FormData(); form.append('video', file); current = await requestApi('/drafts', { method: 'POST', body: form }) }
        else current = await requestApi('/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        if (generation.current !== token) return
        acceptDraft(current)
      } else if (file && replaceReference) {
        const form = new FormData(); form.append('video', file); form.append('revision', String(current.revision))
        current = await requestApi(`/drafts/${current.id}/reference`, { method: 'POST', body: form })
        if (generation.current !== token) return
        acceptDraft(current)
      }
      if (current.reference && !current.analysis) {
        current = await requestApi(`/drafts/${current.id}/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: current.revision }) })
        acceptDraft(current)
        current = await waitDraft(current.id, token)
        if (current.status === 'failed') throw new Error(current.error || '参考视频分析失败。')
      }
      const value = await requestApi(`/drafts/${current.id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: current.revision, message: requirement.trim(), mode, ...(mode === 'api' ? { consent: { provider: health.chat.model, shareImages } } : {}) }) })
      if (generation.current !== token) return
      acceptDraft(value); setRequirement(''); setFile(null); setReplaceReference(false)
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const voice = () => {
    const segments = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
    operate('voice', { narration: segments.map((p) => p.text).join('\n'), prosody: segments })
  }
  const field = (key, value) => setTemplate((t) => ({ ...t, [key]: value }))
  const confirmed = draft && !dirty && draft.confirmedRevision === draft.revision && Boolean(draft.confirmedPlanHash)
  const executable = draft?.directorPlan?.status === 'executable' && draft.directorPlan.route.kind === 'hypit-template' && !draft.pendingQuestion
  const currentProsody = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
  const prosodyDirty = draft?.voicePreview && JSON.stringify(currentProsody) !== JSON.stringify(draft.voicePreview.prosody)
  const voiceReady = template.audioMode !== 'voice' || (draft?.voicePreview?.approved && draft.voicePreview.revision === draft.revision && !dirty && !prosodyDirty)
  return <div className="rwCreateGrid rwTemplateGrid">
    <section className="rwPanel rwSource" aria-labelledby="rt-source-title">
      <div className="rwPanelHead"><div><p className="rwEyebrow">01 / OPTIONAL REFERENCE</p><h2 id="rt-source-title">可选参考视频</h2></div><span className="rwPill">0～30 秒</span></div>
      <label className="rwField">恢复会话<select aria-label="恢复会话" value={draft?.id || ''} onChange={(e) => restore(e.target.value)}><option value="">选择已保存会话</option>{drafts.map((d) => <option key={d.id} value={d.id}>{d.filename} · {d.revision}版</option>)}</select></label>
      <input ref={fileInput} className="rwFileInput" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" aria-label="添加参考视频" onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} />
      {localUrl || draft?.inputUrl ? <div className="rwUploaded rtUploaded"><video src={localUrl || mediaUrl(draft.inputUrl)} controls playsInline preload="metadata" aria-label="模板参考原片" /><div className="rwFileMeta"><strong>{file?.name || draft.filename}</strong><span>{draft?.analysis ? `${draft.analysis.metadata.duration.toFixed(2)} 秒 · ${draft.analysis.metadata.width}×${draft.analysis.metadata.height}` : '发送后自动测量时长和尺寸'}</span></div><button className="rwSecondary" type="button" disabled={busy} onClick={() => fileInput.current.click()}>更换参考视频</button></div> : <button className="rtNoReference" type="button" disabled={busy} onClick={() => fileInput.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]) }}><span>＋</span><strong>添加参考视频</strong><small>可不上传，直接用文字开始<br />MP4 / MOV / WebM · 最长 30 秒 · 25 MB</small></button>}
      <p className="rwHint">本次没有参考原片也能规划并制作文字卡。上传后仅测量尺寸、时长、边缘颜色与像素变化；没有 OCR/ASR，请手动确认文案和剧情。</p>
      <div className="rtActions"><button type="button" className="rwSecondary" disabled={busy} onClick={newSession}>新建会话</button>{draft && <button type="button" className="rwSecondary" disabled={busy} onClick={removeDraft}>删除此会话</button>}</div>
      <p className="rtLive" role="status" aria-live="polite">{pending ? '正在提交…' : draft?.message || '等待你的想法'}{busyStates.includes(draft?.status) ? ` · ${draft.progress || 0}%` : ''}</p>
      {error && <p className="rwAlert" role="alert">{error}</p>}{draft?.error && <p className="rwAlert" role="alert">{draft.error}</p>}
      {draft?.analysis && <div className="rtEvidence"><h3>测量反馈，不是语义识别</h3><p>{draft.analysis.background.stable ? `稳定边缘主色候选 ${draft.analysis.background.color}` : '未找到稳定纯色边缘；选择此模板将重绘画面，不保留原人物或场景。'}</p><div className="rtFrames">{draft.frames.map((f) => <figure key={f.id}><img src={mediaUrl(f.url)} alt={`原片第 ${f.at.toFixed(2)} 秒代表帧`} /><figcaption>{f.at.toFixed(2)} s</figcaption></figure>)}</div><p className="rwHint">六点抽样仅说明边缘颜色与像素变化，原文、语音和剧情均待确认。</p></div>}
      {preview.plan && <div className="rtPreview"><h3>模板实时预览</h3><div className="rtSvg" role="img" aria-label="重建模板图形预览" dangerouslySetInnerHTML={{ __html: renderTemplateSvg(preview.plan, template, time) }} /><div className="rwPreviewControls"><button type="button" onClick={() => { setTime(0); setPlaying(true) }}>播放模板预览</button><button type="button" onClick={() => setPlaying(false)}>暂停</button><span>{time.toFixed(1)} / {preview.plan.duration.toFixed(1)} s</span></div><label className="rwField rwSlider">预览时间<input type="range" min="0" max={preview.plan.duration} step="0.0333" value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} /></label><p className="rwHint">预览与 Hypit 共用图形；最终以编码 MP4 为准。</p></div>}
    </section>
    <section className="rwPanel rwEditor" aria-labelledby="rt-editor-title">
      <div className="rwPanelHead"><div><p className="rwEyebrow">02 / DIRECTOR AGENT</p><h2 id="rt-editor-title">告诉导演你想做什么</h2></div><span className="rwPill rwFree">本地优先</span></div>
      <p className="rwHint">输入创意、剧情或修改要求；导演会先反馈、追问，再形成可执行参数或复杂镜头方案。</p>
      <div className="rtMessages" aria-label="导演对话记录">{draft?.messages?.length ? draft.messages.map((m, i) => <p key={i} className={m.role === 'user' ? 'rtUser' : ''}><strong>{m.role === 'user' ? '你的需求' : m.mode === 'api' ? '模型导演' : '本地向导'}</strong>{m.content}</p>) : <p><strong>导演 Agent</strong>可以先只说想法，也可以添加参考视频。简单图形由本地 Hypit 执行，复杂真人镜头只做规划，不会假装已经生成。</p>}</div>
      {draft?.pendingQuestion && <p className="rwAlert">{draft.pendingQuestion.text} 在下方编辑后点击“保存修改”即按当前控件方案处理。</p>}
      <div className="rtComposer"><label className="rwField">你的想法<textarea aria-label="告诉导演你想做什么" rows={5} maxLength={2000} value={requirement} disabled={busy} onChange={(e) => setRequirement(e.target.value)} placeholder="例如：做一条 6 秒绿色背景文字卡。标题：3 秒看懂；卖点：本地生成；行动：马上开始。文字黄色，弹跳入场。" /></label><div className="rtComposerActions"><button className="rwSecondary" type="button" disabled={busy} onClick={() => fileInput.current.click()}>添加参考视频</button><button className="rwPrimary" type="button" disabled={!requirement.trim() || busy || dirty || !health?.ready} onClick={submitTurn}>{mode === 'api' ? '确认外发并发送' : '发送给导演'} →</button></div></div>
      <div className="rtDialogueActions"><label className="rwField">本轮规划方式<select aria-label="本轮规划方式" value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); setShareImages(false) }}><option value="local">本地向导 · 零模型调用费</option>{health?.chat?.ready && <option value="api">{health.chat.model} · 所有者承担费用</option>}</select></label></div>
      {mode === 'api' && <><p className="rwHint">外发测量、文案、需求及近期对话，不发送视频或声音参考。{health.chat.costNotice}</p>{health.chat.vision && <label className="rwAudio"><input type="checkbox" checked={shareImages} onChange={(e) => setShareImages(e.target.checked)} disabled={busy} />本轮允许外发最多三张代表帧</label>}</>}
      <p className="rwHint">{health?.chat?.ready ? `原版导演 Skill：${health.chat.directorReady ? '已读取，仅用于规划' : '未读取'}` : '模型接口未配置；本地向导只能理解已列出的颜色、动效与开场选项。'}</p>
      <details className="rtSection"><summary>高级模板与声音设置</summary><p className="rwEyebrow">成片文案与视觉参数</p><fieldset disabled={!draft || busy}>
        {copyFields.map(([key, label]) => <div className="rtCopyRow" key={key}><label className="rwField">{label}<textarea aria-label={label} rows={2} maxLength={40} value={template[key]} onChange={(e) => field(key, e.target.value)} placeholder="手动确认或重写，不填修改指令" /></label><label className="rwField">文字颜色<input type="color" aria-label={`${label}颜色`} value={template[`${key}Color`]} onChange={(e) => field(`${key}Color`, e.target.value)} /><small>{template[`${key}Color`]}</small></label></div>)}
        <div className="rtOptions"><label className="rwField">背景颜色<input type="color" aria-label="背景颜色" value={template.background} onChange={(e) => field('background', e.target.value)} /><small>{template.background}</small></label><label className="rwField">文字动效<select aria-label="文字动效" value={template.textMotion} onChange={(e) => field('textMotion', e.target.value)}><option value="none">无动效</option><option value="fade">淡入</option><option value="bounce">弹跳入场</option></select></label><label className="rwField">光环动效<select value={template.ringMotion} onChange={(e) => field('ringMotion', e.target.value)}><option value="none">静止</option><option value="rotate">旋转</option></select></label><label className="rwField">文案节奏<select value={template.opening} onChange={(e) => field('opening', e.target.value)}><option value="simultaneous">同时出现</option><option value="staged">逐段出现</option></select></label><label className="rwField">模板时长（秒）<input type="number" min="0.5" max="30" step="0.1" value={template.duration} onChange={(e) => field('duration', Number(e.target.value))} /></label><label className="rwField">成片声音<select aria-label="成片声音" value={template.audioMode} onChange={(e) => field('audioMode', e.target.value)}><option value="mute">静音</option><option value="original">保留原音轨</option><option value="voice" disabled={!health?.voice?.ready}>本人 F5 旁白试听</option></select></label></div>
      </fieldset><div className="rtActions"><button className="rwSecondary" type="button" disabled={!draft || busy || (!dirty && !draft?.pendingQuestion)} onClick={save}>保存修改</button><span className="rwHint">{dirty ? '有未保存修改；先保存再对话或确认。' : '方案修改会使旧确认与声音认可失效。'}</span></div></details>
      {template.audioMode === 'original' && <p className="rwAlert">请确认原声与新文案不冲突。时长更长时尾部补静音，不循环或拉伸原声。</p>}
      <details className="rtSection"><summary>本人旁白 · 先试听，再认可</summary><p className="rwHint">只用本人本地 F5。新问句、重点和停顿需要听审，不能保证标点直接控制情绪；不加速。商业权重许可：{health?.voice?.commercialLicense || 'pending_verification'}。</p>{!health?.voice?.ready && <p className="rwHint">{health?.voice?.reasons?.join('；') || 'F5 尚未就绪，不自动换声。'}</p>}<fieldset disabled={!draft || busy || !health?.voice?.ready}>{copyFields.map(([key, label]) => <label className="rwField" key={key}>{label}对应的旁白句段<input value={prosody[key]} maxLength={300} onChange={(e) => setProsody((p) => ({ ...p, [key]: e.target.value }))} placeholder={key === 'title' ? '问句/开场，可用标点规划语气' : key === 'benefit' ? '重点与自然停顿' : '行动引导'} /></label>)}<label className="rwField">每句后停顿（秒）<input type="number" min="0" max="1.5" step="0.05" value={pause} onChange={(e) => setPause(Number(e.target.value))} /></label><button className="rwSecondary" type="button" disabled={dirty || !Object.values(prosody).some((s) => s.trim())} onClick={voice}>生成独立试听</button></fieldset>{draft?.voicePreview && <><audio controls src={mediaUrl(draft.voicePreview.url)} aria-label="本人 F5 旁白试听" /><p className="rwHint">实际 {draft.voicePreview.duration.toFixed(2)} 秒，画面跟随声音；{prosodyDirty ? '句段或停顿已修改，请重新生成试听；' : ''}{draft.voicePreview.approved ? '已认可' : '尚未听审认可'}。</p><button className="rwSecondary" type="button" disabled={busy || dirty || prosodyDirty || draft.voicePreview.approved} onClick={() => { if (window.confirm('已完整听审，并认可本次语气、停顿和本人声线，用于当前成片？')) operate(`voice/${draft.voicePreview.id}/approve`, { sha256: draft.voicePreview.sha256 }) }}>认可本次试听</button></>}</details>
      {preview.error && <p className="rwAlert">{preview.error}</p>}
    </section>
    <aside className="rwPanel rtPlanPanel" aria-labelledby="rt-plan-title"><div className="rwPanelHead"><div><p className="rwEyebrow">03 / PRODUCTION PLAN</p><h2 id="rt-plan-title">当前方案</h2></div><span className={`rwPill ${executable ? 'rwFree' : ''}`}>{draft?.directorPlan ? executable ? '可执行' : '仅规划' : '待沟通'}</span></div><h3>证据来源</h3>{draft?.directorPlan?.reference ? <><p>{draft.directorPlan.reference.summary}</p><ul>{draft.directorPlan.reference.evidence.map((item, index) => <li key={index}><span>{item.source}</span>{item.text}</li>)}</ul></> : <p className="rtNoEvidence">本次没有参考原片；当前方案仅依据你的文字和默认画布。</p>}{draft?.directorPlan ? <><div className="rtPlanMeta"><span>{draft.directorPlan.canvas.width}×{draft.directorPlan.canvas.height}</span><span>{draft.directorPlan.canvas.duration} 秒</span><span>{draft.directorPlan.route.kind}</span><span>{draft.directorPlan.audio.mode}</span></div><h3>镜头时间线</h3>{draft.directorPlan.shots.length ? <ol className="rtShots">{draft.directorPlan.shots.map((shot) => <li key={shot.id}><strong>{shot.start.toFixed(2)}–{shot.end.toFixed(2)} 秒</strong><span>{shot.task} · {shot.text}</span></li>)}</ol> : <p className="rwHint">需要继续补充可制作文案或复杂镜头素材。</p>}{draft.directorPlan.blockers.length > 0 && <div className="rwAlert">{draft.directorPlan.blockers.join('；')}</div>}<label className="rwField">可复制视频指令<textarea aria-label="可复制视频指令" readOnly rows={8} value={draft.directorPlan.prompt} /></label><button className="rwSecondary" type="button" onClick={() => navigator.clipboard?.writeText(draft.directorPlan.prompt)}>复制视频指令</button></> : <><p className="rwHint">发送第一条消息后，这里会显示参数、时间线、生产路径和可复制提示词。</p><button className="rwSecondary" type="button" disabled>复制视频指令</button></>}<div className="rwSubmitRow"><div><strong>{confirmed ? '当前方案已确认' : executable ? '方案可以交给本地 Hypit' : '继续和导演沟通'}</strong><small>{executable ? '确认后才会创建独立任务' : '复杂镜头不会伪装成本地成片'}</small></div><button className="rwSecondary" type="button" disabled={!executable || busy || dirty || !voiceReady || confirmed} onClick={() => operate('confirm')}>确认当前方案</button><button className="rwPrimary" type="button" disabled={!confirmed || !preview.plan || busy || !voiceReady || !health?.ready} onClick={() => operate('render')}>制作成片 →</button></div></aside>
  </div>
}
