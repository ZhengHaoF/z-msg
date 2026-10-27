import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const serverOrigin = env.VITE_SERVER_ORIGIN || 'http://127.0.0.1:8081'

  return {
    plugins: [vue()],
    base: './',
    server: {
      port: 5173,
      proxy: {
        '/ws': {
          target: serverOrigin,
          ws: true,
        },
        '/healthz': {
          target: serverOrigin,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
