import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The review entry does not initialize local video executors or alter the production build.
export default defineConfig({
  plugins: [react()],
  base: '/AI-/',
  cacheDir: 'node_modules/.vite-recruitment-preview',
  define: { 'import.meta.env.VITE_DEEPSEEK_API_KEY': '""' },
  server: {
    host: '127.0.0.1', port: 5187, strictPort: true, hmr: false,
    watch: null,
    fs: { deny: ['**/.local-audio/**', '**/.backups/**', '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/server/hypit/jobs/**'] },
  },
  build: {
    outDir: '.codex-run/recruitment-preview-v1',
    copyPublicDir: false,
    emptyOutDir: false,
    rollupOptions: { input: 'recruitment-preview.html' },
  },
})
