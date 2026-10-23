import { useEffect, useState } from 'react'

const skills = [
  { id: 'director', name: 'MOMOCO 导演 Skill', category: '导演', mark: 'DIRECTOR', description: '把想法、剧本和可选参考整理成导演方案，继续在导演智能体里沟通与调整。', input: '创作目标、剧本，可选参考视频', output: '结构化方案、镜头时间线、资产清单与视频指令', steps: ['输入想法或剧本，可选添加参考。', '与导演沟通，核对镜头、资产和声音。', '确认方案，再选择本地制作或 MiniMax 路径。'], agent: 'director', tab: 'template', dependency: '执行需连接导演服务；DeepSeek 与 MiniMax 是否可用以实际连接状态为准。' },
  { id: 'whiteboard', name: '白板视频工作流', category: '白板', mark: 'WHITEBOARD', description: '基于 CS Board 二创：选择音色、输入文案、设置画面风格，查看制作进度。', input: '文案、声音与画面风格', output: '分镜插画、旁白、字幕与白板视频', steps: ['输入文案，选择音色或上传已有旁白。', '试听确认，再选择画面风格和成片设置。', '提交制作，查看任务进度与真实成片。'], agent: 'whiteboard', dependency: '制作需连接白板服务、本地 F5-TTS 与 FFmpeg；不会因选用 Skill 自动开始生成。' },
  { id: 'edit', name: '原片剪辑包装', category: '剪辑', mark: 'EDIT', description: '复用已有画面，调整开头节奏、字幕与视觉包装，先预览再决定导出。', input: '不超过 30 秒、25 MB 的参考视频', output: '浏览器包装预览与本地导出的新版本', steps: ['选择原片，保留原始文件。', '设置开场、字幕与视觉包装。', '先看本地预览，确认后交给 Hypit 导出。'], agent: 'director', tab: 'create', dependency: '预览在浏览器中完成；导出需连接本地 Hypit 执行服务。' },
]

export default function SkillSquare({ onUse }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState([])
  const [detail, setDetail] = useState(null)
  const [storageError, setStorageError] = useState('')
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem('portfolio-studio-skills') || '[]'); if (Array.isArray(value)) setSaved(value.filter(id => skills.some(skill => skill.id === id))) } catch { /* Storage is optional. */ } }, [])
  const toggleSaved = (id) => {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id]
    setSaved(next)
    try { localStorage.setItem('portfolio-studio-skills', JSON.stringify(next)); setStorageError('') }
    catch { setStorageError('当前浏览器无法保存收藏，刷新后可能丢失。') }
  }
  const filtered = skills.filter(skill => (!savedOnly || saved.includes(skill.id)) && (category === '全部' || skill.category === category) && `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="mwSkills">
    <header className="mwSectionHeading"><p>把方法变成可复用的工作流</p><h1>Skill 广场</h1><span>选一个方法，直接在这个工作台里继续。不打开其他页面，也不自动提交生成。</span></header>
    <div className="mwSkillViews"><button aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)}>全部 Skill</button><button aria-pressed={savedOnly} onClick={() => setSavedOnly(true)}>我的收藏 · {saved.length}</button></div>
    <div className="mwSkillFilters"><input aria-label="搜索 Skill" placeholder="搜索名称或用途…" value={query} onChange={event => setQuery(event.target.value)} /><div role="group" aria-label="Skill 分类">{['全部', '导演', '白板', '剪辑'].map(value => <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div></div>
    <div className="mwSkillGrid">{filtered.map(skill => <article className="mwSkillCard" key={skill.id}>
      <div className="mwSkillCover"><span>{skill.category}工作流</span><strong>{skill.mark}</strong><small>刘耀华 · 已集成</small></div>
      <h2>{skill.name}</h2><p>{skill.description}</p>
      <div className="mwSkillActions"><button onClick={() => setDetail(detail === skill.id ? null : skill.id)} aria-expanded={detail === skill.id}>查看步骤</button><button aria-label={`收藏 ${skill.name}`} aria-pressed={saved.includes(skill.id)} onClick={() => toggleSaved(skill.id)}>{saved.includes(skill.id) ? '已收藏' : '收藏'}</button><button className="mwUseSkill" onClick={() => onUse(skill)}>使用 Skill →</button></div>
      {detail === skill.id && <section className="mwSkillDetail" aria-label={`${skill.name}使用步骤`}><dl><dt>输入</dt><dd>{skill.input}</dd><dt>输出</dt><dd>{skill.output}</dd></dl><ol>{skill.steps.map(step => <li key={step}>{step}</li>)}</ol><p>{skill.dependency}</p></section>}
    </article>)}</div>
    {!filtered.length && <p className="mwSkillEmpty">{savedOnly ? '没有匹配的收藏。可先在“全部 Skill”里收藏常用方法。' : '没有找到匹配的 Skill，试试其他关键词或分类。'}</p>}
    {storageError && <p role="status" className="mwError">{storageError}</p>}
    <p className="mwSkillPrivacy">这里仅展示本站已整合的工作流，不读取或公开作者电脑里的私人 Skill。</p>
  </div>
}
