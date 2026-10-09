import { useEffect, useState } from 'react'
import './Gateway.css'

const headline = [
  ['把片场的重复劳动', false],
  ['变成可调度', false],
  ['可复现的流水线', false, true],
]

const STAGES = [
  { key: 'intake', label: '接收剧本', meta: 'script.docx · 2.4k字' },
  { key: 'analyze', label: '剧本分析', meta: '角色×3 · 场景×4' },
  { key: 'assets', label: '资产就绪', meta: '人物/场景/道具/音色' },
  { key: 'storyboard', label: '分镜拆解', meta: '×12 shots' },
  { key: 'generate', label: '多平台生成', meta: 'MiniMax H3 · seed 2084' },
  { key: 'post', label: '后期合成', meta: '配音 / 烧录字幕 / 卡点' },
  { key: 'qc', label: 'QC 报告', meta: '首中末帧 · 穿帮定位' },
  { key: 'publish', label: '发布包', meta: '成片 + 文案' },
]

// 每条日志在第几步时出现
const LOGS = [
  { at: 1, text: '✓ 角色「阿辞」身份锚已锁定', kind: 'ok' },
  { at: 3, text: '· 已授权 ¥2.40 / 预估 ¥2.80（付费前闸门）', kind: 'info' },
  { at: 4, text: '⚠ 第3镜 服装断裂 → blocked_connector，重生成', kind: 'warn' },
  { at: 5, text: '✓ 人物一致性 96% · 穿帮已定位到 00:42', kind: 'ok' },
  { at: 6, text: '✓ ffprobe 校验通过 · 字幕/配音对齐', kind: 'ok' },
]

const TOTAL_STEPS = STAGES.length

function useTraceStep() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s >= TOTAL_STEPS + 2 ? 0 : s + 1))
    }, 950)
    return () => clearInterval(id)
  }, [])
  return step
}

function GatewayTrace() {
  const step = useTraceStep()

  return (
    <div className="gatewayTrace" aria-label="Agent 流水线实时运行演示">
      <div className="traceWindow">
        <div className="traceChrome">
          <span className="dot r" /><span className="dot y" /><span className="dot g" />
          <span className="traceTitle">run-0042 · momoco-aigc-director</span>
          <span className="traceLive"><i /> LIVE</span>
        </div>

        <ol className="traceStages">
          {STAGES.map((stage, i) => {
            let state = 'pending'
            if (step > i) state = 'done'
            else if (step === i) state = 'running'
            return (
              <li key={stage.key} className={`stage is-${state}`}>
                <span className="stageDot" aria-hidden="true" />
                <span className="stageLabel">{stage.label}</span>
                <span className="stageMeta">{stage.meta}</span>
              </li>
            )
          })}
        </ol>

        <div className="traceLog" aria-live="polite">
          {LOGS.filter((l) => step >= l.at).map((l, i) => (
            <p key={i} className={`logLine is-${l.kind}`}>{l.text}</p>
          ))}
          {step < TOTAL_STEPS && <p className="logLine is-cursor"><span className="caret">▋</span></p>}
        </div>

        <div className="traceStats">
          <div><strong>60+</strong><small>集已上线</small></div>
          <div><strong>15</strong><small>部爆款</small></div>
          <div><strong>92%</strong><small>QC 一次通过率</small></div>
        </div>
      </div>
    </div>
  )
}

function Gateway({ assetPath, onEnterPortfolio, onEnterInterview }) {
  return (
    <main className="gateway">
      <div className="gatewayNoise" aria-hidden="true" />
      <header className="gatewayHeader">
        <button className="gatewayBrand" type="button" onClick={onEnterPortfolio}>
          <img src={assetPath('assets/hero-avatar.jpg')} alt="刘耀华" />
          <span>
            <strong>辞.</strong>
            <small>LIU YAO HUA</small>
          </span>
        </button>

        <nav className="gatewayNav" aria-label="双入口导航">
          <button type="button" onClick={onEnterPortfolio}>Agent 流水线</button>
          <button type="button" onClick={onEnterInterview}>AI 面试</button>
          <button type="button" onClick={onEnterPortfolio}>联系</button>
        </nav>

        <button className="gatewayInterviewLink" type="button" onClick={onEnterInterview}>
          AI 面试
          <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="gatewayHero" aria-labelledby="gateway-title">
        <div className="gatewayCopy">
          <p className="gatewayLabel">AGENT WORKFLOW · SHORT-DRAMA SYSTEM · CHENGDU</p>
          <h1 id="gateway-title">
            {headline.map(([line, indented, accent]) => (
              <span
                className={`${indented ? 'isIndented' : ''} ${accent ? 'isAccent' : ''}`}
                key={line}
              >
                {line}
              </span>
            ))}
          </h1>

          <p className="gatewaySubline">
            60+ 集 AI 短剧量产 · 自建剧本→成片全链路 Agent ·
            SeaArt MoreShort 同场景业务视角
          </p>

          <div className="gatewayActions">
            <button className="gatewayPrimary" type="button" onClick={onEnterPortfolio}>
              查看 Agent 流水线 <span aria-hidden="true">↗</span>
            </button>
            <button className="gatewaySecondary" type="button" onClick={onEnterInterview}>
              和数字版的我聊聊
            </button>
          </div>
        </div>

        <GatewayTrace />
      </section>

      <footer className="gatewayFooter">
        <span>AI INTERVIEW / PORTFOLIO</span>
        <span>SCROLL-FREE ENTRY</span>
        <span>© 2026 CI.</span>
      </footer>
    </main>
  )
}

export default Gateway
