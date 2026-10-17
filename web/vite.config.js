import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const api = `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  build: { outDir: path.join(root, 'dist'), emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': api, '/files': api, '/vendor': api, '/download': api },
  },
});
