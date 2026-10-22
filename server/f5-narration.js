import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runTool } from './replica-render.js'

const script = fileURLToPath(new URL('../scripts/f5-narration.py', import.meta.url))

export async function synthesizeNarration({ text, voice, root }, directory) {
  const runtime = JSON.parse(await readFile(path.join(root, 'f5-runtime.json'), 'utf8'))
  const reference = path.resolve(root, voice.referenceFile || '')
  if (!reference.startsWith(path.resolve(root) + path.sep) || !(await stat(reference)).isFile() || !voice.referenceText) throw new Error('Reference unavailable')
  const audioPath = path.join(directory, 'narration.wav')
  const manifest = path.join(directory, 'request.json')
  await writeFile(manifest, JSON.stringify({ runtime, items:[{ text, reference_audio:reference, reference_text:voice.referenceText, output:audioPath }] }))
  await runTool(runtime.python, [script, manifest], { env:{HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',PYTHONIOENCODING:'utf-8'}, timeout:600000 })
  const probe = await runTool(process.env.FFPROBE_PATH || 'ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',audioPath])
  const duration = Number(probe.stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0 || duration > 300) throw new Error('Invalid F5 duration')
  await runTool(process.env.FFMPEG_PATH || 'ffmpeg', ['-v','error','-i',audioPath,'-f','null','-'])
  return { audioPath, duration }
}
