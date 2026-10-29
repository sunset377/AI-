import { useState } from 'react'
import { projects, projectSummaries, styleShots } from '../../portfolio-data'
import VideoPreview from '../VideoPreview/VideoPreview'
import './RecruitmentPreview.css'

export const fitnessUrl = 'https://pixelfit-sunset377.ochre-bay-0465.chatgpt.site/'
const base = import.meta.env.BASE_URL
export const fitnessCover = `${base}assets/pixelfit-user-cover-20261029.jpg`
const original = (hash = '') => `${base}?view=portfolio${hash}`
const findProject = (title) => projects.find(project => project.title === title)
const mine = findProject('MineFlow · 矿山智慧运输调度')
const archaeology = findProject('小刘带你挖三星堆')
const fable = findProject('定制化视频工作流 · 预言')
const fableSample = findProject('量产样片 · 愚公移山')
const commercial = projects.filter(project => ['品牌产品宣传片', '《时光来信》· 屈臣氏 185 周年', '《星际穷途 X》'].includes(project.title))
const filters = [['all', '全部项目'], ['product', '产品与工作流'], ['video', '视频与商业案例'], ['mini', '互动 H5'], ['image', '视觉系列']]

function Arrow() { return <span aria-hidden="true">↗</span> }
function Tags({ children }) { return <div className="rp-tags">{children.map(tag => <span key={tag}>{tag}</span>)}</div> }
function SectionHeading({ number, label, title, children }) {
  return <div className="rp-section-heading"><div><p className="rp-eyebrow">{number} / {label}</p><h2>{title}</h2></div><p>{children}</p></div>
}
export function projectDestination(project) {
  if (project.href?.startsWith('#')) return project.href === '#workflow' ? '#workflow' : original(project.href)
  if (project.href?.startsWith('?')) return `${base}${project.href}`
  return project.href || project.preview
}
function ProjectLink({ project, children }) {
  const href = projectDestination(project)
  return <a className="rp-text-link" href={href} target={href.startsWith('#') ? undefined : '_blank'} rel={href.startsWith('#') ? undefined : 'noreferrer'}>{children || project.actionLabel || '播放精选视频'} <Arrow /></a>
}
function PixelCover() {
  return <div className="rp-pixel-cover"><img src={fitnessCover} alt="PixelFit 我的健身房：暖色健身房中的角色与开始训练界面" width="1080" height="1920" loading="lazy" /></div>
}

export default function RecruitmentPreview() {
  const [filter, setFilter] = useState('all')
  const [showGallery, setShowGallery] = useState(false)
  const [copied, setCopied] = useState(false)
  const visibleProjects = projects.filter(project => filter === 'all' || project.type === filter)
  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText('刘耀华\n电话：19182874015\n微信：Sun677set\n邮箱：980175020@qq.com')
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return <div className="rp">
    <a className="rp-skip" href="#rp-main">跳到主要内容</a>
    <div className="rp-preview-bar"><span>刘耀华 / 开发 · 产品 · AI 实践</span><a href={`${base}?view=interview`}>与 AI 面试分身聊聊 <Arrow /></a></div>
    <header className="rp-header rp-wrap">
      <a className="rp-brand" href="#top" aria-label="刘耀华，回到顶部"><span className="rp-monogram">辞<span>.</span></span><span>刘耀华<small>开发 · 产品 · AI 实践</small></span></a>
      <nav aria-label="新版作品集导航"><a href="#selected">精选开发</a><a href="#ai-workflow">AI 工作流</a><a href="#commercial">商业作品</a><a href="#all-projects">完整档案</a></nav>
      <a className="rp-header-contact" href="#contact">联系我 <Arrow /></a>
    </header>
    <main id="rp-main">
      <section className="rp-hero rp-wrap" id="top">
        <div className="rp-hero-copy">
          <p className="rp-eyebrow"><span className="rp-status-dot" /> 全栈开发 / AI 应用实践 · 成都</p>
          <h1>把想法，<br />做成<span className="rp-headline-accent">能用的产品。</span></h1>
          <p className="rp-hero-description">我是刘耀华，从视觉设计走向产品开发。<br />面向 Web、SaaS 与微信小程序开发岗位，<br className="rp-desktop-break" />用真实产品、AI 工作流和商业交付展示我的实践。</p>
          <div className="rp-hero-actions"><a className="rp-button" href="#selected">先看三个产品 <span aria-hidden="true">↓</span></a><a className="rp-text-link" href="#profile">查看个人简介 <Arrow /></a></div>
          <p className="rp-hero-stack">React / JavaScript / API 集成 / AI 辅助开发</p>
        </div>
        <div className="rp-hero-showcase">
          <div className="rp-showcase-caption"><span>正在做的事 / 从业务到界面</span><span>01 — 03</span></div>
          <a className="rp-browser" href={mine.href} target="_blank" rel="noreferrer" aria-label="体验 MineFlow 矿山运输调度">
            <div className="rp-browser-bar"><span className="rp-window-dots">● ● ●</span><span>MineFlow / 业务系统交互演示</span><Arrow /></div>
            <img src={mine.image} alt="MineFlow 矿山运输调度系统真实页面预览" width="1200" height="750" fetchPriority="high" />
            <div className="rp-browser-bottom"><strong>让复杂业务，变成清楚的操作。</strong><span>90 秒互动体验 <Arrow /></span></div>
          </a>
          <a className="rp-mini-game" href={fitnessUrl} target="_blank" rel="noreferrer"><span className="rp-mini-pixel" aria-hidden="true">P<span>F</span></span><span><strong>PixelFit 我的健身房</strong><small>训练、饮食、睡眠，做成一款养成小游戏。</small></span><Arrow /></a>
          <div className="rp-showcase-footnote"><span>可体验的产品，先于工具清单。</span><span>SCROLL TO EXPLORE ↓</span></div>
        </div>
      </section>

      <section className="rp-capabilities rp-wrap" aria-label="能力与项目证据">
        <div className="rp-capabilities-label">从需求<br />到交付</div>
        <a href="#case-mine"><span>01 / 业务系统</span><strong>Web 与 SaaS 场景</strong><small>需求、调度、异常、看板 → MineFlow</small></a>
        <a href="#case-h5"><span>02 / 互动产品</span><strong>移动端与交互体验</strong><small>游戏养成、内容探索 → PixelFit / H5</small></a>
        <a href="#ai-workflow"><span>03 / AI 应用</span><strong>把模型接入工作流</strong><small>API、状态管理、结果校验 → 导演 / 工作台</small></a>
      </section>

      <section className="rp-section rp-wrap" id="selected">
        <SectionHeading number="01" label="精选开发" title="不止能看，也能亲自试。">三个切入点：业务系统、轻量游戏与移动端互动。每个项目都说明做了什么，以及你可以体验什么。</SectionHeading>
        <article className="rp-feature-case" id="case-mine">
          <div className="rp-feature-media"><a href={mine.href} target="_blank" rel="noreferrer"><img src={mine.image} alt="MineFlow 调度系统页面" width="1200" height="750" loading="lazy" /></a><span className="rp-media-note">业务系统 · 可交互 Demo</span></div>
          <div className="rp-case-copy"><p className="rp-eyebrow">01 / WEB 产品</p><h3>MineFlow<br /><span>矿山智慧运输调度</span></h3><p>把运输需求、人工派单、排队称重与异常处理，串成一条可以亲手操作的业务链路。</p><dl className="rp-evidence"><div><dt>解决什么</dt><dd>让多环节的运输调度过程可视、可操作。</dd></div><div><dt>实现证据</dt><dd>车辆推荐、人工派单、异常处理、电子磅单与运营看板。</dd></div><div><dt>体验范围</dt><dd>模拟业务数据，浏览器独立会话；未接真实司机与设备。</dd></div></dl><Tags>{['业务建模', '状态流转', '规则校验', '异常处理']}</Tags><div className="rp-case-actions"><a className="rp-button" href={mine.href} target="_blank" rel="noreferrer">体验 90 秒调度 <Arrow /></a><a className="rp-text-link" href="#all-projects">查看项目说明 ↓</a></div></div>
        </article>
        <div className="rp-two-cases">
          <article className="rp-small-case"><a href={fitnessUrl} target="_blank" rel="noreferrer" aria-label="打开 PixelFit 健身游戏"><PixelCover /></a><div className="rp-small-case-copy"><p className="rp-eyebrow">02 / 轻量游戏</p><h3>PixelFit · 我的健身房</h3><p>创建自己的分身，把训练、饮食与睡眠变成一段可以玩的健身养成体验，收集每次成长的小票。</p><Tags>{['产品交互', '养成机制', '浏览器存档']}</Tags><p className="rp-case-boundary">进度保存在当前浏览器。</p><a className="rp-text-link" href={fitnessUrl} target="_blank" rel="noreferrer">进入我的健身房 <Arrow /></a></div></article>
          <article className="rp-small-case" id="case-h5"><div className="rp-small-case-media"><img src={archaeology.image} alt="小刘带你挖三星堆互动产品封面" width="1200" height="750" loading="lazy" /><span className="rp-media-note">已上线 · 移动端 H5</span></div><div className="rp-small-case-copy"><p className="rp-eyebrow">03 / 移动端互动</p><h3>小刘带你挖三星堆</h3><p>将文物知识、考古时间线和问答做成互动探索，让访客自己推进内容，保存收藏与学习进度。</p><Tags>{['HTML / CSS / JS', '离线资源', 'localStorage']}</Tags><p className="rp-case-boundary">16 件文物 · 迭代至第 16 版 · 当前形态为 H5。</p><ProjectLink project={archaeology}>打开互动考古工具</ProjectLink></div></article>
        </div>
      </section>

      <section className="rp-ai-section" id="ai-workflow"><div className="rp-wrap">
        <SectionHeading number="02" label="AI 应用与工作流" title="深度使用 AI，也把流程做扎实。">从竞赛创作到工具开发，把剧本、资产、生成和质检组织成可执行、可追溯的流程。</SectionHeading>
        <div className="rp-director-grid"><div className="rp-director-copy"><p className="rp-eyebrow">AI 漫剧导演 / MOMOCO</p><h3>一周竞赛冲刺，<br />跑通漫剧全流程。</h3><p>从主题、剧本与角色设定，到分镜、AI 生成、剪辑和交付。在创作实践中持续总结方法，再将重复步骤沉淀为导演 Skill。</p><p className="rp-director-emphasis">我的关注点：资产如何保持一致，任务失败如何恢复，结果如何检查。</p><Tags>{['多工具编排', '人工确认', '失败恢复', 'QC / 版本记录']}</Tags><a className="rp-button rp-button-light" href={original('#script-demo')} target="_blank" rel="noreferrer">查看剧本与分镜工具 <Arrow /></a></div>
          <div className="rp-workflow-diagram" aria-label="AI 漫剧工作流：剧本、资产、分镜、生成、后期与质检"><div className="rp-diagram-top"><span>导演工作流 / 结构示意</span><span>INPUT → DELIVERY</span></div><ol>{[['01', '剧本与导演意图', '故事、节奏、角色与镜头要求'], ['02', '资产与分镜', '人物 / 服装 / 场景职责与连续性'], ['03', '模型与任务执行', '工具调用、过程状态、失败恢复'], ['04', '后期与交付检查', '音画、字幕、版本与 QC 报告']].map(([n, title, copy]) => <li key={n}><span>{n}</span><div><strong>{title}</strong><small>{copy}</small></div><span aria-hidden="true">↓</span></li>)}</ol><p><span className="rp-status-dot" /> 关键步骤保留人工审核</p></div></div>
        <div className="rp-integration"><div><span className="rp-eyebrow">另一个开发实践</span><h3>统一 AI 创作工作台</h3><p>把聊天、图片模型与导演、白板工具整合到自己的操作界面，配套访客额度和服务端请求控制。</p></div><div><Tags>{['React / Vite', 'API 集成', '访客额度', '服务端网关']}</Tags><a className="rp-text-link" href={`${base}?view=studio`} target="_blank" rel="noreferrer">打开工作台 <Arrow /></a><small>使用第三方模型服务；视频制作取决于对应执行服务。</small></div></div>
      </div></section>

      <section className="rp-section rp-wrap" id="workflow">
        <SectionHeading number="03" label="内容自动化 / 原有核心案例" title="寓言账号：一套 SOP，持续做内容。">保留“预言”成语故事生产线。用已经完成的样片，展示从单次创作走向可复用内容生产的方法。</SectionHeading>
        <div className="rp-fable"><div className="rp-fable-video"><VideoPreview src={fableSample.preview} poster={fableSample.image} label="预言生产线：愚公移山 10 秒实际样片" playLabel="播放 10 秒实际样片" /><span>实际样片 / 愚公移山</span></div><div className="rp-fable-copy"><p className="rp-eyebrow">预言 · 成语短视频账号</p><h3>先确认样片，<br />再让方法重复执行。</h3><p>{projectSummaries[fable.title]}</p><ol>{[['01', '定方向', '选题、脚本、受众与系列风格'], ['02', '做生产', '画面、配音、字幕、配乐与剪辑'], ['03', '验交付', '视频、封面与发布文案分别检查']].map(([n, title, text]) => <li key={n}><span>{n}</span><strong>{title}</strong><p>{text}</p></li>)}</ol><a className="rp-text-link" href={original('#workflow')} target="_blank" rel="noreferrer">查看原有工作流与样片 <Arrow /></a></div></div>
      </section>

      <section className="rp-section rp-wrap rp-commercial" id="commercial">
        <SectionHeading number="04" label="商业与叙事作品" title="产品之外，我也交付内容。">商业 TVC、品牌命题与科幻短片继续保留。视觉设计与 AI 导演经验，是我理解产品表达的另一部分。</SectionHeading>
        <div className="rp-commercial-grid">{commercial.map((project, index) => <article key={project.title} className="rp-film"><div className="rp-film-media"><VideoPreview src={project.preview} poster={project.image} label={`${project.title} 精选片段`} playLabel="播放精选片段" /></div><div className="rp-film-copy"><p className="rp-eyebrow">0{index + 1} / {project.title === '品牌产品宣传片' ? '商业 TVC' : '比赛 / 叙事'}</p><h3>{project.title}</h3><p>{projectSummaries[project.title]}</p><details><summary>查看制作与项目说明 <span aria-hidden="true">＋</span></summary><p>{project.description}</p><small>{project.meta}</small></details></div></article>)}</div>
      </section>

      <section className="rp-section rp-wrap rp-archive" id="all-projects">
        <SectionHeading number="05" label="完整项目索引" title="做过的，都留在这里。">{projects.length} 个项目，覆盖业务系统、互动产品、AI 工作流与商业创作。按类型浏览，查看项目说明或直接体验。</SectionHeading>
        <div className="rp-filters" role="group" aria-label="完整项目筛选">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{value === 'all' ? projects.length : projects.filter(project => project.type === value).length}</span></button>)}</div>
        <p className="rp-sr-only" role="status">显示 {visibleProjects.length} 个项目</p>
        <div className="rp-project-index">{visibleProjects.map(project => <article key={project.title} data-project-title={project.title}><img src={project.image} alt="" width="160" height="100" loading="lazy" /><div><p>{project.subtitle}</p><h3>{project.title}</h3><p>{projectSummaries[project.title]}</p><details><summary>展开项目说明</summary><p>{project.description}</p><small>{project.meta}</small></details></div><ProjectLink project={project}>打开项目</ProjectLink></article>)}</div>
      </section>

      <section className="rp-visual-section" id="visual"><div className="rp-wrap"><div className="rp-visual-intro"><div><p className="rp-eyebrow">设计背景 / 视觉创作档案</p><h2>{styleShots.length}<span>件视觉练习<br />也是我的设计底子。</span></h2><p>人物、场景、服装与连续画面。完整保留，按需展开浏览。</p><button className="rp-text-link" type="button" aria-expanded={showGallery} aria-controls="rp-gallery" onClick={() => setShowGallery(!showGallery)}>{showGallery ? '收起视觉档案 −' : `展开全部 ${styleShots.length} 件作品 ＋`}</button></div><div className="rp-visual-teaser" aria-hidden="true">{styleShots.filter(shot => ['selected-003', 'selected-029', 'mirror-sunset-01'].includes(shot.id)).map(shot => <img key={shot.id} src={shot.src} alt="" width="400" height="500" loading="lazy" />)}</div></div><div id="rp-gallery" hidden={!showGallery}>{showGallery && <div className="rp-gallery">{styleShots.map(shot => <figure key={shot.id}><a href={shot.src} target="_blank" rel="noreferrer" aria-label={`打开大图：${shot.title}`}><img src={shot.src} alt={shot.title} loading="lazy" /></a><figcaption>{shot.title}</figcaption></figure>)}</div>}</div></div></section>

      <section className="rp-section rp-wrap rp-profile" id="profile"><div><p className="rp-eyebrow">关于刘耀华</p><h2>设计的眼光，<br />产品的思考，<br /><span>开发的实践。</span></h2></div><div><p className="rp-profile-lead">从视觉设计出发，我逐步把想法做成网页、互动产品和 AI 工具。现在希望进入开发岗位，继续打磨能被使用、能解决具体问题的产品。</p><dl><div><dt>求职方向</dt><dd>Web / 全栈开发、SaaS 系统、微信小程序开发</dd></div><div><dt>已有实践</dt><dd>Web 产品与 H5、模型 API 接入、AI 工作流、商业内容交付</dd></div><div><dt>协作方式</dt><dd>深度使用 Codex / Claude Code，结合需求拆解、测试与问题排查推进开发。</dd></div><div><dt>工作地点</dt><dd>成都；可沟通其他城市机会</dd></div></dl><p className="rp-profile-note">当前案例以 Web 与 H5 为主；小程序方向通过后续具体项目继续补充。</p></div></section>

      <footer className="rp-contact" id="contact"><div className="rp-wrap"><p className="rp-eyebrow">一起聊聊，下一个产品。</p><div className="rp-contact-top"><h2>正在寻找，<br />把想法落地的机会。</h2><a className="rp-button" href="mailto:980175020@qq.com">发邮件联系 <Arrow /></a></div><div className="rp-contact-details"><a href="tel:19182874015"><span>电话</span>19182874015</a><span><small>微信</small>Sun677set</span><a href="mailto:980175020@qq.com"><span>邮箱</span>980175020@qq.com</a><button type="button" className="rp-text-link" onClick={copyContact}>{copied ? '联系方式已复制 ✓' : '复制联系方式'} <Arrow /></button></div><p className="rp-sr-only" role="status">{copied ? '联系方式已复制' : ''}</p><div className="rp-footer-bottom"><span>刘耀华 © 2026</span><span>开发 · 产品 · AI 实践</span><a href={original()} target="_blank" rel="noreferrer">原版完整作品集 <Arrow /></a></div></div></footer>
    </main>
  </div>
}
