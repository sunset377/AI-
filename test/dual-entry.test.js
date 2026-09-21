import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readView } from '../src/navigation.js'

test('readView restores only supported public views', () => {
  assert.equal(readView({ search: '' }), 'gateway')
  assert.equal(readView({ search: '?view=portfolio' }), 'portfolio')
  assert.equal(readView({ search: '?view=interview' }), 'interview')
  assert.equal(readView({ search: '?view=unknown' }), 'gateway')
})

test('the default render makes AI interview the primary destination while retaining portfolio access', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App))

    assert.match(html, /看作品/)
    assert.match(html, /数字版/)
    assert.match(html, /查看我的作品集/)
    assert.match(html, /开始 AI 面试/)
    assert.match(html, /class="gatewayPrimary"[^>]*>开始 AI 面试/)
    assert.ok(html.indexOf('开始 AI 面试') < html.indexOf('查看我的作品集'))
    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /assets\/portfolio-gallery\/gallery-003\.webp/)
    assert.match(html, />88<\/span><small>WORKS/)
  } finally {
    await vite.close()
  }
})

test('portfolio exposes the partnership product and the silent project preview', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /AIGC Hub · AI 创作中转站/)
    assert.match(html, /与伙伴联合从 0 到 1 搭建/)
    assert.match(html, /href="https:\/\/aigchub\.token6688\.com\/signup\?ref=07996c9e"/)
    assert.match(html, /assets\/starry-preview-113-130\.mp4/)
    assert.match(html, /品牌产品宣传片/)
    assert.match(html, /assets\/brand-promo-preview-37-47\.mp4/)
    assert.match(html, /品牌产品宣传片 10 秒精选预览/)
    assert.match(html, /href="\/assets\/brand-promo-preview-37-47\.mp4"[^>]*>打开 10 秒视频/)
    assert.match(html, /<video[^>]*muted=""[^>]*playsInline=""/)
    assert.match(html, />产品<\/button>/)
    assert.match(html, /镜面落日 · 六帧视觉系列/)
    assert.match(html, /href="#style"[^>]*>查看六张组图/)
    assert.match(html, /镜面落日组图 <span>6<\/span>/)
    for (let index = 1; index <= 6; index += 1) {
      assert.match(html, new RegExp(`assets/mirror-sunset/scene-${String(index).padStart(2, '0')}\\.jpg`))
    }
  } finally {
    await vite.close()
  }
})
