import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, statSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSsrServer as createServer } from './helpers/vite.js'

test('portfolio exposes the complete PixelFit game under the GitHub Pages base', async () => {
  const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))
    assert.match(html, /href="\/pixelfit\/"[^>]*>打开 PixelFit · 立即试玩/)
    assert.match(html, /22 件器械分类/)
  } finally {
    await vite.close()
  }

  const gameHtml = readFileSync('dist/pixelfit/index.html', 'utf8')
  assert.match(gameHtml, /\/AI-\/pixelfit\/assets\//)
  assert.doesNotMatch(gameHtml, /127\.0\.0\.1|localhost/)
  for (const path of [
    'dist/pixelfit/assets/room/gym-interior-a-v1.png',
    'dist/pixelfit/assets/char/original-tie-home-wave-v1.png',
    'dist/assets/pixelfit-home-a.png',
  ]) assert.ok(statSync(path).size > 10_000, path)
})
