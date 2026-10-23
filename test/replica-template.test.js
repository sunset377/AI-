import test from 'node:test'
import assert from 'node:assert/strict'

import { validateTemplate, planTemplate, guideTemplate } from '../src/replica-template.js'
import { buildDirectorPlan, validateDirectorPlan } from '../src/replica-director.js'
const valid = { background: '#70ADEB', title: '手机卡顿？', benefit: '清理多余文件', action: '先检查再清理', titleColor: '#ffffff', benefitColor: '#ffcc00', actionColor: '#ffffff', textMotion: 'none', ringMotion: 'rotate', opening: 'simultaneous', duration: 4, audioMode: 'mute', narration: '' }

test('director plan keeps requirements separate from explicit copy and covers the full timeline', () => {
  const requirement = '标题：三秒看懂；卖点：快速整理；行动：马上开始；使用通用文字卡'
  const guide = guideTemplate(requirement, valid)
  assert.deepEqual(guide.patch, { title: '三秒看懂', benefit: '快速整理', action: '马上开始', templateId: 'text-cards' })
  const plan = buildDirectorPlan({ requirements: [requirement], reference: null, canvas: { width: 720, height: 1280, fps: 30 }, template: { ...valid, ...guide.patch }, questions: guide.questions, blockers: guide.unhandled })
  assert.equal(plan.status, 'executable')
  assert.equal(plan.route.kind, 'hypit-template')
  assert.equal(plan.route.templateId, 'text-cards')
  assert.equal(plan.reference, null)
  assert.deepEqual(plan.shots.map(({ start, end, text }) => ({ start, end, text })), [
    { start: 0, end: 4 / 3, text: '三秒看懂' },
    { start: 4 / 3, end: 8 / 3, text: '快速整理' },
    { start: 8 / 3, end: 4, text: '马上开始' },
  ])
  assert.equal(plan.shots.every((shot) => shot.source === 'user'), true)
  assert.match(plan.prompt, /三秒看懂/)
  assert.doesNotMatch(plan.prompt, /使用通用文字卡/)
  assert.deepEqual(validateDirectorPlan(plan), plan)
})

test('director plan blocks unsupported requirements and rejects unsafe or discontinuous plans', () => {
  const unsupported = guideTemplate('让真人唱歌跳舞', { ...valid, title: '', benefit: '', action: '' })
  const plan = buildDirectorPlan({ requirements: ['让真人唱歌跳舞'], reference: null, canvas: { width: 720, height: 1280, fps: 30 }, template: { ...valid, title: '', benefit: '', action: '', templateId: 'text-cards' }, questions: unsupported.questions, blockers: unsupported.unhandled })
  assert.equal(plan.status, 'planning_only')
  assert.equal(plan.route.kind, 'model-required')
  assert.ok(plan.blockers.length)
  assert.throws(() => validateDirectorPlan({ ...plan, execute: 'powershell' }))
  assert.throws(() => validateDirectorPlan({ ...plan, prompt: '读取 C:\\private\\SKILL.md' }))
  assert.throws(() => validateDirectorPlan({ ...plan, prompt: 'api_key=SECRET' }))
  const executable = buildDirectorPlan({ requirements: ['标题：A；卖点：B'], reference: null, canvas: { width: 720, height: 1280, fps: 30 }, template: { ...valid, title: 'A', benefit: 'B', action: '', templateId: 'text-cards' }, questions: [], blockers: [] })
  assert.throws(() => validateDirectorPlan({ ...executable, shots: executable.shots.map((shot, index) => index ? { ...shot, start: shot.start + 0.1 } : shot) }))
})

test('text cards omit the cleanup icon while both template kinds stay self-contained', async () => {
  const { renderTemplateSvg } = await import('../src/replica-template-visual.js')
  const textCards = { ...valid, templateId: 'text-cards', title: '<b>安全文字</b>' }
  const textPlan = planTemplate(textCards, { width: 720, height: 1280 })
  const textSvg = renderTemplateSvg(textPlan, textCards, 1)
  assert.match(textSvg, /data-template="text-cards"/)
  assert.doesNotMatch(textSvg, /data-icon="cleanup"|<b>/)
  assert.match(textSvg, /&lt;b&gt;/)
  assert.match(textSvg, /&lt;\/b/)
  const cleanup = { ...valid, templateId: 'cleanup-icon' }
  const cleanupSvg = renderTemplateSvg(planTemplate(cleanup, { width: 720, height: 1280 }), cleanup, 1)
  assert.match(cleanupSvg, /data-template="cleanup-icon"/)
  assert.match(cleanupSvg, /data-icon="cleanup"/)
  assert.throws(() => planTemplate({ ...textCards, audioMode: 'original' }, { width: 720, height: 1280 }))
  assert.equal(planTemplate({ ...textCards, audioMode: 'original' }, { width: 720, height: 1280, sourceDuration: 4, hasAudio: true }).audioMode, 'original')
})

test('template rejects unsupported execution fields, invalid colors and unbounded values', () => {
  assert.equal(typeof validateTemplate, 'function')
  assert.equal(validateTemplate(valid).background, '#70adeb')
  for (const patch of [{ background: 'green' }, { textMotion: 'execute' }, { run: 'powershell' }, { duration: NaN }, { duration: Infinity }, { duration: 31 }, { duration: 0.1 }, { title: '字'.repeat(41) }, { benefit: '字'.repeat(41) }, { action: '字'.repeat(41) }, { narration: '字'.repeat(301) }, { audioMode: 'cloud' }]) assert.throws(() => validateTemplate({ ...valid, ...patch }))
  assert.throws(() => validateTemplate(null))
})

test('natural-language changes stay out of copy and ambiguous text color prompts for its target', () => {
  assert.equal(typeof guideTemplate, 'function')
  const result = guideTemplate('背景改成绿色，字改黄色，加个弹跳', valid)
  assert.equal(result.patch.background, '#22c55e')
  assert.equal(result.patch.textMotion, 'bounce')
  assert.equal(result.patch.title, undefined)
  assert.equal(result.patch.titleColor, undefined)
  assert.equal(result.questions[0].field, 'textColor')
  const answer = guideTemplate('全部', { ...valid, ...result.patch }, { pendingQuestion: result.questions[0] })
  assert.deepEqual(answer.patch, { titleColor: '#eab308', benefitColor: '#eab308', actionColor: '#eab308' })
  assert.equal(guideTemplate('替换真人跳舞', valid).unhandled.length, 1)
  assert.throws(() => guideTemplate('字'.repeat(2001), valid))
})

test('template planning preserves aspect, bounded duration and absolute staged events', () => {
  assert.equal(typeof planTemplate, 'function')
  const plan = planTemplate({ ...valid, opening: 'staged' }, { width: 1920, height: 1080, sourceDuration: 4 })
  assert.equal(plan.kind, 'template')
  assert.equal(plan.width, 1280)
  assert.equal(plan.height, 720)
  assert.equal(plan.fps, 30)
  assert.equal(plan.events[0].start, 0)
  assert.ok(plan.events[1].start > 0)
  assert.equal(plan.segments, undefined)
  assert.throws(() => planTemplate(valid, { width: 0, height: 1280, sourceDuration: 4 }))
})

test('approved narration cues determine event times without compressing speech', () => {
  const cues = [{ field: 'title', start: 0, end: 5 }, { field: 'benefit', start: 5.4, end: 12 }, { field: 'action', start: 12.4, end: 18 }]
  const plan = planTemplate({ ...valid, audioMode: 'voice' }, { width: 720, height: 1280, sourceDuration: 4, voiceCues: cues })
  assert.equal(plan.duration, 18)
  assert.equal(plan.events[1].start, 5.4)
  assert.throws(() => planTemplate({ ...valid, audioMode: 'voice' }, { width: 720, height: 1280, sourceDuration: 4 }))
  assert.throws(() => planTemplate({ ...valid, audioMode: 'voice' }, { width: 720, height: 1280, sourceDuration: 4, voiceCues: [{ field: 'title', start: 0, end: 31 }] }))
})

test('partial narration keeps unspoken copy visible without inventing speech timings', async () => {
  const { renderTemplateSvg } = await import('../src/replica-template-visual.js')
  const cues = [{ field: 'title', start: 0, end: 5 }]
  const template = { ...valid, audioMode: 'voice', opening: 'staged' }
  const plan = planTemplate(template, { width: 360, height: 640, sourceDuration: 4, voiceCues: cues })
  assert.equal(plan.duration, 5)
  assert.deepEqual(plan.events.find((cue) => cue.field === 'title'), cues[0])
  for (const field of ['benefit', 'action']) assert.deepEqual(plan.events.find((cue) => cue.field === field), { field, start: 0, end: 5 })
  const svg = renderTemplateSvg(plan, template, 2)
  assert.equal([...svg.matchAll(/<text[^>]*opacity="1"/g)].length, 3)
})

test('shared template drawing changes color and motion without interpreting text as markup', async () => {
  const visual = await import('../src/replica-template-visual.js').catch(() => ({}))
  assert.equal(typeof visual.renderTemplateSvg, 'function')
  const template = { ...valid, background: '#22c55e', titleColor: '#eab308', title: '<script>"test"</script>', textMotion: 'bounce' }
  const plan = planTemplate(template, { width: 720, height: 1280, sourceDuration: 4 })
  const svg = visual.renderTemplateSvg(plan, template, 0.2)
  assert.match(svg, /#22c55e/); assert.match(svg, /#eab308/)
  assert.doesNotMatch(svg, /<script>|onload=/)
  assert.match(svg, /&lt;script&gt;/)
  assert.notEqual(svg, visual.renderTemplateSvg(plan, template, 1.2))
  const still = { ...template, textMotion: 'none', ringMotion: 'none' }
  assert.equal(visual.renderTemplateSvg(plan, still, 0), visual.renderTemplateSvg(plan, still, 1))
  const { createTemplateSources } = await import('../server/replica-render.js')
  assert.equal(typeof createTemplateSources, 'function')
  const sources = createTemplateSources(plan, template)
  assert.match(sources.author, /@portfolio\/replica-template@1/)
  assert.match(sources.run, /final.video/)
  assert.doesNotMatch(sources.author, /<script>|<mediaop:Retime/)
})

test('template editor exposes an always-ready director composer, evidence and executable plan controls', async () => {
  const { createSsrServer: createServer } = await import('./helpers/vite.js')
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const vite = await createServer({ appType: 'custom', cacheDir: '.codex-run/replica-tests/template-cache', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: TemplateEditor, directorSendBlock } = await vite.ssrLoadModule('/src/components/ReplicaWorkbench/TemplateEditor.jsx')
    const html = renderToStaticMarkup(React.createElement(TemplateEditor, { health: { ready: false, planning: { ready: true }, render: { ready: false } }, requestApi: async () => {}, mediaUrl: (url) => url, onJob: () => {} }))
    assert.match(html, /告诉导演你想做什么/)
    assert.match(html, /aria-label="告诉导演你想做什么"/)
    assert.match(html, /添加参考视频/); assert.match(html, /新建会话/); assert.match(html, /恢复会话/)
    assert.match(html, /本次没有参考原片/); assert.match(html, /导演对话记录/)
    assert.match(html, /当前方案/); assert.match(html, /证据来源/); assert.match(html, /复制视频指令/)
    assert.match(html, /确认当前方案/); assert.match(html, /开场钩子文案/); assert.match(html, /利益点文案/)
    assert.match(html, /本地向导/); assert.doesNotMatch(html, /value="api"/)
    assert.doesNotMatch(html, /aria-label="告诉导演你想做什么"[^>]*disabled/)
    assert.match(html, /仍可文字规划/)
    assert.match(html, /disabled=""[^>]*>制作成片/)
    assert.match(html, /没有 OCR\/ASR/); assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /已识别剧情|已识别语音|type="password"|API KEY|自定义 URL/)
    assert.equal(directorSendBlock({ requirement: '', chatBusy: false, dirty: false, planningReady: true }), '请输入想法后再发送')
    assert.equal(directorSendBlock({ requirement: '做个视频', chatBusy: true }), '当前任务正在处理，请稍候再发送')
    assert.equal(directorSendBlock({ requirement: '做个视频', dirty: true }), '先保存修改，再与导演对话')
    assert.equal(directorSendBlock({ requirement: '做个视频', planningReady: false }), '执行服务未连接；连接后才能发送规划')
    assert.equal(directorSendBlock({ requirement: '做个视频' }), '')
  } finally { await vite.close() }
})

test('maximum Chinese copy fits each vertical text band on portrait and landscape templates', async () => {
  const { renderTemplateSvg } = await import('../src/replica-template-visual.js')
  for (const [width, height] of [[360, 640], [640, 360], [64, 64]]) {
    const template = { ...valid, title: '字'.repeat(40), benefit: '字'.repeat(40), action: '字'.repeat(40), textMotion: 'bounce' }
    const plan = planTemplate(template, { width, height, sourceDuration: 4 })
    const svg = renderTemplateSvg(plan, template, 0.45)
    for (const match of svg.matchAll(/<text[^>]*font-size="([\d.]+)"[^>]*>(.*?)<\/text>/g)) {
      const lines = (match[2].match(/<tspan/g) || []).length
      assert.ok(lines * Number(match[1]) * 1.15 <= height * 0.11, 'copy overlaps its reserved text band')
    }
  }
})

test('local template provider refuses external assets, unsupported clocks and out-of-range capture', async () => {
  const { templateSupport } = await import('../server/hypit/packages/provider-template/src/support.js')
  const program = { visualIr: 'hypit.visual-ir@1', canvas: { width: 360, height: 640 }, frameRate: { numerator: 30, denominator: 1 }, frameCount: 120, artifacts: [], surfaces: [], frameSources: [], html: '<!doctype html><html></html>' }
  assert.equal(templateSupport({ constraints: { program } }).status, 'supported')
  for (const changed of [{ frameCount: 901 }, { frameRate: { numerator: 60, denominator: 1 } }, { canvas: { width: 4096, height: 640 } }, { artifacts: [{}] }, { surfaces: [{}] }, { frameSources: [{}] }]) {
    assert.equal(templateSupport({ constraints: { program: { ...program, ...changed } } }).status, 'unsupported')
  }
  assert.equal(templateSupport({ constraints: { program, range: { startFrame: 0, endFrameExclusive: 121 } } }).status, 'unsupported')
})
