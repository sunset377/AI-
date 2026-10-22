import { validateTemplate } from './replica-template.js'

export const DIRECTOR_PLAN_VERSION = 1
const sources = new Set(['observed', 'user', 'model', 'default'])
const topKeys = ['schemaVersion', 'status', 'goal', 'requirements', 'reference', 'canvas', 'shots', 'assets', 'route', 'audio', 'prompt', 'questions', 'blockers']
const unsafe = /(?:[a-z]:[\\/]|file:\/\/|\b(?:api[_ -]?key|authorization|bearer|replica_chat_api_key)\b|skill\.md)/i
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => Object.hasOwn(value, key))
const safeText = (value, max, empty = false) => {
  if (typeof value !== 'string' || (!empty && !value.trim()) || [...value].length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || unsafe.test(value)) throw new Error('导演方案包含无效或敏感文字。')
  return value.trim()
}

export function validateDirectorPlan(value) {
  if (!exactKeys(value, topKeys) || value.schemaVersion !== DIRECTOR_PLAN_VERSION || !['executable', 'planning_only'].includes(value.status)) throw new Error('导演方案格式无效。')
  const result = structuredClone(value)
  result.goal = safeText(result.goal, 2000)
  if (!Array.isArray(result.requirements) || !result.requirements.length || result.requirements.length > 20) throw new Error('导演需求无效。')
  result.requirements = result.requirements.map((item) => safeText(item, 2000))
  if (result.reference !== null) {
    if (!exactKeys(result.reference, ['summary', 'evidence']) || !Array.isArray(result.reference.evidence) || result.reference.evidence.length > 20) throw new Error('参考证据无效。')
    result.reference.summary = safeText(result.reference.summary, 1000)
    result.reference.evidence = result.reference.evidence.map((item) => {
      if (!exactKeys(item, ['source', 'text']) || !sources.has(item.source)) throw new Error('参考证据来源无效。')
      return { source: item.source, text: safeText(item.text, 1000) }
    })
  }
  if (!exactKeys(result.canvas, ['width', 'height', 'fps', 'duration']) || ![result.canvas.width, result.canvas.height].every((n) => Number.isSafeInteger(n) && n >= 64 && n <= 1280 && n % 2 === 0) || result.canvas.fps !== 30 || !Number.isFinite(result.canvas.duration) || result.canvas.duration < 0.5 || result.canvas.duration > 30) throw new Error('导演画布无效。')
  if (!Array.isArray(result.shots) || result.shots.length > 30) throw new Error('导演镜头无效。')
  let cursor = 0
  result.shots = result.shots.map((shot, index) => {
    if (!exactKeys(shot, ['id', 'start', 'end', 'task', 'visual', 'text', 'action', 'source']) || shot.id !== `shot-${index + 1}` || !sources.has(shot.source) || !Number.isFinite(shot.start) || !Number.isFinite(shot.end) || Math.abs(shot.start - cursor) > 1e-6 || shot.end <= shot.start || shot.end > result.canvas.duration + 1e-6) throw new Error('导演镜头时间轴无效。')
    cursor = shot.end
    return { ...shot, task: safeText(shot.task, 200), visual: safeText(shot.visual, 500), text: safeText(shot.text, 200, true), action: safeText(shot.action, 300), source: shot.source }
  })
  if (result.shots.length && Math.abs(cursor - result.canvas.duration) > 1e-6) throw new Error('导演镜头没有连续覆盖总时长。')
  if (!Array.isArray(result.assets) || result.assets.length > 20) throw new Error('导演素材无效。')
  result.assets = result.assets.map((asset) => {
    if (!exactKeys(asset, ['id', 'type', 'description', 'rights', 'source']) || !sources.has(asset.source)) throw new Error('导演素材格式无效。')
    return { ...asset, id: safeText(asset.id, 80), type: safeText(asset.type, 80), description: safeText(asset.description, 500), rights: safeText(asset.rights, 300), source: asset.source }
  })
  if (!exactKeys(result.route, ['kind', 'templateId']) || !['hypit-template', 'model-required'].includes(result.route.kind) || !['text-cards', 'cleanup-icon', null].includes(result.route.templateId)) throw new Error('导演生产路径无效。')
  if (result.route.kind === 'hypit-template' && !['text-cards', 'cleanup-icon'].includes(result.route.templateId)) throw new Error('本地模板不存在。')
  if (result.route.kind === 'model-required' && result.status === 'executable') throw new Error('复杂模型方案不能标记为本地可执行。')
  if (!exactKeys(result.audio, ['mode', 'source']) || !['mute', 'original', 'voice'].includes(result.audio.mode)) throw new Error('导演声音方案无效。')
  result.audio.source = safeText(result.audio.source, 100)
  result.prompt = safeText(result.prompt, 6000)
  if (!Array.isArray(result.questions) || result.questions.length > 3 || !Array.isArray(result.blockers) || result.blockers.length > 20) throw new Error('导演问题或阻塞无效。')
  result.questions = result.questions.map((question) => {
    if (!exactKeys(question, ['field', 'text'])) throw new Error('导演问题无效。')
    return { field: safeText(question.field, 80), text: safeText(question.text, 500) }
  })
  result.blockers = result.blockers.map((item) => safeText(item, 500))
  if (result.status === 'executable' && (result.questions.length || result.blockers.length || !result.shots.length)) throw new Error('可执行方案仍有未解决项目。')
  return result
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const even = (value) => clamp(Math.round(Number(value) / 2) * 2, 64, 1280)
const plain = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function canvasFromFormat(format = '', fallbackDuration) {
  const text = plain(format, 200)
  let width = 720, height = 1280
  const pair = text.match(/(\d{2,4})\s*[:：x×]\s*(\d{2,4})/)
  if (pair) { width = even(pair[1]); height = even(pair[2]) }
  else if (text.includes('16:9') || text.includes('横屏')) { width = 1280; height = 720 }
  else if (text.includes('9:16') || text.includes('竖屏')) { width = 720; height = 1280 }
  else if (text.includes('1:1')) { width = 720; height = 720 }
  const duration = clamp(Number((text.match(/(\d{1,2})\s*秒/) || [])[1] || fallbackDuration || 4), 0.5, 30)
  return { width, height, fps: 30, duration }
}

function shotsFromPlan(rawShots, duration) {
  if (!Array.isArray(rawShots) || !rawShots.length) return []
  const list = rawShots.slice(0, 30).map((raw) => {
    const time = plain(raw?.time, 40)
    const match = time.match(/(\d{1,2}):(\d{2})\s*[-–—~]\s*(\d{1,2}):(\d{2})/)
    const text = plain(raw?.shot, 200)
    const visual = plain([raw?.motion, raw?.overlay].filter(Boolean).join('；'), 500) || '复杂镜头画面'
    return { time, match, text, visual, action: plain(raw?.motion, 300), overlay: plain(raw?.overlay, 200) }
  }).filter((item) => item.text || item.match)
  if (!list.length) return []
  const total = list.length
  return list.map((item, index) => {
    let start = index * duration / total, end = (index + 1) * duration / total
    if (item.match) {
      const s = Number(item.match[1]) * 60 + Number(item.match[2])
      const e = Number(item.match[3]) * 60 + Number(item.match[4])
      if (Number.isFinite(s) && Number.isFinite(e) && e > s && e <= duration + 1e-6) { start = Math.max(0, s); end = e }
    }
    if (end <= start) end = start + 0.5
    return { id: `shot-${index + 1}`, start, end, task: item.text, visual: item.visual, text: item.overlay, action: item.action, source: 'model' }
  })
}

export function coerceDirectorPlan({ plan, requirements = [], canvas = { width: 720, height: 1280, fps: 30, duration: 4 } } = {}) {
  const rawItems = (Array.isArray(requirements) ? requirements : []).map((item) => plain(item, 2000)).filter(Boolean)
  const raw = plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : {}
  const goal = plain(raw.title, 2000) || rawItems.at(-1) || '未命名视频目标'
  const items = rawItems.length ? rawItems : [goal]
  const resolvedCanvas = canvasFromFormat(raw.format, canvas.duration)
  const shots = shotsFromPlan(raw.shots, resolvedCanvas.duration)
  const style = plain(raw.style, 500)
  const deliverables = Array.isArray(raw.deliverables) ? raw.deliverables.map((item) => plain(item, 300)).filter(Boolean) : []
  const prompt = [
    `目标：${plain(raw.format, 500) || goal}`,
    `画布：${resolvedCanvas.width}×${resolvedCanvas.height}，30fps，${resolvedCanvas.duration}秒`,
    '生产路径：model-required（复杂真人/实拍/产品镜头由视频生成大模型出片）',
    ...(style ? [`风格：${style}`] : []),
    ...shots.map((shot) => `${shot.start.toFixed(2)}-${shot.end.toFixed(2)}秒｜${shot.visual}｜${shot.task}`),
    ...(deliverables.length ? [`交付物：${deliverables.join('；')}`] : []),
  ].join('\n').slice(0, 6000)
  const candidate = {
    schemaVersion: DIRECTOR_PLAN_VERSION,
    status: 'planning_only',
    goal,
    requirements: items,
    reference: null,
    canvas: resolvedCanvas,
    shots,
    assets: [],
    route: { kind: 'model-required', templateId: null },
    audio: { mode: 'mute', source: 'none' },
    prompt,
    questions: [],
    blockers: ['复杂真人/实拍镜头：本地 Hypit 只做图形文字卡；方案确认后由视频生成大模型（MiniMax H3）出片。'],
  }
  try {
    return validateDirectorPlan(candidate)
  } catch {
    const fallback = { ...candidate, shots: [], prompt: goal.slice(0, 6000) }
    return validateDirectorPlan(fallback)
  }
}

export function buildDirectorPlan({ requirements, reference = null, canvas, template, questions = [], blockers = [] }) {
  const value = validateTemplate(template)
  const items = Array.isArray(requirements) ? requirements.map((item) => String(item).trim()).filter(Boolean) : []
  if (!items.length) throw new Error('请先填写视频目标。')
  const copy = [['title', '开场信息'], ['benefit', '核心信息'], ['action', '行动信息']].filter(([field]) => value[field])
  const unresolved = [...new Set((blockers || []).map((item) => String(item).trim()).filter(Boolean))]
  if (!copy.length && !unresolved.length) unresolved.push('至少需要一段明确的成片文案。')
  const executable = copy.length > 0 && !questions.length && !unresolved.length && ['text-cards', 'cleanup-icon'].includes(value.templateId)
  const duration = value.duration
  const shots = copy.map(([field, task], index) => ({
    id: `shot-${index + 1}`,
    start: index * duration / copy.length,
    end: (index + 1) * duration / copy.length,
    task,
    visual: value.templateId === 'cleanup-icon' ? '纯色背景、清理图标与双环图形' : '纯色背景与通用文字卡片',
    text: value[field],
    action: value.opening === 'staged' ? '按镜头顺序出现' : `使用 ${value.textMotion} 文字动效`,
    source: 'user',
  }))
  const route = executable ? { kind: 'hypit-template', templateId: value.templateId } : { kind: 'model-required', templateId: null }
  const prompt = [`目标：${copy.length ? '制作可发布的图形短视频' : '继续完善视频制作方案'}`, `画布：${canvas.width}×${canvas.height}，30fps，${duration}秒`, `生产路径：${route.kind}${route.templateId ? `/${route.templateId}` : ''}`, ...shots.map((shot) => `${shot.start.toFixed(2)}-${shot.end.toFixed(2)}秒｜${shot.visual}｜文字：${shot.text}｜动作：${shot.action}`), `声音：${value.audioMode}`].join('\n')
  return validateDirectorPlan({
    schemaVersion: DIRECTOR_PLAN_VERSION,
    status: executable ? 'executable' : 'planning_only',
    goal: items.at(-1),
    requirements: items,
    reference,
    canvas: { width: canvas.width, height: canvas.height, fps: 30, duration },
    shots,
    assets: [],
    route,
    audio: { mode: value.audioMode, source: value.audioMode === 'original' ? 'reference' : value.audioMode === 'voice' ? 'personal-f5' : 'none' },
    prompt,
    questions: structuredClone(questions),
    blockers: unresolved,
  })
}
