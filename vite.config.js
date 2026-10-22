import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { replicaApiPlugin } from './server/replica-api.js'

export default defineConfig({
  plugins: [react(), replicaApiPlugin()],
  base: '/',
  // Legacy demo variables must never expose a provider secret in a browser build.
  define: { 'import.meta.env.VITE_DEEPSEEK_API_KEY': '""' },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    watch: { ignored: ['**/server/hypit/jobs/**', '**/server/hypit/.hypit/**', '**/server/hypit/.browser-cache/**', '**/.codex-run/**'] },
    fs: { deny: ['**/.local-audio/**', '**/.backups/**', '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/server/hypit/jobs/**', '**/server/hypit/.hypit/**', '**/server/hypit/.browser-cache/**'] },
    allowedHosts: ['terminal.local', 'localhost', '127.0.0.1'],
    proxy: {
      '^/api/(interview|storyboard)(?:$|\\?)': {
        target: 'https://ci-interview-gateway.pages.dev',
        changeOrigin: true,
        headers: { origin: 'https://sunset377.github.io' },
      },
    },
  }
})
