import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distribution = process.env.HYPIT_DISTRIBUTION
if (!distribution) throw new Error('Set HYPIT_DISTRIBUTION to the installed Hypit directory to reuse its Puppeteer.')
const require = createRequire(path.join(distribution, 'package.json'))
const puppeteer = require('puppeteer-core')
const directory = fileURLToPath(new URL('../.codex-run/replica-qa/', import.meta.url))
await mkdir(directory, { recursive: true })
const base = process.env.REPLICA_QA_URL || 'http://127.0.0.1:5174'
const browser = await puppeteer.launch({ executablePath: process.env.REPLICA_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${base}/?view=replica`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.querySelector('.rwStatus')?.textContent.includes('本地执行器已连接'), { timeout: 30_000 })
  await page.screenshot({ path: path.join(directory, 'desktop-empty.png'), fullPage: true })
  const clickText = async (selector, text) => page.evaluate((selector, text) => { const target = [...document.querySelectorAll(selector)].find((element) => element.textContent.includes(text)); if (!target) throw new Error(`Missing ${text}`); target.click() }, selector, text)
  if (process.env.REPLICA_QA_VIDEO) {
    if (process.env.REPLICA_QA_TEMPLATE_ONLY !== '1') {
    await clickText('.rwNav button', '原片剪辑包装')
    await (await page.$('input[aria-label="选择参考视频"]')).uploadFile(process.env.REPLICA_QA_VIDEO)
    await page.waitForFunction(() => document.querySelector('.rwFileMeta')?.textContent.includes('秒'))
    await page.type('input[maxlength="40"]', '只换节奏，不换画面')
    await page.type('.rwTextFields textarea', '第一句字幕\n第二句字幕')
    await clickText('label.rwMode', '亮点前置')
    await page.evaluate(() => { const input = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1.5'); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) })
    await page.waitForFunction(() => document.querySelector('.rwSlider')?.textContent.includes('1.5 秒'))
    await clickText('button', '播放完整预览')
    await page.waitForFunction(() => document.querySelector('.rwPreviewControls')?.textContent.includes('4.0 / 4.0'), { timeout: 15_000 })
    await page.screenshot({ path: path.join(directory, 'desktop-upload.png'), fullPage: true })
    await clickText('button', '制作这个版本')
    await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]'), { timeout: 240_000 })
    await page.evaluate(() => { const video = document.querySelector('video[aria-label="Hypit 复刻成片"]'); video.currentTime = 0.4 })
    await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]').readyState >= 2)
    await page.screenshot({ path: path.join(directory, 'desktop-result.png'), fullPage: true })
    const evidence = await page.evaluate(async () => {
      const videos = [...document.querySelectorAll('.rwCompare video')]
      const output = videos[1]
      const download = document.querySelector('a.rwPrimary')
      const result = await fetch(download.href)
      await output.play()
      const job = (await (await fetch('/api/replica/jobs')).json()).jobs[0]
      const direct = await fetch(`/server/hypit/jobs/${job.id}/input.mp4`)
      return { duration: output.duration, width: output.videoWidth, height: output.videoHeight, bytes: (await result.arrayBuffer()).byteLength, downloadStatus: result.status, filename: result.headers.get('content-disposition'), segments: job.plan.segments, directMediaStatus: direct.status }
    })
    assert.equal(evidence.downloadStatus, 200)
    assert.ok(evidence.bytes > 10000)
    assert.ok(Math.abs(evidence.duration - 4) < 0.2)
    assert.equal(evidence.segments[0].start, 1.5)
    assert.equal(evidence.segments.length, 3)
    assert.equal(evidence.directMediaStatus, 403)
    await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]').ended, { timeout: 15_000 })
    await writeFile(path.join(directory, 'browser-evidence.json'), JSON.stringify(evidence, null, 2))
    await clickText('.rwNav button', '运行记录')
    assert.ok(await page.$('.rwHistoryRow'))
    await clickText('.rwHistoryActions button', '查看')
    assert.ok(await page.$('video[aria-label="Hypit 复刻成片"]'))
    }

    await clickText('.rwNav button', '模板重建')
    const picker = await page.$('input[aria-label="选择模板参考视频"]')
    await picker.uploadFile(process.env.REPLICA_QA_VIDEO)
    await page.waitForFunction(() => document.querySelector('video[aria-label="模板参考原片"]')?.readyState >= 1)
    // Hold an old upload, switch source, then release it: no stale response may populate the new editor.
    await page.setRequestInterception(true)
    let held
    const intercept = (request) => { if (!held && request.method() === 'POST' && request.url().endsWith('/drafts')) held = request; else request.continue() }
    page.on('request', intercept)
    await clickText('button', '分析原片')
    for (let n = 0; !held && n < 100; n++) await new Promise((r) => setTimeout(r, 20))
    assert.ok(held)
    await picker.uploadFile(process.env.REPLICA_QA_VIDEO)
    await held.continue()
    await new Promise((r) => setTimeout(r, 600))
    assert.equal(await page.$('.rtEvidence'), null)
    assert.match(await page.$eval('.rtLive', (e) => e.textContent), /等待参考视频/)
    page.off('request', intercept); await page.setRequestInterception(false)
    await clickText('button', '分析原片')
    await page.waitForFunction(() => document.querySelector('.rtFrames img') && !document.querySelector('textarea[aria-label="修改需求"]').disabled, { timeout: 60_000 })
    assert.equal(await page.$$eval('.rtFrames img', (els) => els.length), 6)
    await page.type('textarea[aria-label="修改需求"]', '背景改绿色，字改黄色，加弹跳，光环旋转')
    await clickText('button', '发送修改需求')
    await page.waitForFunction(() => document.querySelector('.rtMessages')?.textContent.includes('还是全部文字'))
    assert.equal(await page.$eval('.rwTemplateGrid .rwSubmitRow .rwPrimary', (e) => e.disabled), true)
    await page.type('textarea[aria-label="修改需求"]', '全部')
    await clickText('button', '发送修改需求')
    await page.waitForFunction(() => document.querySelector('textarea[aria-label="修改需求"]').value === '' && !document.querySelector('textarea[aria-label="修改需求"]').disabled)
    for (const [label, text] of [['开场钩子文案', '手机经常卡顿？'], ['利益点文案', '先检查多余文件'], ['行动引导文案', '确认后再清理']]) await page.type(`textarea[aria-label="${label}"]`, text)
    await clickText('button', '保存修改')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((e) => e.textContent === '确认方案' && !e.disabled))
    assert.equal(await page.$eval('input[aria-label="背景颜色"]', (e) => e.value), '#22c55e')
    assert.equal(await page.$eval('input[aria-label="开场钩子文案颜色"]', (e) => e.value), '#eab308')
    await clickText('button', '播放模板预览')
    await new Promise((r) => setTimeout(r, 350)); await clickText('.rwTemplateGrid button', '暂停')
    await page.screenshot({ path: path.join(directory, 'desktop-template.png'), fullPage: true })
    // Changing Chromium's isMobile mode reloads the page; resize only while testing an in-progress draft.
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: path.join(directory, 'mobile-template.png'), fullPage: true })
    await page.setViewport({ width: 1440, height: 1000 })
    await clickText('.rwTemplateGrid .rwSubmitRow button', '确认方案')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((e) => e.textContent.includes('制作模板成片') && !e.disabled))
    await page.type('textarea[aria-label="行动引导文案"]', '。')
    assert.equal(await page.$eval('.rwTemplateGrid .rwSubmitRow .rwPrimary', (e) => e.disabled), true)
    await clickText('button', '保存修改')
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((e) => e.textContent === '确认方案' && !e.disabled))
    await clickText('.rwTemplateGrid .rwSubmitRow button', '确认方案')
    await page.waitForFunction(() => !document.querySelector('.rwTemplateGrid .rwSubmitRow .rwPrimary').disabled)
    await clickText('button', '制作模板成片')
    await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]'), { timeout: 240_000 })
    const templateEvidence = await page.evaluate(async () => {
      const video = document.querySelector('video[aria-label="Hypit 复刻成片"]')
      const job = (await (await fetch('/api/replica/jobs')).json()).jobs.find((j) => j.kind === 'template')
      const response = await fetch(`${job.resultUrl}?download=1`)
      await video.play()
      return { id: job.id, kind: job.plan.kind, duration: job.result.duration, template: job.template, buildId: job.buildId, bytes: (await response.arrayBuffer()).byteLength, downloadStatus: response.status }
    })
    assert.equal(templateEvidence.kind, 'template'); assert.match(templateEvidence.buildId, /^bld_/)
    assert.equal(templateEvidence.template.background, '#22c55e'); assert.equal(templateEvidence.downloadStatus, 200)
    await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]').ended, { timeout: 20_000 })
    const isolated = await browser.createBrowserContext(), outsider = await isolated.newPage()
    await outsider.goto(`${base}/?view=replica`)
    assert.equal(await outsider.evaluate(async (id) => (await fetch(`/api/replica/jobs/${id}/result`)).status, templateEvidence.id), 404)
    await isolated.close()
    await writeFile(path.join(directory, 'template-browser-evidence.json'), JSON.stringify({ ...templateEvidence, staleUploadIgnored: true, confirmationInvalidated: true, outsiderDenied: true }, null, 2))
    await page.screenshot({ path: path.join(directory, 'template-result.png'), fullPage: true })
  }
  await clickText('.rwNav button', '模板重建')
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 1 })
  await page.waitForFunction(() => document.querySelector('.rwStatus')?.textContent.includes('本地执行器已连接'), { timeout: 30_000 })
  await page.screenshot({ path: path.join(directory, 'mobile-create.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  await clickText('.rwNav button', '执行与模型')
  await page.screenshot({ path: path.join(directory, 'mobile-engine.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ screenshots: directory, browserErrors: errors, horizontalOverflow: false, outputPlayedToEnd: !!process.env.REPLICA_QA_VIDEO }, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ browserErrors: errors, status: await page.$$eval('.rwStatus', (els) => els.map((e) => e.textContent)).catch(() => []) }))
  throw error
} finally { await browser.close() }
