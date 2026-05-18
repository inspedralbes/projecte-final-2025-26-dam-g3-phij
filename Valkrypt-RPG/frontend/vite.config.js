import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const devProxyTarget = 'http://127.0.0.1:3000'
const devWsProxyTarget = 'ws://127.0.0.1:3000'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: devWsProxyTarget,
        ws: true,
        changeOrigin: true
      }
    }
  }
})
