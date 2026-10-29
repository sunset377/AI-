import { useEffect, useMemo, useState } from 'react'
import ScrollExpand from './components/ScrollExpand/ScrollExpand'
import Gateway from './components/Gateway/Gateway'
import InterviewExperience from './components/Interview/InterviewExperience'
import DirectorDemo from './components/DirectorDemo/DirectorDemo'
import ScriptDemo from './components/ScriptDemo/ScriptDemo'
import VideoPreview from './components/VideoPreview/VideoPreview'
import ModelWorkbench from './components/ModelWorkbench/ModelWorkbench'
import { readView, writeView } from './navigation'
import { projects, projectSummaries, schematicCovers, galleryGroups, styleShots } from './portfolio-data'
import RecruitmentPreview from './components/RecruitmentPreview/RecruitmentPreview'

const assetPath = (path) => `${import.meta.env.BASE_URL}${path}`

const wallpapers = [
  {
    id: 'electric',
    label: 'Style 01',
    title: 'Dream Garden',
    src: 'assets/portfolio-gallery/gallery-003.webp',
  },
  {
    id: 'garden',
    label: 'Style 02',
    title: 'Night Portrait',
    src: 'assets/portfolio-gallery/gallery-029.webp',
  },
  {
    id: 'surreal',
    label: 'Style 03',
    title: 'Golden World',
    src: 'assets/portfolio-gallery/gallery-022.webp',
  },
].map((wallpaper) => ({ ...wallpaper, src: assetPath(wallpaper.src) }))


const strengths = [
  {
    index: '01',
    title: '多工具调度与长链状态管理',
    text: '把剧本到成片拆成 8 个阶段、9 种状态，每步记录输入、输出与证据，支持 blocked_connector / blocked_approval 等异常分支。',
  },
  {
    index: '02',
    title: '多模型 API 编排与成本闸门',
    text: '统一抽象 LibTV CLI、MiniMax H3、Seedance 2.x 的 plan→submit→resume→download，付费前必须先估价并取得当次授权。',
  },
  {
    index: '03',
    title: '确定性校验与可复现交付',
    text: '用 ffprobe、QC 报告、SHA-256 校验产物，技术可解码不等于创意通过；run 目录隔离历史，不覆盖、不硬编码易变参数。',
  },
  {
    index: '04',
    title: '失败恢复与对账机制',
    text: '网络超时进入 submission_uncertain 先对账不重提；单段失败只重做失败段；人工确认点与机器自动点严格分开。',
  },
  {
    index: '05',
    title: '短剧场景的质量评测直觉',
    text: '60+ 集踩坑积累的 human baseline：人物身份锚不能被场景图覆盖、前后镜服装光影不能断、切镜要检查首中末帧。',
  },
  {
    index: '06',
    title: '视觉与产品闭环能力',
    text: '视觉传达设计背景，能把模糊的"好看/像/能发"转成可检查条件，并用 React/Vite 做成真实可访问的产品。',
  },
]

const stats = [
  ['3 个月', 'AI 漫剧导演经历'],
  ['SOP', '定制化内容生产方法'],
  ['定时任务', '已跑通的视频工作流'],
  ['Web / H5', '网页与移动端互动产品'],
]

const navItems = [
  ['01 / 作品', 'works'],
  ['02 / 流水线', 'director'],
  ['03 / 视觉练习', 'gallery-intro'],
  ['04 / 关于', 'about'],
  ['05 / 优势', 'strengths'],
  ['06 / 联系', 'contact'],
]

function ProjectVideo({ poster, preview, previewLabel, title }) {
  return <VideoPreview src={preview} poster={poster} label={`${title} ${previewLabel}`} />
}

function App({ initialView }) {
  const [view, setView] = useState(() => {
    if (initialView) return initialView
    return typeof window === 'undefined' ? 'home' : readView(window.location)
  })
  const [filter, setFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    const invite = new URLSearchParams(window.location.hash.slice(1)).get('experience')
    if (invite) {
      sessionStorage.setItem('portfolio-model-invite', invite)
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState(window.history.state, '', url)
    }
    const handlePopState = () => setView(readView(window.location))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (nextView, modelId) => {
    writeView(nextView, modelId)
    setView(nextView)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    const target = window.location.hash
      ? document.getElementById(window.location.hash.slice(1))
      : null

    if (!target) return undefined

    const frame = window.requestAnimationFrame(() => target.scrollIntoView())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const visibleProjects = useMemo(() => {
    if (filter === 'all') return projects
    return projects.filter((project) => project.type === filter)
  }, [filter])

  const visibleStyleShots = useMemo(() => {
    if (styleFilter === 'all') return styleShots
    return styleShots.filter((shot) => shot.categoryId === styleFilter)
  }, [styleFilter])

  const activeStyleShot =
    lightboxIndex === null ? null : visibleStyleShots[lightboxIndex]

  useEffect(() => {
    if (lightboxIndex === null) return undefined

    const moveLightbox = (direction) => {
      setLightboxIndex((current) => {
        if (current === null) return null
        return (current + direction + visibleStyleShots.length) % visibleStyleShots.length
      })
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxIndex(null)
      if (event.key === 'ArrowLeft') moveLightbox(-1)
      if (event.key === 'ArrowRight') moveLightbox(1)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightboxIndex, visibleStyleShots.length])

  if (view === 'home') return <RecruitmentPreview />

  if (['studio', 'replica', 'whiteboard'].includes(view)) return <ModelWorkbench initialSection={view === 'studio' ? 'models' : 'agents'} initialAgent={view === 'whiteboard' ? 'whiteboard' : 'director'} onBack={() => navigateTo('home')} />

  if (view === 'gateway') return <Gateway assetPath={assetPath} onEnterPortfolio={() => navigateTo('portfolio')} onEnterInterview={() => navigateTo('interview')} onEnterStudio={modelId => navigateTo('studio', modelId)} />

  if (view === 'interview') {
    return (
      <InterviewExperience
        assetPath={assetPath}
        onBack={() => navigateTo('gateway')}
        onOpenPortfolio={() => navigateTo('portfolio')}
      />
    )
  }

  return (
    <main className="portfolioRefresh">
      <section className="hero" id="home" aria-label="刘耀华个人作品集首页">
        <div className="heroWallpaper" style={{ backgroundImage: `url(${assetPath('assets/hero-desert-user-20261009.jpg')})`, backgroundPosition: 'center' }} aria-hidden="true" />
        <div className="shade" aria-hidden="true" />
        <header className="siteHeader">
          <div className="portfolioIdentity"><button className="returnGatewayButton" type="button" onClick={() => navigateTo('gateway')}>← 入口</button><a className="brand" href="#home" aria-label="刘耀华，回到首页"><img className="brandAvatar" src={assetPath('assets/hero-avatar.jpg')} alt="" /></a></div>
          <nav className="nav" aria-label="作品集导航">{navItems.map(([label,href])=><a key={href} href={`#${href}`}>{label}</a>)}</nav>
          <div className="headerContact"><span><b>电话</b>19182874015</span><span><b>微信</b>Sun677set</span></div>
        </header>
        <div className="heroInner shell portfolioHeroGrid">
          <div className="heroAside"><span>刘耀华 · AI CONTENT / AGENT WORKFLOW</span><span>把 AI 能力用到内容生产与业务交付</span><span>2026 PORTFOLIO</span><div className="heroDemoActions"><a href="?view=studio" onClick={event=>{event.preventDefault();navigateTo('studio')}}>直接体验 AI 聊天 ↗</a><a href="?view=studio&model=gpt-image-2-c" onClick={event=>{event.preventDefault();navigateTo('studio','gpt-image-2-c')}}>试试图片生成 ↗</a><a href="#works">浏览全部作品 ↓</a></div></div>
          <aside className="studioPreviewCard"><p>已集成 · AIGC 创作智能体</p><h2>直接体验聊天与图片生成。</h2><p>整合对话、图片与视频模型入口，搭配标准化 Skill 和导演、白板等智能体，串联创意沟通、剧本拆解、分镜规划与内容制作。</p><a href="?view=studio" onClick={event=>{event.preventDefault();navigateTo('studio')}}>打开 AIGC 创作智能体 ↗</a><small>免注册 · 无需体验码 · 聊天与图片限额体验。视频生成按授权开放，完整制作需连接对应执行服务。</small><img src={assetPath('assets/production/cs-board-preview.jpg')} alt="白板制作模块预览：画面风格选择与制作进度" width="1000" height="620" loading="lazy" /></aside>
        </div>
      </section>

      <section className="workflowFeature shell" id="workflow" aria-labelledby="workflow-title">
        <div className="workflowFeatureHead">
          <div><div className="sectionKicker">CORE CASE / 定制化视频工作流</div><h2 id="workflow-title">先确认样片，<br />再让流程重复执行。</h2></div>
          <p>已经跑通的成语视频定时任务，是我的工作流实践。围绕具体需求固定风格与交付标准，让同一套方法服务不同选题。</p>
        </div>
        <ol className="workflowSteps">
          {[
            ['需求与样片', '明确受众、主题和风格，以样片确认方向。'],
            ['固化制作 SOP', '整理脚本、画面、配音、字幕与检查标准。'],
            ['定时批量生产', '将不同选题交给可复用流程，按任务推进。'],
            ['审核与交付', '检查成片、封面和文案，组织后续发布。'],
          ].map(([title, copy], index) => <li key={title}><span className="workflowStepNumber">{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{copy}</p></li>)}
        </ol>
        <div className="workflowProof"><p><b>案例：预言 · 成语视频系列</b><span>塞翁失马 / 愚公移山 / 画龙点睛</span></p><a href="#workflow-sample">播放真实样片 <span aria-hidden="true">↑</span></a></div>
      </section>

      <section className="capabilityOverview shell" aria-label="业务与开发能力">
        <article><span>AI CONTENT</span><h2>AI 内容与信息流素材</h2><p>从产品卖点、创意脚本到画面与剪辑，结合样片迭代内容，整理可复用的制作方法。</p></article>
        <article><span>AGENT DEVELOPMENT</span><h2>Agent 与工作流开发</h2><p>把重复步骤拆成任务，连接模型与工具，保留过程状态、结果和人工确认点。</p></article>
        <article><span>BUSINESS ENABLEMENT</span><h2>AIGC 业务赋能</h2><p>从企业实际需求出发，完成工具选型、流程搭建与使用说明，让方法可以被理解和复用。</p></article>
      </section>

      <section className="workCollection section shell" id="works" aria-labelledby="works-title">
        <div className="sectionHead">
          <div><div className="sectionKicker">SELECTED WORK / 精选项目</div><h2 id="works-title">作品先说话。</h2></div>
          <p>工作流、视频与互动产品。点击视频即可播放，项目说明可以展开查看。</p>
        </div>
        <div className="workFilters" aria-label="项目类型筛选">
          {[
            ['all', '全部'], ['product', '工作流 / 产品'], ['video', '视频作品'], ['mini', 'H5 / 小程序'], ['image', '视觉系列'],
          ].map(([value, label]) => <button type="button" key={value} className={filter === value ? 'active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
        </div>
        <div className="workGrid">
          {visibleProjects.map((project) => (
            <article className="workCard" key={project.title}>
              <div className={`workMedia${schematicCovers[project.title] ? ' workMediaSchematic' : ''}`}>
                {project.preview ? <ProjectVideo poster={project.image} preview={project.preview} previewLabel={project.previewLabel} title={project.title} />
                  : schematicCovers[project.title] ? <div className="workSchematic"><span>{schematicCovers[project.title].label}</span><strong>{schematicCovers[project.title].title}</strong><div>{schematicCovers[project.title].items.map(item => <span key={item}>{item}</span>)}</div><small>流程结构示意</small></div>
                  : <img src={project.image} alt={`${project.title} 项目视觉`} loading="lazy" width="1200" height="750" />}
                {project.preview ? <span className="workMediaBadge">{project.previewLabel?.replace('自动预览', '精选样片')}</span> : null}
              </div>
              <div className="workBody">
                <p className="workCategory">{project.subtitle}</p>
                <h3>{project.title}</h3>
                <p className="workSummary">{projectSummaries[project.title]}</p>
                <div className="workActions">
                  {project.href || project.preview ? <a className="workLink" href={project.href || project.preview} target={project.href?.startsWith('#') || project.view ? undefined : '_blank'} rel={project.href?.startsWith('#') || project.view ? undefined : 'noreferrer'} onClick={project.view ? (event) => { event.preventDefault(); navigateTo(project.view) } : project.galleryGroup ? () => { setStyleFilter(project.galleryGroup); setLightboxIndex(null) } : undefined}>{project.actionLabel || '打开精选视频'}<span aria-hidden="true">↗</span></a> : null}
                  <details className="workDetails"><summary>项目说明</summary><p>{project.description}</p><p className="workMeta">{project.meta}</p></details>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about section shell" id="about">
        <div className="sectionKicker">03 / ABOUT</div>
        <div className="aboutGrid">
          <div className="portraitCard">
            <img src={assetPath('assets/liu-yaohua-portrait.png')} alt="刘耀华的个人照片" loading="lazy" />
            <div className="portraitCaption">
              <span>刘耀华</span>
              <span>视觉传达设计 / AI 内容创作</span>
            </div>
          </div>
          <div className="aboutContent">
            <p className="aboutIdentity">刘耀华 <span aria-hidden="true">/</span> 视觉传达设计 · 计算机应用实践</p>
            <h2>把 AI 的不确定性，<br />变成可交付的作品。</h2>
            <p>
              我从视觉设计切入 AI 内容生产，也把计算机应用与开发持续用于真实项目。在服装内容、AI 漫剧与品牌项目中，积累了批量化视频生产、自动化工作流及 Agent 工具落地经验。
            </p>
            <p>
              熟悉主流 AI 图像、视频模型，能够完成创意策划、Prompt 优化、流程搭建与效果迭代。我会先用样片明确风格和交付标准，再将重复步骤整理成 SOP，结合工具开发把方法用到实际业务中。
            </p>
            <p className="aboutHarnessNote">
              工具服务于交付。我结合 Codex、Claude Code、Gemini、Kimi、豆包、DeepSeek 与 MiniMax 等工具，完成内容制作、流程搭建和问题排查。
            </p>

            <p className="aboutHarnessNote">
              对外：小红书 AI 创作者，已实现商业变现；交付过口红/粉底液等品牌 TVC、角色卡 Prompt 模板，项目按需求+预算+周期报价。
            </p>

            <div className="contactStrip">
              <span><b>电话</b> 19182874015</span>
              <span><b>微信</b> Sun677set</span>
            </div>

            <div className="statsGrid" aria-label="项目数据">
              {stats.map(([value, label]) => (
                <div className="stat" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="methodIntroduction shell" aria-label="制作方法与工具"><div className="sectionKicker">METHOD / 方法与工具</div><h2>作品背后，是可复用的方法。</h2><p>下面保留原有流程示意与分镜工具，可继续了解制作步骤和输入输出。</p><div><a href="#director">运行流水线演示</a><a href="#script-input">输入剧本生成分镜</a></div></section>
      <DirectorDemo />
      <ScriptDemo />

      <section className="galleryPortalSection" id="gallery-intro" aria-label="进入视觉作品库">
        <ScrollExpand
          src={assetPath('assets/portfolio-gallery/gallery-003.webp')}
          alt="超现实花园视觉作品"
          title="进入视觉档案"
          scrollHint="继续向下探索"
          startWidth={48}
          startHeight={58}
          startRadius={32}
          mediaZoom={1.24}
          scrollDistance={0.9}
          holdDistance={0.18}
          smoothing={0.08}
          overlayScrim={0.62}
          useWindowScroll
        >
          <div className="galleryPortalCopy">
            <p>VISUAL ARCHIVE / 视觉创作档案</p>
            <h2>
              {styleShots.length} 件作品
              <span>视觉创作档案</span>
            </h2>
            <p className="galleryPortalLead">
              早期视觉探索与风格练习——人物设定、服装、幻想场景，作为设计基本功参考，与上方的业务生产线分开看。
            </p>
            <a href="#style">浏览视觉作品 <span aria-hidden="true">↓</span></a>
          </div>
        </ScrollExpand>
      </section>

      <section className="styleLab section" id="style">
        <div className="shell">
          <div className="sectionHead styleHead">
            <div>
              <div className="sectionKicker">PRACTICE / 视觉练习</div>
              <h2>视觉创作档案</h2>
            </div>
            <p>
              非业务项目，纯属设计基本功探索：人物、插画、服装设定与世界观练习，用不同画幅测试角色气质、色彩关系与场景叙事。
            </p>
          </div>

          <div className="styleToolbar">
            <div className="styleFilters" aria-label="作品风格筛选">
              <button
                type="button"
                className={styleFilter === 'all' ? 'active' : ''}
                onClick={() => {
                  setStyleFilter('all')
                  setLightboxIndex(null)
                }}
              >
                全部 <span>{styleShots.length}</span>
              </button>
              {galleryGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className={styleFilter === group.id ? 'active' : ''}
                  onClick={() => {
                    setStyleFilter(group.id)
                    setLightboxIndex(null)
                  }}
                >
                  {group.label} <span>{group.count}</span>
                </button>
              ))}
            </div>
            <p>{visibleStyleShots.length} 件作品</p>
          </div>

          <div className="styleMasonry" aria-label="风格创意图片展示">
            {visibleStyleShots.map((shot, index) => (
              <figure className="styleShot" key={shot.id}>
                <button
                  type="button"
                  className="styleShotButton"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={`打开大图：${shot.title}`}
                >
                  <img
                    src={shot.src}
                    alt={`${shot.title} 风格创意`}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <figcaption>
                  <span>{shot.category}</span>
                  {shot.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {activeStyleShot ? (
        <div
          className="galleryLightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeStyleShot.title} 大图预览`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightboxIndex(null)
          }}
        >
          <button
            type="button"
            className="lightboxClose"
            onClick={() => setLightboxIndex(null)}
            aria-label="关闭大图"
          >
            ×
          </button>
          <button
            type="button"
            className="lightboxArrow lightboxPrevious"
            onClick={() =>
              setLightboxIndex(
                (lightboxIndex - 1 + visibleStyleShots.length) % visibleStyleShots.length,
              )
            }
            aria-label="上一张"
          >
            ←
          </button>
          <div className="lightboxContent">
            <img src={activeStyleShot.src} alt={`${activeStyleShot.title} 大图`} />
            <div className="lightboxCaption">
              <div>
                <span>{activeStyleShot.category}</span>
                <strong>{activeStyleShot.title}</strong>
              </div>
              <p>{lightboxIndex + 1} / {visibleStyleShots.length}</p>
            </div>
          </div>
          <button
            type="button"
            className="lightboxArrow lightboxNext"
            onClick={() =>
              setLightboxIndex((lightboxIndex + 1) % visibleStyleShots.length)
            }
            aria-label="下一张"
          >
            →
          </button>
        </div>
      ) : null}

      <section className="strengths section shell" id="strengths">
        <div className="sectionHead">
          <div>
            <div className="sectionKicker">04 / 能力</div>
            <h2>个人优势</h2>
          </div>
          <p>
            从真实业务需求出发，把任务拆成流程、状态、工具与验收点；视觉制作经验也帮助我判断最终输出是否可用。
          </p>
        </div>

        <div className="strengthGrid">
          {strengths.map((item) => (
            <article className="strengthCard" key={item.title}>
              <span>{item.index}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="evalSection shell" id="eval">
        <div className="sectionHead">
          <div>
            <div className="sectionKicker">EVAL / 评测方法</div>
            <h2>我怎么判断"这一镜到底哪里不对"</h2>
          </div>
          <p>
            来自 AI 漫剧制作与内容交付的实际检查经验：让技术检查与画面判断相互补充。
          </p>
        </div>

        <div className="evalGrid">
          <article className="evalCard">
            <h3>身份锚不可覆盖</h3>
            <p>人物正脸身份锚、完整服装锚，不能被场景图或局部 AI 穿搭图覆盖。多图输入时职责分离，否则下一镜就变脸。</p>
          </article>
          <article className="evalCard">
            <h3>前后镜连续性</h3>
            <p>逐镜检查首帧/中帧/末帧：伞的位置、烟头、手里道具、窗外光线方向。一处断了就是逻辑断层，不是"风格问题"。</p>
          </article>
          <article className="evalCard">
            <h3>失败样本进库</h3>
            <p>穿帮帧、多指/断肢、字幕错字不删，归入负面提示词库与失败样本，下一次同类问题直接拦截。</p>
          </article>
          <article className="evalCard">
            <h3>可解码 ≠ 可用</h3>
            <p>ffprobe 通过只代表技术合格。人物不像、情绪不对、镜头没有叙事意图，照样判 qc_failed，定位到具体时间段重做。</p>
          </article>
          <article className="evalCard">
            <h3>人工确认点</h3>
            <p>付费生成、上传私有素材、音色克隆、登录发布——四个动作必须当次、明确、可追溯授权，机器不替人拍板。</p>
          </article>
          <article className="evalCard">
            <h3>单段失败不整片重拍</h3>
            <p>只重做失败的那一段，复用已审核资产；网络超时进入对账态，绝不因重试重复扣费。</p>
          </article>
        </div>
      </section>

      <section className="closing" id="contact">
        <div
          className="closingMedia"
          aria-hidden="true"
          style={{ backgroundImage: `url(${assetPath('assets/hero-desert-user-20261009.jpg')})` }}
        />
        <div className="closingInner shell">
          <p className="eyebrow">06 / CONTACT</p>
          <h2>从一条样片，开始合作。</h2>
          <p>
            如果你需要持续制作营销视频、搭建内容工作流，或开发可使用的 AI 应用，可以从具体需求和一条样片开始沟通。
          </p>
          <div className="closingContact" aria-label="联系信息">
            <span><b>电话</b> 19182874015</span>
            <span><b>微信</b> Sun677set</span>
            <span><b>邮箱</b> 980175020@qq.com</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export { projects, projectSummaries, styleShots }
export default App
