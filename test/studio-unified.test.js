import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

test('studio exposes model, agent and skill panels within one shell', async () => {
  const vite = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const { default: Workbench } = await vite.ssrLoadModule('/src/components/ModelWorkbench/ModelWorkbench.jsx')
    const html = renderToStaticMarkup(React.createElement(Workbench, { onBack() {} }))
    assert.match(html, /role="tablist" aria-label="工作台栏目"/)
    for (const tab of ['models', 'agents', 'skills']) assert.match(html, new RegExp(`id="mw-tab-${tab}"`))
    assert.match(html, /DeepSeek V4.1 Flash/)
    assert.equal((html.match(/class="mwHeader"/g) || []).length, 1)
    assert.doesNotMatch(html, /<iframe/)
  } finally { await vite.close() }
})

test('director and open-source whiteboard render their real controls without duplicate page navigation', async () => {
  const vite = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const { default: Workbench } = await vite.ssrLoadModule('/src/components/ModelWorkbench/ModelWorkbench.jsx')
    const director = renderToStaticMarkup(React.createElement(Workbench, { initialSection: 'agents', initialAgent: 'director', onBack() {} }))
    assert.match(director, /aria-label="告诉导演你想做什么"/)
    assert.match(director, /MiniMax H3/)
    assert.doesNotMatch(director, /class="rwRail"|HYPIT VIDEO WORKBENCH · 03/)
    const whiteboard = renderToStaticMarkup(React.createElement(Workbench, { initialSection: 'agents', initialAgent: 'whiteboard', onBack() {} }))
    assert.match(whiteboard, /视频文案/)
    assert.match(whiteboard, /成片设置/)
    assert.match(whiteboard, /CS Board/)
    assert.doesNotMatch(whiteboard, /class="topbar"/)
  } finally { await vite.close() }
})

test('skill panel offers actual integrated tools and local selection rather than external marketplace navigation', async () => {
  const vite = await createServer({ configFile: false, plugins: [react()], appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const { default: Workbench } = await vite.ssrLoadModule('/src/components/ModelWorkbench/ModelWorkbench.jsx')
    const html = renderToStaticMarkup(React.createElement(Workbench, { initialSection: 'skills', onBack() {} }))
    assert.match(html, /aria-label="搜索 Skill"/)
    assert.match(html, /我的收藏/)
    assert.match(html, /MOMOCO 导演 Skill/)
    assert.match(html, /白板视频工作流/)
    assert.match(html, /原片剪辑包装/)
    assert.match(html, /查看步骤/)
    assert.doesNotMatch(html, /href="https:\/\/aigchub/)
  } finally { await vite.close() }
})

test('embedded whiteboard style previews honor the GitHub Pages subdirectory', async () => {
  const vite = await createServer({ configFile: false, base: '/AI-/', plugins: [react()], appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const { default: Board } = await vite.ssrLoadModule('/src/components/CSBoard/NativeBoard.tsx')
    const html = renderToStaticMarkup(React.createElement(Board, { embedded: true, onBack() {}, onDirector() {} }))
    assert.ok(html.includes('src="/AI-/cs-assets/styles/minimal-whiteboard.webp"'), 'Preview assets must stay under the deployed /AI-/ base.')
  } finally { await vite.close() }
})
