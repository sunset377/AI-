import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('portfolio view preserves the supplied portrait artwork without central promotional copy', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /assets\/hero-field-portrait\.jpg/)
    assert.match(html, /class="nav"/)
    assert.match(html, /class="wallpaperSwitch"/)
    assert.doesNotMatch(html, /class="heroCopy"/)
    assert.doesNotMatch(html, /查看作品|复制邮箱/)
  } finally {
    await vite.close()
  }
})
