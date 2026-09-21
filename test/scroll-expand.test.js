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
    assert.match(html, /89 件作品/)
    assert.match(html, /视觉创作档案/)
    assert.match(html, /浏览视觉作品/)
    assert.doesNotMatch(html, /本次重新精选|旧图库已全部替换|本次重新收录/)
    assert.match(html, /assets\/portfolio-gallery\/gallery-003\.webp/)

    const strengthsHtml = html.split('id="strengths"')[1]?.split('id="contact"')[0]
    assert.ok(strengthsHtml, 'Expected a strengths section')
    const titles = [
      'Agent 工作流设计',
      'AI 应用前端实现',
      '模型与工具协作',
      '任务状态与异常处理',
      '测试与上线验证',
      'AI 漫剧导演统筹',
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
