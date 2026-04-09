import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

/** HMR で更新されたファイルをコンソールに表示するプラグイン */
function hmrLogger(): Plugin {
  return {
    name: 'hmr-logger',
    handleHotUpdate({ file, timestamp }) {
      const relative = path.relative(process.cwd(), file)
      const time = new Date(timestamp).toLocaleTimeString()
      console.log(`\x1b[36m[hmr]\x1b[0m ${time} \x1b[33m${relative}\x1b[0m`)
    },
  }
}

const frontendPort = Number(process.env.ARS_FRONTEND_PORT) || 5174
const backendUrl = process.env.ARS_BACKEND_URL || 'http://localhost:5173'
const backendWs = backendUrl.replace(/^http/, 'ws')
const extraHosts = process.env.VITE_ALLOWED_HOSTS?.split(',').filter(Boolean) || []

export default defineConfig({
  plugins: [react(), tailwindcss(), hmrLogger()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: frontendPort,
    strictPort: true,
    allowedHosts: [...extraHosts],
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/auth': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: backendWs,
        ws: true,
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari14'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
