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

test('portfolio gallery publishes every optimized image', async () => {
  const galleryDirectory = 'dist/assets/portfolio-gallery'
  const galleryFiles = (await readdir(galleryDirectory)).filter((file) => file.endsWith('.webp'))

  assert.equal(galleryFiles.length, 107)
  assert.equal(galleryFiles.filter((file) => file.startsWith('world-')).length, 33)
  assert.equal(galleryFiles.filter((file) => file.startsWith('portrait-')).length, 23)
  assert.equal(galleryFiles.filter((file) => file.startsWith('illustration-')).length, 14)
  assert.equal(galleryFiles.filter((file) => file.startsWith('brand-')).length, 13)
  assert.equal(galleryFiles.filter((file) => file.startsWith('fashion-')).length, 24)
})
