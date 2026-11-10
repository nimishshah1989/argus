import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Vite only for the e2e run. It mirrors apps/web/vite.config.ts but points the /api proxy at
 * 127.0.0.1 instead of localhost: the server resolves the tenant from the Host header, and
 * Vite's string-proxy shorthand uses `changeOrigin: true`, which rewrites Host to the target.
 * Target "localhost:3001" therefore yields a bare `localhost` host with no tenant slug and
 * every sign-in 404s; "127.0.0.1:3001" maps to DEFAULT_TENANT_SLUG (cosmos) in tenant.ts.
 */
const API_TARGET = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
});
