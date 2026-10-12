import assert from 'node:assert/strict'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { HYPIT_PROJECT, checkReplicaTools, createAss, renderReplica, runTool } from '../server/replica-render.js'
import { validateReplicaOptions } from '../src/replica.js'
import { DEFAULT_TEMPLATE } from '../src/replica-template.js'
import { analyzeReplica } from '../server/replica-analysis.js'

// Generated test material only; never select a portfolio or another project's video.
const directory = path.join(HYPIT_PROJECT, 'jobs', randomUUID())
await mkdir(directory, { recursive: true })
console.log(await checkReplicaTools())
const isTemplate = process.env.REPLICA_VERIFY_KIND === 'template'
const withReference = !isTemplate || process.env.REPLICA_VERIFY_REFERENCE !== '0'
const templateId = process.env.REPLICA_VERIFY_TEMPLATE || 'cleanup-icon'
const wide = process.env.REPLICA_VERIFY_ASPECT === 'wide' || process.env.REPLICA_VERIFY_ROTATE === '1'
const width = wide ? 640 : 360, height = wide ? 360 : 640
const rotate = process.env.REPLICA_VERIFY_ROTATE === '1'
if (withReference) {
  await writeFile(path.join(directory, 'fixture.ass'), createAss(width, height, { outputDuration: 4, captions: [{ text: '免费清理｜测试参考', start: 0, end: 4 }] }, { title: '手机经常卡顿？', style: 'clean' }))
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `${isTemplate ? 'color=c=0x70adeb:s' : 'testsrc2=size'}=${width}x${height}:rate=30:duration=4`, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4', ...(isTemplate ? ['-vf', 'subtitles=fixture.ass'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(directory, rotate ? 'unrotated.mp4' : 'input.mp4')], { cwd: directory })
  if (rotate) await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-display_rotation:v:0', '90', '-i', path.join(directory, 'unrotated.mp4'), '-c', 'copy', path.join(directory, 'input.mp4')])
}
const keepAudio = withReference && process.env.REPLICA_VERIFY_MUTE !== '1'
const job = { id: path.basename(directory), filename: 'generated-test.mp4', options: validateReplicaOptions({ opening: process.env.REPLICA_VERIFY_MODE || 'fast', highlightStart: 1.5, style: 'blue', title: '开场节奏测试', captions: '保留原片画面\n本地字幕与视觉包装', keepAudio }) }
if (isTemplate) {
  const analysis = withReference ? await analyzeReplica(path.join(directory, 'input.mp4'), directory) : null
  if (analysis) {
    assert.equal(analysis.background.stable, true)
    assert.equal(analysis.metadata.width, rotate ? height : width); assert.equal(analysis.metadata.height, rotate ? width : height)
  }
  const canvas = analysis ? { width: analysis.metadata.width, height: analysis.metadata.height, fps: 30 } : { width, height, fps: 30 }
  Object.assign(job, { kind: 'template', canvas, reference: analysis ? { filename: 'generated-test.mp4', metadata: analysis.metadata } : null, template: { ...DEFAULT_TEMPLATE, templateId, background: '#22c55e', titleColor: '#eab308', title: process.env.REPLICA_VERIFY_LONG === '1' ? '这是用于检查最长中文文案没有越界或者与其他文字相互重叠的四十个汉字模板验收测试。' : '手机经常卡顿？', benefit: '先检查多余文件', action: '确认后再清理', textMotion: 'bounce', duration: 4, audioMode: keepAudio ? 'original' : 'mute' } })
}
await renderReplica(job, directory, async (patch) => { Object.assign(job, patch); console.log(patch.status, patch.progress, patch.message); await writeFile(path.join(directory, 'job-verification.json'), JSON.stringify(job, null, 2)) })
assert.equal(job.status, 'complete')
assert.equal(job.cost ?? job.plan.cost ?? 0, 0)
assert.equal(job.result.audio, keepAudio)
assert.ok(job.result.duration > 3 && job.result.duration <= 4.1)
assert.match(job.buildId, /^bld_/)
if (job.kind === 'template') {
  assert.equal(await access(path.join(directory, 'input.mp4')).then(() => true, () => false), withReference)
  const result = path.join(directory, 'result.mp4')
  const sample = (at, filter) => runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-ss', String(at), '-i', result, '-frames:v', '1', '-vf', filter, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { encoding: null }).then((r) => r.stdout)
  const green = await sample(1, 'crop=2:2:16:16')
  assert.ok(Math.abs(green[0] - 34) < 12 && Math.abs(green[1] - 197) < 12 && Math.abs(green[2] - 94) < 12, `wrong encoded background: ${[...green.subarray(0, 3)]}`)
  assert.notDeepEqual(await sample(0.2, 'scale=180:320'), await sample(1.2, 'scale=180:320'))
  const pixels = await sample(1.2, `crop=${job.result.width}:${Math.floor(job.result.height * 0.24 / 2) * 2}:0:0`)
  let yellow = 0
  for (let i = 0; i < pixels.length; i += 3) if (Math.abs(pixels[i] - 234) < 35 && Math.abs(pixels[i + 1] - 179) < 35 && Math.abs(pixels[i + 2] - 8) < 35) yellow++
  assert.ok(yellow > 30, `missing encoded yellow title pixels: ${yellow}`)
  for (const at of [0, 0.3, 1.2]) await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-ss', String(at), '-i', result, '-frames:v', '1', path.join(directory, `review-${at}.png`)])
}
const sha256 = createHash('sha256').update(await readFile(path.join(directory, 'result.mp4'))).digest('hex')
const review = JSON.parse(await readFile(path.join(directory, 'review.json'), 'utf8'))
assert.equal(review.decoded, true); assert.equal(review.buildId, job.buildId)
await writeFile(path.join(directory, 'verification.json'), JSON.stringify({ buildId: job.buildId, sha256, result: job.result, template: job.template, reference: job.reference, mode: job.options.opening, samples: job.kind === 'template' ? [0, 0.3, 1.2] : [], rotated: rotate, decoded: review.decoded }, null, 2))
console.log(JSON.stringify({ directory, buildId: job.buildId, result: job.result }, null, 2))
