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
    if (!draft?.analysis) return { plan: null }
    try {
      const plan = planTemplate(template, { ...draft.analysis.metadata, sourceDuration: draft.analysis.metadata.duration, voiceCues: draft.voicePreview?.cues })
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
    generation.current++; setPending(false); setDraft(null); setPlaying(false); setError('')
    if (!/\.(mp4|mov|webm|m4v)$/i.test(candidate.name) || !candidate.size || candidate.size > 25 * 1024 * 1024) { setFile(null); setError('请选择不超过 25 MB 的 MP4、MOV 或 WebM。'); return }
    setFile(candidate); setTemplate({ ...DEFAULT_TEMPLATE }); setRequirement('')
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
  const analyze = async () => {
    if (busy || !health?.ready || (!file && !draft)) return
    if (draft) return operate('analyze')
    const token = generation.current; setPending(true); setError('')
    try {
      const form = new FormData(); form.append('video', file)
      const created = await requestApi('/drafts', { method: 'POST', body: form })
      if (generation.current !== token) return
      acceptDraft(created)
      const result = await requestApi(`/drafts/${created.id}/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: created.revision }) })
      if (generation.current === token) acceptDraft(result)
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const restore = async (id) => {
    if (!id) return
    const token = ++generation.current; setPending(true); setFile(null); setDraft(null); setError('')
    try { const value = await requestApi(`/drafts/${id}`); if (generation.current === token) acceptDraft(value) }
    catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
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
  const send = () => {
    if (mode === 'api' && !window.confirm(`本轮使用 ${health.chat.model}，外发测量、文案、需求和最近对话${shareImages ? '及最多三张代表帧' : '，不附图片'}。费用由工作台所有者承担，金额以供应商为准；不自动重试。确认发送？`)) return
    operate('messages', { message: requirement, mode, ...(mode === 'api' ? { consent: { provider: health.chat.model, shareImages } } : {}) })
  }
  const voice = () => {
    const segments = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
    operate('voice', { narration: segments.map((p) => p.text).join('\n'), prosody: segments })
  }
  const field = (key, value) => setTemplate((t) => ({ ...t, [key]: value }))
  const confirmed = draft && !dirty && draft.confirmedRevision === draft.revision
  const currentProsody = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
  const prosodyDirty = draft?.voicePreview && JSON.stringify(currentProsody) !== JSON.stringify(draft.voicePreview.prosody)
  const voiceReady = template.audioMode !== 'voice' || (draft?.voicePreview?.approved && draft.voicePreview.revision === draft.revision && !dirty && !prosodyDirty)
  return <div className="rwCreateGrid rwTemplateGrid">
    <section className="rwPanel rwSource" aria-labelledby="rt-source-title">
      <div className="rwPanelHead"><div><p className="rwEyebrow">01 / VIDEO EVIDENCE</p><h2 id="rt-source-title">原片与分析证据</h2></div><span className="rwPill">模板重建</span></div>
      {drafts.length > 0 && <label className="rwField">恢复本浏览器草稿<select aria-label="恢复草稿" value={draft?.id || ''} onChange={(e) => restore(e.target.value)}><option value="">选择一个已保存草稿</option>{drafts.map((d) => <option key={d.id} value={d.id}>{d.filename} · {d.revision}版</option>)}</select></label>}
      <input ref={fileInput} className="rwFileInput" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" aria-label="选择模板参考视频" onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} />
      {localUrl || draft ? <div className="rwUploaded rtUploaded"><video src={localUrl || mediaUrl(draft.inputUrl)} controls playsInline preload="metadata" aria-label="模板参考原片" /><div className="rwFileMeta"><strong>{file?.name || draft.filename}</strong><span>{draft?.analysis ? `${draft.analysis.metadata.duration.toFixed(2)} 秒 · ${draft.analysis.metadata.width}×${draft.analysis.metadata.height}` : '待本地探测时长和尺寸'}</span></div><button className="rwSecondary" type="button" onClick={() => fileInput.current.click()}>更换模板视频</button></div> : <button className="rwDropzone" type="button" onClick={() => fileInput.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]) }}><span className="rwUploadIcon">↑</span><strong>先放入一个参考短片</strong><small>0.5～15 秒 · 最多 25 MB<br />适合纯色、大字、图标动效模板</small><span className="rwChooseButton">选择视频 ↗</span></button>}
      <div className="rtActions"><button type="button" className="rwPrimary" disabled={busy || !health?.ready || (!file && !draft)} onClick={analyze}>分析原片</button>{draft && <button type="button" className="rwSecondary" disabled={busy} onClick={removeDraft}>删除此草稿</button>}</div>
      <p className="rwHint">更换视频仅停止观察旧操作，不取消服务端任务；原草稿仍保存。没有 OCR/ASR，请手动确认原片文案。</p>
      <p className="rtLive" role="status" aria-live="polite">{pending ? '正在提交…' : draft?.message || '等待参考视频'}{busyStates.includes(draft?.status) ? ` · ${draft.progress || 0}%` : ''}</p>
      {error && <p className="rwAlert" role="alert">{error}</p>}{draft?.error && <p className="rwAlert" role="alert">{draft.error}</p>}
      {draft?.analysis && <div className="rtEvidence"><h3>测量反馈，不是语义识别</h3><p>{draft.analysis.background.stable ? `稳定边缘主色候选 ${draft.analysis.background.color}` : '未找到稳定纯色边缘；选择此模板将重绘画面，不保留原人物或场景。'}</p><div className="rtFrames">{draft.frames.map((f) => <figure key={f.id}><img src={mediaUrl(f.url)} alt={`原片第 ${f.at.toFixed(2)} 秒代表帧`} /><figcaption>{f.at.toFixed(2)} s</figcaption></figure>)}</div><p className="rwHint">六点抽样仅说明边缘颜色与像素变化，原文、语音和剧情均待确认。</p></div>}
      {preview.plan && <div className="rtPreview"><h3>模板实时预览</h3><div className="rtSvg" role="img" aria-label="重建模板图形预览" dangerouslySetInnerHTML={{ __html: renderTemplateSvg(preview.plan, template, time) }} /><div className="rwPreviewControls"><button type="button" onClick={() => { setTime(0); setPlaying(true) }}>播放模板预览</button><button type="button" onClick={() => setPlaying(false)}>暂停</button><span>{time.toFixed(1)} / {preview.plan.duration.toFixed(1)} s</span></div><label className="rwField rwSlider">预览时间<input type="range" min="0" max={preview.plan.duration} step="0.0333" value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} /></label><p className="rwHint">预览与 Hypit 共用图形；最终以编码 MP4 为准。此处仅播放图形，音轨在原片或试听播放器听审。</p></div>}
    </section>
    <section className="rwPanel rwEditor" aria-labelledby="rt-editor-title">
      <div className="rwPanelHead"><div><p className="rwEyebrow">02 / DIRECTOR DIALOGUE</p><h2 id="rt-editor-title">告诉导演，你想改什么</h2></div><span className="rwPill rwFree">本地优先</span></div>
      <p className="rwHint">按模板重绘背景、文案和图标；不会只在原片上加字幕，也不会自动恢复任意源工程。</p>
      <div className="rtMessages" aria-label="导演对话记录">{draft?.messages.map((m, i) => <p key={i} className={m.role === 'user' ? 'rtUser' : ''}><strong>{m.role === 'user' ? '你的需求' : m.mode === 'api' ? '模型导演' : '本地向导'}</strong>{m.content}</p>)}</div>
      {draft?.pendingQuestion && <p className="rwAlert">{draft.pendingQuestion.text} 在下方编辑后点击“保存修改”即按当前控件方案处理。</p>}
      <label className="rwField">修改需求<textarea aria-label="修改需求" rows={3} maxLength={2000} value={requirement} disabled={!draft?.analysis || busy} onChange={(e) => setRequirement(e.target.value)} placeholder="例如：背景改绿色，全部文字改黄色，加弹跳，光环旋转。剧情/复杂动作请用已配置模型讨论，不承诺本地生成。" /></label>
      <div className="rtDialogueActions"><label className="rwField">本轮规划方式<select aria-label="本轮规划方式" value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); setShareImages(false) }}><option value="local">本地向导 · 零模型调用费</option>{health?.chat?.ready && <option value="api">{health.chat.model} · 所有者承担费用</option>}</select></label><button className="rwSecondary" type="button" disabled={!requirement.trim() || !draft?.analysis || busy || dirty} onClick={send}>{mode === 'api' ? '确认外发并发送' : '发送修改需求'}</button></div>
      {mode === 'api' && <><p className="rwHint">外发测量、文案、需求及近期对话，不发送视频或声音参考。{health.chat.costNotice}</p>{health.chat.vision && <label className="rwAudio"><input type="checkbox" checked={shareImages} onChange={(e) => setShareImages(e.target.checked)} disabled={busy} />本轮允许外发最多三张代表帧</label>}</>}
      <p className="rwHint">{health?.chat?.ready ? `原版导演 Skill：${health.chat.directorReady ? '已读取，仅用于规划' : '未读取'}` : '模型接口未配置；本地向导只能理解已列出的颜色、动效与开场选项。'}</p>
      <div className="rtSection"><p className="rwEyebrow">03 / CONFIRM YOUR TEMPLATE</p><h3>成片文案与视觉方案</h3><fieldset disabled={!draft?.analysis || busy}>
        {copyFields.map(([key, label]) => <div className="rtCopyRow" key={key}><label className="rwField">{label}<textarea aria-label={label} rows={2} maxLength={40} value={template[key]} onChange={(e) => field(key, e.target.value)} placeholder="手动确认或重写，不填修改指令" /></label><label className="rwField">文字颜色<input type="color" aria-label={`${label}颜色`} value={template[`${key}Color`]} onChange={(e) => field(`${key}Color`, e.target.value)} /><small>{template[`${key}Color`]}</small></label></div>)}
        <div className="rtOptions"><label className="rwField">背景颜色<input type="color" aria-label="背景颜色" value={template.background} onChange={(e) => field('background', e.target.value)} /><small>{template.background}</small></label><label className="rwField">文字动效<select aria-label="文字动效" value={template.textMotion} onChange={(e) => field('textMotion', e.target.value)}><option value="none">无动效</option><option value="fade">淡入</option><option value="bounce">弹跳入场</option></select></label><label className="rwField">光环动效<select value={template.ringMotion} onChange={(e) => field('ringMotion', e.target.value)}><option value="none">静止</option><option value="rotate">旋转</option></select></label><label className="rwField">文案节奏<select value={template.opening} onChange={(e) => field('opening', e.target.value)}><option value="simultaneous">同时出现</option><option value="staged">逐段出现</option></select></label><label className="rwField">模板时长（秒）<input type="number" min="0.5" max="30" step="0.1" value={template.duration} onChange={(e) => field('duration', Number(e.target.value))} /></label><label className="rwField">成片声音<select aria-label="成片声音" value={template.audioMode} onChange={(e) => field('audioMode', e.target.value)}><option value="mute">静音</option><option value="original">保留原音轨</option><option value="voice" disabled={!health?.voice?.ready}>本人 F5 旁白试听</option></select></label></div>
      </fieldset><div className="rtActions"><button className="rwSecondary" type="button" disabled={!draft?.analysis || busy || (!dirty && !draft?.pendingQuestion)} onClick={save}>保存修改</button><span className="rwHint">{dirty ? '有未保存修改；先保存再对话或确认。' : '方案修改会使旧确认与声音认可失效。'}</span></div></div>
      {template.audioMode === 'original' && <p className="rwAlert">请确认原声与新文案不冲突。时长更长时尾部补静音，不循环或拉伸原声。</p>}
      <details className="rtSection"><summary>本人旁白 · 先试听，再认可</summary><p className="rwHint">只用本人本地 F5。新问句、重点和停顿需要听审，不能保证标点直接控制情绪；不加速。商业权重许可：{health?.voice?.commercialLicense || 'pending_verification'}。</p>{!health?.voice?.ready && <p className="rwHint">{health?.voice?.reasons?.join('；') || 'F5 尚未就绪，不自动换声。'}</p>}<fieldset disabled={!draft?.analysis || busy || !health?.voice?.ready}>{copyFields.map(([key, label]) => <label className="rwField" key={key}>{label}对应的旁白句段<input value={prosody[key]} maxLength={300} onChange={(e) => setProsody((p) => ({ ...p, [key]: e.target.value }))} placeholder={key === 'title' ? '问句/开场，可用标点规划语气' : key === 'benefit' ? '重点与自然停顿' : '行动引导'} /></label>)}<label className="rwField">每句后停顿（秒）<input type="number" min="0" max="1.5" step="0.05" value={pause} onChange={(e) => setPause(Number(e.target.value))} /></label><button className="rwSecondary" type="button" disabled={dirty || !Object.values(prosody).some((s) => s.trim())} onClick={voice}>生成独立试听</button></fieldset>{draft?.voicePreview && <><audio controls src={mediaUrl(draft.voicePreview.url)} aria-label="本人 F5 旁白试听" /><p className="rwHint">实际 {draft.voicePreview.duration.toFixed(2)} 秒，画面跟随声音；{prosodyDirty ? '句段或停顿已修改，请重新生成试听；' : ''}{draft.voicePreview.approved ? '已认可' : '尚未听审认可'}。</p><button className="rwSecondary" type="button" disabled={busy || dirty || prosodyDirty || draft.voicePreview.approved} onClick={() => { if (window.confirm('已完整听审，并认可本次语气、停顿和本人声线，用于当前成片？')) operate(`voice/${draft.voicePreview.id}/approve`, { sha256: draft.voicePreview.sha256 }) }}>认可本次试听</button></>}</details>
      {preview.error && <p className="rwAlert">{preview.error}</p>}
      <div className="rwSubmitRow"><div><strong>{confirmed ? '当前方案已确认' : '先保存、预览并确认方案'}</strong><small>确认重绘文字/图标模板，不自动复制原人物场景</small></div><button className="rwSecondary" type="button" disabled={!draft?.analysis || busy || dirty || !!draft?.pendingQuestion || !voiceReady || confirmed} onClick={() => operate('confirm')}>确认方案</button><button className="rwPrimary" type="button" disabled={!confirmed || !preview.plan || busy || !voiceReady || !health?.ready} onClick={() => operate('render')}>制作模板成片 →</button></div>
    </section>
  </div>
}
