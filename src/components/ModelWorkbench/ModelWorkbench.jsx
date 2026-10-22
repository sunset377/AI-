import { useEffect, useMemo, useRef, useState } from 'react'
import snapshot from '../../model-catalog.json'
import { MODEL_POLICY } from '../../model-policy.js'
import './ModelWorkbench.css'

const API = (import.meta.env.VITE_MODELS_API_URL || 'https://portfolio-model-gateway.980175020.workers.dev').replace(/\/$/, '')
const categories = [['all', '全部'], ['chat', '聊天'], ['image', '图片'], ['video', '视频'], ['audio', '音频'], ['mine', '我的']]
const typeName = { chat: '聊天', image: '图片', video: '视频', audio: '音频' }
const uid = () => crypto.randomUUID()
const read = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) || fallback } catch { return fallback } }
function Symbol({ type = 'chat', small = false }) {
  return <span className={`mwSymbol mwSymbol-${type} ${small ? 'mwSymbolSmall' : ''}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 5 30 18 43 24 30 30 24 43 18 30 5 24 18 18Z" fill="currentColor" /><path d="m24 15 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z" fill="white" /></svg></span>
}

export default function ModelWorkbench({ onBack, onDirector, onWhiteboard }) {
  const [models, setModels] = useState(() => snapshot.models.map(model => ({ ...model, enabled: Boolean(MODEL_POLICY[model.id]), limit: MODEL_POLICY[model.id]?.visitor || 0 })))
  const [ready, setReady] = useState(false)
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [selectedId, setSelectedId] = useState('deepseek-v4.1-flash')
  const [draft, setDraft] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [session, setSession] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [history, setHistory] = useState([])
  const [conversation, setConversation] = useState('')
  const [messages, setMessages] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const end = useRef(null)
  const selected = models.find(model => model.id === selectedId) || models[0]
  const locked = !selected?.enabled
  const providers = useMemo(() => [...new Set(models.map(model => model.provider))].sort(), [models])
  const filtered = useMemo(() => models.filter(model => (category === 'all' || model.type === category) && (provider === 'all' || model.provider === provider) && `${model.name} ${model.description}`.toLowerCase().includes(query.toLowerCase())), [models, category, provider, query])

  const call = async (path, options = {}, token = session) => {
    const response = await fetch(API + path, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } })
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('模型体验服务暂时无法连接，请稍后再试。')
    const data = await response.json()
    if (!response.ok) { if (response.status === 401) { setSession(''); sessionStorage.removeItem('portfolio-model-session') }; throw Object.assign(new Error(data.error || '本次请求未完成。'), { status: response.status }) }
    return data
  }
  const authorize = async (value) => {
    if (!value.trim()) return
    setAuthBusy(true); setError('')
    try {
      const data = await call('/api/sessions', { method: 'POST', body: JSON.stringify({ code: value.trim() }) }, '')
      setSession(data.token); sessionStorage.setItem('portfolio-model-session', data.token); setCode('')
      sessionStorage.removeItem('portfolio-model-invite')
      const url = new URL(window.location.href); url.hash = ''; window.history.replaceState(window.history.state, '', url)
    } catch (err) { setError(err.message) } finally { setAuthBusy(false) }
  }
  useEffect(() => {
    setSession(sessionStorage.getItem('portfolio-model-session') || '')
    setHistory(read(localStorage, 'portfolio-model-history', []))
    call('/api/models', {}, '').then(data => { setModels(data.models); setReady(data.ready) }).catch(() => setReady(false))
    const invite = new URLSearchParams(window.location.hash.slice(1)).get('experience') || sessionStorage.getItem('portfolio-model-invite')
    if (invite) authorize(invite)
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
  const setResult = (previous, task, modelId, id) => {
    const next = [...previous, { role: 'assistant', content: task.text || task.error || '任务正在处理，可稍后查看结果。', imageUrl: task.imageUrl, status: task.status, taskId: task.id, modelId }]
    save(next, id)
  }
  const submit = async (event) => {
    event.preventDefault()
    if (busy || locked || !ready || !session || !draft.trim()) return
    const content = draft.trim(); const requestId = uid(); const modelId = selectedId
    const id = conversation || uid()
    const previous = [...messages, { role: 'user', content, modelId, taskId: requestId }]
    save(previous, id); setDraft(''); setBusy(true); setError('')
    try {
      const body = selected.type === 'chat'
        ? { requestId, modelId, messages: previous.filter(message => !message.status || message.status === 'complete').slice(-8).map(({ role, content }) => ({ role, content })) }
        : { requestId, modelId, prompt: content, size }
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
  return <div className="mw">
    <a href="#mw-main" className="mwSkip">跳到创作区</a>
    <header className="mwHeader"><div className="mwBrand"><Symbol small /><strong>刘耀华<span>AI 创作工作台</span></strong><span className="mwEdition">作品集体验版</span></div><div className="mwHeaderActions"><button onClick={() => setShowHistory(!showHistory)} disabled={busy} aria-expanded={showHistory}>会话记录</button><button onClick={onBack}>返回作品集 ↗</button><span className="mwAvatar" aria-label="作者刘耀华">刘</span></div></header>
    <div className="mwLayout">
      <aside className={`mwSidebar ${sidebarOpen ? 'isOpen' : ''}`} aria-label="模型目录">
        <nav className="mwTools" aria-label="工作台入口"><button className="isActive"><span>✧</span>大模型</button><button onClick={() => onDirector(draft)} disabled={busy}><span>▦</span>MOMOCO 导演</button><button onClick={onWhiteboard} disabled={busy}><span>▤</span>白板工坊</button></nav>
        <div className="mwCategories" role="group" aria-label="模型分类">{categories.map(([id, name]) => <button key={id} aria-pressed={category === id} className={category === id ? 'isActive' : ''} onClick={() => { setCategory(id); setSidebarOpen(true) }}>{name}</button>)}</div>
        <div className="mwFilters"><select aria-label="筛选厂商" value={provider} onChange={event => setProvider(event.target.value)}><option value="all">全部厂商</option>{providers.map(name => <option key={name}>{name}</option>)}</select><input aria-label="搜索模型" placeholder="搜索模型 / 用途" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <p className="mwCatalogNote"><i />目录来自已连接的 AIGC Hub 账户</p>
        <div className="mwModelList">{category === 'mine' ? <><h2>本机创作记录</h2>{history.length ? history.map(item => <button key={item.id} className="mwHistoryItem" disabled={busy} onClick={() => { setSelectedId(item.modelId); setConversation(item.id); setMessages(item.messages); setSidebarOpen(false) }}><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</small></button>) : <p className="mwMuted">完成一次聊天或图片生成后，记录会保存在当前浏览器。</p>}</> : filtered.map(model => <button key={`${model.type}-${model.id}`} className={`mwModel ${selectedId === model.id ? 'isSelected' : ''}`} disabled={busy} aria-pressed={selectedId === model.id} onClick={() => start(model.id)}><Symbol type={model.type} small /><span className="mwModelText"><strong>{model.name}</strong><small>{model.description || `${typeName[model.type]}模型 · 点击查看`}</small></span><span className={`mwAvailability ${model.enabled ? 'isEnabled' : ''}`}>{model.enabled ? '体验' : '锁定'}</span></button>)}{category !== 'mine' && !filtered.length && <p className="mwMuted">没有匹配的模型，试试其他关键词。</p>}</div>
        <div className="mwAccount"><span className="mwAvatar">刘</span><div><strong>作者提供体验额度</strong><small>{session ? '已获得访客体验权限' : '免注册 · 使用作者的体验链接'}</small></div></div>
      </aside>
      <main className="mwMain" id="mw-main"><div className="mwConversationTop"><button className="mwMobileMenu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>☰ 模型目录</button><div><strong>{conversation ? '创作会话' : '新对话'}</strong><small>{selected?.name}</small></div><button disabled={busy} onClick={() => start()}>＋ 新对话</button></div>
        {showHistory && <section className="mwHistory"><h2>会话记录</h2><p>仅显示当前浏览器的记录，不读取作者的私人对话。</p>{history.map(item => <button key={item.id} disabled={busy} onClick={() => { setSelectedId(item.modelId); setConversation(item.id); setMessages(item.messages); setShowHistory(false) }}>{item.title}<span>{new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span></button>)}{!history.length && <p>还没有会话记录。</p>}</section>}
        <div className={`mwCanvas ${messages.length ? 'hasMessages' : ''}`} aria-live="polite">{messages.length ? <div className="mwMessages">{messages.map((message, index) => <article key={index} className={`mwMessage ${message.role}`}>
          <strong>{message.role === 'user' ? '你' : models.find(model => model.id === message.modelId)?.name || selected?.name}</strong><p>{message.content}</p>
          {message.imageUrl && <a href={message.imageUrl} target="_blank" rel="noreferrer"><img src={message.imageUrl} alt="本次提示词生成的图片" /><span>打开原图 ↗</span></a>}
          {((message.role === 'assistant' && ['processing', 'uncertain'].includes(message.status)) || (message.role === 'user' && index === messages.length - 1 && !busy)) && <button onClick={() => refreshTask(message, index)}>查看任务状态</button>}
        </article>)}{busy && <div className="mwThinking" role="status"><i /><i /><i /><span>正在{selected?.type === 'image' ? '生成图片，通常需要一些时间' : '回答'}…</span></div>}<div ref={end} /></div> : <div className="mwWelcome"><Symbol type={selected?.type} /><p className="mwEyebrow">{typeName[selected?.type]}模型</p><h1>{selected?.name}</h1><p>{selected?.description || '从一个想法开始，让模型帮你完成创作。'}</p><span className={`mwWelcomeState ${locked ? 'isLocked' : ''}`}>{locked ? '该模型展示中 · 访客暂未开放' : '访客体验 · 费用由作者承担'}</span>{!locked && <div className="mwSuggestions">{(selected?.type === 'image' ? ['一座悬浮在云层上的玻璃花园，清晨阳光，极简建筑摄影', '为一杯桂花乌龙设计一张清爽的产品海报，米白背景'] : ['帮我把一个产品想法整理成可执行的开发步骤', '如何设计一个从剧本到分镜的视频智能体？']).map(text => <button key={text} onClick={() => setDraft(text)}>{text}<span>↗</span></button>)}</div>}</div>}</div>
        <div className="mwComposeWrap">{locked && <p className="mwLockNotice">此模型保留展示入口。当前访客体验仅开放指定聊天与图片模型，视频和音频不会提交生成任务。</p>}
          {!session && !locked && <form className="mwAuth" onSubmit={event => { event.preventDefault(); authorize(code) }}><div><strong>开始作者提供的体验</strong><small>已有体验链接会自动开通；也可输入作者提供的体验码。</small></div><input aria-label="体验码" type="password" autoComplete="off" placeholder="输入体验码" value={code} onChange={event => setCode(event.target.value)} /><button disabled={authBusy || !code.trim()}>{authBusy ? '验证中…' : '开通体验'}</button></form>}
          <form className="mwComposer" onSubmit={submit}><div className="mwComposerModel"><Symbol type={selected?.type} small /><strong>{selected?.name}</strong><span>{locked ? '未开放' : selected?.type === 'image' ? '文生图 · 1K · 单张' : '简洁回答'}</span></div><label className="mwInputLabel" htmlFor="mw-prompt">创作需求</label><textarea id="mw-prompt" maxLength={selected?.type === 'image' ? 1000 : 1800} placeholder={locked ? '该模型暂未开放，请从左侧选择标有“体验”的模型' : selected?.type === 'image' ? '描述你想生成的画面、风格和构图…' : '描述你的需求，或开始一段对话…'} value={draft} disabled={locked || busy} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event) }} /><div className="mwComposerBottom"><div>{selected?.type === 'image' && !locked ? <select aria-label="图片尺寸" value={size} onChange={event => setSize(event.target.value)} disabled={busy}><option value="1024x1024">1:1 方形 · 1K</option><option value="1792x1024">16:9 横版 · 1K</option><option value="1024x1792">9:16 竖版 · 1K</option></select> : <span>{locked ? '访客权限已锁定' : '聊天体验'}</span>}<span className="mwBudgetHint">{!locked && `每次体验会话每日最多 ${selected?.limit || 0} 次`}</span></div><button className="mwSend" type="submit" disabled={locked || busy || !session || !ready || !draft.trim()} aria-label="发送创作需求">{busy ? '处理中…' : selected?.type === 'image' ? '生成图片 ↑' : '发送 ↑'}</button></div></form>
          {error && <p className="mwError" role="alert">{error}</p>}<p className="mwFootnote">{ready ? '体验费用由作者承担 · 内容由 AI 生成，请核对重要信息' : '模型体验服务暂未就绪 · 你仍可浏览模型目录'}</p>
        </div>
      </main>
    </div>
  </div>
}
