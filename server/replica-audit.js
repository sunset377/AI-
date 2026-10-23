// Call audit log for the replica workbench.
//
// Every external model call (chat, render, voice preview, memory write) is
// recorded with provider, estimated cost and a short summary, kept in memory and
// persisted as JSONL. The log is scoped to the execution service directory so it
// is never committed to the portfolio repository.

import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_ENTRIES = 300

export function createAuditLog({ directory }) {
  const file = path.join(directory, 'audit.jsonl')
  let entries = []
  let pending = Promise.resolve()
  let bootstrapping

  async function bootstrap() {
    if (!bootstrapping) bootstrapping = (async () => {
      try {
        await mkdir(directory, { recursive: true })
        const lines = (await readFile(file, 'utf8').catch(() => '')).split('\n').filter(Boolean)
        for (const line of lines.slice(-MAX_ENTRIES)) {
          try { entries.push(JSON.parse(line)) } catch { /* skip a corrupt line */ }
        }
      } catch { /* audit must never break the workbench */ }
    })()
    return bootstrapping
  }

  async function append(entry) {
    await bootstrap()
    const record = { id: randomUUID(), at: new Date().toISOString(), ...entry }
    entries.push(record)
    if (entries.length > MAX_ENTRIES) entries.shift()
    const json = `${JSON.stringify(record)}\n`
    pending = pending.then(async () => { try { await appendFile(file, json, 'utf8') } catch { /* non-fatal */ } }).catch(() => {})
    await pending
    return record
  }

  async function list({ limit = 100 } = {}) {
    await bootstrap()
    return [...entries].reverse().slice(0, Math.min(Math.max(1, limit), MAX_ENTRIES))
  }

  return { append, list }
}
