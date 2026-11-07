import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  root: __dirname,
  publicDir: path.resolve(__dirname, '../public'),
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // The API restarts on every server-side save (tsx --watch). For that
        // second it is unreachable and the proxy would answer an empty 500,
        // which the client could only report as a generic failure. Say what
        // is going on instead, in the shape the client reads. Registered
        // before Vite's own listener, which then sees the answer already sent.
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if (!('writeHead' in response) || response.headersSent) return;
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ errors: ['API en cours de redémarrage, réessaie dans un instant'] }));
          });
        },
      },
    },
  },
})
