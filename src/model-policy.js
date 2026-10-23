import catalog from './model-catalog.json' with { type: 'json' }
import imageModels from './image-models.json' with { type: 'json' }

export { imageModels }
export const MODEL_POLICY = Object.freeze(Object.fromEntries(catalog.models
  .filter(model => model.available && (model.type === 'chat' || (model.type === 'image' && Object.hasOwn(imageModels, model.id))))
  .map(model => [model.id, model.type === 'chat' ? { type: 'chat', daily: 20, visitor: 6 } : { type: 'image', daily: 3, visitor: 1 }])))

export function validateModelRequest(payload) {
  if (!payload || typeof payload !== 'object' || !/^[a-f0-9-]{36}$/.test(payload.requestId || '')) throw new Error('请求标识无效，请刷新后重试。')
  const policy = Object.hasOwn(MODEL_POLICY, payload.modelId) ? MODEL_POLICY[payload.modelId] : null
  if (!policy) throw new Error('该模型未向访客开放。')
  const allowed = policy.type === 'chat' ? ['requestId', 'modelId', 'messages'] : ['requestId', 'modelId', 'prompt', 'size', 'reference']
  if (Object.keys(payload).some(key => !allowed.includes(key))) throw new Error('提交包含未开放的参数。')
  if (policy.type === 'image') {
    const profile = imageModels[payload.modelId]
    if (profile.referenceRequired && !payload.reference) throw new Error('该模型需要先选择一张参考图。')
    if (payload.reference !== undefined) {
      if (typeof payload.reference !== 'string' || payload.reference.length > 7_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(payload.reference)) throw new Error('参考图仅支持 5MB 以内的 PNG、JPEG 或 WebP 本地图片。')
      const encoded = payload.reference.split(',')[1]
      let bytes
      try { bytes = atob(encoded) } catch { throw new Error('参考图编码无效。') }
      if (bytes.length > 5 * 1024 * 1024 || !((payload.reference.startsWith('data:image/png;') && bytes.startsWith('\x89PNG\r\n\x1a\n')) || (payload.reference.startsWith('data:image/jpeg;') && bytes.startsWith('\xff\xd8\xff')) || (payload.reference.startsWith('data:image/webp;') && bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP'))) throw new Error('参考图格式或大小无效。')
    }
    if (typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 1000) throw new Error('图片描述需要在 1–1000 字之间。')
    if (profile.sizeField && !profile.sizes.includes(payload.size)) throw new Error('请选择该模型支持的图片比例。')
    const params = { ...profile.defaults, prompt: payload.prompt.trim() }
    if (payload.modelId === 'aliyun-image-superres') delete params.prompt
    if (profile.sizeField) params[profile.sizeField] = payload.size
    if (payload.reference) {
      params[profile.referenceField] = profile.referenceField === 'images' ? [payload.reference] : payload.reference
      if (profile.modes.length) params.mode = profile.modes.includes('image-edit') ? 'image-edit' : 'multi-reference'
    }
    return { ...payload, prompt: payload.prompt.trim(), params, type: 'image', policy }
  }
  if (!Array.isArray(payload.messages) || !payload.messages.length || payload.messages.length > 8) throw new Error('每次最多保留 8 条对话。')
  let total = 0
  for (const message of payload.messages) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000) throw new Error('对话内容或角色无效。')
    total += message.content.length
  }
  if (total > 6000 || payload.messages.at(-1).role !== 'user') throw new Error('对话过长，请新建会话后重试。')
  return { ...payload, type: 'chat', policy }
}
