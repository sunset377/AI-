import { useMemo, useState } from 'react'

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

const styleDirections = [
  {
    title: '梦核与未来花园',
    text: '植物、废墟、机械与柔光人物叙事，适合 AI 短片世界观、海报组图和账号视觉系列。',
  },
  {
    title: '电影感人物肖像',
    text: '冷暖对撞、近景凝视、强情绪面部光线，适合角色设定、短剧主视觉和商业人物风格稿。',
  },
  {
    title: '复古黑白与故障印刷',
    text: '高反差黑白、彩色噪点、旧海报质感，适合封面、视觉实验和品牌态度型物料。',
  },
  {
    title: '童话自然与手作感',
    text: '草地、兔子、纸箱宇航员、暖色儿童叙事，适合亲和型内容、儿童生活方式和治愈系画面。',
  },
]

const styleShots = [
  {
    title: '瓷白暗房',
    category: '人像 / 暗黑童话',
    src: 'assets/style-gallery/porcelain-noir.jpg',
  },
  {
    title: '黑白吉他房间',
    category: '纪实 / 音乐情绪',
    src: 'assets/style-gallery/blackroom-guitar.jpg',
  },
  {
    title: '超现实凝视',
    category: '梦核 / 世界观',
    src: 'assets/style-gallery/surreal-eye-garden.jpg',
  },
  {
    title: '电子绘画肖像',
    category: '色彩 / 角色海报',
    src: 'assets/style-gallery/electric-portrait-wide.jpg',
  },
  {
    title: '纸箱宇航员',
    category: '童趣 / 手作设定',
    src: 'assets/style-gallery/cardboard-astronaut.jpg',
  },
  {
    title: '舞台夸张角色',
    category: '角色 / 表演感',
    src: 'assets/style-gallery/stage-caricature.jpg',
  },
  {
    title: '草地兔子女孩',
    category: '自然 / 治愈叙事',
    src: 'assets/style-gallery/meadow-rabbit-girl.jpg',
  },
  {
    title: '故障印刷偶像',
    category: '海报 / Glitch',
    src: 'assets/style-gallery/glitch-icon-poster.jpg',
  },
  {
    title: '沙漠锈色肖像',
    category: '时装 / 胶片感',
    src: 'assets/style-gallery/desert-rust-portrait.jpg',
  },
  {
    title: '神话舞者',
    category: '绘画 / 身体动态',
    src: 'assets/style-gallery/mythic-dancer.jpg',
  },
  {
    title: '雪夜电影脸',
    category: '影视 / 冷暖光',
    src: 'assets/style-gallery/winter-cinema-face.jpg',
  },
  {
    title: '瓷白近景',
    category: '美学 / 近景肖像',
    src: 'assets/style-gallery/porcelain-close.jpg',
  },
  {
    title: '云海旅人',
    category: '史诗 / 场景概念',
    src: 'assets/style-gallery/cloud-cliff-journey.jpg',
  },
  {
    title: '遗落未来花园',
    category: '组图 / 社媒排版',
    src: 'assets/style-gallery/future-garden-board.jpg',
  },
  {
    title: '花园入口',
    category: '场景 / 角色叙事',
    src: 'assets/style-gallery/future-garden-hero.jpg',
  },
  {
    title: '旷野红发',
    category: '时装 / 户外肖像',
    src: 'assets/style-gallery/desert-redhair-portrait.jpg',
  },
  {
    title: '干净棚拍脸',
    category: '商业 / 人像样片',
    src: 'assets/style-gallery/studio-clean-face.jpg',
  },
  {
    title: '风中兔子男孩',
    category: '童话 / 田野叙事',
    src: 'assets/style-gallery/field-rabbit-boy.jpg',
  },
  {
    title: '维多利亚秋日',
    category: '暗黑 / 复古幻想',
    src: 'assets/style-gallery/victorian-witch-autumn.jpg',
  },
].map((shot) => ({ ...shot, src: assetPath(shot.src) }))

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
  ['02 / Style', 'style'],
  ['03 / About', 'about'],
  ['04 / Strengths', 'strengths'],
  ['05 / Contact', 'contact'],
]

function App() {
  const [activeWallpaper, setActiveWallpaper] = useState(wallpapers[0])
  const [filter, setFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  const visibleProjects = useMemo(() => {
    if (filter === 'all') return projects
    return projects.filter((project) => project.type === filter)
  }, [filter])

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

      <section className="styleLab section" id="style">
        <div className="shell">
          <div className="sectionHead styleHead">
            <div>
              <div className="sectionKicker">02 / STYLE LAB</div>
              <h2>风格创意库</h2>
            </div>
            <p>
              这里收录我做过和正在沉淀的视觉方向：人像、壁纸、AI 绘画、短片概念、社媒封面和角色设定都可以继续扩展进来。
            </p>
          </div>

          <div className="directionGrid">
            {styleDirections.map((item) => (
              <article className="directionCard" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>

          <div className="styleMasonry" aria-label="风格创意图片展示">
            {styleShots.map((shot, index) => (
              <figure className={index % 5 === 2 ? 'styleShot wideShot' : 'styleShot'} key={shot.src}>
                <img src={shot.src} alt={`${shot.title} 风格创意`} loading="lazy" />
                <figcaption>
                  <span>{shot.category}</span>
                  {shot.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

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
