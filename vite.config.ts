import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { serverPlugins } from './server';

export default defineConfig({
  // custom：禁用 Vite 的 SPA html fallback，所有 HTML 由 pagesPlugin 自己伺服
  appType: 'custom',
  plugins: [react(), ...serverPlugins()],
  server: {
    port: 5173,
    strictPort: false,
    host: 'localhost',
  },
});
