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
