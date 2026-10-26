import { useEffect, useMemo, useRef, useState } from 'react'
import snapshot from '../../model-catalog.json'
import { MODEL_POLICY, imageModels } from '../../model-policy.js'
import ReplicaWorkbench from '../ReplicaWorkbench/ReplicaWorkbench'
import NativeBoard from '../CSBoard/NativeBoard'
import SkillSquare from './SkillSquare'
import './ModelWorkbench.css'

const API = (import.meta.env.VITE_MODELS_API_URL || 'https://ci-interview-gateway.pages.dev').replace(/\/$/, '')
const categories = [['all', '全部'], ['chat', '聊天'], ['image', '图片'], ['video', '视频'], ['audio', '音频'], ['mine', '我的']]
const sections = [['models', '✧', '大模型'], ['agents', '▦', '智能体'], ['skills', '⌘', 'Skill 广场']]
const typeName = { chat: '聊天', image: '图片', video: '视频', audio: '音频' }
const uid = () => crypto.randomUUID()
const read = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) || fallback } catch { return fallback } }
function Symbol({ type = 'chat', small = false }) {
  return <span className={`mwSymbol mwSymbol-${type} ${small ? 'mwSymbolSmall' : ''}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 5 30 18 43 24 30 30 24 43 18 30 5 24 18 18Z" fill="currentColor" /><path d="m24 15 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="white" /></svg></span>
}

export default function ModelWorkbench({ onBack, initialSection = 'models', initialAgent = 'director', initialRequirement = '' }) {
  const [section, setSection] = useState(initialSection)
  const [agent, setAgent] = useState(initialAgent)
  const [visitedAgents, setVisitedAgents] = useState(initialSection === 'agents' ? [initialAgent] : [])
  const [directorAction, setDirectorAction] = useState({ tab: 'template', copy: initialRequirement })
  const [whiteboardHandoff, setWhiteboardHandoff] = useState(null)
  const [models, setModels] = useState(() => snapshot.models.map(model => ({ ...model, enabled: Boolean(MODEL_POLICY[model.id]), limit: MODEL_POLICY[model.id]?.visitor || 0 })))
  const [ready, setReady] = useState(false)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [selectedId, setSelectedId] = useState(() => {
    const model = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('model')
    return snapshot.models.some(item => item.id === model && MODEL_POLICY[item.id]) ? model : 'deepseek-v4.1-flash'
  })
  const [draft, setDraft] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [reference, setReference] = useState('')
  const [referenceName, setReferenceName] = useState('')
  const [session, setSession] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [publicAccess, setPublicAccess] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [conversation, setConversation] = useState('')
  const [messages, setMessages] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const shell = useRef(null)
  const end = useRef(null)
  const referenceVersion = useRef(0)
  useEffect(() => {
    for (const media of shell.current?.querySelectorAll('audio,video') || []) {
      if (media.parentElement?.closest('[hidden]')) media.pause()
    }
  }, [section, agent])
  const selected = models.find(model => model.id === selectedId) || models[0]
  const imageProfile = imageModels[selectedId]
  useEffect(() => {
    referenceVersion.current++
    setSize(imageProfile?.defaults[imageProfile.sizeField] || '')
    setReference(''); setReferenceName('')
    return () => { referenceVersion.current++ }
  }, [selectedId])
  const locked = !selected?.enabled
  const providers = useMemo(() => [...new Set(models.map(model => model.provider))].sort(), [models])
  const filtered = useMemo(() => models.filter(model => (category === 'all' || model.type === category) && (provider === 'all' || model.provider === provider) && `${model.name} ${model.description}`.toLowerCase().includes(query.toLowerCase())), [models, category, provider, query])
  const switchSection = (value) => {
    setSection(value); setSidebarOpen(false); setShowHistory(false)
    if (value === 'agents') setVisitedAgents(current => current.includes(agent) ? current : [...current, agent])
  }
  const openAgent = (value, action) => {
    setAgent(value); setSection('agents'); setSidebarOpen(false); setShowHistory(false)
    setVisitedAgents(current => current.includes(value) ? current : [...current, value])
    if (value === 'director' && action) setDirectorAction(action)
    if (value === 'whiteboard' && action?.copy) setWhiteboardHandoff({ copy: action.copy })
  }
  const tabKey = (event) => {
    const current = sections.findIndex(([id]) => id === section)
    const next = ({ ArrowRight: (current + 1) % 3, ArrowLeft: (current + 2) % 3, Home: 0, End: 2 })[event.key]
    if (next === undefined) return
    event.preventDefault(); switchSection(sections[next][0]); setSidebarOpen(true)
    event.currentTarget.querySelectorAll('[role="tab"]')[next].focus()
  }

  const call = async (path, options = {}, token = session) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), path === '/api/images' ? 210000 : path === '/api/chat' ? 75000 : 15000)
    try {
      const response = await fetch(API + path, { ...options, signal: controller.signal, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } })
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('模型体验服务暂时无法连接，请稍后再试。')
      const data = await response.json()
      if (!response.ok) { if (response.status === 401) { setSession(''); sessionStorage.removeItem('portfolio-model-session'); sessionStorage.removeItem('portfolio-model-session-expiry') }; throw Object.assign(new Error(data.error || '本次请求未完成。'), { status: response.status }) }
      return data
    } catch (err) {
      if (controller.signal.aborted) throw new Error('连接超时，请检查网络后重试连接。已提交的生成请求可查看任务状态。')
      if (err instanceof TypeError) throw new Error('暂时无法连接模型服务，请检查网络后重试连接。')
      throw err
    } finally { clearTimeout(timer) }
  }
  const authorize = async (value = '', guest = false) => {
    if (!guest && !value.trim()) return
    setAuthBusy(true); setError('')
    try {
      const data = await call('/api/sessions', { method: 'POST', body: JSON.stringify(guest ? {} : { code: value.trim() }) }, '')
      if (typeof data.token !== 'string' || !data.token) throw new Error('访客会话未能建立，请重试连接。')
      setSession(data.token); sessionStorage.setItem('portfolio-model-session', data.token)
      sessionStorage.setItem('portfolio-model-session-expiry', String(Date.now() + (data.expiresIn || 8 * 3600) * 1000))
      sessionStorage.removeItem('portfolio-model-invite')
      const url = new URL(window.location.href); url.hash = ''; window.history.replaceState(window.history.state, '', url)
    } catch (err) { setError(err.message) } finally { setAuthBusy(false) }
  }
  const connect = async (saved = session) => {
    setCatalogLoading(true); setError('')
    try {
      const data = await call('/api/models', {}, '')
      setModels(data.models); setReady(data.ready); setPublicAccess(Boolean(data.publicAccess))
      const invite = new URLSearchParams(window.location.hash.slice(1)).get('experience') || sessionStorage.getItem('portfolio-model-invite')
      if (data.ready && data.publicAccess && !saved) await authorize('', true)
      else if (data.ready && invite && !saved) await authorize(invite)
    } catch (err) { setReady(false); setPublicAccess(false); setError(err.message) }
    finally { setCatalogLoading(false) }
  }
  useEffect(() => {
    const saved = Number(sessionStorage.getItem('portfolio-model-session-expiry')) > Date.now() ? sessionStorage.getItem('portfolio-model-session') || '' : ''
    if (!saved) sessionStorage.removeItem('portfolio-model-session')
    setSession(saved)
    setHistory(read(localStorage, 'portfolio-model-history', []))
    connect(saved)
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages])
  const save = (next, id = conversation) => {
    const conversationId = id || uid()
    setConversation(conversationId); setMessages(next)
    const item = { id: conversationId, modelId: selectedId, title: next.find(message => message.role === 'user')?.content.slice(0, 24) || '新对话', messages: next.slice(-24), updatedAt: new Date().toISOString() }
    setHistory(current => {
      const updated = [item, ...current.filter(entry => entry.id !== conversationId)].slice(0, 12)
      try { localStorage.setItem('portfolio-model-history', JSON.stringify(updated)) } catch { /* Browser storage is optional. */ }
      return updated
    })
  }
  const start = (modelId = selectedId) => { if (busy) return; setSelectedId(modelId); setMessages([]); setConversation(''); setError(''); setShowHistory(false); setSidebarOpen(false) }
  const chooseReference = async event => {
    const version = ++referenceVersion.current
    const file = event.target.files?.[0]
    setReference(''); setReferenceName(''); event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('参考图仅支持 5MB 以内的 PNG、JPEG 或 WebP。'); return }
    try {
      const value = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      if (version !== referenceVersion.current) return
      setReference(value); setReferenceName(file.name); setError('')
    } catch { if (version === referenceVersion.current) setError('读取参考图失败，请重新选择。') }
  }
  const setResult = (previous, task, modelId, id) => {
    const next = [...previous, { role: 'assistant', content: task.text || task.error || '任务正在处理，可稍后查看结果。', imageUrl: task.imageUrl, status: task.status, taskId: task.id, modelId }]
    save(next, id)
  }
  const submit = async (event) => {
    event.preventDefault()
    if (busy || locked || !ready || !session || !draft.trim() || (imageProfile?.referenceRequired && !reference)) return
    const content = draft.trim(); const requestId = uid(); const modelId = selectedId
    const id = conversation || uid()
    const previous = [...messages, { role: 'user', content, modelId, taskId: requestId }]
    save(previous, id); setDraft(''); setBusy(true); setError('')
    try {
      const body = selected.type === 'chat'
        ? { requestId, modelId, messages: previous.filter(message => !message.status || message.status === 'complete').slice(-8).map(({ role, content }) => ({ role, content })) }
        : { requestId, modelId, prompt: content, size, ...(reference ? { reference } : {}) }
      const result = await call(selected.type === 'chat' ? '/api/chat' : '/api/images', { method: 'POST', body: JSON.stringify(body) })
      setResult(previous, result, modelId, id)
    } catch (err) {
      setError(err.message)
      if (err.status >= 400 && err.status < 500) setResult(previous, { id: requestId, status: 'failed', error: err.message }, modelId, id)
      else {
        try { setResult(previous, await call(`/api/jobs/${requestId}`), modelId, id) }
        catch { save([...previous, { role: 'assistant', content: '本次请求未确认。请查看任务状态，避免直接重复提交。', status: 'uncertain', taskId: requestId, modelId }], id) }
      }
    } finally { setBusy(false) }
  }
  const refreshTask = async (message, index) => {
    setError('')
    try {
      const result = await call(`/api/jobs/${message.taskId}`)
      if (message.role === 'user') setResult(messages, result, message.modelId, conversation)
      else save(messages.map((item, i) => i === index ? { ...item, status: result.status, content: result.text || result.error || '任务仍在处理，请稍后查看。', imageUrl: result.imageUrl } : item))
    } catch (err) { setError(err.message) }
  }
  useEffect(() => {
    const pending = messages.find(message => message.role === 'assistant' && message.status === 'processing')
    if (!pending || busy || !session) return
    let cancelled = false; let polling = false; let attempts = 0
    const timer = setInterval(async () => {
      if (polling) return
      if (++attempts > 60) { clearInterval(timer); return }
      polling = true
      try {
        const result = await call(`/api/jobs/${pending.taskId}`)
        if (!cancelled && result.status !== 'processing') save(messages.map(item => item === pending ? { ...item, status: result.status, content: result.text || result.error || '图片已生成。', imageUrl: result.imageUrl } : item))
      } catch {
        if (!cancelled) { clearInterval(timer); setError('自动查询暂时中断，请点击“查看任务状态”。不要重复生成。') }
      } finally { polling = false }
    }, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [messages, conversation, selectedId, session, busy])
  return <div className="mw" ref={shell}>
    <a href="#mw-main" className="mwSkip">跳到创作区</a>
    <header className="mwHeader"><div className="mwBrand"><Symbol small /><strong>刘耀华<span>AI 创作工作台</span></strong><span className="mwEdition">作品集体验版</span></div><div className="mwHeaderActions"><button className="mwMobileMenu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>☰ 工作台目录</button><button onClick={() => { setSection('models'); setShowHistory(!showHistory) }} disabled={busy} aria-expanded={showHistory}>会话记录</button><button onClick={onBack}>返回作品集 ↗</button><span className="mwAvatar" aria-label="作者刘耀华">刘</span></div></header>
    <div className="mwLayout">
      <aside className={`mwSidebar ${sidebarOpen ? 'isOpen' : ''}`} aria-label="工作台目录">
        <nav className="mwTools" role="tablist" aria-label="工作台栏目" onKeyDown={tabKey}>{sections.map(([id, icon, label]) => <button key={id} type="button" role="tab" id={`mw-tab-${id}`} aria-controls={`mw-panel-${id}`} aria-selected={section === id} tabIndex={section === id ? 0 : -1} className={section === id ? 'isActive' : ''} onClick={() => switchSection(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
        <div className="mwModelDirectory" hidden={section !== 'models'}>
        <div className="mwCategories" role="group" aria-label="模型分类">{categories.map(([id, name]) => <button key={id} aria-pressed={category === id} className={category === id ? 'isActive' : ''} onClick={() => { setCategory(id); setSidebarOpen(true) }}>{name}</button>)}</div>
        <div className="mwFilters"><select aria-label="筛选厂商" value={provider} onChange={event => setProvider(event.target.value)}><option value="all">全部厂商</option>{providers.map(name => <option key={name}>{name}</option>)}</select><input aria-label="搜索模型" placeholder="搜索模型 / 用途" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <p className="mwCatalogNote"><i />目录来自已连接的 AIGC Hub 账户</p>
        <div className="mwModelList">{category === 'mine' ? <><h2>本机创作记录</h2>{history.length ? history.map(item => <button key={item.id} className="mwHistoryItem" disabled={busy} onClick={() => { setSelectedId(item.modelId); setConversation(item.id); setMessages(item.messages); setSidebarOpen(false) }}><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</small></button>) : <p className="mwMuted">完成一次聊天或图片生成后，记录会保存在当前浏览器。</p>}</> : filtered.map(model => <button key={`${model.type}-${model.id}`} className={`mwModel ${selectedId === model.id ? 'isSelected' : ''}`} disabled={busy} aria-pressed={selectedId === model.id} onClick={() => start(model.id)}><Symbol type={model.type} small /><span className="mwModelText"><strong>{model.name}</strong><small>{model.description || `${typeName[model.type]}模型 · 点击查看`}</small></span><span className={`mwAvailability ${model.enabled ? 'isEnabled' : ''}`}>{model.enabled ? ready ? '体验' : '待连接' : '锁定'}</span></button>)}{category !== 'mine' && !filtered.length && <p className="mwMuted">没有匹配的模型，试试其他关键词。</p>}</div>
        </div>
        <div className="mwAgentDirectory" hidden={section !== 'agents'}><p className="mwDirectoryTitle">我的智能体</p>{[['director', 'MOMOCO 导演', '剧本拆解 · 分镜 · 复杂镜头'], ['whiteboard', '白板视频智能体', 'CS Board 二创 · 音色 · 画面风格']].map(([id, name, description]) => <button key={id} className={`mwAgentChoice ${agent === id ? 'isSelected' : ''}`} aria-pressed={agent === id} onClick={() => openAgent(id)}><Symbol type={id === 'director' ? 'video' : 'image'} small /><span><strong>{name}</strong><small>{description}</small></span></button>)}<p className="mwDirectoryNote">导演链路：DeepSeek / MOMOCO Skill / MiniMax H3。<br />实际可用状态以工具内提示为准。</p><button className="mwDirectoryLink" onClick={() => switchSection('skills')}>查看可用 Skill →</button></div>
        <div className="mwSkillDirectory" hidden={section !== 'skills'}><p className="mwDirectoryTitle">方法与工具，在这里衔接</p><p className="mwDirectoryNote">查看步骤、收藏常用方法，再将 Skill 交给对应智能体。始终留在同一个工作台。</p><button className="mwAgentChoice" onClick={() => openAgent('director')}><Symbol type="video" small /><span><strong>MOMOCO 导演</strong><small>打开导演操作区</small></span></button><button className="mwAgentChoice" onClick={() => openAgent('whiteboard')}><Symbol type="image" small /><span><strong>白板视频智能体</strong><small>打开白板制作区</small></span></button></div>
        <div className="mwAccount"><span className="mwAvatar">刘</span><div><strong>{section === 'models' ? '作者提供体验额度' : '同一工作台 · 按需调用'}</strong><small>{section === 'models' ? session ? '访客体验已连接 · 无需体验码' : '免注册 · 自动连接访客体验' : '切换栏目保留当前输入与草稿'}</small></div></div>
      </aside>
      <main className="mwContent" id="mw-main">
      <section className="mwMain" role="tabpanel" id="mw-panel-models" aria-labelledby="mw-tab-models" hidden={section !== 'models'}><div className="mwConversationTop"><div><strong>{conversation ? '创作会话' : '新对话'}</strong><small>{selected?.name}</small></div><button disabled={busy} onClick={() => start()}>＋ 新对话</button></div>
        <nav className="mwQuickModels" aria-label="快速体验"><button type="button" aria-label="切换到聊天" aria-pressed={selected?.type === 'chat'} disabled={busy} onClick={() => start('deepseek-v4.1-flash')}>聊天</button><button type="button" aria-label="切换到图片生成" aria-pressed={selected?.type === 'image'} disabled={busy} onClick={() => start('gpt-image-2-c')}>图片生成</button><button type="button" onClick={() => openAgent('whiteboard')}>语音试听</button></nav>
        {showHistory && <section className="mwHistory"><h2>会话记录</h2><p>仅显示当前浏览器的记录，不读取作者的私人对话。</p>{history.map(item => <button key={item.id} disabled={busy} onClick={() => { setSelectedId(item.modelId); setConversation(item.id); setMessages(item.messages); setShowHistory(false) }}>{item.title}<span>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span></button>)}{!history.length && <p>还没有会话记录。</p>}</section>}
        <div className={`mwCanvas ${messages.length ? 'hasMessages' : ''}`} aria-live="polite">{messages.length ? <div className="mwMessages">{messages.map((message, index) => <article key={index} className={`mwMessage ${message.role}`}>
          <strong>{message.role === 'user' ? '你' : models.find(model => model.id === message.modelId)?.name || selected?.name}</strong><p>{message.content}</p>
          {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="本次提示词生成的图片" /><span>打开原图 ↗</span></a>}
          {((message.role === 'assistant' && ['processing', 'uncertain'].includes(message.status)) || (message.role === 'user' && index === messages.length - 1 && !busy)) && <button onClick={() => refreshTask(message, index)}>查看任务状态</button>}
        </article>)}{busy && <div className="mwThinking" role="status"><i /><i /><i /><span>正在{selected?.type === 'image' ? '生成图片，通常需要一些时间' : '回答'}…</span></div>}<div ref={end} /></div> : <div className="mwWelcome"><Symbol type={selected?.type} /><p className="mwEyebrow">{typeName[selected?.type]}模型</p><h1>{selected?.name}</h1><p>{selected?.description || '从一个想法开始，让模型帮你完成创作。'}</p><span className={`mwWelcomeState ${locked ? 'isLocked' : ''}`}>{locked ? '该模型展示中 · 访客暂未开放' : '访客体验 · 费用由作者承担'}</span>{!locked && <div className="mwSuggestions">{(selected?.type === 'image' ? ['一座悬浮在云层上的玻璃花园，清晨阳光，极简建筑摄影', '为一杯桂花乌龙设计一张清爽的产品海报，米白背景'] : ['帮我把一个产品想法整理成可执行的开发步骤', '如何设计一个从剧本到分镜的视频智能体？']).map(text => <button key={text} onClick={() => setDraft(text)}>{text}<span>↗</span></button>)}</div>}</div>}</div>
        <div className="mwComposeWrap">{locked && <p className="mwLockNotice">此模型保留展示入口。访客权限已覆盖聊天与图片模型，视频和音频不会提交生成任务。</p>}
          {(!session || !ready) && !locked && <div className="mwAuth" role="status"><div><strong>{catalogLoading || authBusy ? '正在自动连接访客体验…' : ready && publicAccess ? '访客连接未完成' : '模型服务暂时不可用'}</strong><small>{catalogLoading || authBusy ? '无需注册或输入体验码，请稍候。' : '请检查网络后点击重新连接，无需输入体验码。'}</small></div>{!catalogLoading && !authBusy && <button type="button" onClick={() => connect()}>重新连接</button>}</div>}
          <form className="mwComposer" onSubmit={submit}><div className="mwComposerModel"><Symbol type={selected?.type} small /><strong>{selected?.name}</strong><span>{locked ? '未开放' : selected?.type === 'image' ? imageProfile?.label || '图片生成 · 单张' : '简洁回答'}</span></div><label className="mwInputLabel" htmlFor="mw-prompt">创作需求</label><textarea id="mw-prompt" maxLength={selected?.type === 'image' ? 1000 : 1800} placeholder={locked ? '该模型暂未开放，请从左侧选择标有“体验”的模型' : selected?.type === 'image' ? '描述你想生成的画面、风格和构图…' : '描述你的需求，或开始一段对话…'} value={draft} disabled={locked || busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event) }} />{selected?.type === 'image' && !locked && <div className="mwReference"><label>参考图<input aria-label="参考图" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={chooseReference} /></label><span>{referenceName || (imageProfile?.referenceRequired ? '该模型必须提供参考图' : '可选 · 不选择即文生图')} · 5MB 以内</span>{reference && <button type="button" disabled={busy} onClick={() => { referenceVersion.current++; setReference(''); setReferenceName('') }}>移除</button>}<small>选择时仅在本机读取；点击“生成图片”才发送给中转站。请仅上传有权使用的图片。</small></div>}<div className="mwComposerBottom"><div>{selected?.type === 'image' && imageProfile?.sizes && !locked ? <select aria-label="图片尺寸" value={size} onChange={event => setSize(event.target.value)} disabled={busy}>{imageProfile?.sizes?.map(value => <option key={value} value={value}>{value}</option>)}</select> : <span>{locked ? '访客权限已锁定' : '聊天体验'}</span>}<span className="mwBudgetHint">{!locked && `每会话每日同类模型合计 ${selected?.limit || 0} 次`}</span></div><button className="mwSend" type="submit" disabled={locked || busy || !session || !ready || !draft.trim() || (imageProfile?.referenceRequired && !reference)} aria-label="发送创作需求">{busy ? '处理中…' : selected?.type === 'image' ? '生成图片 ↑' : '发送 ↑'}</button></div></form>
          {error && <p className="mwError" role="alert">{error}</p>}<p className="mwFootnote">{ready ? '体验费用由作者承担 · 内容由 AI 生成，请核对重要信息' : '模型体验服务暂未就绪 · 你仍可浏览模型目录'}</p>
        </div>
      </section>
      <section className="mwAgentPanel" role="tabpanel" id="mw-panel-agents" aria-labelledby="mw-tab-agents" hidden={section !== 'agents'}>
        <div className="mwAgentHeading"><div><p>智能体</p><h1>{agent === 'director' ? 'MOMOCO 视频导演' : '白板视频智能体'}</h1><span>{agent === 'director' ? '从想法、剧本到分镜方案，与白板工作流在同页衔接。' : '基于 CS Board 二创，保留音色、文案、画面风格与成片设置。'}</span></div><span className="mwServiceNotice">生成需连接执行服务</span></div>
        <div hidden={agent !== 'director'}>{visitedAgents.includes('director') && <ReplicaWorkbench embedded action={directorAction} initialRequirement={initialRequirement} onWhiteboard={copy => openAgent('whiteboard', { copy })} onBack={onBack} />}</div>
        <div hidden={agent !== 'whiteboard'}>{visitedAgents.includes('whiteboard') && <NativeBoard embedded handoff={whiteboardHandoff} onDirector={copy => openAgent('director', { tab: 'template', copy })} onBack={onBack} />}</div>
      </section>
      <section className="mwSkillPanel" role="tabpanel" id="mw-panel-skills" aria-labelledby="mw-tab-skills" hidden={section !== 'skills'}><SkillSquare onUse={skill => openAgent(skill.agent, { tab: skill.tab || 'template' })} /></section>
      </main>
    </div>
  </div>
}
