import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/analyze': 'http://backend:8000',
      '/health': 'http://backend:8000',
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  }
})
