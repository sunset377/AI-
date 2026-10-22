import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const cli = process.env.TOKENGO_CLI || 'tokengo'
const read = (args) => JSON.parse(execFileSync(cli, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8_000_000 }))
const catalogs = [
  ['chat', read(['agent', 'model', 'list', '--agent', 'codex']).models],
  ...['image', 'video', 'audio'].map(type => [type, read(['model', 'list', '--agent', 'codex', '--type', type]).models]),
]
const models = catalogs.flatMap(([type, items]) => (items || []).map(item => ({
  id: item.id, publicId: item.public_id || item.id, type,
  name: item.display_name_zh || item.display_name || item.id,
  description: item.description_zh || item.description || '',
  provider: item.provider || 'AIGC Hub', available: item.available !== false,
})))
writeFileSync(new URL('../src/model-catalog.json', import.meta.url), JSON.stringify({ source: 'AIGC Hub / TokenGo', syncedAt: new Date().toISOString(), models }, null, 2) + '\n')
console.log(JSON.stringify({ models: models.length, categories: Object.fromEntries(catalogs.map(([type, items]) => [type, items?.length || 0])) }))
