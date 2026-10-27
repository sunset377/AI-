import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { canOccupy } from '../demos/dazhou-store/src/navigation.js'

test('Dazhou production demo resolves its assets beneath the Pages subdirectory', () => {
  const root = 'dist/dazhou-store'
  const html = readFileSync(`${root}/index.html`, 'utf8')
  const base = new URL('https://sunset377.github.io/AI-/dazhou-store/')
  const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)]
  assert.ok(assets.length >= 2)
  for (const [, asset] of assets) {
    assert.ok(readFileSync(resolve(root, asset)).length > 0)
    assert.ok(new URL(asset, base).pathname.startsWith('/AI-/dazhou-store/'))
  }
  const js = assets.filter(([, path]) => path.endsWith('.js')).map(([, path]) => readFileSync(resolve(root, path), 'utf8')).join('')
  assert.match(js, /\.\/models\/dazhou_store_base_V4\.glb/)
  assert.match(js, /\.\/navigation-v4\.json/)
  assert.doesNotMatch(html, /127\.0\.0\.1|plan-check/)
  assert.match(html, /\.\.\/\?view=portfolio#works/)
  assert.deepEqual(readdirSync(root).sort(), ['assets', 'index.html', 'models', 'navigation-v4.json', 'preview.png'])
  const glb = readFileSync(`${root}/models/dazhou_store_base_V4.glb`)
  assert.equal(glb.toString('utf8', 0, 4), 'glTF')
  assert.equal(glb.readUInt32LE(8), glb.length)
  const nav = JSON.parse(readFileSync(`${root}/navigation-v4.json`, 'utf8'))
  assert.ok(canOccupy(nav.entry[0], nav.entry[2], nav.colliders, nav.footprint))
  assert.ok(!canOccupy(0, 8.45, nav.colliders, nav.footprint))
})
