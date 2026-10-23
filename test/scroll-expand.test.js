import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSsrServer as createServer } from './helpers/vite.js'

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
    assert.match(html, /99 件作品/)
    assert.match(html, /视觉创作档案/)
    assert.match(html, /浏览视觉作品/)
    assert.doesNotMatch(html, /本次重新精选|旧图库已全部替换|本次重新收录/)
    assert.match(html, /assets\/portfolio-gallery\/gallery-003\.webp/)

    const strengthsHtml = html.split('id="strengths"')[1]?.split('id="eval"')[0]
    assert.ok(strengthsHtml, 'Expected a strengths section')
    const titles = [
      '多工具调度与长链状态管理',
      '多模型 API 编排与成本闸门',
      '确定性校验与可复现交付',
      '失败恢复与对账机制',
      '短剧场景的质量评测直觉',
      '视觉与产品闭环能力',
    ]
    for (const [index, title] of titles.entries()) {
      assert.match(strengthsHtml, new RegExp(title))
      if (index > 0) assert.ok(strengthsHtml.indexOf(titles[index - 1]) < strengthsHtml.indexOf(title))
    }
    assert.doesNotMatch(strengthsHtml, /影视分镜叙事|提示词工程与抽卡|品牌视觉全案|后期剪辑调色/)
  } finally {
    await vite.close()
  }
})
