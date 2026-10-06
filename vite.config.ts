import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps every asset path relative, so the same build works on
// GitHub Pages (served from /<repo>/), Netlify, Vercel or a plain folder.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
} as never);
