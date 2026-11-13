import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The custom service worker (src/sw.ts) owns precache + navigation fallback + push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: false,
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,png,webmanifest}'],
      },
    }),
  ],
  optimizeDeps: {
    include: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
  },
  server: {
    proxy: {
      // 127.0.0.1 (an IP) so a proxied Host resolves the default tenant (see tenant.ts);
      // "localhost" carries no tenant slug and the server would 404 "Unknown company".
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
