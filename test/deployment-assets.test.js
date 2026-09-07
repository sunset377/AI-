import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
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
