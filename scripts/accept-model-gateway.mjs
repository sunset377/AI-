import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { validateModelRequest } from '../src/model-policy.js'

export async function acceptModel(kind, { key, task, output, fetcher = fetch }) {
  if (!['chat', 'image'].includes(kind)) throw new Error('Only the authorized chat/image acceptance is supported.')
  if (existsSync(output)) return JSON.parse(readFileSync(output, 'utf8'))
  const requestId = crypto.randomUUID()
  const input = validateModelRequest(kind === 'chat'
    ? { requestId, modelId: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: '请只回答：连接成功。' }] }
    : { requestId, modelId: 'gpt-image-2-c', size: '1024x1024', prompt: '一座小巧的玻璃花园，白色背景，清晨阳光，极简建筑摄影，无文字，无人物。' })
  const body = kind === 'chat'
    ? { model: input.modelId, messages: [{ role: 'system', content: '你是刘耀华作品集的 AI 创作助手。请用中文清晰简洁地回答用户的问题。' }, ...input.messages], stream: false, max_tokens: 600 }
    : { task_id: task, request_id: requestId, input: { model_id: input.modelId, modality: 'image', params: input.params } }
  const record = { requestId, kind, modelId: input.modelId, status: 'uncertain', submittedAt: new Date().toISOString() }
  writeFileSync(output, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ submitting: kind, requestId }))
  try {
    const response = await fetcher(kind === 'chat' ? 'https://aigchub.token6688.com/v1/chat/completions' : 'https://aigchub.token6688.com/api/v1/model-runtime/cli/generations', {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'x-request-id': requestId }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000),
    })
    record.httpStatus = response.status
    record.data = await response.json()
    record.status = response.ok ? 'received' : 'rejected'
  } catch { record.status = 'uncertain' }
  writeFileSync(output, JSON.stringify(record, null, 2), { mode: 0o600 })
  return record
}

if (import.meta.main) {
  const kind = process.argv.includes('--chat') ? 'chat' : process.argv.includes('--image') || process.argv.includes('--recover-image') ? 'image' : null
  if (!kind) throw new Error('Select --chat, --image, or read-only --recover-image; no automatic paid calls.')
  const state = JSON.parse(readFileSync('.local-audio/model-gateway-credential.json', 'utf8'))
  const secrets = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'], { input: state.encrypted, encoding: 'utf8', windowsHide: true }))
  const output = path.resolve(`.local-audio/model-${kind}-acceptance.json`)
  let record
  if (process.argv.includes('--recover-image')) {
    record = JSON.parse(readFileSync(output, 'utf8'))
    const id = record.data?.generation_id || record.data?.id
    const endpoint = id ? '/generations/' + encodeURIComponent(id) : '/requests/' + record.requestId
    const response = await fetch('https://aigchub.token6688.com/api/v1/model-runtime/cli' + endpoint, { headers: { authorization: `Bearer ${secrets.RELAY_API_KEY}` }, signal: AbortSignal.timeout(30000) })
    const data = await response.json()
    if (response.ok) { record.data = data; record.httpStatus = response.status; record.status = 'received'; writeFileSync(output, JSON.stringify(record, null, 2), { mode: 0o600 }) }
    else console.log(JSON.stringify({ recoveryHttpStatus: response.status, error: data.error }))
  } else record = await acceptModel(kind, { key: secrets.RELAY_API_KEY, task: state.task, output })
  console.log(JSON.stringify({ kind, requestId: record.requestId, status: record.status, httpStatus: record.httpStatus, errorCode: record.data?.error?.code, final: record.data?.is_final, providerStatus: record.data?.status, generationId: record.data?.generation_id, resultKeys: Object.keys(record.data || {}), text: record.data?.choices?.[0]?.message?.content, receipt: output }))
}
