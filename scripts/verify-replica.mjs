import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { HYPIT_PROJECT, checkReplicaTools, renderReplica, runTool } from '../server/replica-render.js'
import { validateReplicaOptions } from '../src/replica.js'
import { DEFAULT_TEMPLATE } from '../src/replica-template.js'
import { analyzeReplica } from '../server/replica-analysis.js'

// Generated test material only; never select a portfolio or another project's video.
const directory = path.join(HYPIT_PROJECT, 'jobs', randomUUID())
await mkdir(directory, { recursive: true })
console.log(await checkReplicaTools())
await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=360x640:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(directory, 'input.mp4')])
const keepAudio = process.env.REPLICA_VERIFY_MUTE !== '1'
const job = { id: path.basename(directory), filename: 'generated-test.mp4', options: validateReplicaOptions({ opening: process.env.REPLICA_VERIFY_MODE || 'fast', highlightStart: 1.5, style: 'blue', title: '开场节奏测试', captions: '保留原片画面\n本地字幕与视觉包装', keepAudio }) }
if (process.env.REPLICA_VERIFY_KIND === 'template') {
  const analysis = await analyzeReplica(path.join(directory, 'input.mp4'), directory)
  Object.assign(job, { kind: 'template', source: analysis.metadata, template: { ...DEFAULT_TEMPLATE, background: '#22c55e', titleColor: '#eab308', title: '手机经常卡顿？', benefit: '先检查多余文件', action: '确认后再清理', textMotion: 'bounce', duration: 4, audioMode: keepAudio ? 'original' : 'mute' } })
}
await renderReplica(job, directory, async (patch) => { Object.assign(job, patch); console.log(patch.status, patch.progress, patch.message); await writeFile(path.join(directory, 'job-verification.json'), JSON.stringify(job, null, 2)) })
assert.equal(job.status, 'complete')
assert.equal(job.cost ?? job.plan.cost ?? 0, 0)
assert.equal(job.result.audio, keepAudio)
assert.ok(job.result.duration > 3 && job.result.duration <= 4.1)
assert.match(job.buildId, /^bld_/)
if (job.kind === 'template') {
  const result = path.join(directory, 'result.mp4')
  const sample = (at, filter) => runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-ss', String(at), '-i', result, '-frames:v', '1', '-vf', filter, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { encoding: null }).then((r) => r.stdout)
  const green = await sample(1, 'crop=2:2:16:16')
  assert.ok(Math.abs(green[0] - 34) < 12 && Math.abs(green[1] - 197) < 12 && Math.abs(green[2] - 94) < 12, `wrong encoded background: ${[...green.subarray(0, 3)]}`)
  assert.notDeepEqual(await sample(0.2, 'scale=180:320'), await sample(1.2, 'scale=180:320'))
  for (const at of [0, 0.3, 1.2]) await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-ss', String(at), '-i', result, '-frames:v', '1', path.join(directory, `review-${at}.png`)])
}
console.log(JSON.stringify({ directory, buildId: job.buildId, result: job.result }, null, 2))
