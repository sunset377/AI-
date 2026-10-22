import http from 'node:http'
import { createReadStream, realpathSync } from 'node:fs'
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { createReplicaApi } from './replica-api.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const interviewGateway = 'https://ci-interview-gateway.pages.dev'
export async function startPortfolio({ port = Number(process.env.PORTFOLIO_DEMO_PORT || 5175), host = '127.0.0.1' } = {}) {
  const api = await createReplicaApi()
  const dist = path.join(root, 'dist')
  const quotaPath = path.join(root, '.local-audio', 'online-quota.json')
  await mkdir(path.dirname(quotaPath), { recursive: true })
  let quota = await readFile(quotaPath, 'utf8').then(JSON.parse).catch(() => ({ day: '', count: 0 }))
  let queue = Promise.resolve()
  const reserve = () => {
    const result = queue.then(async () => {
      const day = new Date().toISOString().slice(0, 10)
      if (quota.day !== day) quota = { day, count: 0 }
      // shortcut: global daily submission count, use per-visitor budgets before wider release.
      if (quota.count >= 20) return false
      quota.count++
      await writeFile(quotaPath, JSON.stringify(quota))
      return true
    })
    queue = result.catch(() => {})
    return result
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/api/interview' || url.pathname === '/api/storyboard') {
        const upstream = await fetch(interviewGateway + url.pathname, {
          method: req.method,
          headers: {
            ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
            origin: 'https://sunset377.github.io',
          },
          ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req, duplex: 'half' }),
          signal: AbortSignal.timeout(50_000),
        })
        const headers = Object.fromEntries(['content-type', 'cache-control', 'x-content-type-options']
          .map(name => [name, upstream.headers.get(name)]).filter(([, value]) => value))
        res.writeHead(upstream.status, headers)
        if (req.method === 'HEAD' || !upstream.body) return res.end()
        return Readable.fromWeb(upstream.body).pipe(res)
      }
      if (url.pathname.startsWith('/api/replica/')) {
        if (req.method === 'POST' && /\/(messages|video-submit|voice|narrations|jobs)$/.test(url.pathname) && !(await reserve())) {
          res.writeHead(429, { 'content-type': 'application/json; charset=utf-8' }); return res.end(JSON.stringify({ error: '今日体验额度已用完，请联系作品集作者。' }))
        }
        return await api(req, res, () => { res.writeHead(404); res.end() })
      }
      if (!['GET', 'HEAD'].includes(req.method) || url.pathname.startsWith('/api/')) { res.writeHead(404); return res.end() }
      let relative = decodeURIComponent(url.pathname).replace(/^\/AI-(?:\/|$)/, '/').replace(/^\/+/, '')
      if (!relative) relative = 'index.html'
      let file = path.resolve(dist, relative)
      if (!file.startsWith(dist + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.'))) { res.writeHead(404); return res.end() }
      let info = await stat(file).catch(() => null)
      if (!info?.isFile()) {
        if (path.extname(relative)) { res.writeHead(404); return res.end() }
        file = path.join(dist, 'index.html'); info = await stat(file)
      }
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'content-length': info.size, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' })
      if (req.method === 'HEAD') return res.end()
      const stream = createReadStream(file); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res)
    } catch { if (!res.headersSent) res.writeHead(503); res.end('Service unavailable') }
  })
  server.listen(port, host, () => console.log(`Public portfolio: http://${host}:${port}/?view=replica`))
  return server
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) await startPortfolio()
