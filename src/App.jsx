import { useMemo, useState } from 'react'

const wallpapers = [
  {
    id: 'ice',
    label: 'Wallpaper 01',
    title: 'Ice / Motion',
    src: '/assets/wallpaper-ice.jpg',
  },
  {
    id: 'blade',
    label: 'Wallpaper 02',
    title: 'Blade / Focus',
    src: '/assets/wallpaper-blade.png',
  },
]

const projects = [
  {
    title: '《星际穷途 X》',
    subtitle: 'S 级仿真人科幻短剧 · 项目负责人',
    type: 'video',
    image: '/assets/starry-destitute-cover.jpg',
    meta: '2 分 52 秒 / Grok3.5 + Seedance2.0 / 人物一致性 95%+',
    description:
      '统筹美术资产、分镜设计、AI 生成、后期剪辑、配音字幕与最终交付，建立双模型提示词体系与导演级审美校准标准。',
  },
  {
    title: '江南水乡港口小镇 FPV',
    subtitle: '第一视角 AI 视频 · 独立制作',
    type: 'video',
    image: '/assets/wallpaper-blade.png',
    meta: '15 秒 / FPV 运镜 / 沉浸式写实画面',
    description:
      '完成场景概念规划与分镜设计，以 AI 生成无人机穿越视角动态视频，控制飞行节奏、景别变化与空间沉浸感。',
  },
  {
    title: '「金蜀门咖」',
    subtitle: '三星堆 × 金沙联名文博咖啡品牌 VI 全案',
    type: 'image',
    image: '/assets/wallpaper-ice.jpg',
    meta: '品牌定位 / 包装系统 / 门店视觉',
    description:
      '将古蜀文化符号转译进现代咖啡消费场景，完成品牌识别、包装、延展物料与商业落地视觉体系。',
  },
  {
    title: 'AI 抽卡实验室',
    subtitle: '角色设定、提示词与视觉筛选流程',
    type: 'image',
    image: '/assets/wallpaper-blade.png',
    meta: 'Midjourney / Liblib / 即梦 / 审美筛选',
    description:
      '围绕角色一致性、镜头张力和商业可用度进行批量出图、筛选、复盘与风格收敛，形成稳定可复用的抽卡方法。',
  },
  {
    title: '小程序视觉概念',
    subtitle: '轻量交互产品的视觉系统预留位',
    type: 'mini',
    image: '/assets/wallpaper-ice.jpg',
    meta: 'Mini Program / UI Direction / 后续替换真实案例',
    description:
      '为后续小程序项目预留展示模块，可扩展为二维码入口、交互视频、组件规范与关键页面走查。',
  },
]

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
  ['02 / About', 'about'],
  ['03 / Strengths', 'strengths'],
  ['04 / Contact', 'contact'],
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
          <source src="/assets/hero-loop.mp4" type="video/mp4" />
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
        <div className="sectionKicker">02 / ABOUT</div>
        <div className="aboutGrid">
          <div className="portraitCard">
            <img src="/assets/wallpaper-blade.png" alt="辞的视觉风格人物图" />
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
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="strengths section shell" id="strengths">
        <div className="sectionHead">
          <div>
            <div className="sectionKicker">03 / SERVICES</div>
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
        <div className="closingMedia" aria-hidden="true" />
        <div className="closingInner shell">
          <p className="eyebrow">04 / CONTACT</p>
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
