import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const file = '.local-audio/model-paid-acceptance.json'
const base = 'https://portfolio-model-gateway.980175020.workers.dev'
const origin = 'https://sunset377.github.io'
const protect = (input, decrypt = false) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', decrypt
  ? 'Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'
  : 'Add-Type -AssemblyName System.Security; $b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'], { input, encoding: 'utf8', windowsHide: true }).trim()
const account = args => JSON.parse(execFileSync('tokengo', ['account', ...args, '--agent', 'codex'], { encoding: 'utf8', windowsHide: true }))
const credential = JSON.parse(readFileSync('.local-audio/model-gateway-credential.json', 'utf8'))
const secrets = JSON.parse(protect(credential.encrypted, true))
let record
if (process.argv.includes('--submit')) {
  if (existsSync(file)) throw new Error('An acceptance record already exists. Use --resume; do not submit again.')
  const response = await fetch(base + '/api/sessions', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ code: secrets.INVITE_TOKEN }) })
  const session = await response.json()
  if (!response.ok || !session.token) throw new Error('Cannot authorize acceptance session.')
  record = { startedAt: new Date().toISOString(), before: account(['balance']), session: protect(session.token), requests: [
    { path: '/api/chat', body: { requestId: randomUUID(), modelId: 'deepseek-v4.1-flash', messages: [{ role: 'user', content: '请只用一句中文说明：模型聚合工作台有什么用途？' }] } },
    { path: '/api/images', body: { requestId: randomUUID(), modelId: 'gpt-image-2-c', prompt: 'A single small yellow flower in a clear glass vase, plain white background, soft daylight, minimalist still-life photograph, no text, no logo.', size: '1024x1024' } },
  ] }
  writeFileSync(file, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 })
} else if (process.argv.includes('--resume')) record = JSON.parse(readFileSync(file, 'utf8'))
else throw new Error('Explicit --submit or --resume required. --submit is only for the two user-authorized acceptance calls.')
const token = protect(record.session, true)
for (const item of record.requests) {
  if (item.result) continue
  const submit = process.argv.includes('--submit') && !item.submissionStartedAt
  if (submit) { item.submissionStartedAt = new Date().toISOString(); writeFileSync(file, JSON.stringify(record, null, 2)) }
  try {
    const response = await fetch(base + (submit ? item.path : '/api/jobs/' + item.body.requestId), {
      method: submit ? 'POST' : 'GET', headers: { origin, authorization: `Bearer ${token}`, ...(submit ? { 'content-type': 'application/json' } : {}) },
      ...(submit ? { body: JSON.stringify(item.body) } : {}), signal: AbortSignal.timeout(230000),
    })
    item.httpStatus = response.status
    item.result = await response.json()
  } catch (error) { item.observationError = error.name; console.log(JSON.stringify({ id: item.body.requestId, observation: 'uncertain; only resume this request' })) }
  writeFileSync(file, JSON.stringify(record, null, 2))
  console.log(JSON.stringify({ id: item.body.requestId, model: item.body.modelId, status: item.result?.status, httpStatus: item.httpStatus, hasText: Boolean(item.result?.text), hasImage: Boolean(item.result?.imageUrl), error: item.result?.error }))
}
record.after = account(['balance'])
record.billing = account(['calls', '--key', credential.keyId, '--size', '5'])
record.checkedAt = new Date().toISOString()
writeFileSync(file, JSON.stringify(record, null, 2))
console.log(JSON.stringify({ receipt: file, before: record.before, after: record.after, billing: record.billing }))
