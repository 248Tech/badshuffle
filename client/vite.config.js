import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getServerPort() {
  if (process.env.PORT) return Number(process.env.PORT);
  try {
    const lock = JSON.parse(readFileSync(resolve(__dirname, '../badshuffle.lock'), 'utf8'));
    if (lock.port) return lock.port;
  } catch {}
  return 3001;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${getServerPort()}`,
        changeOrigin: true
      }
    }
  }
});
