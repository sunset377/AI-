import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('portfolio renders a scroll-expanding entrance into the image gallery', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))

    assert.match(html, /class="scroll-expand/)
    assert.match(html, /进入视觉档案/)
    assert.match(html, /82 件作品/)
    assert.match(html, /本次重新精选/)
    assert.match(html, /assets\/portfolio-gallery\/gallery-003\.webp/)
  } finally {
    await vite.close()
  }
})
