import assert from 'node:assert/strict'
import test from 'node:test'
import catalog from '../src/model-catalog.json' with { type: 'json' }
import { MODEL_POLICY, imageModels, validateModelRequest } from '../src/model-policy.js'

const image = (modelId, size = '1:1', extra = {}) => ({ requestId: crypto.randomUUID(), modelId, prompt: '一座花园', size, ...extra })
const reference = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII='
test('every available chat model accepts bounded conversation while other modalities stay blocked', () => {
  for (const model of catalog.models) {
    if (model.type === 'chat' && model.available) {
      const result = validateModelRequest({ requestId: crypto.randomUUID(), modelId: model.id, messages: [{ role: 'user', content: '你好' }] })
      assert.equal(result.type, 'chat')
      assert.equal(result.policy.daily, 20)
    } else if (model.type !== 'image') assert.equal(MODEL_POLICY[model.id], undefined)
  }
})
test('image requests compile model-specific low-cost parameters rather than a shared pixel size', () => {
  assert.deepEqual(validateModelRequest(image('gpt-image-2-c', '1792x1024')).params, { count: 1, mode: 'text-to-image', output_format: 'jpeg', quality: 'medium', size: '1792x1024', prompt: '一座花园' })
  const gemini = validateModelRequest(image('gemini-3-pro-image', '16:9')).params
  assert.equal(gemini.aspect_ratio, '16:9'); assert.equal(gemini.size, '1K')
  const seedream = validateModelRequest(image('doubao-seedream-5-0-pro')).params
  assert.equal(seedream.size, '1:1'); assert.equal(seedream.resolution, '1k')
  const seedream5 = validateModelRequest(image('doubao-seedream-5-0')).params
  assert.equal(seedream5.resolution, '2k')
  assert.throws(() => validateModelRequest(image('gemini-3-pro-image', '4K')))
})
test('reference-only models reject missing input and arbitrary URLs before any charge', () => {
  for (const modelId of ['face-repaint', 'aliyun-image-superres']) {
    assert.throws(() => validateModelRequest(image(modelId)), /参考图/)
    assert.throws(() => validateModelRequest(image(modelId, '1:1', { reference: 'https://private.test/image.png' })), /参考图/)
  }
  assert.throws(() => validateModelRequest(image('gpt-image-2-c', '1024x1024', { reference: 'data:image/svg+xml;base64,PHN2Zz4=' })), /参考图/)
})
test('all 25 image profiles can compile a valid single-output request including reference tools', () => {
  let count = 0
  for (const model of catalog.models.filter(model => model.type === 'image')) {
    const profile = imageModels[model.id]
    const result = validateModelRequest(image(model.id, profile.sizes?.[0], { reference }))
    assert.equal(result.type, 'image')
    if (model.id === 'aliyun-image-superres') {
      assert.equal(result.params.url, reference)
      assert.equal(result.params.prompt, undefined)
      assert.equal(result.params.upscale_factor, 2)
    } else {
      assert.equal(result.params.count, 1)
      assert.deepEqual(result.params.images, [reference])
    }
    count++
  }
  assert.equal(count, 25)
})
