import { useEffect, useMemo, useRef, useState } from 'react'
import { REPLICA_LIMITS } from '../../replica'
import { DEFAULT_TEMPLATE, planTemplate, validateTemplate } from '../../replica-template'
import { renderTemplateSvg } from '../../replica-template-visual'

const API = (import.meta.env.VITE_REPLICA_API_URL || '/api/replica').replace(/\/$/, '')
const busyStates = ['queued', 'analyzing', 'chatting', 'voicing', 'rendering']
const copyFields = [['title', '开场钩子文案'], ['benefit', '利益点文案'], ['action', '行动引导文案']]
const PRESETS = [
  ['做一条 8 秒宠物零食广告，暖色调，最后品牌名定格', '宠物零食 · 暖色调广告'],
  ['做一条 6 秒绿色背景文字卡。标题：3 秒看懂；卖点：本地生成；行动：马上开始。文字黄色，弹跳入场', '绿色文字卡 · 本地生成'],
  ['做一条 8 秒国潮口红广告：深红背景金色光线，口红旋出，膏体特写旋转，品牌名「辞色」定格', '国潮口红 · 产品广告'],
]

export function readVideoSeconds(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(video.duration) ? video.duration : null) }
    video.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    video.src = url
  })
}

export function directorSendBlock({ requirement = '', chatBusy = false, dirty = false, planningReady = true } = {}) {
  if (!requirement.trim()) return '请输入想法后再发送'
  if (chatBusy) return '当前任务正在处理，请稍候再发送'
  if (dirty) return '先保存修改，再与导演对话'
  if (!planningReady) return '执行服务未连接；连接后才能发送规划'
  return ''
}

export default function TemplateEditor({ health, requestApi, mediaUrl, onJob, onWhiteboard, initialRequirement = '', handoff, jobBusy = false }) {
  const [file, setFile] = useState(null), [localUrl, setLocalUrl] = useState('')
  const [draft, setDraft] = useState(null), [drafts, setDrafts] = useState([])
  const [template, setTemplate] = useState({ ...DEFAULT_TEMPLATE })
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const [requirement, setRequirement] = useState(initialRequirement), [mode, setMode] = useState('local'), [shareImages, setShareImages] = useState(false)
  useEffect(() => { if (handoff?.copy) setRequirement(handoff.copy) }, [handoff])
  const [replaceReference, setReplaceReference] = useState(false)
  const [pendingTrim, setPendingTrim] = useState(null), [trimming, setTrimming] = useState(false)
  const [prosody, setProsody] = useState({ title: '', benefit: '', action: '' }), [pause, setPause] = useState(0.25)
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const [ragHits, setRagHits] = useState([])
  const [memoryHits, setMemoryHits] = useState([])
  const [prefs, setPrefs] = useState({ style: '', background: '#70adeb', duration: 4, copy: '' })
  const [prefStatus, setPrefStatus] = useState('')
  const [qAnswer, setQAnswer] = useState('')
  const generation = useRef(0), fileInput = useRef(null), previewId = useRef(null)
  const chatBusy = pending || busyStates.includes(draft?.status)
  const busy = chatBusy || jobBusy
  const planningReady = Boolean(health) && health.planning?.ready !== false
  const renderReady = Boolean(health?.ready)
  const dirty = draft && JSON.stringify(template) !== JSON.stringify(draft.template)
  const sendBlock = directorSendBlock({ requirement, chatBusy, dirty: Boolean(dirty), planningReady })
  const sendHint = [sendBlock, !renderReady ? '渲染器未就绪：仍可文字规划；制作成片需 Hypit。' : ''].filter(Boolean).join(' ')
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
  useEffect(() => { if (initialRequirement && health?.chat?.ready) setMode('api') }, [initialRequirement, health?.chat?.ready])
  useEffect(() => {
    if (!health?.planning?.ready) return
    let disposed = false
    requestApi('/drafts').then((data) => { if (!disposed) setDrafts(data.drafts) }).catch((e) => { if (!disposed) setError(e.message) })
    return () => { disposed = true }
  }, [health?.planning?.ready])
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

  // RAG: as the director requirement is typed, retrieve related methodology.
  useEffect(() => {
    const query = requirement.trim()
    if (query.length < 4) { setRagHits([]); return }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const data = await requestApi('/rag/search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ collection: 'methodology', query, top_k: 3 }),
        })
        if (!cancelled) setRagHits(data.ready ? data.hits : [])
      } catch {
        if (!cancelled) setRagHits([])
      }
    }, 450)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [requirement, health?.rag?.ready, requestApi])

  // Long-term memory: load saved preferences once the RAG service is ready.
  useEffect(() => {
    if (!health?.rag?.ready) return
    let disposed = false
    requestApi('/rag/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection: 'memory', query: '我的偏好 风格 背景 时长 文案', top_k: 8 }),
    }).then((data) => {
      if (disposed) return
      const hits = data.ready ? data.hits : []
      setMemoryHits(hits)
      setPrefs((current) => {
        const next = { ...current }
        for (const hit of hits) {
          const kind = hit.metadata?.kind
          if (kind === 'style' && next.style === '') next.style = hit.text.slice(0, 200)
          if (kind === 'background' && /^#[a-f0-9]{6}$/i.test(hit.text)) next.background = hit.text.toLowerCase()
          if (kind === 'duration') { const n = Number(hit.text); if (Number.isFinite(n) && n >= 0.5 && n <= 30) next.duration = n }
          if (kind === 'copy' && next.copy === '') next.copy = hit.text.slice(0, 200)
        }
        return next
      })
    }).catch(() => { if (!disposed) setMemoryHits([]) })
    return () => { disposed = true }
  }, [health?.rag?.ready, requestApi])

  const estimateChatCost = (requirement) => {
    const inputTokens = Math.round([...(requirement || '')].length * 0.6 + 1500)
    const fee = (inputTokens * 2 + 2400 * 8) / 1_000_000
    return Math.round(fee * 10000) / 10000
  }

  const savePrefs = async () => {
    if (!health?.rag?.ready) { setPrefStatus('知识库未就绪；偏好暂存在本轮会话。'); return }
    setPrefStatus('正在保存…')
    const items = [
      { item_id: 'pref-style', text: prefs.style.trim().slice(0, 200), meta: { kind: 'style' } },
      { item_id: 'pref-background', text: prefs.background, meta: { kind: 'background' } },
      { item_id: 'pref-duration', text: String(prefs.duration), meta: { kind: 'duration' } },
      { item_id: 'pref-copy', text: prefs.copy.trim().slice(0, 200), meta: { kind: 'copy' } },
    ].filter((item) => item.text)
    try {
      for (const item of items) await requestApi('/rag/memory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) })
      setPrefStatus(`已保存 ${items.length} 条偏好到我的记忆；后续对话自动应用。`)
    } catch (e) { setPrefStatus(e.message) }
  }

  const choose = async (candidate) => {
    if (!candidate) return
    if (!/\.(mp4|mov|webm|m4v)$/i.test(candidate.name) || !candidate.size || candidate.size > REPLICA_LIMITS.bytes) { setFile(null); setError('请选择不超过 25 MB 的 MP4、MOV、WebM 或 M4V 视频。'); return }
    generation.current++; setPending(false); setPlaying(false); setError('')
    const seconds = await readVideoSeconds(candidate)
    if (seconds !== null && seconds > REPLICA_LIMITS.seconds) {
      setPendingTrim({ file: candidate, seconds }); setFile(null); setTrimming(false)
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setPendingTrim(null)
    if (draft) {
      const replace = window.confirm('确定：替换当前会话的参考视频；取消：用这个视频新建会话。')
      setReplaceReference(replace)
      if (!replace) { setDraft(null); setTemplate({ ...DEFAULT_TEMPLATE }) }
    } else setReplaceReference(false)
    setFile(candidate)
  }
  const acceptTrim = async () => {
    if (!pendingTrim || trimming) return
    setTrimming(true); setError('')
    try {
      const form = new FormData()
      form.append('video', pendingTrim.file)
      form.append('seconds', String(REPLICA_LIMITS.seconds))
      const response = await fetch(`${API}/trim`, { method: 'POST', body: form, credentials: 'include' })
      if (!response.ok) {
        let message = '截取失败，请稍后重试。'
        try { message = (await response.json()).error || message } catch {}
        throw new Error(message)
      }
      const blob = await response.blob()
      const baseName = (pendingTrim.file.name || '参考视频').replace(/\.[^.]+$/, '')
      const trimmed = new File([blob], `${baseName}-前${REPLICA_LIMITS.seconds}秒.mp4`, { type: 'video/mp4' })
      setPendingTrim(null)
      if (draft) {
        const replace = window.confirm('确定：替换当前会话的参考视频；取消：用这个视频新建会话。')
        setReplaceReference(replace)
        if (!replace) { setDraft(null); setTemplate({ ...DEFAULT_TEMPLATE }) }
      } else setReplaceReference(false)
      setFile(trimmed)
    } catch (e) { setError(e.message) }
    finally { setTrimming(false) }
  }
  const operate = async (operation, body = {}) => {
    if (!draft || busy) return
    if (operation === 'video-submit') {
      const plan = draft.videoPlan
      if (!plan?.estimate?.cny) { setError('请先确认当前方案，由官方 H3 连接器生成离线费用计划。'); return }
      if (!window.confirm(`提交 ${plan.duration} 秒 MiniMax H3 视频？预估 ¥${plan.estimate.cny}（${plan.resolution}，官方价格快照 ${plan.estimate.snapshotDate}，实际以供应商账单为准）。此次只提交一个付费任务，网络结果不确定时不会自动重提。`)) return
      body = { ...body, confirmCostCny: plan.estimate.cny }
    }
    const token = generation.current; setPending(true); setError('')
    try {
      const value = await requestApi(`/drafts/${draft.id}${operation ? `/${operation}` : ''}`, { method: operation ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: draft.revision, ...body }) })
      if (generation.current !== token) return
      if (operation === 'render' || operation === 'video-submit') onJob(value)
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
    const token = ++generation.current; setPending(true); setFile(null); setDraft(null); setError(''); setQAnswer('')
    try { const value = await requestApi(`/drafts/${id}`); if (generation.current === token) acceptDraft(value) }
    catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const newSession = () => {
    generation.current++; setPending(false); setDraft(null); setFile(null); setReplaceReference(false); setTemplate({ ...DEFAULT_TEMPLATE }); setRequirement(''); setError(''); setPlaying(false); setQAnswer('')
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
  const submitTurn = async (auto = false, textOverride = '') => {
    const text = textOverride || requirement
    if (directorSendBlock({ requirement: text, chatBusy, dirty: Boolean(dirty), planningReady })) return
    if (auto && mode === 'api') { setError('一键全自动走本地向导（零模型费）；外发模式请手动逐轮发送。'); return }
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
      let memory = []
      if (health?.rag?.ready) {
        try {
          const search = await requestApi('/rag/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collection: 'memory', query: requirement.trim(), top_k: 3 }) })
          if (search.ready) memory = search.hits.map((h) => ({ text: h.text, meta: h.metadata }))
        } catch { /* memory is optional */ }
      }
      const payload = { revision: current.revision, message: text.trim(), mode, auto: Boolean(auto), memory, ...(mode === 'api' ? { consent: { provider: health.chat.model, shareImages } } : {}) }
      const value = await requestApi(`/drafts/${current.id}/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      if (generation.current !== token) return
      acceptDraft(value); setRequirement(''); setFile(null); setReplaceReference(false); setQAnswer('')
      if (auto) {
        const settled = await waitDraft(current.id, token)
        if (settled.status === 'failed') throw new Error(settled.error || '自动规划未完成。')
        if (settled.directorPlan?.status === 'executable' && renderReady && !settled.pendingQuestion) {
          await requestApi(`/drafts/${current.id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: settled.revision }) })
          const job = await requestApi(`/drafts/${current.id}/render`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: settled.revision }) })
          if (generation.current === token) onJob(job)
        }
      }
    } catch (e) { if (generation.current === token) setError(e.message) }
    finally { if (generation.current === token) setPending(false) }
  }
  const answerQuestion = async (option) => {
    const answer = (option || qAnswer || '').trim()
    if (!answer) return
    setRequirement(''); setQAnswer('')
    submitTurn(false, answer)
  }
  const voice = () => {
    const segments = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
    operate('voice', { narration: segments.map((p) => p.text).join('\n'), prosody: segments })
  }
  const field = (key, value) => setTemplate((t) => ({ ...t, [key]: value }))
  const confirmed = draft && !dirty && draft.confirmedRevision === draft.revision && Boolean(draft.confirmedPlanHash)
  const executable = draft?.directorPlan?.status === 'executable' && draft.directorPlan.route.kind === 'hypit-template' && !draft.pendingQuestion
  const complexPlanReady = draft?.directorPlan && draft.directorPlan.route.kind !== 'hypit-template' && !draft.pendingQuestion && Boolean(draft.directorPlan.prompt?.trim())
  const currentProsody = copyFields.map(([field]) => ({ field, text: prosody[field].trim(), pause })).filter((p) => p.text)
  const prosodyDirty = draft?.voicePreview && JSON.stringify(currentProsody) !== JSON.stringify(draft.voicePreview.prosody)
  const voiceReady = template.audioMode !== 'voice' || (draft?.voicePreview?.approved && draft.voicePreview.revision === draft.revision && !dirty && !prosodyDirty)
  const questionCount = (draft?.messages || []).filter((m) => m.role === 'assistant' && m.mode === 'api').length
  const referenceName = file?.name || draft?.filename || ''
  const referenceMeta = draft?.analysis ? `${draft.analysis.metadata.duration.toFixed(2)} 秒 · ${draft.analysis.metadata.width}×${draft.analysis.metadata.height}` : (file ? '发送后自动测量时长和尺寸' : '')
  return <div className="rtShell">
    <div className="rtMain">
      <section className="rwPanel rtHero" aria-labelledby="rt-hero-title">
        <p className="rwEyebrow">01 / DIRECTOR AGENT</p>
        <h2 id="rt-hero-title" className="rtHeroTitle">今天想让 Agent 完成什么？</h2>
        <p className="rtHeroSub">MOMOCO 导演 Skill 先拆解剧本、镜头和资产缺口；图形文字路由 Hypit 执行，真人、产品和复杂运镜再生成 MiniMax H3 离线计划。</p>
        <div className="rtComposer">
          <label className="rwField">你的想法<textarea aria-label="告诉导演你想做什么" rows={4} maxLength={2000} value={requirement} disabled={chatBusy} onChange={(e) => setRequirement(e.target.value)} placeholder="例如：做一条 6 秒绿色背景文字卡。标题：3 秒看懂；卖点：本地生成；行动：马上开始。文字黄色，弹跳入场。" /></label>
          <div className="rtRouteBar"><span className={`rtRoutePill ${mode === 'api' ? 'isApi' : ''}`}>{mode === 'api' ? health?.chat?.model || 'DeepSeek 对话' : '本地向导'}</span><span className="rtRoutePill isVideo">{health?.video?.ready ? 'MiniMax H3 视频' : '视频模型未启用'}</span><span className="rtRoutePill isLocal">Hypit 本地渲染</span></div>
          <div className="rtDialogueActions"><label className="rwField">本轮规划方式<select aria-label="本轮规划方式" value={mode} disabled={chatBusy} onChange={(e) => { setMode(e.target.value); setShareImages(false) }}><option value="local">本地向导 · 零模型调用费</option>{health?.chat?.ready && <option value="api">{health.chat.model} · 所有者承担费用</option>}</select></label></div>
          <div className="rtComposerActions">
            <button className="rwSecondary" type="button" disabled={busy} onClick={() => fileInput.current.click()}>添加参考视频</button>
            <button className="rwSecondary rtAutoButton" type="button" title={mode === 'api' ? '一键全自动仅走本地向导（零模型费）' : '一句话 → 自动拆解 → 自动确认 → 直接出片'} disabled={Boolean(sendBlock) || mode === 'api'} onClick={() => submitTurn(true)}>⚡ 一键全自动</button>
            <button className="rwPrimary" type="button" disabled={Boolean(sendBlock)} onClick={() => submitTurn(false)} aria-describedby="rt-send-hint">{mode === 'api' ? '确认外发并发送' : '发送给导演'} →</button>
          </div>
          {mode === 'api' && health?.chat?.ready ? <p className="rtRouting" role="status"><strong>本次路由：{health.chat.model} 对话</strong><span>需求拆解外发，成片仍由本地 Hypit 渲染 · 预估 ¥{estimateChatCost(requirement)}/轮（估算，以供应商账单为准）</span></p> : <p className="rtRouting" role="status"><strong>本次路由：本地 Hypit · 零模型费</strong><span>本地向导 + RAG 检索 + FFmpeg 均在机内执行，不调用外部模型</span></p>}
          <p className="rwHint" id="rt-send-hint" role="status">{sendHint || '输入想法后即可发送给导演。'}</p>
        </div>
        {(referenceName || draft?.inputUrl) && <div className="rtRefBar"><span className="rtRefIcon">▶</span><div><strong>{referenceName || draft.filename}</strong><small>{referenceMeta || (localUrl || mediaUrl(draft.inputUrl)) ? '已选参考视频，发送时自动分析' : ''}</small></div><button className="rwSecondary" type="button" disabled={busy} onClick={() => fileInput.current.click()}>更换</button></div>}
        <div className="rtPresets"><span className="rtPresetsLabel">试试：</span>{PRESETS.map(([text, label]) => <button key={label} type="button" disabled={chatBusy} onClick={() => { setRequirement(text); setError('') }}><small>{label}</small>{text.slice(0, 26)}{text.length > 26 ? '…' : ''}</button>)}</div>
        {mode === 'api' && <><p className="rwHint">外发测量、文案、需求及近期对话，不发送视频或声音参考。{health.chat.costNotice}</p>{health.chat.vision && <label className="rwAudio"><input type="checkbox" checked={shareImages} onChange={(e) => setShareImages(e.target.checked)} disabled={busy} />本轮允许外发最多三张代表帧</label>}</>}
        <p className="rwHint">{health?.chat?.ready ? `原版导演 Skill：${health.chat.directorReady ? '已读取，仅用于规划' : '未读取'}` : '模型接口未配置；本地向导只能理解已列出的颜色、动效与开场选项。'}</p>
      </section>

      <section className="rtFlow" aria-label="导演对话记录">
        <div className="rwPanelHead"><div><p className="rwEyebrow">02 / DIALOGUE</p><h2>对话与追问</h2></div><span className="rwPill rwFree">{mode === 'api' ? 'DeepSeek 拆解' : '本地优先'}</span></div>
        <div className="rtMessages">
          {draft?.messages?.length ? draft.messages.map((m, i) => <div key={i} className={`rtBubble ${m.role === 'user' ? 'rtBubbleUser' : ''}`}><strong>{m.role === 'user' ? '你的需求' : m.mode === 'api' ? '模型导演' : '本地向导'}</strong><p>{m.content}</p></div>) : <div className="rtBubble"><strong>导演 Agent</strong><p>可以先只说想法，也可以添加参考视频。简单图形由本地 Hypit 执行，复杂镜头可在确认方案与费用后交给 MiniMax；已有旁白可转到白板工坊。</p></div>}
        </div>
        {draft?.pendingQuestion && <div className="rtQuestionCard"><div className="rtQHead"><span>{mode === 'api' ? '模型导演' : '本地向导'}</span><span className="rtQStep">{mode === 'api' ? `澄清 · 第 ${questionCount} 轮` : '选项确认'}</span></div><p className="rtQText">{draft.pendingQuestion.text}</p>{Array.isArray(draft.pendingQuestion.options) && draft.pendingQuestion.options.length > 0 && <div className="rtQOptions">{draft.pendingQuestion.options.map((option) => <button key={option} type="button" disabled={busy} onClick={() => answerQuestion(option)}>{option}</button>)}</div>}<label className="rwField">选择之外的想法写这里（可空）<input value={qAnswer} maxLength={2000} disabled={busy} onChange={(e) => setQAnswer(e.target.value)} placeholder="可直接补充你的选择，点「下一步」发送" /></label><button className="rwPrimary" type="button" disabled={busy || !qAnswer.trim()} onClick={() => answerQuestion('')}>下一步 →</button>{draft.directorPlan?.route?.kind !== 'hypit-template' ? <p className="rwHint">选中选项或补充想法后点「下一步」，导演会继续细化方案。</p> : <p className="rwHint">在下方编辑后点击“保存修改”即按当前控件方案处理。</p>}</div>}
        {ragHits.length > 0 && <div className="rtRagPanel" aria-label="知识库方法论建议"><h3>知识库方法论 · RAG 检索 <span>{health?.rag?.embedding === 'transformer' ? `${health.rag.embedding_dim} 维语义检索` : '降级'}</span></h3>{ragHits.map((h) => <p key={h.id}><span className="rtRagTopic">{h.metadata?.topic || '方法论'}</span>{h.text}</p>)}</div>}
        {pendingTrim && <div className="rwAlert rtTrimAlert" role="alert"><strong>视频时长 {pendingTrim.seconds.toFixed(1)} 秒，最长 {REPLICA_LIMITS.seconds} 秒</strong><p>可换一个 30 秒内的视频；也可由服务端截取前 {REPLICA_LIMITS.seconds} 秒，生成独立副本，你的原视频不会被修改。</p><div className="rtActions"><button className="rwSecondary" type="button" disabled={trimming} onClick={() => { setPendingTrim(null); setFile(null); if (fileInput.current) { fileInput.current.value = ''; fileInput.current.click() } }}>换一个 30 秒内的视频</button><button className="rwPrimary" type="button" disabled={trimming} onClick={acceptTrim}>{trimming ? '正在截取…' : `截取前 ${REPLICA_LIMITS.seconds} 秒（独立副本）`}</button></div></div>}
        {error && <p className="rwAlert" role="alert">{error}</p>}{draft?.error && <p className="rwAlert" role="alert">{draft.error}</p>}
      </section>

      <section className="rwPanel rtPlanPanel" aria-labelledby="rt-plan-title">
        <div className="rwPanelHead"><div><p className="rwEyebrow">03 / PRODUCTION PLAN</p><h2 id="rt-plan-title">当前方案</h2></div><span className={`rwPill ${executable ? 'rwFree' : ''}`}>{draft?.directorPlan ? executable ? '可执行' : '仅规划' : '待沟通'}</span></div>
        <h3>证据来源</h3>{draft?.directorPlan?.reference ? <><p>{draft.directorPlan.reference.summary}</p><ul>{draft.directorPlan.reference.evidence.map((item, index) => <li key={index}><span>{item.source}</span>{item.text}</li>)}</ul></> : <p className="rtNoEvidence">本次没有参考原片；当前方案仅依据你的文字和默认画布。</p>}
        <p className="rwHint">当前分析只测量时长与尺寸，没有 OCR/ASR，不自动识别文字、语音或剧情。</p>
        {draft?.directorPlan ? <><div className="rtPlanMeta"><span>{draft.directorPlan.canvas.width}×{draft.directorPlan.canvas.height}</span><span>{draft.directorPlan.canvas.duration} 秒</span><span>{draft.directorPlan.route.kind}</span><span>{draft.directorPlan.audio.mode}</span></div><h3>镜头时间线</h3>{draft.directorPlan.shots.length ? <ol className="rtShots">{draft.directorPlan.shots.map((shot) => <li key={shot.id}><strong>{shot.start.toFixed(2)}–{shot.end.toFixed(2)} 秒</strong><span>{shot.task} · {shot.text}</span></li>)}</ol> : <p className="rwHint">需要继续补充可制作文案或复杂镜头素材。</p>}{draft.directorPlan.blockers.length > 0 && <div className="rwAlert">{draft.directorPlan.blockers.join('；')}</div>}<label className="rwField">可复制视频指令<textarea aria-label="可复制视频指令" readOnly rows={6} value={draft.directorPlan.prompt} /></label><button className="rwSecondary" type="button" onClick={() => navigator.clipboard?.writeText(draft.directorPlan.prompt)}>复制视频指令</button></> : <><p className="rwHint">发送第一条消息后，这里会显示参数、时间线、生产路径和可复制提示词。</p><button className="rwSecondary" type="button" disabled>复制视频指令</button></>}
        {draft?.directorPlan?.assets?.length > 0 && <div><h3>资产清单</h3><ol className="rtShots">{draft.directorPlan.assets.map((asset) => <li key={asset.id}><strong>{asset.type}</strong><span>{asset.description} · 权利：{asset.rights}</span></li>)}</ol></div>}
        {draft?.directorPlan && !draft.directorPlan.assets.length && <p className="rwHint">当前没有绑定资产；私有图片不会自动上传给视频模型。</p>}
        {draft?.videoPlan && <p className="rtRouting" role="status"><strong>H3 离线计划：¥{draft.videoPlan.estimate.cny}</strong><span>{draft.videoPlan.model} · {draft.videoPlan.duration} 秒 · {draft.videoPlan.resolution} · 价格快照 {draft.videoPlan.estimate.snapshotDate}</span></p>}
        {onWhiteboard && <button className="rwSecondary" type="button" disabled={busy} onClick={() => onWhiteboard([template.title, template.benefit, template.action].filter(Boolean).join("\n"))}>带着当前文案制作白板 →</button>}
        <div className="rwSubmitRow"><div><strong>{confirmed ? '当前方案已确认' : executable ? '方案可以交给本地 Hypit' : complexPlanReady ? '复杂镜头方案已就绪，可确认后提交生成' : '继续和导演沟通'}</strong><small>{confirmed && executable ? (renderReady ? '确认后才会创建独立任务' : '渲染器未就绪：图形卡成片需 Hypit；复杂镜头可走 MiniMax') : confirmed && complexPlanReady ? '提交后由 MiniMax H3 云端生成，按量计费（以供应商账单为准），生成期间可查看进度' : executable ? '确认后才会创建独立任务' : complexPlanReady ? '确认后才会提交 MiniMax 生成' : '复杂镜头不会伪装成本地成片'}</small></div><button className="rwSecondary" type="button" disabled={(!executable && !complexPlanReady) || busy || dirty || (executable && !voiceReady) || confirmed} onClick={() => operate('confirm')}>确认当前方案</button>{executable ? <button className="rwPrimary" type="button" disabled={!confirmed || !preview.plan || busy || !voiceReady || !renderReady} onClick={() => operate('render')}>制作成片 →</button> : draft?.directorPlan ? <button className="rwPrimary" type="button" disabled={!confirmed || busy || !health?.video?.ready} onClick={() => operate('video-submit')} title="复杂人物镜头由 MiniMax H3 云端生成，按量计费">{health?.video?.ready ? '提交 MiniMax 生成 →' : 'MiniMax 未启用 →'}</button> : <button className="rwPrimary" type="button" disabled>制作成片 →</button>}</div>
      </section>
    </div>

    <aside className="rtSidebar" aria-label="会话管理">
      <div className="rwPanelHead"><div><p className="rwEyebrow">SESSIONS</p><h2>会话历史</h2></div><button className="rwSecondary" type="button" disabled={busy} onClick={newSession}>＋ 新建会话</button></div>
      <label className="rwField">恢复会话<select aria-label="恢复会话" value={draft?.id || ''} onChange={(e) => restore(e.target.value)}><option value="">选择已保存会话</option>{drafts.map((d) => <option key={d.id} value={d.id}>{d.filename} · {d.revision}版</option>)}</select></label>
      <div className="rtDraftList">{drafts.slice(0, 12).map((d) => <button key={d.id} type="button" className={`rtDraftRow ${draft?.id === d.id ? 'isActive' : ''}`} disabled={busy} onClick={() => restore(d.id)}><strong>{d.filename}</strong><small>{d.revision} 版 · {({ idle: '已就绪', failed: '失败', chatting: '处理中', queued: '排队中', analyzing: '分析中', voicing: '配音中', rendering: '渲染中' })[d.status] || d.status}</small></button>)}</div>
      {draft && <button type="button" className="rwSecondary" disabled={busy} onClick={removeDraft}>删除此会话</button>}
      <p className="rtLive" role="status" aria-live="polite">{pending ? '正在提交…' : draft?.message || '等待你的想法'}{busyStates.includes(draft?.status) ? ` · ${draft.progress || 0}%` : ''}</p>
      <details className="rtSection rtSideSection"><summary>模板实时预览</summary>{preview.plan && <div className="rtPreview"><div className="rtSvg" role="img" aria-label="重建模板图形预览" dangerouslySetInnerHTML={{ __html: renderTemplateSvg(preview.plan, template, time) }} /><div className="rwPreviewControls"><button type="button" onClick={() => { setTime(0); setPlaying(true) }}>播放模板预览</button><button type="button" onClick={() => setPlaying(false)}>暂停</button><span>{time.toFixed(1)} / {preview.plan.duration.toFixed(1)} s</span></div><label className="rwField rwSlider">预览时间<input type="range" min="0" max={preview.plan.duration} step="0.0333" value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)) }} /></label><p className="rwHint">预览与 Hypit 共用图形；最终以编码 MP4 为准。</p></div>}</details>
      {draft?.analysis && <details className="rtSection rtSideSection" open><summary>参考视频测量</summary><div className="rtEvidence"><p>{draft.analysis.background.stable ? `稳定边缘主色候选 ${draft.analysis.background.color}` : '未找到稳定纯色边缘；选择此模板将重绘画面，不保留原人物或场景。'}</p><div className="rtFrames">{draft.frames.map((f) => <figure key={f.id}><img src={mediaUrl(f.url)} alt={`原片第 ${f.at.toFixed(2)} 秒代表帧`} /><figcaption>{f.at.toFixed(2)} s</figcaption></figure>)}</div><p className="rwHint">六点抽样仅说明边缘颜色与像素变化，原文、语音和剧情均待确认。</p></div></details>}
      <details className="rtSection rtSideSection"><summary>高级模板与声音设置</summary><p className="rwEyebrow">成片文案与视觉参数</p><fieldset disabled={!draft || busy}>
        {copyFields.map(([key, label]) => <div className="rtCopyRow" key={key}><label className="rwField">{label}<textarea aria-label={label} rows={2} maxLength={40} value={template[key]} onChange={(e) => field(key, e.target.value)} placeholder="手动确认或重写，不填修改指令" /></label><label className="rwField">文字颜色<input type="color" aria-label={`${label}颜色`} value={template[`${key}Color`]} onChange={(e) => field(`${key}Color`, e.target.value)} /><small>{template[`${key}Color`]}</small></label></div>)}
        <div className="rtOptions"><label className="rwField">背景颜色<input type="color" aria-label="背景颜色" value={template.background} onChange={(e) => field('background', e.target.value)} /><small>{template.background}</small></label><label className="rwField">文字动效<select aria-label="文字动效" value={template.textMotion} onChange={(e) => field('textMotion', e.target.value)}><option value="none">无动效</option><option value="fade">淡入</option><option value="bounce">弹跳入场</option></select></label><label className="rwField">光环动效<select value={template.ringMotion} onChange={(e) => field('ringMotion', e.target.value)}><option value="none">静止</option><option value="rotate">旋转</option></select></label><label className="rwField">文案节奏<select value={template.opening} onChange={(e) => field('opening', e.target.value)}><option value="simultaneous">同时出现</option><option value="staged">逐段出现</option></select></label><label className="rwField">模板时长（秒）<input type="number" min="0.5" max="30" step="0.1" value={template.duration} onChange={(e) => field('duration', Number(e.target.value))} /></label><label className="rwField">成片声音<select aria-label="成片声音" value={template.audioMode} onChange={(e) => field('audioMode', e.target.value)}><option value="mute">静音</option><option value="original">保留原音轨</option><option value="voice" disabled={!health?.voice?.ready}>本人 F5 旁白试听</option></select></label></div>
      </fieldset><div className="rtActions"><button className="rwSecondary" type="button" disabled={!draft || busy || draft?.directorPlan?.route?.kind !== 'hypit-template' || (!dirty && !draft?.pendingQuestion)} onClick={save}>保存修改</button><span className="rwHint">{draft?.directorPlan?.route?.kind !== 'hypit-template' ? '复杂镜头方案请在输入框直接回复导演；模板控件只影响本地文字卡。' : dirty ? '有未保存修改；先保存再对话或确认。' : '方案修改会使旧确认与声音认可失效。'}</span></div></details>
      {template.audioMode === 'original' && <p className="rwAlert">请确认原声与新文案不冲突。时长更长时尾部补静音，不循环或拉伸原声。</p>}
      <details className="rtSection rtSideSection"><summary>本人旁白 · 先试听，再认可</summary><p className="rwHint">只用本人本地 F5。新问句、重点和停顿需要听审，不能保证标点直接控制情绪；不加速。商业权重许可：{health?.voice?.commercialLicense || 'pending_verification'}。</p>{!health?.voice?.ready && <p className="rwHint">{health?.voice?.reasons?.join('；') || 'F5 尚未就绪，不自动换声。'}</p>}<fieldset disabled={!draft || busy || !health?.voice?.ready}>{copyFields.map(([key, label]) => <label className="rwField" key={key}>{label}对应的旁白句段<input value={prosody[key]} maxLength={300} onChange={(e) => setProsody((p) => ({ ...p, [key]: e.target.value }))} placeholder={key === 'title' ? '问句/开场，可用标点规划语气' : key === 'benefit' ? '重点与自然停顿' : '行动引导'} /></label>)}<label className="rwField">每句后停顿（秒）<input type="number" min="0" max="1.5" step="0.05" value={pause} onChange={(e) => setPause(Number(e.target.value))} /></label><button className="rwSecondary" type="button" disabled={dirty || !Object.values(prosody).some((s) => s.trim())} onClick={voice}>生成独立试听</button></fieldset>{draft?.voicePreview && <><audio controls src={mediaUrl(draft.voicePreview.url)} aria-label="本人 F5 旁白试听" /><p className="rwHint">实际 {draft.voicePreview.duration.toFixed(2)} 秒，画面跟随声音；{prosodyDirty ? '句段或停顿已修改，请重新生成试听；' : ''}{draft.voicePreview.approved ? '已认可' : '尚未听审认可'}。</p><button className="rwSecondary" type="button" disabled={busy || dirty || prosodyDirty || draft.voicePreview.approved} onClick={() => { if (window.confirm('已完整听审，并认可本次语气、停顿和本人声线，用于当前成片？')) operate(`voice/${draft.voicePreview.id}/approve`, { sha256: draft.voicePreview.sha256 }) }}>认可本次试听</button></>}</details>
      <details className="rtSection rtSideSection"><summary>我的偏好记忆 · 跨会话 RAG</summary><p className="rwHint">保存后写入 rag-service 的 memory 库，按会话身份隔离；后续对话自动应用背景色与时长，并作为方案证据展示。{health?.rag?.ready ? `语义库就绪（${health.rag.embedding_dim} 维）` : '知识库未就绪；偏好仅保留在本轮会话。'}</p><div className="rtPrefs"><label className="rwField">常用风格描述<input value={prefs.style} maxLength={200} onChange={(e) => setPrefs((p) => ({ ...p, style: e.target.value }))} placeholder="例如：暖色调、大字排版、节奏卡点" /></label><label className="rwField">常用背景色<input type="color" value={prefs.background} onChange={(e) => setPrefs((p) => ({ ...p, background: e.target.value }))} /><small>{prefs.background}</small></label><label className="rwField">常用时长（秒）<input type="number" min="0.5" max="30" step="0.1" value={prefs.duration} onChange={(e) => setPrefs((p) => ({ ...p, duration: Number(e.target.value) }))} /></label><label className="rwField">文案模板提示<input value={prefs.copy} maxLength={200} onChange={(e) => setPrefs((p) => ({ ...p, copy: e.target.value }))} placeholder="例如：先抛钩子，再讲卖点，最后行动引导" /></label></div><div className="rtActions"><button className="rwSecondary" type="button" onClick={savePrefs}>保存到我的记忆</button>{memoryHits.length > 0 && <span className="rwHint">已记住 {memoryHits.length} 条偏好（背景/时长/风格/文案）</span>}</div>{prefStatus && <p className="rwHint">{prefStatus}</p>}</details>
      {preview.error && <p className="rwAlert">{preview.error}</p>}
      <input ref={fileInput} className="rwFileInput" type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" aria-label="添加参考视频" onChange={(e) => { choose(e.target.files[0]); e.target.value = '' }} />
    </aside>
  </div>
}
