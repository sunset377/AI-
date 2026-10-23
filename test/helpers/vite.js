import { createServer } from 'vite'
import react from '@vitejs/plugin-react'

// SSR presentation checks must not start video executors or watch private artifact folders.
export const createSsrServer = (options = {}) => createServer({
  ...options, configFile: false, plugins: [react()], appType: 'custom',
  server: { ...options.server, middlewareMode: true, watch: null, hmr: false },
  optimizeDeps: { noDiscovery: true, include: [] },
})
