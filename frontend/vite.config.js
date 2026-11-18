import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  define: {
    'import.meta.env.VITE_API_URL': '(typeof window !== "undefined" && window.location.origin && window.location.origin !== "null" && !window.location.origin.startsWith("file:") ? (window.location.port === "5173" ? (window.location.protocol + "//" + window.location.hostname + ":5000/api") : "/api") : "http://localhost:5000/api")'
  }
})
