import { useEffect, useMemo, useState } from 'react'
import ScrollExpand from './components/ScrollExpand/ScrollExpand'
import Gateway from './components/Gateway/Gateway'
import InterviewExperience from './components/Interview/InterviewExperience'
import DirectorDemo from './components/DirectorDemo/DirectorDemo'
import ScriptDemo from './components/ScriptDemo/ScriptDemo'
import ReplicaWorkbench from './components/ReplicaWorkbench/ReplicaWorkbench'
import VideoPreview from './components/VideoPreview/VideoPreview'
import NativeBoard from './components/CSBoard/NativeBoard'
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
    title: 'MineFlow · 矿山智慧运输调度',
    subtitle: '可交互业务 Demo · 浏览器直接体验',
    type: 'product',
    image: 'assets/mineflow-preview.png',
    meta: '需求 / 车辆推荐 / 人工派单 / 排队 / 称重 / 异常 / 看板',
    description:
      '基于公开招聘场景开发的运输调度演示：创建需求、确认车辆推荐、推进运输、处理超载与故障，再核对电子磅单和运营指标。全部为模拟数据，每位访客使用独立浏览器会话；不包含真实司机接单 App 或生产设备接入。',
    href: 'mineflow/',
    actionLabel: '进入 MineFlow · 开始90秒互动演示',
  },
  {
    title: '定制化视频工作流 · 预言',
    subtitle: '已跑通的定时任务 · 同系列、不同选题',
    type: 'product',
    image: 'assets/production/cover-hualong.png',
    meta: '定时调度 / 系列风格 / 视频与发布包',
    href: '#workflow',
    actionLabel: '查看生产流程',
    description:
      '将选题、脚本、画面制作、字幕、配乐和发布文案串成可复用的内容生产流程，已跑通定时任务，并完成塞翁失马、愚公移山、画龙点睛等系列视频。先用样片确认风格，再按不同选题组织生产；内容交付与平台发布分别检查。',
  },
  {
    title: '量产样片 · 愚公移山',
    subtitle: '同一条生产线 · 实际样片',
    type: 'video',
    image: 'assets/production/cover-yugong.png',
    preview: 'assets/production/preview-yugong-30-40.mp4',
    previewLabel: '10 秒自动预览',
    meta: 'Vox 风格 / 横版精选 / 10 秒片段',
    description:
      '以“愚公移山”为主题的工作流样片，呈现画面制作、重点字词字幕与剪辑节奏。这里展示既有 10 秒精选视频及系列封面，制作方法见上方工作流案例。',
  },
  {
    title: 'AI 漫剧导演工作流',
    subtitle: 'MOMOCO AIGC Director · 开源 Agent 流水线 v2.0',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-004.webp',
    meta: '剧本→资产→分镜→多平台API→后期→QC · 全程状态机',
    description:
      '独立投入 3 个月进行 AI 漫剧导演开发与测试，最终沉淀为标准化导演 Skill：根据剧本自动确认人物、道具与资产，生成资产图和分镜，编写分时段强制提示词，并通过失败样本持续校准，视频抽卡成功率达到 90%。工作流保留人工审核与授权闸门，失败可对账、可重试、可复现。',
    href: '#script-demo',
    actionLabel: '在线演示 · 粘贴剧本即出分镜',
  },
  {
    title: '《星际穷途 X》',
    subtitle: '个人科幻比赛项目 · AI 导演',
    type: 'video',
    image: 'assets/starry-destitute-cover.jpg',
    preview: 'assets/starry-preview-113-130.mp4',
    previewLabel: '17 秒精选预览',
    meta: '2′52″ 成片 / 科幻叙事 / 多模型协作',
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
    subtitle: 'Hypit 本地剪辑 · 原片低成本复刻',
    type: 'product',
    image: 'assets/portfolio-gallery/gallery-006.webp',
    meta: '原片保留 / 开头节奏 / 字幕包装 / MP4 导出',
    description:
      '保留参考视频画面，用 Hypit 调整开头与剪辑节奏，再添加字幕和蓝紫视觉包装。浏览器先看效果，本地执行器制作真实 MP4；默认不调用付费视频模型。',
    view: 'replica',
    href: '?view=replica',
    actionLabel: '打开视频复刻工作台',
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
    subtitle: '国家级三等奖 · AIGC 商业比赛',
    type: 'video',
    image: 'assets/competition/shiguang-cover.png',
    preview: 'assets/production/preview-shiguang-0-10.mp4',
    previewLabel: '10 秒自动预览',
    meta: '国家级三等奖 / 185 周年命题 / 竖屏成片 + A3 海报×3',
    description:
      '屈臣氏 185 周年 AIGC 命题比赛国家级三等奖作品。以“一封跨越 185 年的信”为叙事，用 AI 生成民国药铺与现代药房跨时空对照的成片，配套《跨越 / 抵达 / 陪伴》三张 A3 海报与 AIGC 制作报告，从分镜、角色一致性到品牌氛围统一走完整链路。',
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
  {
    title: '镜面落日 · 六帧视觉系列',
    subtitle: '个人视觉创作 · 连续画面',
    type: 'image',
    image: 'assets/mirror-sunset/scene-01.jpg',
    meta: '落日 / 倒影 / 超现实场景',
    description: '以落日、倒影与超现实宴席组织的六幅连续画面，探索同一主题下的视觉变化。',
    href: '#style',
    galleryGroup: 'mirrorSunset',
    actionLabel: '查看六张组图',
  },
].map((project) => ({
  ...project,
  image: assetPath(project.image),
  preview: project.preview ? assetPath(project.preview) : undefined,
  href: project.view || project.href?.startsWith('https://') || project.href?.startsWith('#')
    ? project.href
    : project.href ? assetPath(project.href) : undefined,
}))

const projectOrder = [
  'MineFlow · 矿山智慧运输调度',
  '定制化视频工作流 · 预言', '量产样片 · 愚公移山', 'AI 漫剧导演工作流',
  '小刘带你挖三星堆', '品牌产品宣传片', '《星际穷途 X》',
  '《时光来信》· 屈臣氏 185 周年',
  'AI创作聚合平台', '爆款视频复刻工作台', '镜面落日 · 六帧视觉系列',
]
projects.sort((a, b) => projectOrder.indexOf(a.title) - projectOrder.indexOf(b.title))

const projectSummaries = {
  'MineFlow · 矿山智慧运输调度': '从业务需求、车辆推荐与人工派单，到排队、称重、异常和运营看板的可交互调度演示。',
  '定制化视频工作流 · 预言': '以已跑通的定时任务与系列样片，展示从选题到成片、封面和发布文案的生产方法。',
  '量产样片 · 愚公移山': '同一套工作流的实际视频，直接查看画面风格、字幕和剪辑节奏。',
  'AI 漫剧导演工作流': '独立开发测试 3 个月，沉淀从剧本、人物道具资产到分镜和分时段提示词的标准化导演 Skill。',
  '小刘带你挖三星堆': '把文物知识和考古时间线，做成可以直接打开体验的互动 H5。',
  '品牌产品宣传片': '围绕产品使用场景组织镜头，展示营销视频与生活方式内容的制作能力。',
  '《星际穷途 X》': '个人科幻比赛项目：从世界观、美术资产到分镜和完整成片。',
  '《时光来信》· 屈臣氏 185 周年': '屈臣氏 185 周年 AIGC 命题比赛国家级三等奖，包含成片、三张海报与制作说明。',
  'AI创作聚合平台': '与伙伴共建的 AI 创作平台，整合多模型对话、图像与视频工具。',
  '爆款视频复刻工作台': '本地剪辑与包装演示，将参考视频、字幕和制作结果组织成一个工作台。',
  '镜面落日 · 六帧视觉系列': '在同一主题下探索色彩、构图与连续画面的表达。',
}

const schematicCovers = {
  'AI 漫剧导演工作流': { label: 'DIRECTOR WORKFLOW', title: '让镜头有叙事，\n让角色有连续性。', items: ['剧本分析', '角色与场景', '分镜制作', '后期交付'] },
  '爆款视频复刻工作台': { label: 'VIDEO WORKBENCH / 本地演示', title: '从参考素材，\n到剪辑与交付。', items: ['参考视频', '剪辑包装', '字幕', 'MP4 导出'] },
}

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
    return typeof window === 'undefined' ? 'gateway' : readView(window.location)
  })
  const [filter, setFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [directorBrief, setDirectorBrief] = useState('')

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

  if (view === 'replica') return <ReplicaWorkbench initialRequirement={directorBrief} onBack={() => navigateTo(directorBrief ? 'studio' : 'portfolio')} />
  if (view === 'studio') return <NativeBoard onBack={() => navigateTo('portfolio')} onDirector={(brief = '') => { setDirectorBrief(brief); navigateTo('replica') }} />

  if (view === 'gateway') return <Gateway assetPath={assetPath} onEnterPortfolio={() => navigateTo('portfolio')} onEnterInterview={() => navigateTo('interview')} />

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
          <div className="heroAside"><span>刘耀华 · AI CONTENT / AGENT WORKFLOW</span><span>把 AI 能力用到内容生产与业务交付</span><span>2026 PORTFOLIO</span><div className="heroDemoActions"><a href={assetPath('mineflow/')} target="_blank" rel="noreferrer">体验 MineFlow 矿山调度 ↗</a><a href="#workflow">查看视频工作流 ↓</a><a href="#works">浏览全部作品 ↓</a></div></div>
          <aside className="studioPreviewCard"><p>已集成 · 开源视频智能体</p><img src={assetPath('assets/production/cs-board-preview.jpg')} alt="CS Board 蓝白配色工作台预览：画面风格选择与制作进度" width="1000" height="620" /><h2>把一段旁白，做成视频。</h2><p>选择音色、输入文案或分镜，再从 12 种画面风格中选择并查看制作进度。</p><a href="?view=studio" onClick={event=>{event.preventDefault();navigateTo('studio')}}>打开视频智能体 ↗</a><small>界面已上线；完整生成需连接本地 F5‑TTS / FFmpeg 服务</small></aside>
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

export default App
