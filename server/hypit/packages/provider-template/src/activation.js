import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { canonicalize, defineEndpoint } from '@hypit/hypit/endpoint'
import { mediaTypes, sealTimelineVisual } from '@hypit/media'
import { htmlProgramCapabilities, verifyHtmlRasterRequest } from '@hypit/html-program'
import { createRuntimeEndpointAdapterFacet, runtimeConfigExact, runtimeConfigObject, runtimeConfigString } from '@hypit/runtime-local/extension'
import { templateSupport } from './support.js'

const execute = promisify(execFile)
const launch = (chromePath) => puppeteer.launch({ executablePath: chromePath, headless: true, timeout: 15_000 })

async function rasterize(context, config) {
  const request = context.need.constraints
  verifyHtmlRasterRequest(request)
  if (templateSupport({ constraints: request }).status !== 'supported') throw new Error('Unsupported template program.')
  const p = request.program, start = request.range?.startFrame ?? 0, end = request.range?.endFrameExclusive ?? p.frameCount
  const work = await mkdtemp(path.join(tmpdir(), 'hypit-template-'))
  let browser, expired = false
  const deadline = setTimeout(() => { expired = true; void browser?.close().catch(() => {}) }, 150_000)
  try {
    browser = await launch(config.chromePath)
    const page = await browser.newPage()
    await page.setViewport({ ...p.canvas, deviceScaleFactor: 1 })
    await page.setRequestInterception(true)
    page.on('request', (r) => { void (/^(data:|about:)/.test(r.url()) ? r.continue() : r.abort()).catch(() => {}) })
    let pageFailure
    page.on('pageerror', (error) => { pageFailure = error })
    await page.setContent(p.html, { waitUntil: 'load', timeout: 15_000 })
    await page.evaluate(async () => { await window.__hypitFrameProgram.prepare(); await document.fonts.ready })
    for (let frame = start; frame < end; frame++) {
      if (expired) throw new Error('Template capture deadline exceeded.')
      await page.evaluate(async (index) => { await window.__hypitFrameProgram.applyFrame(index); await document.fonts.ready }, frame)
      if (pageFailure) throw pageFailure
      await page.screenshot({ path: path.join(work, `${String(frame - start).padStart(6, '0')}.png`), type: 'png', timeout: 10_000 })
      if ((frame - start) % 30 === 0) await context.reportProgress?.({ phase: 'capturing frames', completed: frame - start, total: end - start, unit: 'frames' })
    }
    await browser.close(); browser = null
    if (expired) throw new Error('Template capture deadline exceeded.')
    const output = path.join(work, 'visual.mp4')
    const opts = { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 }
    await context.reportProgress?.({ phase: 'encoding and verifying video', completed: end - start, total: end - start, unit: 'frames' })
    await execute(config.ffmpegPath, ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(work, '%06d.png'), '-frames:v', String(end - start), '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], opts)
    const probe = JSON.parse((await execute(config.ffprobePath, ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames', '-of', 'json', output], opts)).stdout).streams[0]
    if (probe?.width !== p.canvas.width || probe?.height !== p.canvas.height || Number(probe?.nb_read_frames) !== end - start) throw new Error('Template output differs from its declared canvas or frame count.')
    if (expired) throw new Error('Template capture deadline exceeded.')
    const artifact = await context.resources.put(await readFile(output), 'video/mp4')
    const visual = sealTimelineVisual({ canvas: p.canvas, frameRate: p.frameRate, frameCount: end - start, artifact })
    return { value: { kind: 'inline', value: canonicalize(visual) } }
  } finally {
    clearTimeout(deadline)
    await browser?.close().catch(() => {})
    await rm(work, { recursive: true, force: true })
  }
}

export default { format: 'hypit.package@1', facets: [createRuntimeEndpointAdapterFacet({
  use: '@portfolio/provider-template',
  activate(context) {
    const input = runtimeConfigObject(context.config, 'template Provider')
    runtimeConfigExact(input, ['chromePath', 'ffmpegPath', 'ffprobePath'], 'template Provider')
    const config = { chromePath: runtimeConfigString(input.chromePath, 'Chrome'), ffmpegPath: runtimeConfigString(input.ffmpegPath, 'FFmpeg') ?? 'ffmpeg', ffprobePath: runtimeConfigString(input.ffprobePath, 'FFprobe') ?? 'ffprobe' }
    if (!config.chromePath) throw new Error('Template Provider requires an existing Chrome path.')
    return {
      endpoint: defineEndpoint({ instance: context.instance, pool: context.pool ?? context.instance, pricing: { kind: 'local' }, defaultConcurrency: 1, capabilities: [{ capability: htmlProgramCapabilities.rasterizeVisual, returns: mediaTypes.timelineVisual, lifecycle: 'immediate', supports: templateSupport, handler: (call) => rasterize(call, config) }] }),
      program: { id: context.instance, async probe() {
        let browser
        try {
          browser = await launch(config.chromePath)
          await browser.version()
          for (const tool of [config.ffmpegPath, config.ffprobePath]) await execute(tool, ['-version'], { windowsHide: true, timeout: 10_000 })
          return { state: 'ready' }
        } catch { return { state: 'down', detail: 'Selected Chrome or media tools could not start; no download or fallback is performed.' } }
        finally { await browser?.close().catch(() => {}) }
      } },
    }
  },
})] }
