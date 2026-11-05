import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  define: {
    'import.meta.env.VITE_API_URL': process.env.VITE_API_URL 
      ? JSON.stringify(process.env.VITE_API_URL)
      : '(typeof window !== "undefined" && window.location.origin && window.location.origin !== "null" && !window.location.origin.startsWith("file:") ? (window.location.port === "5173" ? (window.location.protocol + "//" + window.location.hostname + ":5000/api") : (window.location.origin + "/api")) : "http://localhost:5000/api")'
  }
})

