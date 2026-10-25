import './Gateway.css'

export default function Gateway({ assetPath, onEnterPortfolio, onEnterInterview, onEnterStudio }) {
  return <main className="gateway">
    <div className="gatewayNoise" aria-hidden="true" />
    <header className="gatewayHeader">
      <button className="gatewayBrand" type="button" onClick={onEnterPortfolio}>
        <img src={assetPath('assets/hero-avatar.jpg')} alt="刘耀华" />
        <span><strong>刘耀华</strong><small>LIU YAO HUA</small></span>
      </button>
      <nav className="gatewayNav" aria-label="网站入口">
        <button type="button" onClick={() => onEnterStudio()}>AI 创作智能体</button>
        <button type="button" onClick={onEnterPortfolio}>查看作品集</button>
        <button type="button" onClick={onEnterInterview}>AI 面试</button>
      </nav>
      <button className="gatewayInterviewLink" type="button" onClick={onEnterInterview}>AI 面试 <span aria-hidden="true">↗</span></button>
    </header>
    <section className="gatewayHero" aria-labelledby="gateway-title">
      <div className="gatewayCopy">
        <p className="gatewayLabel">AI CONTENT · AGENT WORKFLOW · CHENGDU</p>
        <h1 id="gateway-title"><span>我的 AI 智能体，</span><span className="isAccent">请直接试一试。</span></h1>
        <p className="gatewaySubline">聊一个想法，生成一张图片，再看看我如何把模型、Skill 和智能体串成可调度的工作流。</p>
        <div className="gatewayActions">
          <a className="gatewayPrimary" href="?view=studio" onClick={event => { event.preventDefault(); onEnterStudio() }}>打开 AI 创作智能体 <span aria-hidden="true">↗</span></a>
          <button className="gatewaySecondary" type="button" onClick={onEnterPortfolio}>查看作品集</button>
        </div>
        <p className="gatewayAccessNote">免注册 · 无需体验码 · 聊天与图片限额体验</p>
        <button className="gatewayInterviewText" type="button" onClick={onEnterInterview}>和数字版的我聊聊 →</button>
      </div>
      <div className="gatewayTrace" aria-label="AI 创作体验入口">
        <div className="traceWindow">
          <div className="traceChrome"><span className="dot r" /><span className="dot y" /><span className="dot g" /><span className="traceTitle">刘耀华 · AI 创作工作台</span><span className="traceLive">访客体验</span></div>
          <div className="gatewayTry"><p>从一个小需求开始</p><h2>点开，就能进入创作。</h2>
            <a href="?view=studio" onClick={event => { event.preventDefault(); onEnterStudio() }}><span className="gatewayTryNumber">01</span><span><strong>开始聊天</strong><small>提问、梳理想法、拆解工作流</small></span><span aria-hidden="true">↗</span></a>
            <a href="?view=studio&model=gpt-image-2-c" onClick={event => { event.preventDefault(); onEnterStudio('gpt-image-2-c') }}><span className="gatewayTryNumber">02</span><span><strong>生成图片</strong><small>写下画面描述，体验真实模型出图</small></span><span aria-hidden="true">↗</span></a>
            <a href="?view=whiteboard"><span className="gatewayTryNumber">03</span><span><strong>试听语音 · 看智能体</strong><small>试听已公开音色，查看白板创作流程</small></span><span aria-hidden="true">↗</span></a>
            <p className="gatewayTryNote">聊天与图片费用由作者承担，设有每日体验次数。旁白生成需连接本地 F5-TTS。</p>
          </div>
        </div>
      </div>
    </section>
    <a className="gatewayMineflow" href={assetPath('mineflow/')} target="_blank" rel="noreferrer"><strong>更多项目 · 体验 MineFlow 矿山运输调度 ↗</strong><small>90 秒互动演示 · 模拟数据 · 无需登录</small></a>
    <footer className="gatewayFooter"><span>LIU YAO HUA / PORTFOLIO</span><span>AI 信息流 · Agent 开发 · AIGC 赋能</span><span>2026</span></footer>
  </main>
}
