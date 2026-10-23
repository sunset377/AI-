import assert from 'node:assert/strict'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function collectTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(entryPath))
    } else if (/\.(?:css|html|js)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

test('GitHub Pages build does not request media from the domain root', async () => {
  const files = await collectTextFiles('dist')
  const offenders = []

  for (const file of files) {
    const contents = await readFile(file, 'utf8')

    if (/['"`(]\/assets\//.test(contents)) {
      offenders.push(path.relative(process.cwd(), file))
    }
  }

  assert.deepEqual(offenders, [])
})

test('entry icons stay within a small download budget instead of loading full artwork', async () => {
  const html = await readFile('dist/index.html', 'utf8')
  for (const [tag] of html.matchAll(/<link\b[^>]*rel="[^"]*\bicon\b[^"]*"[^>]*>/g)) {
    const href = tag.match(/href="([^"]+)"/)?.[1]
    assert.ok(href?.startsWith('/AI-/'), 'Icons must use the portfolio base path')
    const { size } = await stat(path.join('dist', href.slice('/AI-/'.length)))
    assert.ok(size <= 64 * 1024, `Icon is ${size} bytes; do not download full artwork for a browser tab`)
  }
})

test('MineFlow publishes a self-contained subdirectory with replay and license notices', async () => {
  const html = await readFile('dist/mineflow/index.html', 'utf8')
  assert.match(html, /<title>MineFlow｜矿山智慧运输调度系统<\/title>/)
  const assets = [...html.matchAll(/(?:src|href)="(\/AI-\/mineflow\/[^"?#]+)"/g)]
  assert.ok(assets.length >= 3)
  for (const [, url] of assets) {
    assert.equal(await fileExists(`dist/${url.slice('/AI-/'.length)}`), true, url)
  }
  const replay = JSON.parse(await readFile('dist/mineflow/research/openmines-replay.json', 'utf8'))
  assert.equal(replay.frames.length, 97)
  assert.match(await readFile('dist/mineflow/THIRD_PARTY_NOTICES.txt', 'utf8'), /Apache/)
  assert.equal(await fileExists('dist/assets/mineflow-preview.png'), true)
})

test('GitHub Pages build publishes the Sanxingdui tool as a self-contained interactive page', async () => {
  const toolFiles = [
    'dist/sanxingdui/index.html',
    'dist/sanxingdui/assets/experience.js',
    'dist/sanxingdui/assets/visual.css',
    'dist/sanxingdui/assets/museum/tree.webp',
  ]

  for (const filePath of toolFiles) {
    assert.equal(
      await fileExists(filePath),
      true,
      `Expected the deployed tool to include ${filePath}`,
    )
  }

  const toolHtml = await readFile('dist/sanxingdui/index.html', 'utf8')
  assert.match(toolHtml, /<title>小刘带你挖三星堆<\/title>/)
  assert.match(toolHtml, /\.\/assets\/experience\.js/)
})

test('portfolio gallery removes the retired six-image set', async () => {
  const galleryDirectory = 'dist/assets/portfolio-gallery'
  const galleryFiles = (await readdir(galleryDirectory)).filter((file) => file.endsWith('.webp'))

  assert.equal(galleryFiles.length, 77)
  assert.equal(galleryFiles[0], 'gallery-001.webp')
  assert.equal(galleryFiles.at(-1), 'gallery-083.webp')
  for (let index = 31; index <= 36; index += 1) {
    assert.equal(galleryFiles.includes(`gallery-${String(index).padStart(3, '0')}.webp`), false)
  }
})

test('portfolio publishes only the sixteen deduplicated latest creations', async () => {
  const files = (await readdir('dist/assets/latest-creations')).sort()
  assert.deepEqual(files, [
    ...Array.from({ length: 8 }, (_, index) => `character-${String(index + 1).padStart(2, '0')}.webp`),
    ...Array.from({ length: 6 }, (_, index) => `daily-${String(index + 1).padStart(2, '0')}.webp`),
    ...Array.from({ length: 2 }, (_, index) => `portrait-${String(index + 1).padStart(2, '0')}.webp`),
  ])
})

test('portfolio publishes all six mirror sunset images without replacing the archive', async () => {
  const files = (await readdir('dist/assets/mirror-sunset')).sort()
  assert.deepEqual(files, Array.from({ length: 6 }, (_, index) => `scene-${String(index + 1).padStart(2, '0')}.jpg`))
})

test('About section publishes the supplied personal portrait', async () => {
  assert.equal(await fileExists('dist/assets/liu-yaohua-portrait.png'), true)
})

test('portfolio hero publishes the selected desert portrait', async () => {
  assert.equal(await fileExists('dist/assets/hero-desert-portrait.jpg'), true)
})

test('portfolio hero publishes the newly supplied landscape photo unchanged', async () => {
  const photo = await readFile('public/assets/hero-desert-user-20261009.jpg')
  assert.deepEqual(await readFile('dist/assets/hero-desert-user-20261009.jpg'), photo)
  const app = await readFile('src/App.jsx', 'utf8')
  assert.match(app, /assetPath\('assets\/hero-desert-user-20261009\.jpg'\)/)
})

test('portfolio publishes the AI creation platform visual and the short video preview', async () => {
  assert.equal(await fileExists('dist/assets/aigc-hub-product.png'), true)
  assert.equal(await fileExists('dist/assets/starry-preview-113-130.mp4'), true)
})

test('portfolio publishes the ten-second brand promotion preview and poster', async () => {
  assert.equal(await fileExists('dist/assets/brand-promo-preview-37-47.mp4'), true)
  assert.equal(await fileExists('dist/assets/brand-promo-preview-cover.jpg'), true)
})
