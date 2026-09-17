import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
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

test('portfolio gallery publishes every selected desktop image', async () => {
  const galleryDirectory = 'dist/assets/portfolio-gallery'
  const galleryFiles = (await readdir(galleryDirectory)).filter((file) => file.endsWith('.webp'))

  assert.equal(galleryFiles.length, 82)
  assert.equal(galleryFiles[0], 'gallery-001.webp')
  assert.equal(galleryFiles.at(-1), 'gallery-082.webp')
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

test('portfolio publishes the AIGC Hub visual and the short video preview', async () => {
  assert.equal(await fileExists('dist/assets/aigc-hub-product.png'), true)
  assert.equal(await fileExists('dist/assets/starry-preview-113-130.mp4'), true)
})
