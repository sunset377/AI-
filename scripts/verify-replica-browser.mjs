import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const distribution = process.env.HYPIT_DISTRIBUTION
const referenceVideo = process.env.REPLICA_QA_VIDEO
if (!distribution) throw new Error('Set HYPIT_DISTRIBUTION to the installed Hypit directory to reuse its Puppeteer.')
if (!referenceVideo) throw new Error('Set REPLICA_QA_VIDEO to a generated QA video, not a user or portfolio asset.')
const require = createRequire(path.join(distribution, 'package.json'))
const puppeteer = require('puppeteer-core')
const directory = fileURLToPath(new URL('../.codex-run/replica-qa/', import.meta.url))
await mkdir(directory, { recursive: true })
const base = process.env.REPLICA_QA_URL || 'http://127.0.0.1:5174'
const browser = await puppeteer.launch({ executablePath: process.env.REPLICA_QA_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

const clickText = (selector, value) => page.evaluate((selector, value) => {
  const target = [...document.querySelectorAll(selector)].find((element) => element.textContent.includes(value))
  if (!target) throw new Error(`Missing ${value}`)
  target.click()
}, selector, value)
const typeRequirement = async (value) => {
  const selector = 'textarea[aria-label="告诉导演你想做什么"]'
  await page.focus(selector)
  await page.evaluate((selector) => { const field = document.querySelector(selector); field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })) }, selector)
  await page.type(selector, value)
}
const waitForPlan = async (reference) => {
  await page.waitForFunction((reference) => {
    const panel = document.querySelector('.rtPlanPanel')
    return panel?.textContent.includes('可执行') && panel.textContent.includes('hypit-template') && panel.textContent.includes(reference ? '已测量参考视频' : '没有参考原片')
  }, { timeout: 90_000 }, reference)
}
const renderAndVerify = async ({ reference }) => {
  await clickText('.rtPlanPanel button', '确认当前方案')
  await page.waitForFunction(() => [...document.querySelectorAll('.rtPlanPanel button')].some((button) => button.textContent.includes('制作成片') && !button.disabled))
  await clickText('.rtPlanPanel button', '制作成片')
  await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]'), { timeout: 240_000 })
  assert.equal(Boolean(await page.$('video[aria-label="对比原片"]')), reference)
  if (!reference) assert.match(await page.$eval('.rwCompare', (element) => element.textContent), /本次无参考原片/)
  const evidence = await page.evaluate(async () => {
    const video = document.querySelector('video[aria-label="Hypit 复刻成片"]')
    const response = await fetch(document.querySelector('a.rwPrimary').href)
    await video.play()
    const job = (await (await fetch('/api/replica/jobs')).json()).jobs[0]
    const directInput = await fetch(`/api/replica/jobs/${job.id}/input`)
    return { id: job.id, duration: video.duration, width: video.videoWidth, height: video.videoHeight, bytes: (await response.arrayBuffer()).byteLength, downloadStatus: response.status, inputStatus: directInput.status, buildId: job.buildId, kind: job.plan.kind, templateId: job.template.templateId }
  })
  assert.equal(evidence.downloadStatus, 200)
  assert.ok(evidence.bytes > 10_000)
  assert.match(evidence.buildId, /^bld_/)
  assert.equal(evidence.kind, 'template')
  assert.equal(evidence.inputStatus, reference ? 200 : 404)
  await page.waitForFunction(() => document.querySelector('video[aria-label="Hypit 复刻成片"]').ended, { timeout: 20_000 })
  return evidence
}

try {
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${base}/?view=replica`, { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.querySelector('.rwStatus')?.textContent.includes('本地执行器已连接'), { timeout: 30_000 })
  await page.screenshot({ path: path.join(directory, 'agent-empty-desktop.png'), fullPage: true })
  assert.equal(await page.$eval('textarea[aria-label="告诉导演你想做什么"]', (element) => element.disabled), false)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)

  await typeRequirement('标题：三秒看懂；卖点：本地生成；行动：马上开始；使用通用文字卡；背景改绿色；全部文字改黄色；加个弹跳')
  await clickText('.rtComposer button', '发送给导演')
  await waitForPlan(false)
  assert.match(await page.$eval('.rtMessages', (element) => element.textContent), /依据描述，未分析原片/)
  assert.match(await page.$eval('textarea[aria-label="可复制视频指令"]', (element) => element.value), /三秒看懂/)
  await page.screenshot({ path: path.join(directory, 'agent-text-plan-desktop.png'), fullPage: true })
  const noReference = await renderAndVerify({ reference: false })
  assert.equal(noReference.templateId, 'text-cards')
  await page.screenshot({ path: path.join(directory, 'agent-text-result-desktop.png'), fullPage: true })

  await clickText('button', '调整并新建版本')
  await clickText('.rtActions button', '新建会话')
  const picker = await page.$('input[aria-label="添加参考视频"]')
  await picker.uploadFile(referenceVideo)
  await typeRequirement('标题：手机经常卡顿？；卖点：先检查多余文件；行动：确认后再清理；使用清理图标；背景改绿色；全部文字改黄色；加个弹跳')

  // An upload finishing after a new file selection must not populate the new editor.
  await page.setRequestInterception(true)
  let held
  const intercept = (request) => { if (!held && request.method() === 'POST' && request.url().endsWith('/drafts')) held = request; else request.continue() }
  page.on('request', intercept)
  await clickText('.rtComposer button', '发送给导演')
  for (let count = 0; !held && count < 100; count++) await new Promise((resolve) => setTimeout(resolve, 20))
  assert.ok(held)
  await picker.uploadFile(referenceVideo)
  await held.continue()
  await new Promise((resolve) => setTimeout(resolve, 500))
  assert.equal(await page.$('.rtEvidence'), null)
  page.off('request', intercept)
  await page.setRequestInterception(false)

  await clickText('.rtComposer button', '发送给导演')
  await waitForPlan(true)
  assert.equal(await page.$$eval('.rtFrames img', (elements) => elements.length), 6)
  assert.equal(await page.$eval('input[aria-label="背景颜色"]', (element) => element.value), '#22c55e')
  assert.equal(await page.$eval('input[aria-label="开场钩子文案颜色"]', (element) => element.value), '#eab308')
  await clickText('.rtSection summary', '高级模板与声音设置')
  await page.select('select[aria-label="成片声音"]', 'original')
  await clickText('.rtSection button', '保存修改')
  await page.waitForFunction(() => [...document.querySelectorAll('.rtPlanPanel button')].some((button) => button.textContent.includes('确认当前方案') && !button.disabled))
  await page.screenshot({ path: path.join(directory, 'agent-reference-plan-desktop.png'), fullPage: true })

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path: path.join(directory, 'agent-reference-plan-mobile.png'), fullPage: true })
  await page.setViewport({ width: 1440, height: 1000 })

  await clickText('.rtPlanPanel button', '确认当前方案')
  await page.waitForFunction(() => [...document.querySelectorAll('.rtPlanPanel button')].some((button) => button.textContent.includes('制作成片') && !button.disabled))
  await page.type('textarea[aria-label="行动引导文案"]', '。')
  assert.equal(await page.$eval('.rtPlanPanel .rwPrimary', (element) => element.disabled), true)
  await clickText('.rtSection button', '保存修改')
  await page.waitForFunction(() => [...document.querySelectorAll('.rtPlanPanel button')].some((button) => button.textContent.includes('确认当前方案') && !button.disabled))
  const withReference = await renderAndVerify({ reference: true })
  assert.equal(withReference.templateId, 'cleanup-icon')
  await page.screenshot({ path: path.join(directory, 'agent-reference-result-desktop.png'), fullPage: true })

  const isolated = await browser.createBrowserContext()
  const outsider = await isolated.newPage()
  await outsider.goto(`${base}/?view=replica`, { waitUntil: 'networkidle0' })
  assert.equal(await outsider.evaluate(async (id) => (await fetch(`/api/replica/jobs/${id}/result`)).status, withReference.id), 404)
  await isolated.close()

  const evidence = { noReference, withReference, staleUploadIgnored: true, confirmationInvalidated: true, outsiderDenied: true, browserErrors: errors, horizontalOverflow: false, outputPlayedToEnd: true }
  await writeFile(path.join(directory, 'agent-browser-evidence.json'), JSON.stringify(evidence, null, 2))
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ screenshots: directory, ...evidence }, null, 2))
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'agent-failure.png'), fullPage: true }).catch(() => {})
  console.error(JSON.stringify({ browserErrors: errors, status: await page.$$eval('.rwStatus', (elements) => elements.map((element) => element.textContent)).catch(() => []) }))
  throw error
} finally { await browser.close() }
