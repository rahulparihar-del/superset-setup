import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
  port: 5180,
  strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/superset-api': {
        target: 'https://superset.lockated.com',
        changeOrigin: true,
        secure: true,
        // Map /superset-api/* -> /* at the target (root). Useful if Superset API is served at /api.
        rewrite: (path) => path.replace(/^\/superset-api/, ''),
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
        xfwd: true,
        headers: {
          // Align Origin/Referer with upstream host to satisfy CSRF/referrer checks
          Origin: 'https://superset.lockated.com',
          Referer: 'https://superset.lockated.com/superset',
        },
      },
    },
  },
})
