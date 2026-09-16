import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('portfolio route preserves the supplied artwork and offers a return to the new gateway', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /assets\/hero-field-portrait\.jpg/)
    assert.match(html, /assets\/liu-yaohua-portrait\.png/)
    assert.match(html, /alt="刘耀华的个人照片"/)
    assert.match(html, /class="nav"/)
    assert.match(html, /class="wallpaperSwitch"/)
    assert.match(html, /← 入口/)
    assert.doesNotMatch(html, /class="heroCopy"/)
    assert.doesNotMatch(html, /查看作品|复制邮箱/)
  } finally {
    await vite.close()
  }
})
