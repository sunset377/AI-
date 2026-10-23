import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('live acceptance persists before submission and never repeats an uncertain paid call', async () => {
  const { acceptModel } = await import('../scripts/accept-model-gateway.mjs')
  const directory = mkdtempSync(path.join(tmpdir(), 'model-acceptance-'))
  const output = path.join(directory, 'receipt.json')
  let calls = 0
  try {
    const options = { key: 'fixture-key', task: 'fixture-task', output, fetcher: async (_url, init) => {
      calls++
      assert.equal(JSON.parse(readFileSync(output, 'utf8')).requestId, JSON.parse(init.body).request_id)
      assert.equal(JSON.parse(init.body).input.params.count, 1)
      throw new Error('uncertain transport')
    } }
    assert.equal((await acceptModel('image', options)).status, 'uncertain')
    assert.equal((await acceptModel('image', options)).status, 'uncertain')
    assert.equal(calls, 1)
    assert.doesNotMatch(readFileSync(output, 'utf8'), /fixture-key/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
