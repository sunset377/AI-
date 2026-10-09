import { useEffect, useMemo, useRef, useState } from 'react'
import ScrollExpand from './components/ScrollExpand/ScrollExpand'
import Gateway from './components/Gateway/Gateway'
import InterviewExperience from './components/Interview/InterviewExperience'
import DirectorDemo from './components/DirectorDemo/DirectorDemo'
import ScriptDemo from './components/ScriptDemo/ScriptDemo'
import { readView, writeView } from './navigation'

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

const projects = [
  {
    title: '预言 · 自动化成语短视频生产线',
    subtitle: 'Vox 风格 · 每 2 小时自动跑一集 · 已上线 40+ 集',
    type: 'product',
    image: 'assets/production/cover-hualong.png',
    meta: '主题自选→剧本→资产→动效→烧录字幕→配乐→卡点剪辑→发布文案',
    description:
      '一套已跑通三遍、挂在定时任务里的无人值守生产线：不给主题就自己挑一个没做过的成语，自动写剧本、生成人物/场景资产、加元素级动效、烧录带重点字词高亮的字幕、匹配账号专属 BGM、自动卡点剪辑，最终交付可直接发布的竖屏成片 + 标题文案 + 评论区互动。已量产塞翁失马、亡羊补牢、画龙点睛、愚公移山等 40+ 集——这就是上面那套状态机在真实业务里的样子。',
  },
  {
    title: '量产样片 · 愚公移山',
    subtitle: '同一条生产线 · 竖屏成片',
    type: 'video',
    image: 'assets/production/cover-yugong.png',
    preview: 'assets/production/preview-yugong-30-40.mp4',
    previewLabel: '10 秒自动预览',
    meta: 'Vox 风格 / 9:16 / 全自动从主题到发布',
    description:
      '输入"愚公移山"主题，生产线自动完成剧本、人物与场景资产、动效、重点字词字幕、BGM 与卡点剪辑。封面即成片首帧，无人工修图。',
  },
  {
    title: 'AI 漫剧导演工作流',
    subtitle: 'MOMOCO AIGC Director · 开源 Agent 流水线 v2.0',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-004.webp',
    meta: '剧本→资产→分镜→多平台API→后期→QC · 全程状态机',
    description:
      '把一段剧本推进为可发布成片：自动拆解人物/场景/道具/音色资产，统一调度 LibTV CLI、MiniMax H3、Seedance 2.x，经 QC 报告与授权闸门后交付。每步只记录真实状态，失败可对账、可重试、可复现——这是一个跑在短剧片场的小型 Agent Harness。',
    href: '#script-demo',
    actionLabel: '在线演示 · 粘贴剧本即出分镜',
  },
  {
    title: 'WorkBuddy 私人 Agent 工作台',
    subtitle: '面向 AIGC 创作者的多任务自动化台',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-005.webp',
    meta: '任务分层 / 工具调度 / 失败恢复 / 多模型切换',
    description:
      '把素材生成、提示词管理、批量处理拆成独立模块，建立输入→执行状态→结果反馈闭环；用 Claude Code、Codex 辅助搭建与排错，持续解决多模型切换、素材统一与批量产出效率问题。',
  },
  {
    title: '《星际穷途 X》',
    subtitle: 'S 级仿真人科幻短片 · 项目负责人 / AI 导演',
    type: 'video',
    image: 'assets/starry-destitute-cover.jpg',
    preview: 'assets/starry-preview-113-130.mp4',
    previewLabel: '17 秒精选预览',
    meta: '2′52″ 成片 / Grok3.5 + Seedance2.0 / 人物一致性 95%+',
    description:
      '统筹世界观、美术资产、分镜、AI 生成与后期交付，建立双模型提示词体系、负面提示词库与版本记录；围绕角色与画面一致性多轮校准，验证复杂 AIGC 项目的全流程组织能力。',
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
    title: '爆款视频复刻工作台',
    subtitle: '参考视频 → 同款复刻的任务流',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-006.webp',
    meta: '参考解析 / 分镜运镜拆解 / 人物替换 / 多方向生成',
    description:
      '把参考视频解析、分镜与节奏拆解、人物替换和多方向生成组织为可重复执行的任务流，把生成状态、失败重试与结果整理纳入统一流程，沉淀可复用的复刻生产 SOP。',
  },
  {
    title: 'AI创作聚合平台',
    subtitle: '与伙伴联合从 0 到 1 搭建的 AI 产品',
    type: 'product',
    image: 'assets/aigc-hub-product.png',
    meta: '多模型对话 / 图像 / 视频 / 创作工具',
    description:
      '与伙伴共同搭建并推广的 AI 创作平台，整合多模型对话、图像与视频工具，让创作者从一个入口完成探索与使用。',
    href: 'https://aigchub.token6688.com/signup?ref=07996c9e',
    actionLabel: '访问产品 / 注册体验',
  },
  {
    title: '《时光来信》· 屈臣氏 185 周年',
    subtitle: 'AIGC 商业比赛 · 成片 + 海报系列',
    type: 'video',
    image: 'assets/competition/shiguang-cover.png',
    preview: 'assets/production/preview-shiguang-0-10.mp4',
    previewLabel: '10 秒自动预览',
    meta: '185 周年命题 / 民国药铺↔现代药房 / 竖屏成片 + A3 海报×3',
    description:
      '屈臣氏 185 周年命题比赛作品：以"一封跨越 185 年的信"为叙事，用 AI 生成民国药铺与现代药房跨时空对照的成片，配套《跨越/抵达/陪伴》三张 A3 海报与 AIGC 制作报告。从分镜、角色一致性到品牌氛围统一走完整链路。',
  },
  {
    title: '小刘带你挖三星堆',
    subtitle: '线上互动考古工具 · 小红书已发布',
    type: 'mini',
    image: 'assets/sanxingdui-tool-cover.jpg',
    meta: 'H5 / 1927—今天 / 16 件文物互动探索 / 离线可运行',
    description:
      '把线下讲解中的提问、看展顺序与文物知识，转成可自己推进的互动考古体验。迭代至第 16 版，检查 62 处图片引用与离线资源完整性后交付。',
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
    id: 'dailyLife',
    label: '生活方式组图',
    count: 6,
    description: '围绕日常状态与情绪片段展开的连续视觉叙事',
  },
  {
    id: 'characterSketch',
    label: '角色设定草图',
    count: 8,
    description: '以同一角色为核心的造型、姿态与道具设定探索',
  },
  {
    id: 'portraitStudy',
    label: '人物肖像',
    count: 2,
    description: '自然光与生活感人物肖像练习',
  },
  {
    id: 'mirrorSunset',
    label: '镜面落日组图',
    count: 6,
    description: '落日、倒影与超现实宴席的连续画面',
  },
  {
    id: 'portrait',
    label: '竖幅作品',
    count: 49,
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
const excludedArchiveShots = new Set([31, 32, 33, 34, 35, 36])

const archiveShots = Array.from({ length: 83 }, (_, index) => index + 1)
  .filter((number) => !excludedArchiveShots.has(number))
  .map((number) => {
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

const latestCreationGroups = [
  {
    categoryId: 'dailyLife',
    category: '生活方式组图',
    description: '围绕日常状态与情绪片段展开的连续视觉叙事',
    prefix: 'daily',
    titles: ['早安被窝', '自我护理', '蓝天下听歌', '深夜学习', '披萨治愈', '星空下做梦'],
  },
  {
    categoryId: 'characterSketch',
    category: '角色设定草图',
    description: '以同一角色为核心的造型、姿态与道具设定探索',
    prefix: 'character',
    titles: ['角色动作设定', '滑板造型设定', '街头造型设定', '摄影角色设定', '服装轮廓设定', '道具互动设定', '音乐角色设定', '耳机造型设定'],
  },
  {
    categoryId: 'portraitStudy',
    category: '人物肖像',
    description: '自然光与生活感人物肖像练习',
    prefix: 'portrait',
    titles: ['晨光饮品', '被窝与猫'],
  },
]

const latestCreationShots = latestCreationGroups.flatMap((group) =>
  group.titles.map((title, index) => ({
    id: `${group.prefix}-${String(index + 1).padStart(2, '0')}`,
    title,
    category: group.category,
    categoryId: group.categoryId,
    description: group.description,
    src: assetPath(`assets/latest-creations/${group.prefix}-${String(index + 1).padStart(2, '0')}.webp`),
  })),
)

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
  ...latestCreationShots,
]

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
  ['60+ 集', 'AI 短剧量产参与经验'],
  ['8 阶段', '剧本 → 成片状态机'],
  ['3+ 平台', 'LibTV / MiniMax / Seedance 统一调度'],
  ['9 态', 'pending → complete，含 blocked / failed'],
]

const navItems = [
  ['01 / 作品', 'works'],
  ['02 / 流水线', 'director'],
  ['03 / 视觉练习', 'gallery-intro'],
  ['04 / 关于', 'about'],
  ['05 / 优势', 'strengths'],
  ['06 / 联系', 'contact'],
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
        <div className="heroWallpaper" aria-hidden="true" />
        <div className="shade" aria-hidden="true" />

        <header className="siteHeader">
          <div className="portfolioIdentity">
            <button className="returnGatewayButton" type="button" onClick={() => navigateTo('gateway')}>
              ← 入口
            </button>
            <a
              className="brand"
              href="#home"
              aria-label="回到首页"
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
            <span>AI Agent · Workflow · Short-Drama System</span>
            <span>把片场重复劳动变成可调度流水线</span>
            <span>2026 Portfolio</span>
            <div className="heroDemoActions">
              <a href="#director">运行流水线演示 ↓</a>
              <a href="#script-demo">输入剧本生成分镜 ↓</a>
            </div>
          </div>
        </div>
      </section>

      <DirectorDemo />

      <ScriptDemo />

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
              我更关注”结果是否像一个真正的作品”：画风统一、镜头有叙事意图、角色有连续性，品牌视觉也能被落地到真实商业场景。
            </p>
            <p className="aboutHarnessNote">
              我在做的事，是把创意生产里每一步的<b>输入、输出、失败模式、人工审核点</b>都变成结构化状态——这和给大模型搭
              Agent Harness 要解决的"幻觉、长链断裂、工具调度"是同一个问题，只是它发生在短剧片场。我想做那个最懂片场、能定义"这一镜到底哪里不对"的人。
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
          title="进入视觉练习"
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
            <p>VISUAL PRACTICE / 视觉练习</p>
            <h2>
              {styleShots.length} 件练习
              <span>非业务项目</span>
            </h2>
            <p className="galleryPortalLead">
              早期视觉探索与风格练习——人物设定、服装、幻想场景，作为设计基本功参考，与上方的业务生产线分开看。
            </p>
            <a href="#style">进入视觉练习 <span aria-hidden="true">↓</span></a>
          </div>
        </ScrollExpand>
      </section>

      <section className="styleLab section" id="style">
        <div className="shell">
          <div className="sectionHead styleHead">
            <div>
              <div className="sectionKicker">PRACTICE / 视觉练习</div>
              <h2>视觉练习库</h2>
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
            做 60+ 集 AI 短剧攒下的、可复用的评测直觉——这正是给 Agent 建 Benchmark 时最缺的那部分"业务 ground truth"。
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
          style={{ backgroundImage: `url(${assetPath('assets/portfolio-gallery/gallery-022.webp')})` }}
        />
        <div className="closingInner shell">
          <p className="eyebrow">06 / CONTACT</p>
          <h2>让故事长出画面。</h2>
          <p>
            如果你在做 AI 短剧生产、Agent 工作流，或想给大模型建创意场景的评测标准——我们可以从一段剧本、一条流水线，或一次片场复盘开始。
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

export default App
