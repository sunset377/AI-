import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODEL_POLICY } from '../src/model-policy.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const statePath = path.join(root, '.local-audio', 'model-gateway-credential.json')
const cli = process.env.TOKENGO_CLI || 'tokengo'
const site = 'https://aigchub.token6688.com'
const task = process.env.RELAY_SETUP_TASK_ID
const protect = (input, decrypt = false) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', decrypt
  ? 'Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'
  : 'Add-Type -AssemblyName System.Security; $bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'], { input, encoding: 'utf8', windowsHide: true }).trim()
const findSecret = value => {
  if (!value || typeof value !== 'object') return ''
  for (const [key, item] of Object.entries(value)) if (/^(secret|api_key|key_secret|token|key)$/.test(key) && typeof item === 'string' && item.length > 40) return item
  for (const item of Object.values(value)) { const found = findSecret(item); if (found) return found }
  return ''
}

let state, secrets
if (existsSync(statePath)) {
  state = JSON.parse(readFileSync(statePath, 'utf8'))
  secrets = JSON.parse(protect(state.encrypted, true))
} else {
  if (!task) throw new Error('Set RELAY_SETUP_TASK_ID to a dedicated TokenGo account task before creating a key.')
  if (protect(protect('preflight'), true) !== 'preflight') throw new Error('Windows credential protection is unavailable.')
  const input = { name: 'Portfolio guest workbench', permissions: ['chat', 'image', 'models', 'tasks'], allowed_models: Object.keys(MODEL_POLICY), total_quota: 100000, rate_limit: 4 }
  const response = spawnSync(cli, ['key', 'create', '--site', site, '--task', task, '--input', '-'], { input: JSON.stringify(input), encoding: 'utf8', windowsHide: true })
  let data
  try { data = JSON.parse(response.stdout) } catch { throw new Error('Key creation did not return JSON; inspect account key metadata before retrying.') }
  const secret = findSecret(data)
  if (!secret) { console.error(JSON.stringify({ error: data.error || 'No secret returned', fields: Object.keys(data) })); process.exit(1) }
  secrets = { RELAY_API_KEY: secret, SESSION_SECRET: randomBytes(48).toString('base64url'), INVITE_TOKEN: randomBytes(24).toString('base64url') }
  state = { task, keyId: data.key?.id || data.id || data.api_key?.id, encrypted: protect(JSON.stringify(secrets)) }
  mkdirSync(path.dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' })
}
if (process.argv.includes('--open-chat-images')) {
  if (!state.keyId) throw new Error('The dedicated portfolio key ID is missing; do not create a replacement key automatically.')
  const response = spawnSync(cli, ['key', 'update', '--site', site, '--key', state.keyId, '--input', '-'], {
    input: JSON.stringify({ permissions: ['chat', 'image', 'models', 'tasks'], allowed_models: Object.keys(MODEL_POLICY), total_quota: 100000, rate_limit: 4 }), encoding: 'utf8', windowsHide: true,
  })
  let data
  try { data = JSON.parse(response.stdout) } catch { throw new Error('Key update was not confirmed; query its metadata before retrying.') }
  if (response.status !== 0 || data.error) { console.error(JSON.stringify({ error: data.error?.code || 'key_update_unconfirmed' })); process.exit(1) }
  console.log(JSON.stringify({ keyUpdated: true, allowedModelCount: Object.keys(MODEL_POLICY).length, quotaMicroUsd: 100000, video: false, audio: false }))
}
if (process.argv.includes('--install')) {
  const result = spawnSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'), 'secret', 'bulk', '--config', 'wrangler.models.jsonc'], { cwd: root, input: JSON.stringify(secrets), encoding: 'utf8', windowsHide: true })
  console.log(result.stdout)
  if (result.status) { console.error('Secret installation failed; the credential remains encrypted locally.'); process.exit(1) }
}
if (process.argv.includes('--check')) {
  const response = await fetch(site + '/v1/models', { headers: { authorization: `Bearer ${secrets.RELAY_API_KEY}` }, signal: AbortSignal.timeout(20000) })
  const data = await response.json()
  console.log(JSON.stringify({ upstreamStatus: response.status, availableModels: data.data?.map(item => item.id), errorCode: data.error?.code }))
}
if (process.argv.includes('--invite')) console.log(`https://sunset377.github.io/AI-/?view=studio#experience=${secrets.INVITE_TOKEN}`)
console.log(JSON.stringify({ keyId: state.keyId, encryptedCredential: statePath, quotaMicroUsd: 100000, permissions: ['chat', 'image', 'models', 'tasks'] }))
