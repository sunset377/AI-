import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import catalog from '../src/model-catalog.json' with { type: 'json' }
import { MODEL_POLICY } from '../src/model-policy.js'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || 'C:/Users/98017/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }))
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:5190/AI-/'
const output = '.codex-run/model-workbench'
await mkdir(output, { recursive: true })
const errors = []
try {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', error => errors.push(error.message))
    let submissions = 0; let imageWrites = 0; let imageReads = 0
    await page.route('https://cdn.token6688.com/fixture.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64') }))
    await page.route('https://portfolio-model-gateway.980175020.workers.dev/**', async route => {
      const path = new URL(route.request().url()).pathname
      let data
      if (path === '/api/models') data = { ...catalog, ready: true, publicAccess: true, models: catalog.models.map(model => ({ ...model, enabled: Boolean(MODEL_POLICY[model.id]), limit: MODEL_POLICY[model.id]?.visitor || 0 })) }
      else if (path === '/api/sessions') data = { token: 'ui-test-only' }
      else if (path === '/api/chat') { submissions++; data = { status: 'complete', id: route.request().postDataJSON().requestId, text: '界面交互测试已完成。' } }
      else if (path === '/api/images') { imageWrites++; data = { status: 'processing', id: route.request().postDataJSON().requestId } }
      else if (path.startsWith('/api/jobs/')) { imageReads++; data = { status: 'complete', id: path.split('/').at(-1), imageUrl: 'https://cdn.token6688.com/fixture.png' } }
      else throw new Error('Unexpected request: ' + path)
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    })
    await page.goto(base + '?view=studio#experience=ui-test')
    try { await page.getByRole('heading', { name: 'DeepSeek V4.1 Flash' }).waitFor({ timeout: 6000 }) }
    catch (error) { console.error(JSON.stringify({ viewport, errors, text: (await page.locator('body').innerText()).slice(-2000), url: page.url() })); await page.screenshot({ path: `${output}/failed-${viewport.width}.png` }); throw error }
    await page.waitForFunction(() => sessionStorage.getItem('portfolio-model-session') === 'ui-test-only')
    await page.screenshot({ path: `${output}/desktop-${viewport.width}.png`, fullPage: true })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    if (viewport.width < 680) await page.getByRole('button', { name: '☰ 工作台目录' }).click()
    await page.getByRole('button', { name: '图片', exact: true }).click()
    assert.equal(await page.locator('.mwModel .mwAvailability').filter({ hasText: '锁定' }).count(), 0)
    await page.getByRole('textbox', { name: '搜索模型' }).fill('人脸转绘')
    await page.locator('.mwModel').first().click()
    await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('保留人物服装，转换为素描')
    assert.equal(await page.getByRole('button', { name: '发送创作需求' }).isDisabled(), true)
    await page.evaluate(() => { const read = FileReader.prototype.readAsDataURL; FileReader.prototype.readAsDataURL = function(file) { setTimeout(() => read.call(this, file), 150) } })
    await page.getByLabel('参考图').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64') })
    await page.waitForFunction(() => document.querySelector('.mwReference')?.textContent.includes('fixture.png'))
    assert.equal(await page.getByRole('button', { name: '发送创作需求' }).isEnabled(), true)
    await page.getByRole('button', { name: '移除', exact: true }).click()
    await page.getByLabel('参考图').setInputFiles({ name: 'stale.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64') })
    if (viewport.width < 680) await page.getByRole('button', { name: '☰ 工作台目录' }).click()
    await page.getByRole('textbox', { name: '搜索模型' }).fill('Image 2 C')
    await page.getByRole('button', { name: /^GT Image 2 C / }).click()
    await page.getByRole('heading', { name: 'GT Image 2 C', exact: true }).waitFor()
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)))
    assert.doesNotMatch(await page.locator('.mwReference').innerText(), /stale.png/)
    await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('一座玻璃花园')
    assert.equal(await page.getByRole('button', { name: '发送创作需求' }).isEnabled(), true)
    await page.getByRole('button', { name: '发送创作需求' }).click()
    await page.locator('.mwMessages img').waitFor({ timeout: 7000 })
    assert.equal(imageWrites, 1); assert.equal(imageReads, 1)
    if (viewport.width < 680) await page.getByRole('button', { name: '☰ 工作台目录' }).click()
    await page.getByRole('textbox', { name: '搜索模型' }).fill('')
    await page.getByRole('button', { name: '视频', exact: true }).click()
    await page.locator('.mwModel').first().click()
    assert.equal(await page.getByRole('button', { name: '发送创作需求' }).isDisabled(), true)
    assert.match(await page.locator('.mwLockNotice').innerText(), /视频和音频不会提交/)
    assert.equal(submissions, 0)
    if (viewport.width < 680) await page.getByRole('button', { name: '☰ 工作台目录' }).click()
    await page.getByRole('button', { name: '聊天', exact: true }).click()
    assert.equal(await page.locator('.mwModel .mwAvailability').filter({ hasText: '锁定' }).count(), 0)
    await page.getByRole('textbox', { name: '搜索模型' }).fill('DeepSeek V4.1 Flash')
    await page.locator('.mwModel').first().click()
    await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('测试界面交互')
    await page.getByRole('button', { name: '发送创作需求' }).click()
    await page.getByText('界面交互测试已完成。', { exact: true }).waitFor()
    assert.equal(submissions, 1)
    await page.getByRole('button', { name: '＋ 新对话' }).click()
    await page.getByRole('button', { name: '会话记录', exact: true }).click()
    await page.locator('.mwHistory').getByRole('button', { name: /测试界面交互/ }).click()
    await page.getByText('界面交互测试已完成。', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.evaluate(() => sessionStorage.clear())
    await page.goto(base + '?view=studio')
    await page.waitForFunction(() => sessionStorage.getItem('portfolio-model-session') === 'ui-test-only', { timeout: 7000 })
    assert.equal(await page.locator('.mwAuth').count(), 0)
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ ok: true, viewports: [1440, 390], checks: ['model switching', 'image parameters', 'video lock', 'invitation', 'chat', 'history', 'no horizontal overflow'], paidCalls: 0 }))
} finally { await browser.close() }
