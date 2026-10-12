import path from 'node:path'
import { runTool } from './replica-render.js'

export function measureBackground(samples) {
  if (!Array.isArray(samples) || !samples.length || samples.some((s) => s.length !== 64 * 64 * 3)) throw new Error('分析采样无效。')
  const measured = samples.map((rgb) => {
    const bins = new Map(); let total = 0
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (x >= 4 && x < 60 && y >= 4 && y < 60) continue
      const pixel = [...rgb.subarray((y * 64 + x) * 3, (y * 64 + x) * 3 + 3)]
      const key = pixel.map((v) => v >> 4).join(',')
      const bin = bins.get(key) || { count: 0, sum: [0, 0, 0] }
      bin.count++; pixel.forEach((v, i) => { bin.sum[i] += v }); bins.set(key, bin); total++
    }
    const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0]
    return { channels: dominant.sum.map((v) => Math.round(v / dominant.count)), coverage: dominant.count / total }
  })
  const coverage = Math.min(...measured.map((m) => m.coverage))
  const stable = coverage >= 0.8 && measured.every((m) => m.channels.every((c, i) => Math.abs(c - measured[0].channels[i]) <= 30))
  return { color: `#${measured[0].channels.map((v) => v.toString(16).padStart(2, '0')).join('')}`, coverage, stable }
}

export function readReplicaMetadata(probe) {
  const stream = probe?.streams?.find((item) => item.codec_type === 'video' && !item.disposition?.attached_pic)
  const duration = Number(stream?.duration ?? probe?.format?.duration)
  if (!stream || ![stream.width, stream.height].every((n) => n >= 64 && n <= 4096) || !Number.isFinite(duration) || duration < 0.5 || duration > 30.05) throw new Error('请选择 0.5～30 秒、尺寸 64～4096 像素的视频。')
  const rotation = Number(stream.side_data_list?.find((item) => item.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0)
  const swapped = Math.abs(rotation % 180) === 90
  return { duration, width: swapped ? stream.height : stream.width, height: swapped ? stream.width : stream.height, hasAudio: probe.streams.some((item) => item.codec_type === 'audio'), rotation }
}

export async function analyzeReplica(inputPath, directory, update = async () => {}) {
  const probe = JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', inputPath])).stdout)
  const metadata = readReplicaMetadata(probe)
  const duration = metadata.duration
  const frames = [], samples = [], changes = []
  for (let id = 0; id < 6; id++) {
    const at = id === 5 ? Math.max(0, duration - 0.08) : duration * id / 5
    const common = ['-v', 'error', '-ss', String(at), '-i', inputPath, '-frames:v', '1']
    await runTool(process.env.FFMPEG_PATH || 'ffmpeg', [...common, '-vf', 'scale=720:720:force_original_aspect_ratio=decrease', '-y', path.join(directory, `frame-${id}.png`)])
    const sample = (await runTool(process.env.FFMPEG_PATH || 'ffmpeg', [...common, '-vf', 'scale=64:64', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { encoding: null })).stdout
    if (sample.length !== 64 * 64 * 3) throw new Error('视频代表帧读取失败。')
    if (samples.length) changes.push({ at, difference: [...sample].reduce((sum, v, i) => sum + Math.abs(v - samples.at(-1)[i]), 0) / sample.length / 255 })
    samples.push(sample); frames.push({ id, at }); await update({ progress: 10 + id * 12, message: `正在提取代表帧 ${id + 1}/6` })
  }
  const background = measureBackground(samples)
  return { metadata, frames, background, changes, supported: background.stable, unknowns: ['未自动识别原片文字，请确认或填写。', '未转写语音，也未识别人、表演或镜头语义。', '画面差异是像素测量，不代表已经识别剪辑结构。'] }
}
