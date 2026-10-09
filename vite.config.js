import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  // Legacy demo variables must never expose a provider secret in a browser build.
  define: { 'import.meta.env.VITE_DEEPSEEK_API_KEY': '""' },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'https://ci-interview-gateway.pages.dev',
        changeOrigin: true,
        headers: { origin: 'https://sunset377.github.io' },
      },
    },
  }
})
