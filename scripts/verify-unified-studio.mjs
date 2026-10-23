import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import catalog from '../src/model-catalog.json' with { type: 'json' }
import { MODEL_POLICY } from '../src/model-policy.js'

const require = createRequire(import.meta.url)
const { chromium } = require(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES || 'C:/Users/98017/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'] }))
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'], executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const base = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:5192/AI-/'
const output = '.codex-run/unified-studio'
await mkdir(output, { recursive: true })
const errors = []
let writes = 0
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width > 680 ? 960 : 844 } })
    page.setDefaultTimeout(6000)
    page.setDefaultNavigationTimeout(30000)
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/replica/rag/search' && route.request().method() === 'POST') return route.fulfill({ json: { ready: false, hits: [] } })
      if (route.request().method() !== 'GET') { writes++; return route.fulfill({ status: 403, json: { error: 'Read-only UI test: generation is prohibited.' } }) }
      let data = { items: [], jobs: [], drafts: [], entries: [] }
      if (path === '/api/models') data = { ...catalog, ready: false, models: catalog.models.map(model => ({ ...model, enabled: Boolean(MODEL_POLICY[model.id]), limit: MODEL_POLICY[model.id]?.visitor || 0 })) }
      if (path === '/api/replica/health') data = { ready: false, planning: { ready: false }, chat: { ready: false }, video: { ready: false }, render: { ready: false } }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    })
    await page.goto(base + '?view=portfolio', { waitUntil: 'domcontentloaded' })
    const providerCard = page.locator('article.workCard').filter({ has: page.getByRole('heading', { name: 'AI创作聚合平台', exact: true }) })
    assert.match(await providerCard.innerText(), /第三方/)
    await providerCard.getByRole('link', { name: '在工作台查看模型' }).click()
    await page.getByRole('heading', { name: 'DeepSeek V4.1 Flash', exact: true }).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('view'), 'studio')
    assert.equal(page.context().pages().length, 1)
    const url = page.url()
    const openDirectory = async () => { if (width < 680 && !await page.getByRole('complementary', { name: '工作台目录' }).isVisible()) await page.getByRole('button', { name: '☰ 工作台目录', exact: true }).click() }
    const tab = async name => { await openDirectory(); await page.getByRole('tab', { name, exact: true }).click(); assert.equal(page.url(), url) }
    const checkLayout = async () => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); assert.equal(await page.getByRole('main').count(), 1) }
    const playSilentFixture = () => page.locator('.csStudio audio').first().evaluate(async audio => {
      const buffer = new ArrayBuffer(44 + 16000), view = new DataView(buffer)
      const word = (offset, text) => [...text].forEach((value, i) => view.setUint8(offset + i, value.charCodeAt(0)))
      word(0, 'RIFF'); view.setUint32(4, 16036, true); word(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, 16000, true)
      audio.src = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' })); audio.loop = true
      await audio.play()
      return !audio.paused
    })
    await page.getByRole('heading', { name: 'DeepSeek V4.1 Flash' }).waitFor()
    await page.getByRole('textbox', { name: '创作需求', exact: true }).fill('保留大模型里的未发送草稿')
    await page.screenshot({ path: `${output}/models-${width}.png`, fullPage: true })
    await tab('智能体')
    const director = page.getByRole('textbox', { name: '告诉导演你想做什么', exact: true })
    await director.fill('保留导演里的未发送剧本，不开始制作')
    await checkLayout()
    await page.screenshot({ path: `${output}/director-${width}.png`, fullPage: true })
    await tab('Skill 广场')
    await page.getByRole('textbox', { name: '搜索 Skill' }).fill('白板')
    await page.getByRole('button', { name: '收藏 白板视频工作流', exact: true }).click()
    await page.getByRole('button', { name: /^我的收藏/ }).click()
    assert.equal(await page.locator('.mwSkillCard').count(), 1)
    await page.getByRole('button', { name: '查看步骤', exact: true }).click()
    await page.getByRole('region', { name: '白板视频工作流使用步骤' }).waitFor()
    await page.getByRole('button', { name: '使用 Skill →', exact: true }).click()
    assert.equal(page.url(), url)
    const copy = page.getByRole('textbox', { name: '视频文案', exact: true })
    await copy.fill('这是一段从白板交接给导演的文案，切换功能不能清空这段文字。')
    await page.locator('.csStudio .aspectRatioField select').selectOption('9:16')
    await checkLayout()
    assert.equal(await page.locator('.csStudio .primary.create').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(124, 58, 237)')
    const images = page.locator('.csStudio .stylePicker img')
    await images.first().scrollIntoViewIfNeeded()
    await page.waitForFunction(() => [...document.querySelectorAll('.csStudio .stylePicker img')].every(img => img.complete && img.naturalWidth > 0), undefined, { timeout: 30000 })
    assert.equal(await images.count(), 12)
    await page.locator('.mwAgentPanel').evaluate(element => { element.scrollTop = 0 })
    await page.screenshot({ path: `${output}/whiteboard-${width}.png`, fullPage: true })
    assert.equal(await playSilentFixture(), true)
    await tab('大模型')
    await page.waitForFunction(() => document.querySelector('.csStudio audio').paused)
    assert.equal(await page.getByRole('textbox', { name: '创作需求', exact: true }).inputValue(), '保留大模型里的未发送草稿')
    await tab('智能体')
    assert.equal(await copy.inputValue(), '这是一段从白板交接给导演的文案，切换功能不能清空这段文字。')
    assert.equal(await page.locator('.csStudio .aspectRatioField select').inputValue(), '9:16')
    assert.equal(await playSilentFixture(), true)
    await openDirectory()
    await page.locator('.mwAgentDirectory').getByRole('button', { name: /^MOMOCO 导演/ }).click()
    await page.waitForFunction(() => document.querySelector('.csStudio audio').paused)
    assert.equal(await director.inputValue(), '保留导演里的未发送剧本，不开始制作')
    await page.getByRole('navigation', { name: '导演工具' }).getByRole('button', { name: /白板与音频库/ }).click()
    await page.getByRole('button', { name: '交给 MOMOCO 导演拆解 →', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('[aria-label="告诉导演你想做什么"]')?.value.startsWith('这是一段从白板交接给导演'))
    assert.equal(page.url(), url)
    await tab('Skill 广场')
    await page.getByRole('button', { name: '全部 Skill', exact: true }).click()
    await page.getByRole('textbox', { name: '搜索 Skill' }).fill('')
    assert.equal(await page.locator('.mwSkillCard').count(), 3)
    await checkLayout()
    await page.screenshot({ path: `${output}/skills-${width}.png`, fullPage: true })
    await page.locator('.mwSkillCard').filter({ has: page.getByRole('heading', { name: '原片剪辑包装', exact: true }) }).getByRole('button', { name: '使用 Skill →', exact: true }).click()
    await page.getByRole('heading', { name: '给它一个新的节奏', exact: true }).waitFor()
    assert.equal(page.url(), url)
    await tab('Skill 广场')
    await page.locator('.mwSkillCard').filter({ has: page.getByRole('heading', { name: 'MOMOCO 导演 Skill', exact: true }) }).getByRole('button', { name: '使用 Skill →', exact: true }).click()
    assert.match(await director.inputValue(), /^这是一段从白板交接给导演/)
    await tab('Skill 广场')
    await openDirectory()
    await page.getByRole('tab', { name: 'Skill 广场', exact: true }).focus()
    await page.keyboard.press('Home')
    assert.equal(await page.getByRole('tab', { name: '大模型', exact: true }).getAttribute('aria-selected'), 'true')
    for (const [view, heading] of [['replica', 'MOMOCO 视频导演'], ['whiteboard', '白板视频智能体']]) {
      await page.goto(base + '?view=' + view, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      assert.equal(await page.locator('.mwHeader').count(), 1)
      await checkLayout()
    }
    await page.close()
  }
  assert.equal(writes, 0)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ ok: true, widths: [1440, 390], paidCalls: 0, checks: ['same URL', 'real agent controls', 'three preserved drafts', 'handoff', 'skill search and bookmarks', '12 loaded style previews', 'keyboard tabs', 'no horizontal overflow'] }))
} catch (error) {
  const images = await Promise.all(browser.contexts().flatMap(context => context.pages()).map(page => page.locator('.csStudio .stylePicker img').evaluateAll(items => items.map(img => ({ src: img.src, complete: img.complete, width: img.naturalWidth }))).catch(() => [])))
  console.error(JSON.stringify({ pageErrors: errors, blockedWrites: writes, images }))
  throw error
} finally { await browser.close() }
