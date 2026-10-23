import './Gateway.css'

const stages = ['需求与样片', '整理制作规范', '分镜与素材', '调用模型与工具', '后期与字幕', '检查与交付']

export default function Gateway({ assetPath, onEnterPortfolio, onEnterInterview }) {
  return <main className="gateway">
    <div className="gatewayNoise" aria-hidden="true" />
    <header className="gatewayHeader">
      <button className="gatewayBrand" type="button" onClick={onEnterPortfolio}>
        <img src={assetPath('assets/hero-avatar.jpg')} alt="刘耀华" />
        <span><strong>刘耀华</strong><small>LIU YAO HUA</small></span>
      </button>
      <nav className="gatewayNav" aria-label="网站入口">
        <button type="button" onClick={onEnterPortfolio}>查看作品集</button>
        <button type="button" onClick={onEnterInterview}>AI 面试</button>
      </nav>
      <button className="gatewayInterviewLink" type="button" onClick={onEnterInterview}>AI 面试 <span aria-hidden="true">↗</span></button>
    </header>
    <a className="gatewayMineflow" href={assetPath('mineflow/')} target="_blank" rel="noreferrer">
      <strong>体验 MineFlow · 矿山运输调度 <span aria-hidden="true">↗</span></strong>
      <span>90秒互动演示：创建需求 → 人工派单 → 排队称重 → 完成运输</span>
      <small>模拟数据 · 无需登录 · 每位访客独立会话</small>
    </a>
    <section className="gatewayHero" aria-labelledby="gateway-title">
      <div className="gatewayCopy">
        <p className="gatewayLabel">AI CONTENT · AGENT WORKFLOW · CHENGDU</p>
        <h1 id="gateway-title"><span>把业务里的重复劳动</span><span>变成可调度</span><span className="isAccent">可复用的工作流</span></h1>
        <p className="gatewaySubline">从服装企业的 AI 内容创作与工具落地出发，连接视频生产、自动化工作流与 Agent 应用实践。</p>
        <div className="gatewayActions">
          <button className="gatewayPrimary" type="button" onClick={onEnterPortfolio}>查看作品集 <span aria-hidden="true">↗</span></button>
          <button className="gatewaySecondary" type="button" onClick={onEnterInterview}>和数字版的我聊聊</button>
        </div>
      </div>
      <div className="gatewayTrace" aria-label="内容生产流程示意">
        <div className="traceWindow">
          <div className="traceChrome"><span className="dot r" /><span className="dot y" /><span className="dot g" /><span className="traceTitle">刘耀华 · 内容与工具落地</span><span className="traceLive">流程示意</span></div>
          <ol className="traceStages">{stages.map((stage,i)=><li className={`stage ${i===3?'is-running':'is-pending'}`} key={stage}><span className="stageDot" aria-hidden="true" /><span className="stageLabel">{stage}</span><span className="stageMeta">{String(i+1).padStart(2,'0')}</span></li>)}</ol>
          <div className="traceLog"><p className="logLine is-info">先确认方向与样片，再组织重复生产。</p><p className="logLine is-info">每一步保留输入、输出与人工审核点。</p><p className="logLine is-warn">进入作品集可体验 AIGC 创作智能体。</p></div>
          <div className="traceStats"><div><strong>内容</strong><small>信息流素材与视频</small></div><div><strong>Agent</strong><small>工具与工作流</small></div><div><strong>落地</strong><small>业务应用与交付</small></div></div>
        </div>
      </div>
    </section>
    <footer className="gatewayFooter"><span>LIU YAO HUA / PORTFOLIO</span><span>AI 信息流 · Agent 开发 · AIGC 赋能</span><span>2026</span></footer>
  </main>
}
