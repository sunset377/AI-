import './Gateway.css'

const headline = [
  ['看作品，', false],
  ['也和数字版的我', false],
  ['聊聊。', false, true],
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
          <button type="button" onClick={onEnterInterview}>AI 面试</button>
          <button type="button" onClick={onEnterPortfolio}>作品集</button>
          <button type="button" onClick={onEnterPortfolio}>联系</button>
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
            <button className="gatewayPrimary" type="button" onClick={onEnterInterview}>
              开始 AI 面试 <span aria-hidden="true">↗</span>
            </button>
            <button className="gatewaySecondary" type="button" onClick={onEnterPortfolio}>
              查看现有作品
            </button>
          </div>
        </div>

        <div className="gatewayMedia" aria-label="刘耀华视觉作品精选">
          <div className="gatewayMediaFrame">
            <img
              className="gatewayMediaMain"
              src={assetPath('assets/portfolio-gallery/gallery-003.webp')}
              alt="超现实花园视觉作品"
            />
            <div className="gatewayMediaTint" aria-hidden="true" />
            <p><span>01</span> SELECTED VISUAL / 2026</p>
          </div>
          <figure className="gatewayMediaCard">
            <img
              src={assetPath('assets/portfolio-gallery/gallery-029.webp')}
              alt="夜景人物视觉作品"
            />
            <figcaption>AI FILM / BRAND / VISUAL</figcaption>
          </figure>
          <div className="gatewayOrbit" aria-hidden="true">
            <span>82</span>
            <small>WORKS<br />ONLINE</small>
          </div>
        </div>
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
