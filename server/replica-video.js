import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const pluginBase = 'minimax-h3-local/minimax-h3-official-api'

function runnerFrom(value) {
  if (!value) return ''
  const resolved = path.resolve(value)
  return resolved.toLowerCase().endsWith('.cmd') ? path.resolve(path.dirname(resolved), '..', 'runtime', 'src', 'cli.mjs') : resolved
}

function findRunner() {
  const explicit = runnerFrom(process.env.MINIMAX_H3_RUNNER || process.env.MINIMAX_H3_CLI)
  if (existsSync(explicit)) return explicit
  const bases = [
    process.env.CODEX_HOME && path.join(process.env.CODEX_HOME, 'plugins', 'cache', pluginBase),
    'E:/AppData/.codex/plugins/cache/minimax-h3-local/minimax-h3-official-api',
  ].filter(Boolean)
  for (const base of bases) {
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => b.name.localeCompare(a.name))) {
      const candidate = path.join(base, entry.name, 'runtime', 'src', 'cli.mjs')
      if (existsSync(candidate)) return candidate
    }
  }
  return ''
}

export function readVideoConfig() {
  return {
    runnerPath: findRunner(),
    credentialPath: process.env.MINIMAX_H3_CREDENTIAL_PATH || path.join(process.env.LOCALAPPDATA || '', 'MiniMaxH3Official', 'credential.dat'),
    model: process.env.MINIMAX_MODEL || 'MiniMax-H3',
  }
}

export function videoHealth(config) {
  const installed = Boolean(config?.runnerPath && existsSync(config.runnerPath))
  const configured = Boolean(config?.credentialPath && existsSync(config.credentialPath))
  return {
    ready: installed && configured,
    planningReady: installed,
    configured,
    connector: 'official-plugin',
    model: config?.model || 'MiniMax-H3',
    note: installed ? (configured ? '官方 H3 插件已安装，密钥仅由 Windows DPAPI 凭据库解密。' : '官方 H3 插件已安装，但尚未配置 DPAPI 凭据。') : '未找到 MiniMax H3 官方插件运行器。',
  }
}

export function ratioForCanvas(width, height) {
  return height > width ? '9:16' : width > height ? '16:9' : '1:1'
}

async function runH3(args, config) {
  if (config.run) return config.run(args)
  if (!config.runnerPath || !existsSync(config.runnerPath)) throw new Error('MiniMax H3 官方插件未安装。')
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [config.runnerPath, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', bytes = 0
    const collect = (target) => (chunk) => {
      bytes += chunk.length
      if (bytes > 1_000_000) { child.kill(); reject(new Error('MiniMax H3 连接器输出过大。')); return }
      if (target === 'out') stdout += chunk
      else stderr += chunk
    }
    child.stdout.on('data', collect('out'))
    child.stderr.on('data', collect('err'))
    child.on('error', reject)
    child.on('close', (code) => {
      const raw = (code === 0 ? stdout : stderr).trim().split(/\r?\n/).filter(Boolean).at(-1) || ''
      let value
      try { value = JSON.parse(raw) } catch { value = null }
      if (code === 0 && value?.ok) resolve(value)
      else reject(new Error(value?.error?.message || `MiniMax H3 连接器退出（${code ?? 'unknown'}）。`))
    })
  })
}

export async function planVideoTask({ prompt, duration, resolution = '768P', ratio, directory }, config) {
  if (!videoHealth(config).planningReady) throw new Error('MiniMax H3 官方插件未安装，无法生成费用计划。')
  const specPath = path.join(directory, 'h3-spec.json')
  const manifestPath = path.join(directory, 'h3-job.json')
  await writeFile(specPath, `${JSON.stringify({ model: config.model, prompt, duration, resolution, ratio }, null, 2)}\n`, { flag: 'wx' })
  const result = await runH3(['plan', '--spec', specPath, '--manifest', manifestPath], config)
  return { manifestPath, job: result.job }
}

export async function submitVideoTask({ manifestPath, confirmCostCny }, config) {
  if (!videoHealth(config).ready) throw new Error('MiniMax H3 官方插件未配置 DPAPI 凭据。')
  try {
    return (await runH3(['submit', '--manifest', manifestPath, '--confirm-cost-cny', String(confirmCostCny)], config)).job
  } catch (error) {
    try { error.state = JSON.parse(await readFile(manifestPath, 'utf8')).state } catch { /* no persisted provider state */ }
    throw error
  }
}

export async function resumeVideoTask({ manifestPath, outputDir }, config) {
  return (await runH3(['resume', '--manifest', manifestPath, '--output-dir', outputDir], config)).job
}
