import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('gateway and project list expose the interactive MineFlow entry without removing portfolio access', async () => {
  const vite = await createServer({ appType: 'custom', server: { middlewareMode: true, hmr: false } })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const gateway = renderToStaticMarkup(React.createElement(App))
    assert.match(gateway, /href="\/mineflow\/"[^>]*>.*?体验 MineFlow/s)
    assert.match(gateway, /查看 Agent 流水线/)
    assert.match(gateway, /和数字版的我聊聊/)
    const portfolio = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))
    assert.match(portfolio, /href="\/mineflow\/"[^>]*>进入 MineFlow/)
    assert.match(portfolio, /每位访客使用独立浏览器会话/)
    assert.match(portfolio, /预言 · 自动化成语短视频生产线/)
  } finally {
    await vite.close()
  }
})
