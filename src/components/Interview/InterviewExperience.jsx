import { useEffect, useRef, useState } from 'react'
import { streamInterview } from '../../interview/client'
import './InterviewExperience.css'

const starterQuestions = [
  '请做一下自我介绍',
  '讲讲你最完整的 AI 项目',
  '你如何保证角色一致性',
  '为什么适合这个岗位',
]

const welcomeMessage = {
  role: 'assistant',
  content: '你好，我是刘耀华的 AI 面试助手。你可以直接问我的经历、项目方法和岗位匹配度。',
}

function createSessionId() {
  if (typeof window === 'undefined') return 'server-render-session'

  const saved = window.sessionStorage.getItem('ci-interview-session')
  if (saved) return saved

  const id = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.sessionStorage.setItem('ci-interview-session', id)
  return id
}

function InterviewExperience({ assetPath, onBack, onOpenPortfolio }) {
  const [messages, setMessages] = useState([welcomeMessage])
  const [draft, setDraft] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const sessionId = useRef(createSessionId())
  const transcriptRef = useRef(null)
  const controllerRef = useRef(null)

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isStreaming])

  useEffect(() => () => controllerRef.current?.abort(), [])

  const sendQuestion = async (question) => {
    const content = question.trim()
    if (!content || isStreaming) return

    const userMessage = { role: 'user', content }
    const history = [...messages, userMessage].slice(-10)

    setDraft('')
    setError('')
    setLastQuestion(content)
    setIsStreaming(true)
    setMessages((current) => [...current, userMessage, { role: 'assistant', content: '' }])

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      await streamInterview({
        messages: history,
        sessionId: sessionId.current,
        signal: controller.signal,
        onToken(token) {
          setMessages((current) => current.map((message, index) => (
            index === current.length - 1
              ? { ...message, content: message.content + token }
              : message
          )))
        },
      })
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message)
        setMessages((current) => {
          const last = current[current.length - 1]
          return last?.role === 'assistant' && !last.content ? current.slice(0, -1) : current
        })
      }
    } finally {
      controllerRef.current = null
      setIsStreaming(false)
    }
  }

  const clearConversation = () => {
    controllerRef.current?.abort()
    setMessages([welcomeMessage])
    setDraft('')
    setError('')
    setLastQuestion('')
  }

  return (
    <main className="interviewExperience">
      <header className="interviewHeader">
        <button className="interviewBack" type="button" onClick={onBack}>← 返回入口</button>
        <div className="interviewIdentity">
          <img src={assetPath('assets/hero-avatar.jpg')} alt="刘耀华" />
          <span><strong>辞.</strong><small>AI INTERVIEW / ONLINE</small></span>
        </div>
        <button className="interviewPortfolioLink" type="button" onClick={onOpenPortfolio}>
          查看作品集 ↗
        </button>
      </header>

      <section className="interviewLayout">
        <aside className="interviewProfile">
          <p className="interviewKicker">DIGITAL INTERVIEW / 2026</p>
          <h1>
            先聊聊
            <span>我做过的</span>
            <span className="interviewAccent">真实项目</span>
          </h1>
          <p className="interviewIntro">
            这里的回答基于刘耀华公开的作品与经历。适合快速了解他的项目方法、视觉判断和岗位匹配度。
          </p>
          <dl className="interviewFacts">
            <div><dt>定位</dt><dd>AI 漫剧导演 / 视觉设计</dd></div>
            <div><dt>能力</dt><dd>分镜 · 生成 · 剪辑 · 品牌</dd></div>
            <div><dt>状态</dt><dd><span /> AI 面试助手在线</dd></div>
          </dl>
          <p className="interviewDisclosure">AI 回答仅用于了解本人经历，不代表新的承诺或未公开信息。</p>
        </aside>

        <section className="interviewConsole" aria-label="AI 面试对话">
          <div className="interviewConsoleBar">
            <div>
              <span className="interviewLiveDot" aria-hidden="true" />
              <strong>AI 面试助手</strong>
              <small>基于真实作品档案</small>
            </div>
            <button type="button" onClick={clearConversation}>清空对话</button>
          </div>

          <div className="interviewTranscript" ref={transcriptRef} aria-live="polite">
            {messages.map((message, index) => (
              <article className={`interviewMessage is-${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === 'assistant' ? '辞.AI' : '你'}</span>
                <p>
                  {message.content}
                  {isStreaming && index === messages.length - 1 ? <i aria-label="正在回答" /> : null}
                </p>
              </article>
            ))}

            {messages.length === 1 ? (
              <div className="interviewStarters" aria-label="推荐问题">
                <p>可以从这里开始</p>
                {starterQuestions.map((question, index) => (
                  <button type="button" onClick={() => sendQuestion(question)} key={question}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {question}
                    <i aria-hidden="true">↗</i>
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="interviewError" role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => sendQuestion(lastQuestion)}>重新提问</button>
              </div>
            ) : null}
          </div>

          <form
            className="interviewComposer"
            onSubmit={(event) => {
              event.preventDefault()
              sendQuestion(draft)
            }}
          >
            <label htmlFor="interview-question">向数字版的刘耀华提问</label>
            <textarea
              id="interview-question"
              value={draft}
              maxLength={800}
              rows={3}
              placeholder="例如：你在《星际穷途 X》中具体负责什么？"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  sendQuestion(draft)
                }
              }}
              disabled={isStreaming}
            />
            <div className="interviewComposerMeta">
              <span>Enter 发送 · Shift + Enter 换行 · {draft.length}/800</span>
              <button type="submit" disabled={!draft.trim() || isStreaming}>
                {isStreaming ? '回答中…' : '发送问题'} <i aria-hidden="true">→</i>
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  )
}

export default InterviewExperience
