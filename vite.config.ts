import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // OpenCode Zen does not answer browser CORS preflights. The dev and preview
  // servers forward this one path server-side, so `npm run dev` can use the
  // free JEV model without exposing a key. A static host needs worker/jev-proxy.js.
  server: {
    proxy: {
      '/api/jev': {
        target: 'https://opencode.ai/zen/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jev/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/jev': {
        target: 'https://opencode.ai/zen/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jev/, ''),
      },
    },
  },
});
