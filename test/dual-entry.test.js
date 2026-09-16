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
    assert.match(html, />82<\/span><small>WORKS/)
  } finally {
    await vite.close()
  }
})
