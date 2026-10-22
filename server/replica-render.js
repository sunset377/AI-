import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { planReplica } from '../src/replica.js'
import { planTemplate, validateTemplate } from '../src/replica-template.js'

const execute = promisify(execFile)
export const HYPIT_PROJECT = fileURLToPath(new URL('./hypit/', import.meta.url))

function hypitLauncher() {
  const candidates = [process.env.HYPIT_CLI, path.join(process.cwd(), 'node_modules/@hypit/hypit/bin/hypit.mjs'),
    ...(process.env.PATH ?? '').split(path.delimiter).map((directory) => path.join(directory, 'node_modules/@hypit/hypit/bin/hypit.mjs'))]
  const launcher = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!launcher) throw new Error('本地执行器未找到 Hypit，请安装 Hypit 或设置 HYPIT_CLI。')
  return launcher
}

export async function runTool(program, args, options = {}) {
  const env = { ...process.env, ...options.env }
  if (process.platform === 'win32' && env.USERPROFILE) {
    for (const key of ['TEMP', 'TMP']) if (env[key]?.includes('%USERPROFILE%')) env[key] = env[key].replaceAll('%USERPROFILE%', env.USERPROFILE)
  }
  return execute(program, args, { windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024, ...options, env })
}

export async function runHypit(args, options) {
  return runTool(process.execPath, [hypitLauncher(), ...args], { cwd: HYPIT_PROJECT, ...options })
}

export async function probeVideoDuration(inputPath) {
  const result = await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', inputPath], { timeout: 15_000 })
  const seconds = Number(String(result.stdout).trim())
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export async function trimReplicaVideo(inputPath, outputPath, seconds = 30) {
  // 重编码以精确停在指定秒数；输出为独立副本，不修改原视频。
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-i', inputPath, '-t', String(seconds), '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-movflags', '+faststart', outputPath], { timeout: 120_000 })
  return outputPath
}

export async function checkReplicaTools() {
  const [hypit, ffmpeg] = await Promise.all([
    runHypit(['version', '--json'], { timeout: 15_000 }),
    runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { timeout: 10_000 }),
    runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { timeout: 10_000 }),
  ])
  return { ready: true, engine: 'Hypit', version: JSON.parse(hypit.stdout).version, media: ffmpeg.stdout.split('\n')[0], paidGeneration: false }
}

export function createHypitSources(segments, keepAudio) {
  const transforms = segments.map((segment, index) => `  <mediaop:Transform id="part${index}" source={prepared.media}>\n    <mediaop:Trim start="${segment.start}s" end="${segment.end}s"/>\n    <mediaop:Retime rate="${segment.rate}"/>\n  </mediaop:Transform>`).join('\n')
  return {
    author: `<?svml using="@hypit/markup@1"?>\n<svml>\n  <import as="media" from="@hypit/media@1"/>\n  <import as="mediaop" from="@hypit/media-operations@1"/>\n  <import as="time" from="@hypit/timeline-author@1"/>\n  <media:Video id="source" src="./input.mp4"/>\n  <time:Clock id="clock" frame-rate="30"/>\n  <mediaop:Normalize id="prepared" source={source} video="primary-moving" audio="${keepAudio ? 'default' : 'none'}" span-authority="video" clock={clock}/>\n${transforms}\n</svml>\n`,
    run: `<?svml using="@hypit/markup/run@1"?>\n<svrun version="1">\n  <author source="./production.svml"/>\n${segments.map((_, index) => `  <target output="part${index}.video"/>`).join('\n')}\n</svrun>\n`,
  }
}

const assTime = (seconds) => {
  const centiseconds = Math.round(seconds * 100)
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`
}

function safeAssText(text, width, size) {
  const maxWidth = width * 0.84 / size
  let lineWidth = 0
  let result = ''
  for (const character of text.replace(/[\x00-\x1f\x7f]/g, '').replaceAll('\\', '＼').replaceAll('{', '｛').replaceAll('}', '｝')) {
    const units = /[\u0000-\u007f]/.test(character) ? 0.55 : 1
    if (lineWidth + units > maxWidth) { result += '\\N'; lineWidth = 0 }
    result += character
    lineWidth += units
  }
  return result
}

export function createAss(width, height, plan, options) {
  const size = Math.max(16, Math.round(Math.min(width / 19, height / 14)))
  const margin = Math.round(height * 0.09)
  const background = options.style === 'blue' ? '&H70271C17' : '&H80000000'
  const accent = options.style === 'blue' ? '&H00FFD1AE' : '&H00FFFFFF'
  const rows = plan.captions.map((cue) => `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Caption,,0,0,0,,${safeAssText(cue.text, width, size)}`)
  if (options.title) rows.push(`Dialogue: 1,0:00:00.00,${assTime(Math.min(1.5, plan.outputDuration))},Title,,0,0,0,,${safeAssText(options.title, width, size * 1.15)}`)
  return `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Caption,Microsoft YaHei,${size},&H00FFFFFF,&H00FFFFFF,${background},&H90000000,-1,0,0,0,100,100,0,0,3,${Math.max(2, size * 0.18)},0,2,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${margin},1\nStyle: Title,Microsoft YaHei,${Math.round(size * 1.15)},${accent},&H00FFFFFF,&H801C1410,&H90000000,-1,0,0,0,100,100,0,0,3,${Math.max(2, size * 0.18)},0,8,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${margin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${rows.join('\n')}\n`
}

export async function renderReplica(job, directory, update) {
  if (job.kind === 'template') return renderTemplateReplica(job, directory, update)
  await Promise.all([
    writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'replica-task', private: true, type: 'module', hypit: { project: true } })),
    writeFile(path.join(directory, 'hypit.runtime.json'), await readFile(path.join(HYPIT_PROJECT, 'hypit.runtime.json'))),
  ])
  let result
  try { result = await executeReplica(job, directory, update) }
  finally {
    // Each task owns its Runtime and Results, so deletion removes all of that task's media.
    await runHypit(['runtime', 'down', '--runtime', path.join(directory, 'hypit.runtime.json'), '--json'], { cwd: directory, timeout: 20_000 }).catch(() => {})
  }
  await update(result)
}

export function createTemplateSources(plan, value) {
  const template = validateTemplate(value)
  const config = JSON.stringify({ plan, template }).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  return { author: `<?svml using="@hypit/markup@1"?>\n<svml>\n<import as="time" from="@hypit/timeline-author@1"/>\n<import as="spatial" from="@hypit/spatial@1"/>\n<import as="template" from="@portfolio/replica-template@1"/>\n<import as="film" from="@hypit/film@1"/>\n<import as="html" from="@hypit/html-video@1"/>\n<import as="style" source="./style.svs"/>\n<time:Clock id="clock" frame-rate="30"/>\n<time:Timeline id="animation" clock={clock} end="${Math.ceil(plan.duration * 30)}f"/>\n<spatial:Canvas id="canvas" width="${plan.width}" height="${plan.height}"/>\n<template:Template id="scene" timeline={animation.timeline} config="${config}"/>\n<film:Film id="main" canvas={canvas.canvas} timeline={animation.timeline} appearance={style.film.main}><film:Track source={scene.visual}/></film:Film>\n<html:Video id="final" composition={main.composition} timeline={animation.timeline}/>\n</svml>\n`, run: '<?svml using="@hypit/markup/run@1"?>\n<svrun version="1"><author source="./production.svml"/><target output="final.video"/></svrun>\n' }
}

export async function renderTemplateReplica(job, directory, update) {
  const template = validateTemplate(job.template)
  const reference = job.reference?.metadata || job.source
  const canvas = job.canvas || reference
  const plan = planTemplate(template, { width: canvas.width, height: canvas.height, sourceDuration: reference?.duration, hasAudio: Boolean(reference?.hasAudio), voiceCues: job.voicePreview?.cues })
  const sources = createTemplateSources(plan, template)
  const runtimePath = path.join(directory, 'hypit.runtime.json')
  const profile = JSON.parse(await readFile(path.join(HYPIT_PROJECT, 'hypit.runtime.json')))
  // Reuse the selected Distribution's installed SDK packages; no downloads or duplicate Core.
  const dependencyRoot = path.join(HYPIT_PROJECT, 'node_modules')
  await mkdir(dependencyRoot, { recursive: true })
  const dependencyLink = path.join(dependencyRoot, '@hypit')
  if (!existsSync(dependencyLink)) await symlink(path.join(path.dirname(hypitLauncher()), '../node_modules/@hypit'), dependencyLink, 'junction')
  const puppeteerLink = path.join(dependencyRoot, 'puppeteer-core')
  if (!existsSync(puppeteerLink)) await symlink(path.join(path.dirname(hypitLauncher()), '../node_modules/puppeteer-core'), puppeteerLink, 'junction')
  const chromePath = process.env.REPLICA_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  if (!existsSync(chromePath)) throw new Error('本地执行器缺少已配置的 Chrome。')
  profile.endpoints['html.local'] = { use: '@portfolio/provider-template', config: { chromePath, ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg', ffprobePath: process.env.FFPROBE_PATH || 'ffprobe' } }
  await Promise.all([
    writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: 'replica-template-task', private: true, type: 'module', hypit: { project: true } })),
    writeFile(runtimePath, JSON.stringify(profile)), writeFile(path.join(directory, 'production.svml'), sources.author), writeFile(path.join(directory, 'production.svrun'), sources.run),
    writeFile(path.join(directory, 'style.svs'), '<?svml using="@hypit/recipe@1"?>\n<sheet version="1">film.main { background: #000000; }</sheet>\n'), writeFile(path.join(directory, 'plan.json'), JSON.stringify(plan, null, 2)),
  ])
  const hypit = (args, settings) => runHypit(['check', 'plan', 'build'].includes(args[0]) ? [...args, '--package-root', HYPIT_PROJECT] : args, { cwd: directory, ...settings })
  let completed
  try {
    await update({ status: 'planning', progress: 10, message: 'Hypit 正在校验独立图形模板', plan })
    const run = path.join(directory, 'production.svrun')
    await hypit(['check', run, '--json']); await hypit(['plan', run, '--runtime', runtimePath, '--json'])
    const submitted = JSON.parse((await hypit(['build', run, '--runtime', runtimePath, '--title', '图形模板重建', '--json'])).stdout)
    const buildId = submitted.buildId ?? submitted.build?.id ?? submitted.id
    if (typeof buildId !== 'string' || !buildId.startsWith('bld_')) throw new Error('Hypit 未返回任务编号。')
    await update({ status: 'processing', progress: 35, buildId, message: 'Hypit 正在逐帧绘制背景、文字和动效' })
    await hypit(['status', buildId, '--runtime', runtimePath, '--watch', '--max-wait-ms', '180000', '--json'], { timeout: 200_000 })
    await hypit(['get', buildId, '--output', 'final.video', '--to', path.join(directory, 'picture.mp4'), '--json'])
    await update({ status: 'packaging', progress: 85, message: '正在合成所选音轨并检查成片' })
    const audio = template.audioMode === 'voice' || (template.audioMode === 'original' && reference?.hasAudio)
    const args = ['-v', 'error', '-y', '-i', path.join(directory, 'picture.mp4')]
    if (audio) args.push('-i', path.join(directory, template.audioMode === 'voice' ? 'voice.wav' : 'input.mp4'), '-map', '0:v:0', '-map', '1:a:0', '-af', 'apad', '-t', String(Math.ceil(plan.duration * 30) / 30), '-c:a', 'aac')
    else args.push('-map', '0:v:0', '-an')
    args.push('-c:v', 'copy', '-movflags', '+faststart', path.join(directory, 'result.mp4'))
    await runTool(process.env.FFMPEG_PATH || 'ffmpeg', args)
    const probe = JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(directory, 'result.mp4')])).stdout)
    const stream = probe.streams.find((s) => s.codec_type === 'video'), duration = Number(probe.format.duration)
    if (!stream || stream.width !== plan.width || stream.height !== plan.height || Math.abs(duration - plan.duration) > 0.1 || probe.streams.some((s) => s.codec_type === 'audio') !== audio) throw new Error('成片尺寸、时长或音轨校验失败。')
    await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-xerror', '-i', path.join(directory, 'result.mp4'), '-f', 'null', '-'])
    const result = { duration, width: stream.width, height: stream.height, audio }
    await writeFile(path.join(directory, 'review.json'), JSON.stringify({ ...result, decoded: true, buildId, kind: 'template' }, null, 2))
    completed = { status: 'complete', progress: 100, result, message: '模板成片完成，技术校验通过；请观看确认。' }
  } finally { await hypit(['runtime', 'down', '--runtime', runtimePath, '--json'], { timeout: 20_000 }).catch(() => {}) }
  await update(completed)
}

async function executeReplica(job, directory, update) {
  const hypit = (args, settings) => runHypit(args, { cwd: directory, ...settings })
  await update({ status: 'validating', message: 'Hypit 正在检查视频与音轨', progress: 10 })
  await hypit(['media', 'probe', path.join(directory, 'input.mp4'), '--json'])
  const probe = JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path.join(directory, 'input.mp4')])).stdout)
  const video = probe.streams.find((stream) => stream.codec_type === 'video' && !stream.disposition?.attached_pic)
  if (!video || video.width < 64 || video.height < 64 || video.width > 4096 || video.height > 4096) throw new Error('请选择尺寸在 64～4096 像素之间的正常视频。')
  const hasAudio = probe.streams.some((stream) => stream.codec_type === 'audio')
  const plan = planReplica(Number(video.duration ?? probe.format.duration), job.options)
  const sources = createHypitSources(plan.segments, job.options.keepAudio && hasAudio)
  await Promise.all([writeFile(path.join(directory, 'production.svml'), sources.author), writeFile(path.join(directory, 'production.svrun'), sources.run), writeFile(path.join(directory, 'plan.json'), JSON.stringify(plan, null, 2))])
  await update({ status: 'planning', message: 'Hypit 校验开头与节奏方案 · 无付费请求', progress: 25, plan, source: { duration: Number(probe.format.duration), width: video.width, height: video.height, hasAudio } })
  const run = path.join(directory, 'production.svrun')
  const runtime = path.join(directory, 'hypit.runtime.json')
  await hypit(['check', run, '--json'])
  await hypit(['plan', run, '--runtime', runtime, '--json'])
  const submitted = JSON.parse((await hypit(['build', run, '--runtime', runtime, '--title', '原片低成本复刻', '--json'])).stdout)
  const buildId = submitted.buildId ?? submitted.build?.id ?? submitted.id
  if (typeof buildId !== 'string' || !buildId.startsWith('bld_')) throw new Error('Hypit 未返回有效任务编号。')
  await update({ status: 'processing', message: 'Hypit 正在剪辑开头、调整节奏并保持音画同步', progress: 45, buildId })
  const completed = JSON.parse((await hypit(['status', buildId, '--runtime', runtime, '--watch', '--max-wait-ms', '180000', '--json'], { timeout: 200_000 })).stdout)
  // Export checks the actual Result; a watcher returning is not itself completion.
  if (JSON.stringify(completed).includes('"outcome":"failed"') || JSON.stringify(completed).includes('"outcome":"cancelled"')) throw new Error('Hypit 剪辑任务未完成，请在运行记录中重新创建任务。')
  for (let index = 0; index < plan.segments.length; index++) {
    await hypit(['get', buildId, '--output', `part${index}.video`, '--to', path.join(directory, `part${index}.mp4`), '--json'])
  }
  await update({ status: 'packaging', message: '正在烧录字幕和视觉包装', progress: 75 })
  const dimensions = JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path.join(directory, 'part0.mp4')])).stdout).streams[0]
  await writeFile(path.join(directory, 'captions.ass'), createAss(dimensions.width, dimensions.height, plan, job.options))
  const args = ['-hide_banner', '-loglevel', 'error', '-y']
  for (let index = 0; index < plan.segments.length; index++) args.push('-i', `part${index}.mp4`)
  const audio = job.options.keepAudio && hasAudio
  const count = plan.segments.length
  let filter = count === 1 ? '[0:v:0]null[base];' : `${plan.segments.map((_, index) => `[${index}:v:0]${audio ? `[${index}:a:0]` : ''}`).join('')}concat=n=${count}:v=1:a=${audio ? 1 : 0}[base]${audio ? '[sound]' : ''};`
  const decoration = job.options.style === 'blue' ? `drawbox=x=0:y=0:w=iw:h=4:color=0x7b9bff@0.9:t=fill,drawbox=x=0:y=ih-4:w=iw:h=4:color=0xac8bfa@0.9:t=fill,` : ''
  filter += `[base]${decoration}subtitles=captions.ass,setsar=1[video]`
  args.push('-filter_complex', filter, '-map', '[video]')
  if (audio) args.push('-map', count === 1 ? '0:a:0' : '[sound]', '-c:a', 'aac', '-b:a', '192k')
  args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'result.mp4')
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', args, { cwd: directory })
  const result = JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path.join(directory, 'result.mp4')])).stdout)
  if (!result.streams.some((stream) => stream.codec_type === 'video') || (audio && !result.streams.some((stream) => stream.codec_type === 'audio')) || Math.abs(Number(result.format.duration) - plan.outputDuration) > 0.2) throw new Error('成片音轨或时长校验失败，请重新创建任务。')
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-xerror', '-i', path.join(directory, 'result.mp4'), '-f', 'null', '-'])
  await writeFile(path.join(directory, 'review.json'), JSON.stringify({ duration: Number(result.format.duration), audio, width: dimensions.width, height: dimensions.height, decoded: true, buildId }, null, 2))
  return { status: 'complete', message: '成片已完成，时长、音轨和解码校验通过', progress: 100, result: { duration: Number(result.format.duration), width: dimensions.width, height: dimensions.height, audio } }
}
