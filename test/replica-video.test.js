import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { planVideoTask, ratioForCanvas, resumeVideoTask, submitVideoTask, videoHealth } from '../server/replica-video.js'

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'replica-video-'))
  const runnerPath = path.join(directory, 'cli.mjs')
  const credentialPath = path.join(directory, 'credential.dat')
  await writeFile(runnerPath, '')
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { directory, runnerPath, credentialPath, model: 'MiniMax-H3' }
}

test('video health requires the official runner and DPAPI credential', async (t) => {
  const config = await fixture(t)
  assert.equal(videoHealth(config).planningReady, true)
  assert.equal(videoHealth(config).ready, false)
  await writeFile(config.credentialPath, 'ciphertext')
  assert.equal(videoHealth(config).ready, true)
  assert.equal(videoHealth(config).connector, 'official-plugin')
})

test('ratio maps the workbench canvas to a MiniMax token', () => {
  assert.equal(ratioForCanvas(720, 1280), '9:16')
  assert.equal(ratioForCanvas(1280, 720), '16:9')
  assert.equal(ratioForCanvas(1024, 1024), '1:1')
})

test('offline planning writes a text-only spec and returns the plugin estimate', async (t) => {
  const config = await fixture(t)
  let call
  config.run = async (args) => {
    call = args
    return { ok: true, job: { request: { model: 'MiniMax-H3', duration: 6, resolution: '768P', ratio: '9:16' }, estimate: { cny: '3.00', snapshotDate: '2026-09-01' } } }
  }
  const result = await planVideoTask({ prompt: '口红特写镜头', duration: 6, resolution: '768P', ratio: '9:16', directory: config.directory }, config)
  assert.equal(call[0], 'plan')
  assert.equal(result.job.estimate.cny, '3.00')
  assert.deepEqual(JSON.parse(await readFile(path.join(config.directory, 'h3-spec.json'), 'utf8')), { model: 'MiniMax-H3', prompt: '口红特写镜头', duration: 6, resolution: '768P', ratio: '9:16' })
})

test('paid submit uses the persisted manifest and exact confirmed cost', async (t) => {
  const config = await fixture(t)
  await writeFile(config.credentialPath, 'ciphertext')
  const manifestPath = path.join(config.directory, 'h3-job.json')
  await writeFile(manifestPath, JSON.stringify({ state: 'planned' }))
  let call
  config.run = async (args) => { call = args; return { ok: true, job: { state: 'submitted', taskId: 'task-1' } } }
  const job = await submitVideoTask({ manifestPath, confirmCostCny: '3.00' }, config)
  assert.equal(job.taskId, 'task-1')
  assert.deepEqual(call, ['submit', '--manifest', manifestPath, '--confirm-cost-cny', '3.00'])
})

test('uncertain paid submission preserves the plugin state instead of retrying', async (t) => {
  const config = await fixture(t)
  await writeFile(config.credentialPath, 'ciphertext')
  const manifestPath = path.join(config.directory, 'h3-job.json')
  config.run = async () => { await writeFile(manifestPath, JSON.stringify({ state: 'submission_uncertain' })); throw new Error('uncertain') }
  await assert.rejects(submitVideoTask({ manifestPath, confirmCostCny: '3.00' }, config), (error) => error.state === 'submission_uncertain')
})

test('resume only continues the recorded task manifest', async (t) => {
  const config = await fixture(t)
  const manifestPath = path.join(config.directory, 'h3-job.json')
  let call
  config.run = async (args) => { call = args; return { ok: true, job: { state: 'processing', taskId: 'task-1' } } }
  const job = await resumeVideoTask({ manifestPath, outputDir: config.directory }, config)
  assert.equal(job.state, 'processing')
  assert.deepEqual(call, ['resume', '--manifest', manifestPath, '--output-dir', config.directory])
})
