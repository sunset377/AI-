import './Gateway.css'

const headline = [
  ['看我的', false],
  ['作品', false],
  ['也和', false],
  ['数字版', true],
  ['的我', true],
  ['对话', true, true],
]

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
          <button type="button" onClick={onEnterPortfolio}>PORTFOLIO</button>
          <button type="button" onClick={onEnterInterview}>AI INTERVIEW</button>
          <a href="mailto:980175020@qq.com">CONTACT</a>
        </nav>

        <button className="gatewayInterviewLink" type="button" onClick={onEnterInterview}>
          AI 面试
          <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="gatewayHero" aria-labelledby="gateway-title">
        <div className="gatewayCopy">
          <p className="gatewayLabel">AI DIRECTOR · VISUAL DESIGNER · CHENGDU</p>
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

          <div className="gatewayActions">
            <button className="gatewayPrimary" type="button" onClick={onEnterPortfolio}>
              进入作品集 <span aria-hidden="true" />
            </button>
            <button className="gatewaySecondary" type="button" onClick={onEnterInterview}>
              开始 AI 面试 <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        <div className="gatewayMedia" aria-label="刘耀华视觉作品精选">
          <div className="gatewayMediaFrame">
            <img
              className="gatewayMediaMain"
              src={assetPath('assets/style-gallery/future-garden-hero.jpg')}
              alt="未来花园视觉作品"
            />
            <div className="gatewayMediaTint" aria-hidden="true" />
            <p><span>01</span> SELECTED VISUAL / 2026</p>
          </div>
          <figure className="gatewayMediaCard">
            <img
              src={assetPath('assets/style-gallery/electric-portrait-wide.jpg')}
              alt="电光人物视觉作品"
            />
            <figcaption>AI FILM / BRAND / VISUAL</figcaption>
          </figure>
          <div className="gatewayOrbit" aria-hidden="true">
            <span>107</span>
            <small>WORKS<br />ONLINE</small>
          </div>
        </div>
      </section>

      <footer className="gatewayFooter">
        <span>PORTFOLIO / AI INTERVIEW</span>
        <span>SCROLL-FREE ENTRY</span>
        <span>© 2026 CI.</span>
      </footer>
    </main>
  )
}

export default Gateway
