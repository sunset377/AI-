import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSsrServer as createServer } from './helpers/vite.js'

test('portfolio route preserves the supplied artwork and offers a return to the new gateway', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /assets\/hero-desert-user-20261009\.jpg/)
    assert.doesNotMatch(html, /assets\/hero-field-portrait\.jpg/)
    assert.match(html, /assets\/liu-yaohua-portrait\.png/)
    assert.match(html, /alt="刘耀华的个人照片"/)
    assert.match(html, /class="nav"/)
    assert.match(html, /aria-label="作品集导航"/)
    assert.match(html, /href="\?view=studio"[^>]*>打开视频智能体/)
    assert.match(html, /← 入口/)
    assert.doesNotMatch(html, /class="heroCopy"/)
    assert.doesNotMatch(html, /查看作品|复制邮箱/)
  } finally {
    await vite.close()
  }
})
