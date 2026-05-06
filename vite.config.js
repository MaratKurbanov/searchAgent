import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      {
        name: 'config-js',
        configureServer(server) {
          server.middlewares.use('/config.js', (req, res) => {
            const apiUrl = env.VITE_API_URL || ''
            const siteName = env.VITE_SITE_NAME || ''
            res.setHeader('Content-Type', 'application/javascript')
            res.end(`window.API_URL=${JSON.stringify(apiUrl)};window.SITE_NAME=${JSON.stringify(siteName)};`)
          })
        },
      },
    ],
    publicDir: 'static',
    build: {
      outDir: 'public',
      emptyOutDir: true,
    },
  }
})
