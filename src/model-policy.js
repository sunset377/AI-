export const MODEL_POLICY = Object.freeze({
  'deepseek-v4.1-flash': { type: 'chat', daily: 20, visitor: 6 },
  'gpt-image-2-c': { type: 'image', daily: 3, visitor: 1 },
})

export function validateModelRequest(payload) {
  if (!payload || typeof payload !== 'object' || !/^[a-f0-9-]{36}$/.test(payload.requestId || '')) throw new Error('请求标识无效，请刷新后重试。')
  const policy = Object.hasOwn(MODEL_POLICY, payload.modelId) ? MODEL_POLICY[payload.modelId] : null
  if (!policy) throw new Error('该模型未向访客开放。')
  const allowed = policy.type === 'chat' ? ['requestId', 'modelId', 'messages'] : ['requestId', 'modelId', 'prompt', 'size']
  if (Object.keys(payload).some(key => !allowed.includes(key))) throw new Error('提交包含未开放的参数。')
  if (policy.type === 'image') {
    if (typeof payload.prompt !== 'string' || !payload.prompt.trim() || payload.prompt.length > 1000) throw new Error('图片描述需要在 1–1000 字之间。')
    if (!['1024x1024', '1792x1024', '1024x1792'].includes(payload.size)) throw new Error('请选择已开放的 1K 图片尺寸。')
    return { ...payload, prompt: payload.prompt.trim(), type: 'image', policy }
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
