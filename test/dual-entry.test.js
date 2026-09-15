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

test('the default render offers the two primary destinations', async () => {
  const vite = await createServer({
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  })

  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App))

    assert.match(html, /看我的/)
    assert.match(html, /数字版/)
    assert.match(html, /进入作品集/)
    assert.match(html, /开始 AI 面试/)
    assert.match(html, /assets\/hero-avatar\.jpg/)
    assert.match(html, /assets\/style-gallery\/future-garden-hero\.jpg/)
  } finally {
    await vite.close()
  }
})
