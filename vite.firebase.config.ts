import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@/lib/platform-context',
        replacement: path.resolve(root, 'lib/platform-context.firebase.tsx'),
      },
      { find: '@', replacement: root },
    ],
  },
  build: {
    outDir: 'firebase-dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
