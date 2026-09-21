import { useEffect, useMemo, useRef, useState } from 'react'
import ScrollExpand from './components/ScrollExpand/ScrollExpand'
import Gateway from './components/Gateway/Gateway'
import InterviewExperience from './components/Interview/InterviewExperience'
import { readView, writeView } from './navigation'

const assetPath = (path) => `${import.meta.env.BASE_URL}${path}`

const defaultHeroWallpaper = {
  id: 'desert-portrait',
  src: assetPath('assets/hero-desert-portrait.jpg'),
  position: '32% center',
}

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

const projects = [
  {
    title: '《星际穷途 X》',
    subtitle: 'S 级仿真人科幻短剧 · 项目负责人',
    type: 'video',
    image: 'assets/starry-destitute-cover.jpg',
    preview: 'assets/starry-preview-113-130.mp4',
    previewLabel: '17 秒精选预览',
    meta: '17 秒精选预览 / Grok3.5 + Seedance2.0 / 人物一致性 95%+',
    description:
      '统筹美术资产、分镜设计、AI 生成、后期剪辑、配音字幕与最终交付，建立双模型提示词体系与导演级审美校准标准。',
  },
  {
    title: '品牌产品宣传片',
    subtitle: '生活方式产品广告 · 10 秒精选',
    type: 'video',
    image: 'assets/brand-promo-preview-cover.jpg',
    preview: 'assets/brand-promo-preview-37-47.mp4',
    previewLabel: '10 秒精选预览',
    meta: '居家 / 户外 / 通勤 / 1280×720',
    description:
      '通过居家品尝、户外分享与通勤场景，串联产品在不同生活节奏中的使用情境；本站展示原片 37—47 秒精选片段。',
    href: 'assets/brand-promo-preview-37-47.mp4',
    actionLabel: '打开 10 秒视频',
  },
  {
    title: 'AIGC Hub · AI 创作中转站',
    subtitle: '与伙伴联合从 0 到 1 搭建的 AI 产品',
    type: 'product',
    image: 'assets/aigc-hub-product.png',
    meta: '多模型对话 / 图像 / 视频 / 创作工具',
    description:
      '与伙伴共同搭建并推广的 AI 创作平台，整合多模型对话、图像与视频工具，让创作者从一个入口完成探索与使用。可通过公开邀请页了解产品并注册体验。',
    href: 'https://aigchub.token6688.com/signup?ref=07996c9e',
    actionLabel: '访问产品 / 注册体验',
  },
  {
    title: '镜面落日 · 六帧视觉系列',
    subtitle: '落日 / 镜面水域 / 超现实宴席',
    type: 'image',
    image: 'assets/mirror-sunset/scene-01.jpg',
    meta: '6 张组图 / 16:9 横幅 / 连续场景',
    description:
      '以落日、水面倒影与悬浮餐具贯穿六幅画面，呈现同一场景从对称全景到人物近景的视角变化。',
    galleryGroup: 'mirrorSunset',
    href: '#style',
    actionLabel: '查看六张组图',
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
    image: 'assets/portfolio-gallery/gallery-004.webp',
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
  preview: project.preview ? assetPath(project.preview) : undefined,
  href: project.href?.startsWith('https://') || project.href?.startsWith('#')
    ? project.href
    : project.href ? assetPath(project.href) : undefined,
}))

const galleryGroups = [
  {
    id: 'mirrorSunset',
    label: '镜面落日组图',
    count: 6,
    description: '落日、倒影与超现实宴席的连续画面',
  },
  {
    id: 'portrait',
    label: '竖幅作品',
    count: 54,
    description: '人物、角色、服装与叙事型竖幅视觉',
  },
  {
    id: 'landscape',
    label: '横幅作品',
    count: 21,
    description: '世界观、角色设定与宽幅视觉方案',
  },
  {
    id: 'square',
    label: '方形作品',
    count: 7,
    description: '肖像、插画与方形构图实验',
  },
]

const landscapeShots = new Set([4, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 29, 45, 46, 50, 51, 52, 53, 54, 55])
const squareShots = new Set([1, 2, 3, 28, 63, 66, 78])

const archiveShots = Array.from({ length: 83 }, (_, index) => {
  const number = index + 1
  const categoryId = landscapeShots.has(number)
    ? 'landscape'
    : squareShots.has(number)
      ? 'square'
      : 'portrait'
  const group = galleryGroups.find((item) => item.id === categoryId)

  return {
    id: `selected-${String(number).padStart(3, '0')}`,
    title: `视觉作品 · ${String(number).padStart(2, '0')}`,
    category: group.label,
    categoryId,
    description: group.description,
    src: assetPath(`assets/portfolio-gallery/gallery-${String(number).padStart(3, '0')}.webp`),
  }
})

const mirrorSunsetTitles = [
  '暮色长桌',
  '临水而立',
  '宴席延展',
  '镜中来者',
  '离席时刻',
  '余晖回望',
]

const styleShots = [
  ...archiveShots,
  ...mirrorSunsetTitles.map((title, index) => ({
    id: `mirror-sunset-${String(index + 1).padStart(2, '0')}`,
    title: `镜面落日 · ${title}`,
    category: '镜面落日组图',
    categoryId: 'mirrorSunset',
    description: '落日、倒影与超现实宴席的连续画面',
    src: assetPath(`assets/mirror-sunset/scene-${String(index + 1).padStart(2, '0')}.jpg`),
  })),
]

const strengths = [
  {
    index: '01',
    title: 'Agent 工作流设计',
    text: '以 MOMOCO 服装内容流程为例，拆分素材、生成、审核与交付环节，明确输入输出和人工确认点。',
  },
  {
    index: '02',
    title: 'AI 应用前端实现',
    text: '使用 React、Vite 与原生 Web 技术搭建作品集和移动端 H5，处理响应式布局、交互状态与资源加载。',
  },
  {
    index: '03',
    title: '模型与工具协作',
    text: '围绕具体任务设计提示词、模型与工具的输入输出，保留人工审核，让生成结果更贴近业务要求。',
  },
  {
    index: '04',
    title: '任务状态与异常处理',
    text: '在工作台原型中梳理任务状态、异常反馈与失败重试路径，让多步骤流程可检查、可恢复。',
  },
  {
    index: '05',
    title: '测试与上线验证',
    text: '通过构建、移动端检查、资源路径验证与线上回归，持续迭代已上线网站和互动 H5。',
  },
  {
    index: '06',
    title: 'AI 漫剧导演统筹',
    text: '能从美术资产、人物设定、分镜、生成、剪辑到交付形成闭环，以导演视角控制成片质感。',
  },
]

const stats = [
  ['2′52″', 'S 级仿真人科幻短剧成片'],
  ['95%+', '人物一致性校准目标'],
  ['200+', '线下服务与讲解人次'],
  ['98%+', '客户满意度'],
]

const navItems = [
  ['01 / 作品', 'works'],
  ['02 / 风格', 'gallery-intro'],
  ['03 / 关于', 'about'],
  ['04 / 优势', 'strengths'],
  ['05 / 联系', 'contact'],
]

function AutoPlayProjectMedia({ poster, preview, previewLabel, title }) {
  const containerRef = useRef(null)
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const video = videoRef.current
    if (!container || !video || typeof IntersectionObserver === 'undefined') return undefined

    let delayId
    let visible = false
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.4
      window.clearTimeout(delayId)

      if (visible) {
        delayId = window.setTimeout(() => {
          if (!visible) return
          video.play().then(() => {
            if (visible) setPlaying(true)
          }).catch(() => setPlaying(false))
        }, 1000)
      } else {
        video.pause()
        video.currentTime = 0
        setPlaying(false)
      }
    }, { threshold: [0, 0.4, 0.7] })

    observer.observe(container)
    return () => {
      visible = false
      window.clearTimeout(delayId)
      observer.disconnect()
      video.pause()
    }
  }, [])

  return (
    <div className={`projectPreviewMedia${playing ? ' isPlaying' : ''}`} ref={containerRef}>
      <img src={poster} alt={`${title} 项目视觉`} />
      <video ref={videoRef} src={preview} muted playsInline loop preload="metadata" aria-label={`${title} ${previewLabel}`} />
    </div>
  )
}

function App({ initialView }) {
  const [view, setView] = useState(() => {
    if (initialView) return initialView
    return typeof window === 'undefined' ? 'gateway' : readView(window.location)
  })
  const [activeWallpaper, setActiveWallpaper] = useState(defaultHeroWallpaper)
  const [filter, setFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    const handlePopState = () => setView(readView(window.location))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (nextView) => {
    writeView(nextView)
    setView(nextView)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
  }

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

  if (view === 'gateway') {
    return (
      <Gateway
        assetPath={assetPath}
        onEnterPortfolio={() => navigateTo('portfolio')}
        onEnterInterview={() => navigateTo('interview')}
      />
    )
  }

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
    <main>
      <section className="hero" id="home" aria-label="首页">
        <div
          className="heroWallpaper"
          style={{
            backgroundImage: `url(${activeWallpaper.src})`,
            backgroundPosition: activeWallpaper.position ?? 'center',
          }}
          aria-hidden="true"
        />
        <div className="shade" aria-hidden="true" />

        <header className="siteHeader">
          <div className="portfolioIdentity">
            <button className="returnGatewayButton" type="button" onClick={() => navigateTo('gateway')}>
              ← 入口
            </button>
            <a
              className="brand"
              href="#home"
              aria-label="回到首页并恢复首屏图片"
              onClick={() => setActiveWallpaper(defaultHeroWallpaper)}
            >
              <img
                className="brandAvatar"
                src={assetPath('assets/hero-avatar.jpg')}
                alt=""
              />
            </a>
          </div>
          <nav className="nav" aria-label="主导航">
            {navItems.map(([label, href]) => (
              <a key={href} href={`#${href}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="headerContact" aria-label="联系方式">
            <span>
              <b>电话</b>
              19182874015
            </span>
            <span>
              <b>微信</b>
              Sun677set
            </span>
          </div>
        </header>

        <div className="heroInner shell">
          <div className="heroAside">
            <span>上海 · 杭州 · 武汉 / 可沟通</span>
            <span>AI Film · Brand · Visual</span>
            <span>2026 Portfolio</span>
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
            <img src={assetPath('assets/liu-yaohua-portrait.png')} alt="刘耀华的个人照片" loading="lazy" />
            <div className="portraitCaption">
              <span>刘耀华</span>
              <span>视觉传达设计 / 2026 届</span>
            </div>
          </div>
          <div className="aboutContent">
            <p className="aboutIdentity">刘耀华 <span aria-hidden="true">/</span> 视觉传达设计 · AI 内容创作</p>
            <h2>把 AI 的不确定性，<br />变成可交付的作品。</h2>
            <p>
              我于 2026 年 6 月毕业于四川大学艺术学院视觉传达设计专业，深耕 AIGC 仿真人短剧全流程制作。熟悉美术资产、人物设定、分镜设计、AI
              生成、后期剪辑、配音字幕与成片交付的完整闭环。
            </p>
            <p>
              我更关注“结果是否像一个真正的作品”：画风统一、镜头有叙事意图、角色有连续性，品牌视觉也能被落地到真实商业场景。
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
              ['product', '产品'],
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
            <article className={`projectCard${project.type === 'product' ? ' projectCard--product' : ''}`} key={project.title}>
              {project.preview ? (
                <AutoPlayProjectMedia
                  poster={project.image}
                  preview={project.preview}
                  previewLabel={project.previewLabel}
                  title={project.title}
                />
              ) : (
                <img src={project.image} alt={`${project.title} 项目视觉`} />
              )}
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
                  <a
                    className="projectAction"
                    href={project.href}
                    target={project.galleryGroup ? undefined : '_blank'}
                    rel={project.galleryGroup ? undefined : 'noreferrer'}
                    onClick={project.galleryGroup ? () => {
                      setStyleFilter(project.galleryGroup)
                      setLightboxIndex(null)
                    } : undefined}
                  >
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
            <p>VISUAL ARCHIVE / 2026</p>
            <h2>
              {styleShots.length} 件作品
              <span>视觉创作档案</span>
            </h2>
            <p className="galleryPortalLead">
              从人物设定、服装到幻想场景，呈现不同题材里的风格、构图与叙事。
            </p>
            <a href="#style">浏览视觉作品 <span aria-hidden="true">↓</span></a>
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
              人物、插画、服装设定与世界观探索：用不同画幅呈现角色气质、色彩关系和场景叙事。
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

      <section className="closing" id="contact">
        <div
          className="closingMedia"
          aria-hidden="true"
          style={{ backgroundImage: `url(${assetPath('assets/portfolio-gallery/gallery-022.webp')})` }}
        />
        <div className="closingInner shell">
          <p className="eyebrow">05 / CONTACT</p>
          <h2>让故事长出画面。</h2>
          <p>
            如果你正在做 AI 漫剧、品牌视觉、AIGC 影像或小程序视觉方向，我们可以从一个角色、一支片子或一套视觉系统开始。
          </p>
          <div className="closingContact" aria-label="联系信息">
            <span><b>电话</b> 19182874015</span>
            <span><b>微信</b> Sun677set</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
