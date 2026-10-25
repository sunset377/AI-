import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSsrServer as createServer } from './helpers/vite.js'
import { readView } from '../src/navigation.js'

test('readView restores only supported public views', () => {
  assert.equal(readView({ search: '' }), 'gateway')
  assert.equal(readView({ search: '?view=portfolio' }), 'portfolio')
  assert.equal(readView({ search: '?view=interview' }), 'interview')
  assert.equal(readView({ search: '?view=unknown' }), 'gateway')
})

test('the default gateway leads with direct AI creation and retains portfolio and interview access', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App))

    assert.match(html, /可调度/)
    assert.match(html, /和数字版的我聊聊/)
    assert.match(html, /查看作品集/)
    assert.match(html, /AGENT WORKFLOW/)
    assert.match(html, /class="gatewayPrimary"[^>]*href="\?view=studio"[^>]*>打开 AI 创作智能体/)
    assert.match(html, /href="\?view=studio&amp;model=gpt-image-2-c"/)
    assert.match(html, /无需体验码/)
    assert.ok(html.indexOf('class="gatewayHero"') < html.indexOf('class="gatewayMineflow"'))
    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /aria-label="网站入口"/)
    assert.doesNotMatch(html, /QC 一次通过率|SeaArt MoreShort/)
  } finally {
    await vite.close()
  }
})

test('portfolio distinguishes the third-party model service and preserves silent project previews', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /AI创作聚合平台/)
    const service = html.split('<article class="workCard"').find(card => card.includes('<h3>AI创作聚合平台</h3>'))
    assert.ok(service)
    assert.match(service, /第三方/)
    assert.doesNotMatch(html, /与伙伴.*(?:搭建|共建)|联合创始人/)
    assert.match(service, /href="\?view=studio"/)
    assert.doesNotMatch(service, /target="_blank"/)
    assert.match(html, /assets\/starry-preview-113-130\.mp4/)
    assert.match(html, /品牌产品宣传片/)
    assert.match(html, /assets\/brand-promo-preview-37-47\.mp4/)
    assert.match(html, /品牌产品宣传片 10 秒精选预览/)
    assert.match(html, /href="\/assets\/brand-promo-preview-37-47\.mp4"[^>]*>打开 10 秒视频/)
    assert.match(html, /<video[^>]*muted=""[^>]*playsInline=""/)
    assert.match(html, />工作流 \/ 产品<\/button>/)
    assert.match(html, /镜面落日 · 六帧视觉系列/)
    assert.match(html, /href="#style"[^>]*>查看六张组图/)
    assert.match(html, /镜面落日组图 <span>6<\/span>/)
    for (let index = 1; index <= 6; index += 1) {
      assert.match(html, new RegExp(`assets/mirror-sunset/scene-${String(index).padStart(2, '0')}\\.jpg`))
    }
    assert.match(html, /生活方式组图 <span>6<\/span>/)
    assert.match(html, /角色设定草图 <span>8<\/span>/)
    assert.match(html, /人物肖像 <span>2<\/span>/)
    assert.doesNotMatch(html, /assets\/portfolio-gallery\/gallery-03[1-6]\.webp/)
  } finally {
    await vite.close()
  }
})
