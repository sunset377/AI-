// Explicit model routing and cost estimation for the replica workbench.
//
// The workbench is local-first: text planning and graphic rendering run on the
// machine (Hypit + FFmpeg + local RAG) at zero model cost. Optional chat models
// and video generation models are separate, explicitly routed tiers. This module
// owns the provider catalogue and the cost estimator; it never calls an API.

// Estimation basis, not a quote. Providers bill independently; the workbench
// always asks for consent before sending an external request.
const CHAT_IN_PER_MILLION = 2 // 元 / 1M input tokens (deepseek-chat, cache miss)
const CHAT_OUT_PER_MILLION = 8 // 元 / 1M output tokens
const OUTPUT_TOKENS = 2400 // max_tokens used by the chat planner
const TOKENS_PER_CHAR = 0.6 // conservative Chinese/English mixed estimate

export const PROVIDERS = {
  local: {
    id: 'local',
    label: '本地 Hypit',
    task: '图形模板渲染 / 本地向导',
    fee: 0,
    feeUnit: '零模型费',
    enabled: true,
    note: 'FFmpeg + Hypit 在本机执行；本地向导与 RAG 检索也不调用外部模型。',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek 对话',
    task: '需求拆解与方案规划',
    feePerMillionIn: CHAT_IN_PER_MILLION,
    feePerMillionOut: CHAT_OUT_PER_MILLION,
    feeUnit: '元/百万 token',
    enabled: false,
    note: '按输入+输出 token 计费；以下为估算基准，实际以供应商账单为准。',
  },
  'minimax-h3': {
    id: 'minimax-h3',
    label: 'MiniMax H3 视频',
    task: '复杂人物镜头生成',
    feePerSecond: null,
    feeUnit: '按量计费',
    enabled: false,
    note: '提交接口已接入（MiniMax-H3）；按量计费，提交前须确认。',
  },
}

export function providerList() {
  return Object.values(PROVIDERS)
}

export function routeFor({ mode = 'local', chatReady = false } = {}) {
  if (mode === 'api' && chatReady) {
    return { ...PROVIDERS.deepseek, decision: '本轮需求拆解外发 DeepSeek；成片仍由本地 Hypit 渲染。' }
  }
  return { ...PROVIDERS.local, decision: '本地向导零模型费；成片由本地 Hypit 渲染。' }
}

export function estimateChatCost(requirement, contextChars = 1500) {
  const inputTokens = Math.round([...(requirement || '')].length * TOKENS_PER_CHAR + contextChars)
  const fee = (inputTokens * CHAT_IN_PER_MILLION + OUTPUT_TOKENS * CHAT_OUT_PER_MILLION) / 1_000_000
  return {
    inputTokens,
    outputTokens: OUTPUT_TOKENS,
    fee: Math.round(fee * 10000) / 10000,
    currency: '元',
    note: '估算基准（约）；实际费用以供应商账单为准。',
  }
}
