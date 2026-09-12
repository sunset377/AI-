import { useEffect, useMemo, useState } from 'react'
import ScrollExpand from './components/ScrollExpand/ScrollExpand'

const assetPath = (path) => `${import.meta.env.BASE_URL}${path}`

const wallpapers = [
  {
    id: 'electric',
    label: 'Style 01',
    title: 'Electric Portrait',
    src: 'assets/style-gallery/electric-portrait-wide.jpg',
  },
  {
    id: 'garden',
    label: 'Style 02',
    title: 'Future Garden',
    src: 'assets/style-gallery/future-garden-hero.jpg',
  },
  {
    id: 'surreal',
    label: 'Style 03',
    title: 'Surreal Vision',
    src: 'assets/style-gallery/surreal-eye-garden.jpg',
  },
].map((wallpaper) => ({ ...wallpaper, src: assetPath(wallpaper.src) }))

const projects = [
  {
    title: '《星际穷途 X》',
    subtitle: 'S 级仿真人科幻短剧 · 项目负责人',
    type: 'video',
    image: 'assets/starry-destitute-cover.jpg',
    meta: '2 分 52 秒 / Grok3.5 + Seedance2.0 / 人物一致性 95%+',
    description:
      '统筹美术资产、分镜设计、AI 生成、后期剪辑、配音字幕与最终交付，建立双模型提示词体系与导演级审美校准标准。',
  },
  {
    title: '江南水乡港口小镇 FPV',
    subtitle: '第一视角 AI 视频 · 独立制作',
    type: 'video',
    image: 'assets/wallpaper-blade.png',
    meta: '15 秒 / FPV 运镜 / 沉浸式写实画面',
    description:
      '完成场景概念规划与分镜设计，以 AI 生成无人机穿越视角动态视频，控制飞行节奏、景别变化与空间沉浸感。',
  },
  {
    title: '「金蜀门咖」',
    subtitle: '三星堆 × 金沙联名文博咖啡品牌 VI 全案',
    type: 'image',
    image: 'assets/wallpaper-ice.jpg',
    meta: '品牌定位 / 包装系统 / 门店视觉',
    description:
      '将古蜀文化符号转译进现代咖啡消费场景，完成品牌识别、包装、延展物料与商业落地视觉体系。',
  },
  {
    title: 'AI 抽卡实验室',
    subtitle: '角色设定、提示词与视觉筛选流程',
    type: 'image',
    image: 'assets/style-gallery/electric-portrait-wide.jpg',
    meta: 'Midjourney / Liblib / 即梦 / 审美筛选',
    description:
      '围绕角色一致性、镜头张力和商业可用度进行批量出图、筛选、复盘与风格收敛，形成稳定可复用的抽卡方法。',
  },
  {
    title: '小刘带你挖三星堆',
    subtitle: '线上互动考古工具 · 小红书已发布',
    type: 'mini',
    image: 'assets/sanxingdui-tool-cover.jpg',
    meta: 'H5 / 1927—今天 / 16 件文物互动探索',
    description:
      '将三年线下讲解中的提问、看展顺序与文物知识，转成可自己推进的互动考古体验：沿时间线发掘、看懂材质，并追踪文物从出土到展柜的旅程。',
    href: 'sanxingdui/',
    actionLabel: '打开互动工具',
  },
].map((project) => ({
  ...project,
  image: assetPath(project.image),
  href: project.href ? assetPath(project.href) : undefined,
}))

const galleryGroups = [
  {
    id: 'world',
    label: '梦幻世界',
    count: 33,
    description: '梦核场景、神话人物与电影感世界观',
  },
  {
    id: 'portrait',
    label: '人像实验',
    count: 23,
    description: '情绪肖像、胶片摄影与角色气质探索',
  },
  {
    id: 'illustration',
    label: '插画手作',
    count: 14,
    description: '绘画、拼贴、童话与训练手账视觉',
  },
  {
    id: 'brand',
    label: '商业创意',
    count: 13,
    description: '角色资产、产品表达与广告视觉方案',
  },
  {
    id: 'fashion',
    label: '服装造型',
    count: 24,
    description: '服装设定、造型组合与人物一致性测试',
  },
]

const styleShots = galleryGroups.flatMap((group) =>
  Array.from({ length: group.count }, (_, index) => ({
    id: `${group.id}-${String(index + 1).padStart(2, '0')}`,
    title: `${group.label} · ${String(index + 1).padStart(2, '0')}`,
    category: group.label,
    categoryId: group.id,
    description: group.description,
    src: assetPath(
      `assets/portfolio-gallery/${group.id}-${String(index + 1).padStart(2, '0')}.webp`,
    ),
  })),
)

const strengths = [
  {
    index: '01',
    title: 'AI 漫剧导演统筹',
    text: '能从美术资产、人物设定、分镜、生成、剪辑到交付形成闭环，以导演视角控制成片质感。',
  },
  {
    index: '02',
    title: '影视分镜叙事',
    text: '熟悉分层分屏、人脸叠化、微距特写、史诗全景等镜头语言，能把故事节奏转译为画面节奏。',
  },
  {
    index: '03',
    title: '提示词工程与抽卡',
    text: '围绕模型能力、负面词库、角色一致性和画风统一建立提示词系统，提升出图出片稳定性。',
  },
  {
    index: '04',
    title: '品牌视觉全案',
    text: '具备视觉传达设计背景，能完成品牌定位、VI 系统、包装、门店视觉与商业落地延展。',
  },
  {
    index: '05',
    title: '后期剪辑调色',
    text: '熟悉剪映专业版、PR、AE、达芬奇，能处理节奏、字幕、配音、调色与最终成片包装。',
  },
  {
    index: '06',
    title: '沟通与项目拆解',
    text: '导游与教练经历带来客户沟通、需求洞察、路线规划与目标拆解能力，适合跨环节协作。',
  },
]

const stats = [
  ['2′52″', 'S 级仿真人科幻短剧成片'],
  ['95%+', '人物一致性校准目标'],
  ['200+', '线下服务与讲解人次'],
  ['98%+', '客户满意度'],
]

const navItems = [
  ['01 / Works', 'works'],
  ['02 / Style', 'gallery-intro'],
  ['03 / About', 'about'],
  ['04 / Strengths', 'strengths'],
  ['05 / Contact', 'contact'],
]

function App() {
  const [activeWallpaper, setActiveWallpaper] = useState(wallpapers[0])
  const [filter, setFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const target = window.location.hash
      ? document.querySelector(window.location.hash)
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('980175020@qq.com')
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = 'mailto:980175020@qq.com'
    }
  }

  return (
    <main>
      <section className="hero" id="home" aria-label="首页">
        <video className="heroVideo" autoPlay muted loop playsInline poster={activeWallpaper.src}>
          <source src={assetPath('assets/hero-loop.mp4')} type="video/mp4" />
        </video>
        <div
          className="heroWallpaper"
          style={{ backgroundImage: `url(${activeWallpaper.src})` }}
          aria-hidden="true"
        />
        <div className="shade" aria-hidden="true" />

        <header className="siteHeader">
          <a className="brand" href="#home" aria-label="回到首页">
            辞.
          </a>
          <nav className="nav" aria-label="主导航">
            {navItems.map(([label, href]) => (
              <a key={href} href={`#${href}`}>
                {label}
              </a>
            ))}
          </nav>
          <a className="headerCta" href="mailto:980175020@qq.com">
            联系我
          </a>
        </header>

        <div className="heroInner shell">
          <div className="heroAside">
            <span>成都 / 可合作</span>
            <span>AI Film · Brand · Visual</span>
            <span>2026 Portfolio</span>
          </div>

          <div className="heroCopy">
            <p className="eyebrow">Visual Designer / AI Designer / Brand Designer</p>
            <h1>
              辞<span>.</span>
            </h1>
            <p className="heroLead">
              AI 漫剧导演，也是抽卡师。用视觉设计的秩序感，校准 AI 影像的情绪、镜头与商业质感。
            </p>
            <div className="heroActions">
              <a className="primaryBtn" href="#works">
                查看作品
              </a>
              <button className="ghostBtn" type="button" onClick={handleCopy}>
                {copied ? '邮箱已复制' : '复制邮箱'}
              </button>
            </div>
          </div>

          <div className="wallpaperSwitch" aria-label="壁纸切换">
            {wallpapers.map((wallpaper) => (
              <button
                key={wallpaper.id}
                type="button"
                className={activeWallpaper.id === wallpaper.id ? 'active' : ''}
                onClick={() => setActiveWallpaper(wallpaper)}
              >
                <span>{wallpaper.label}</span>
                {wallpaper.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="about section shell" id="about">
        <div className="sectionKicker">03 / ABOUT</div>
        <div className="aboutGrid">
          <div className="portraitCard">
            <img src={assetPath('assets/style-gallery/porcelain-close.jpg')} alt="辞的视觉风格人物图" />
            <div className="portraitCaption">
              <span>刘耀华</span>
              <span>23 岁 / 成都</span>
            </div>
          </div>
          <div className="aboutContent">
            <h2>把 AI 生成的不确定性，变成可导演、可复盘、可交付的视觉系统。</h2>
            <p>
              我本科毕业于视觉传达设计，深耕 AIGC 仿真人短剧全流程制作。熟悉美术资产、人物设定、分镜设计、AI
              生成、后期剪辑、配音字幕与成片交付的完整闭环。
            </p>
            <p>
              我更关注“结果是否像一个真正的作品”：画风统一、镜头有叙事意图、角色有连续性，品牌视觉也能被落地到真实商业场景。
            </p>

            <div className="contactStrip">
              <a href="tel:19182874015">电话 / 微信：19182874015</a>
              <a href="mailto:980175020@qq.com">邮箱：980175020@qq.com</a>
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

      <section className="works section shell" id="works">
        <div className="sectionHead">
          <div>
            <div className="sectionKicker">01 / WORKS</div>
            <h2>精选项目</h2>
          </div>
          <div className="filters" aria-label="项目类型筛选">
            {[
              ['all', '全部'],
              ['image', '图片'],
              ['video', '视频'],
              ['mini', '小程序'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="projectGrid">
          {visibleProjects.map((project, index) => (
            <article className="projectCard" key={project.title}>
              <img src={project.image} alt={`${project.title} 项目视觉`} />
              <div className="projectOverlay">
                <div className="projectIndex">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <p>{project.subtitle}</p>
                  <h3>{project.title}</h3>
                  <span>{project.meta}</span>
                </div>
              </div>
              <div className="projectInfo">
                <p>{project.description}</p>
                {project.href ? (
                  <a className="projectAction" href={project.href} target="_blank" rel="noreferrer">
                    {project.actionLabel}
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="galleryPortalSection" id="gallery-intro" aria-label="进入视觉作品库">
        <ScrollExpand
          src={assetPath('assets/portfolio-gallery/world-01.webp')}
          alt="超现实花园中的巨型眼睛与旅行者"
          title="进入视觉档案"
          scrollHint="向下滚动，展开作品"
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
            <p>VISUAL ARCHIVE / 2026</p>
            <h2>
              107 件作品
              <span>5 种视觉方向</span>
            </h2>
            <p className="galleryPortalLead">
              梦幻世界、人像实验、插画手作、商业创意与服装造型。
            </p>
            <a href="#style">进入双列图库 <span aria-hidden="true">↓</span></a>
          </div>
        </ScrollExpand>
      </section>

      <section className="styleLab section" id="style">
        <div className="shell">
          <div className="sectionHead styleHead">
            <div>
              <div className="sectionKicker">02 / STYLE LAB</div>
              <h2>风格创意库</h2>
            </div>
            <p>
              从桌面壁纸、AI 绘画到角色与服装设定，共收录 107 件视觉作品。像浏览小红书一样向下滑动，点击图片可查看完整大图。
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
            <div className="sectionKicker">04 / SERVICES</div>
            <h2>个人优势</h2>
          </div>
          <p>
            从审美判断到工具链落地，我的能力更像一条制片管线：先建立风格，再控制变量，最后交付稳定结果。
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

      <section className="closing" id="contact">
        <div
          className="closingMedia"
          aria-hidden="true"
          style={{ backgroundImage: `url(${assetPath('assets/style-gallery/future-garden-hero.jpg')})` }}
        />
        <div className="closingInner shell">
          <p className="eyebrow">05 / CONTACT</p>
          <h2>让故事长出画面。</h2>
          <p>
            如果你正在做 AI 漫剧、品牌视觉、AIGC 影像或小程序视觉方向，我们可以从一个角色、一支片子或一套视觉系统开始。
          </p>
          <div className="closingActions">
            <a className="primaryBtn" href="mailto:980175020@qq.com">
              发送邮件
            </a>
            <a className="ghostBtn linkBtn" href="tel:19182874015">
              电话 / 微信：19182874015
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
