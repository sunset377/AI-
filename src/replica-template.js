export const DEFAULT_TEMPLATE = Object.freeze({ background: '#70adeb', title: '', benefit: '', action: '', titleColor: '#ffffff', benefitColor: '#eab308', actionColor: '#ffffff', textMotion: 'fade', ringMotion: 'rotate', opening: 'simultaneous', duration: 4, audioMode: 'mute', narration: '' })
const colors = { 红: '#ef4444', 绿: '#22c55e', 蓝: '#3b82f6', 黄: '#eab308', 白: '#ffffff', 黑: '#000000', 紫: '#a855f7', 橙: '#f97316' }
const fields = ['title', 'benefit', 'action']

export function validateTemplate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !Object.hasOwn(DEFAULT_TEMPLATE, key))) throw new Error('模板包含无效字段。')
  const result = { ...DEFAULT_TEMPLATE, ...value }
  for (const field of ['background', 'titleColor', 'benefitColor', 'actionColor']) {
    if (typeof result[field] !== 'string' || !/^#[a-f0-9]{6}$/i.test(result[field])) throw new Error('颜色必须是六位十六进制值。')
    result[field] = result[field].toLowerCase()
  }
  for (const field of [...fields, 'narration']) {
    if (typeof result[field] !== 'string' || [...result[field]].length > (field === 'narration' ? 300 : 40) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result[field])) throw new Error('文案超长或包含无效字符。')
    result[field] = result[field].trim()
  }
  for (const [field, allowed] of Object.entries({ textMotion: ['none', 'fade', 'bounce'], ringMotion: ['none', 'rotate'], opening: ['simultaneous', 'staged'], audioMode: ['original', 'mute', 'voice'] })) if (!allowed.includes(result[field])) throw new Error('模板选项无效。')
  if (typeof result.duration !== 'number' || !Number.isFinite(result.duration) || result.duration < 0.5 || result.duration > 30) throw new Error('模板时长必须在 0.5～30 秒之间。')
  return result
}

export function planTemplate(value, { width, height, sourceDuration, voiceCues } = {}) {
  const template = validateTemplate(value)
  if (![width, height].every((n) => Number.isFinite(n) && n >= 64 && n <= 4096) || !Number.isFinite(sourceDuration) || sourceDuration < 0.5 || sourceDuration > 15.05) throw new Error('参考视频尺寸或时长无效。')
  let duration = template.duration
  let events = fields.map((field, index) => ({ field, start: template.opening === 'staged' ? index * duration / 3 : 0, end: duration }))
  if (template.audioMode === 'voice') {
    if (!Array.isArray(voiceCues) || !voiceCues.length || voiceCues.length > 30) throw new Error('请先生成并认可旁白试听。')
    let end = 0
    for (const cue of voiceCues) {
      if (!fields.includes(cue.field) || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < end || cue.end <= cue.start || cue.end > 30) throw new Error('旁白时间轴无效或超过 30 秒，请精简文案。')
      end = cue.end
    }
    duration = end
    events = voiceCues.map((cue) => ({ ...cue }))
    // Unspoken copy stays visible; only narrated fields follow speech cues.
    for (const field of fields) if (template[field] && !voiceCues.some((cue) => cue.field === field)) events.push({ field, start: 0, end: duration })
  }
  const scale = Math.min(1, 1280 / Math.max(width, height))
  return { kind: 'template', width: Math.floor(width * scale / 2) * 2, height: Math.floor(height * scale / 2) * 2, duration, fps: 30, events, audioMode: template.audioMode }
}

export function guideTemplate(message, value, { pendingQuestion } = {}) {
  validateTemplate(value)
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new Error('修改需求请输入 1～2000 字。')
  const patch = {}, questions = [], unhandled = []
  for (const raw of message.split(/[，,。；;\n]+/).map((part) => part.trim()).filter(Boolean)) {
    const color = raw.match(/#[a-f0-9]{6}/i)?.[0].toLowerCase() ?? colors[raw.match(/([红绿蓝黄白黑紫橙])(?:色)?/)?.[1]]
    const targets = /全部|所有/.test(raw) ? fields : /标题|开头/.test(raw) ? ['title'] : /利益|卖点/.test(raw) ? ['benefit'] : /行动|底部/.test(raw) ? ['action'] : []
    if (pendingQuestion?.field === 'textColor' && targets.length && /^#[a-f0-9]{6}$/i.test(pendingQuestion.color)) { for (const field of targets) patch[`${field}Color`] = color || pendingQuestion.color; continue }
    if (/背景|底色/.test(raw) && color) { patch.background = color; continue }
    if (/字|标题|利益|卖点|行动|底部/.test(raw) && color) {
      if (targets.length) for (const field of targets) patch[`${field}Color`] = color
      else questions.push({ field: 'textColor', color, text: `文字改为 ${color}：标题、利益点、行动文案，还是全部文字？` })
      continue
    }
    if (/弹跳|淡入/.test(raw)) { patch.textMotion = /弹跳/.test(raw) ? 'bounce' : 'fade'; continue }
    if (/旋转/.test(raw) && /环|光/.test(raw)) { patch.ringMotion = 'rotate'; continue }
    if (/关闭|不要|取消/.test(raw) && /动效|动画/.test(raw)) { patch.textMotion = 'none'; patch.ringMotion = 'none'; continue }
    if (/静音|不要原声/.test(raw)) { patch.audioMode = 'mute'; continue }
    if (/逐段|依次/.test(raw)) { patch.opening = 'staged'; continue }
    if (/同时/.test(raw)) { patch.opening = 'simultaneous'; continue }
    unhandled.push(raw)
  }
  validateTemplate({ ...value, ...patch })
  return { patch, questions, unhandled }
}
