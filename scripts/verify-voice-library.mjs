import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || 'C:/Users/98017/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }))
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:5193/AI-/'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const output = '.codex-run/voice-library'
await mkdir(output, { recursive: true })
const errors = []
let writes = 0
const names = ['耀华 · 本人音色', '阿言 · 温暖沉稳男声', '川川 · 亲切自然男声', 'Frank · 沉稳叙事男声', '安宁 · 轻柔舒缓女声', '小雅 · 清晰自然女声']
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    let live = false
    let unavailable = 'missing'
    await page.route('**/api/**', route => {
      if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 403 }) }
      if (live && new URL(route.request().url()).pathname === '/api/replica/whiteboard/voices') return route.fulfill({ json: { items: [{ id: 'local-test', name: '本地 F5 测试音色', filename: 'local-test.wav', synthesizable: true }] } })
      if (new URL(route.request().url()).pathname === '/api/replica/whiteboard/voices') {
        if (unavailable === 'empty') return route.fulfill({ json: { items: [] } })
        if (unavailable === 'malformed') return route.fulfill({ json: { items: [null, { id: '../private', name: '不合法的目录条目', synthesizable: true }] } })
        if (unavailable === 'offline') return route.abort('connectionrefused')
        if (unavailable === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Static fallback</html>' })
      }
      return route.fulfill({ status: 404, contentType: 'text/html', body: '<html>GitHub Pages 404</html>' })
    })
    await page.goto(base + '?view=whiteboard', { waitUntil: 'networkidle' })
    console.log(`Checking voice previews at ${width}px`)
    const select = page.getByLabel('选择声音', { exact: true })
    await select.waitFor()
    assert.deepEqual(await select.locator('option').allTextContents(), names, 'A missing local API must not leave the public voice selector empty.')
    assert.equal(await select.inputValue(), 'yaohua')
    const copy = page.getByRole('textbox', { name: '视频文案', exact: true })
    await copy.fill('这是访客自己的文案，更换音色后仍须保留。')
    await select.selectOption('xiaoya')
    await page.locator('.voiceReferenceGrid article').last().getByRole('button', { name: '选择并试听', exact: true }).click()
    const playing = page.getByLabel('所选声音自我介绍', { exact: true })
    await page.waitForFunction(() => { const audio = document.querySelector('audio[aria-label="所选声音自我介绍"]'); return audio && !audio.paused && audio.currentTime > 0 })
    assert.match(await playing.getAttribute('src'), /\/AI-\/cs-assets\/voices\/xiaoya\.wav$/)
    const samples = page.locator('.voiceReferenceGrid audio')
    assert.equal(await samples.count(), 6)
    await page.waitForFunction(() => [...document.querySelectorAll('.voiceReferenceGrid audio')].every(audio => audio.readyState >= 1 && audio.duration > 0))
    for (const sample of await samples.all()) {
      assert.equal(await sample.evaluate(async audio => {
        let timer
        try { await Promise.race([audio.play(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sample playback timed out')), 10000) })]); return !audio.paused && audio.duration > 0 }
        finally { clearTimeout(timer); audio.pause() }
      }), true)
    }
    assert.equal(await copy.inputValue(), '这是访客自己的文案，更换音色后仍须保留。')
    assert.equal(await page.getByRole('button', { name: '生成旁白试听', exact: true }).isDisabled(), true)
    assert.match(await page.locator('.narrationComposer').innerText(), /仅.*试听.*本地 F5/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.mwAgentPanel').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: `${output}/public-${width}.png`, fullPage: true })
    if (width === 1440) for (const failure of ['empty', 'html', 'malformed', 'offline']) {
      unavailable = failure
      await page.reload({ waitUntil: 'networkidle' })
      await select.waitFor()
      assert.deepEqual(await select.locator('option').allTextContents(), names, `Public previews must survive a ${failure} API response.`)
      assert.equal(await page.getByRole('button', { name: '生成旁白试听', exact: true }).isDisabled(), true)
    }
    // Reload into a connected local catalogue; it must take precedence over static previews.
    live = true
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(await select.locator('option').allTextContents(), ['本地 F5 测试音色'])
    assert.equal(await page.getByRole('button', { name: '生成旁白试听', exact: true }).isEnabled(), true)
    await page.close()
  }
  assert.equal(writes, 0, 'Previewing samples must never submit narration, video or model generation.')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, widths: [1440, 390], samples: 6, writes, errors, output }))
} finally { await browser.close() }
