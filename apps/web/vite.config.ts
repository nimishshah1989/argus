import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 127.0.0.1 (an IP) so a proxied Host resolves the default tenant (see tenant.ts);
      // "localhost" carries no tenant slug and the server would 404 "Unknown company".
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
