import test from 'node:test'
import assert from 'node:assert/strict'

import { validateTemplate, planTemplate, guideTemplate } from '../src/replica-template.js'
const valid = { background: '#70ADEB', title: '手机卡顿？', benefit: '清理多余文件', action: '先检查再清理', titleColor: '#ffffff', benefitColor: '#ffcc00', actionColor: '#ffffff', textMotion: 'none', ringMotion: 'rotate', opening: 'simultaneous', duration: 4, audioMode: 'mute', narration: '' }

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

test('template editor exposes separate requirements, bounded copy and confirm-before-render controls', async () => {
  const { createServer } = await import('vite')
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const vite = await createServer({ appType: 'custom', cacheDir: '.codex-run/replica-tests/template-cache', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: TemplateEditor } = await vite.ssrLoadModule('/src/components/ReplicaWorkbench/TemplateEditor.jsx')
    const html = renderToStaticMarkup(React.createElement(TemplateEditor, { health: { ready: false }, requestApi: async () => {}, mediaUrl: (url) => url, onJob: () => {} }))
    assert.match(html, /修改需求/); assert.match(html, /开场钩子文案/); assert.match(html, /利益点文案/)
    assert.match(html, /本地向导/); assert.doesNotMatch(html, /value="api"/)
    assert.match(html, /disabled=""[^>]*>分析原片/)
    assert.match(html, /disabled=""[^>]*>制作模板成片/)
    assert.match(html, /没有 OCR\/ASR/); assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /已识别语音|type="password"/)
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
