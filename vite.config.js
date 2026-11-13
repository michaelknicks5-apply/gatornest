import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' so the build works at any path (GitHub Pages serves it under /<repo>/).
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1600 },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
