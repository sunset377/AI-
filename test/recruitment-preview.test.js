import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createSsrServer } from './helpers/vite.js'

test('review layout retains every original case and links to the authorized fitness game', async () => {
  const vite = await createSsrServer()
  try {
    const { default: Preview, projectDestination, fitnessUrl, fitnessCover } = await vite.ssrLoadModule('/src/components/RecruitmentPreview/RecruitmentPreview.jsx')
    const { default: App, projects, styleShots } = await vite.ssrLoadModule('/src/App.jsx')
    const html = renderToStaticMarkup(React.createElement(Preview))
    assert.equal(renderToStaticMarkup(React.createElement(App)), html, 'The published default route uses the approved layout')
    assert.ok(html.includes(`src="${fitnessCover}"`))
    assert.doesNotMatch(html, /仅本地评审|封面排版示意/)
    assert.equal(createHash('sha256').update(await readFile('public/assets/pixelfit-user-cover-20261029.jpg')).digest('hex'), 'cd583e2027bdbbff6a58c82dec3d1c2770938554969c2b516fdd37452b62460c')
    for (const project of projects) assert.ok(html.includes(`data-project-title="${project.title}"`), project.title)
    assert.equal(fitnessUrl, 'https://pixelfit-sunset377.ochre-bay-0465.chatgpt.site/')
    assert.ok(html.includes(`href="${fitnessUrl}"`))
    assert.match(html, new RegExp(`展开全部 ${styleShots.length} 件作品`))
    assert.match(html, /当前形态为 H5/)
    assert.match(html, /商业 TVC/)
    assert.match(html, /预言 · 成语短视频账号/)
    assert.equal(projectDestination({ href: '#workflow' }), '#workflow')
    assert.equal(projectDestination({ href: '#script-demo' }), '/?view=portfolio#script-demo')
    assert.equal(projectDestination({ href: '?view=studio' }), '/?view=studio')
    assert.equal(projectDestination({ preview: '/assets/clip.mp4' }), '/assets/clip.mp4')
  } finally {
    await vite.close()
  }
})
