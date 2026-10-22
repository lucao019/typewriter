import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/tools/**'],
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
});
