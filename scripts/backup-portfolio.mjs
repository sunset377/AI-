import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const directory = path.join(root, '.backups', `portfolio-${stamp}`)
mkdirSync(directory, { recursive: true })
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 30_000_000, windowsHide: true })
const head = git(['rev-parse', 'HEAD']).trim()
const beforeWorkbench = git(['rev-parse', '3c6c907^{commit}']).trim()
const bundle = path.join(directory, 'repository.bundle')
git(['bundle', 'create', bundle, '--all'])
git(['bundle', 'verify', bundle])
const sourceExtensions = /\.(?:jsx?|tsx?|mjs|cjs|py|ps1|cmd|bat|sh|md|jsonc?|toml|ya?ml|css|scss|html?|sql|xml|vue|svelte|lock|ini|cfg|conf)$/i
const files = [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0'))]
  .filter(file => file && (sourceExtensions.test(file) || /(?:^|\/)(?:Dockerfile|Makefile|LICENSE|\.gitignore|\.env\.example)$/.test(file)))
  .filter(file => !file.split(/[\\/]/).some(part => ['node_modules', '.git', '.venv', 'venv', '__pycache__', '.codex-run', 'dist'].includes(part)))
const sourceHashes = {}
for (const file of files) {
  const target = path.join(directory, 'working-source', file)
  mkdirSync(path.dirname(target), { recursive: true })
  copyFileSync(path.join(root, file), target)
  const original = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
  if (createHash('sha256').update(readFileSync(target)).digest('hex') !== original) throw new Error('Source copy verification failed.')
  sourceHashes[file] = original
}
const hashes = {}
for (const file of [bundle]) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  hashes[path.basename(file)] = hash.digest('hex')
}
const receipt = { createdAt: new Date().toISOString(), head, beforeWorkbench, sources: files.length, hashes,
  scope: 'Complete reachable Git history plus tracked/untracked source and documentation. Dependencies, caches, generated media and ignored secrets are not duplicated; originals stay in place.',
  restore: ['Clone repository.bundle into a new folder.', 'Select the saved beforeWorkbench commit to review the pre-workbench version.', 'Use working-source/ in a separate folder to recover the exact source snapshot. Do not copy over live work.'],
}
writeFileSync(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2))
writeFileSync(path.join(directory, 'source-inventory.json'), JSON.stringify(files, null, 2))
writeFileSync(path.join(directory, 'source-sha256.json'), JSON.stringify(sourceHashes, null, 2))
console.log(JSON.stringify({ directory, ...receipt }))
