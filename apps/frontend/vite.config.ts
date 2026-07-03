import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Relative base so the packaged app can load from the filesystem.
  base: './',
  server: {
    // Explicit IPv4 so wait-on and Electron always find the dev server.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
