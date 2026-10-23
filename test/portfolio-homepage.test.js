import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { resumeKnowledgeBase } from '../src/interview/profile.js'

test('unavailable WorkBuddy is absent from interview facts', () => {
  assert.doesNotMatch(JSON.stringify(resumeKnowledgeBase), /workbuddy/i)
})

// A presentation check must not initialize the separate local video service.
test('separate gateway and portfolio retain the original visual entry and all projects', async () => {
  const vite = await createServer({
    configFile: false,
    plugins: [react()],
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  try {
    const { default: App } = await vite.ssrLoadModule('/src/App.jsx')
    const gateway = renderToStaticMarkup(React.createElement(App, { initialView: 'gateway' }))
    assert.match(gateway, /class="gateway"/)
    assert.match(gateway, /刘耀华/)
    assert.match(gateway, /AI 信息流 · Agent 开发 · AIGC 赋能/)
    assert.doesNotMatch(gateway, /id="works"|QC 一次通过率/)
    {
      const html = renderToStaticMarkup(React.createElement(App, { initialView: 'portfolio' }))
      assert.match(html, /hero-desert-user-20261009\.jpg/)
      assert.match(html, /cs-board-preview\.jpg/)
      assert.match(html, /href="\?view=studio"[^>]*>打开 AIGC 创作智能体/)
      const studioCard = html.match(/<aside class="studioPreviewCard">([\s\S]*?)<\/aside>/)?.[1]
      assert.ok(studioCard)
      assert.match(studioCard, /已集成 · AIGC 创作智能体/)
      assert.match(studioCard, /对话、图片与视频模型入口/)
      assert.match(studioCard, /标准化 Skill/)
      assert.match(studioCard, /导演、白板等智能体/)
      assert.match(studioCard, /视频生成按授权开放/)
      assert.doesNotMatch(studioCard, /开源|把一段旁白，做成视频|打开视频智能体/)
      assert.match(html, /定制化视频/)
      assert.match(html, /视觉传达设计 · 计算机应用实践/)
      assert.doesNotMatch(html, /计算机.*双学位|计算机.*本科/)
      assert.doesNotMatch(html, /四川大学|2026 年 6 月|2026 届/)
      assert.match(html, /国家级三等奖/)
      assert.match(html, /视频抽卡成功率达到 90%/)
      const order = ['home', 'workflow', 'works', 'about', 'director', 'script-demo', 'style', 'contact']
        .map(id => html.indexOf(`id="${id}"`))
      assert.ok(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])), 'Real work must precede the biography and process demos')
      assert.match(html, /href="#works"[^>]*>浏览全部作品/)
      assert.match(html, /<video[^>]*controls=""[^>]*muted=""[^>]*playsInline=""/)
      assert.match(html, /assets\/production\/preview-yugong-30-40\.mp4/)
      assert.doesNotMatch(html, /QC 一次通过率|人物一致性 9[256]%|WorkBuddy/i)
      const works = html.split('id="works"')[1].split('id="about"')[0]
      assert.ok(works.indexOf('定制化视频工作流') < works.indexOf('AI 漫剧导演工作流'))
      assert.ok(works.indexOf('AI 漫剧导演工作流') < works.indexOf('小刘带你挖三星堆'))
      for (const title of ['量产样片 · 愚公移山', '《星际穷途 X》', '品牌产品宣传片', '爆款视频复刻工作台', 'AI创作聚合平台', '《时光来信》· 屈臣氏 185 周年']) assert.ok(works.includes(title), title)
      assert.equal((html.match(/class="styleShot"/g) ?? []).length, 99)
      assert.match(html, /href="\/sanxingdui\/"/)
    }
    const studio = renderToStaticMarkup(React.createElement(App, { initialView: 'studio' }))
    assert.match(studio, /AI 创作工作台/)
    assert.match(studio, /MOMOCO 导演/)
    assert.match(studio, /GT Image 2 C/)
    assert.match(studio, /体验码/)
    assert.doesNotMatch(studio, /克隆参考音色|API 设置/)
    const whiteboard = renderToStaticMarkup(React.createElement(App, { initialView: 'whiteboard' }))
    assert.match(whiteboard, /配音与试听确认/)
    assert.equal((whiteboard.match(/class="styleCard/g) ?? []).length, 12)
  } finally {
    await vite.close()
  }
})
