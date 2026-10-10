import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { runTool } from './replica-render.js'

const voiceConfig = 'E:/小红书三星堆账号/assets/audio/用户本人音色-默认-v1.json'
const python = 'E:/98017/Projects/C盘迁移/屈臣氏比赛资料/tmp/f5tts-env/Scripts/python.exe'

async function localConfig(configPath = voiceConfig) {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  config.python = process.env.REPLICA_F5_PYTHON || python
  config.cli = path.resolve(path.dirname(config.python), '../Lib/site-packages/f5_tts/infer/infer_cli.py')
  config.checkpoint = process.env.REPLICA_F5_CHECKPOINT || ''
  config.vocab = process.env.REPLICA_F5_VOCAB || ''
  config.vocoder = process.env.REPLICA_F5_VOCODER || ''
  config.referenceText = (await readFile(config.reference_text_file, 'utf8')).trim()
  if (config.engine !== 'local_F5_TTS' || config.model !== 'F5TTS_v1_Base' || config.speed !== 1 || config.nfe_step !== 32 || !config.referenceText) throw new Error()
  return config
}

export async function checkReplicaVoice(configPath = voiceConfig) {
  try {
    const config = await localConfig(configPath)
    if (!config.checkpoint || !config.vocab || !config.vocoder) return { ready: false, reasons: ['尚未指定已核验的本地 F5 权重、词表和 Vocos 目录；不自动下载或换声。'], commercialLicense: config.commercial_model_license }
    for (const file of [config.python, config.cli, config.reference_wav, config.checkpoint, config.vocab, path.join(config.vocoder, 'config.yaml'), path.join(config.vocoder, 'pytorch_model.bin')]) if (!(await stat(file)).isFile()) throw new Error()
    return { ready: true, reasons: [], commercialLicense: config.commercial_model_license }
  } catch { return { ready: false, reasons: ['本人 F5 配置、准确转写、参考或本地模型不完整；不能替换声线。'], commercialLicense: 'pending_verification' } }
}

export function validateProsody(narration, prosody) {
  if (typeof narration !== 'string' || !narration.trim() || [...narration].length > 300 || !Array.isArray(prosody) || !prosody.length || prosody.length > 3) throw new Error('请填写最多三段、总计 300 字的旁白。')
  const fields = new Set()
  for (const p of prosody) {
    if (!p || Object.keys(p).some((k) => !['field', 'text', 'pause'].includes(k)) || !['title', 'benefit', 'action'].includes(p.field) || fields.has(p.field) || typeof p.text !== 'string' || !p.text.trim() || /[\x00-\x1f\[\]]/.test(p.text) || !Number.isFinite(p.pause) || p.pause < 0 || p.pause > 1.5) throw new Error('句段、标点或停顿规划无效。')
    fields.add(p.field)
  }
  if (prosody.map((p) => p.text).join('').replace(/\s/g, '') !== narration.replace(/\s/g, '')) throw new Error('试听句段必须与旁白逐字对应。')
  return prosody
}

export function f5Arguments(config, cli, text, directory) {
  if (config.model !== 'F5TTS_v1_Base' || config.speed !== 1 || config.nfe_step !== 32 || !config.referenceText) throw new Error('F5 必须保持本人参考和自然语速。')
  return [cli, '--config', path.join(directory, 'voice.toml'), '--model', 'F5TTS_v1_Base', '--ckpt_file', config.checkpoint, '--vocab_file', config.vocab, '--ref_audio', config.reference_wav, '--ref_text', config.referenceText, '--gen_text', text, '--output_dir', directory, '--output_file', 'segment.wav', '--speed', '1', '--nfe_step', '32', '--vocoder_name', 'vocos', '--load_vocoder_from_local']
}

export async function createVoicePreview({ narration, prosody }, directory) {
  validateProsody(narration, prosody)
  if (!(await checkReplicaVoice()).ready) throw new Error('本人 F5 尚未就绪。')
  const config = await localConfig(), id = randomUUID(), root = path.join(directory, `voice-${id}`)
  await mkdir(path.join(root, 'checkpoints'), { recursive: true })
  await symlink(config.vocoder, path.join(root, 'checkpoints/vocos-mel-24khz'), 'junction')
  const cues = [], parts = []; let end = 0
  for (let i = 0; i < prosody.length; i++) {
    const part = path.join(root, `segment-${i}`); await mkdir(part)
    await writeFile(path.join(part, 'voice.toml'), '')
    await runTool(config.python, f5Arguments(config, config.cli, prosody[i].text, part), { cwd: part, env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' }, timeout: 180_000 })
    const segment = path.join(part, 'segment.wav')
    const duration = Number(JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_format', '-of', 'json', segment])).stdout).format.duration)
    if (!Number.isFinite(duration) || duration <= 0 || end + duration + prosody[i].pause > 30) throw new Error('旁白超过 30 秒或无效，请精简文案；不会加速。')
    cues.push({ field: prosody[i].field, start: end, end: end + duration + prosody[i].pause })
    const padded = path.join(part, 'padded.wav')
    await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-y', '-i', segment, '-af', `apad=pad_dur=${prosody[i].pause}`, '-ar', '24000', '-ac', '1', padded])
    parts.push(padded); end = cues.at(-1).end
  }
  const audioPath = path.join(directory, `voice-${id}.wav`), args = ['-v', 'error', '-y']
  for (const file of parts) args.push('-i', file)
  args.push('-filter_complex', `${parts.map((_, i) => `[${i}:a:0]`).join('')}concat=n=${parts.length}:v=0:a=1[sound]`, '-map', '[sound]', '-c:a', 'pcm_s16le', audioPath)
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', args)
  const duration = Number(JSON.parse((await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_format', '-of', 'json', audioPath])).stdout).format.duration)
  if (duration > 30 || Math.abs(duration - end) > 0.08) throw new Error('试听时间轴校验失败。')
  cues.at(-1).end = duration
  return { id, audioPath, sha256: createHash('sha256').update(await readFile(audioPath)).digest('hex'), duration, cues }
}
