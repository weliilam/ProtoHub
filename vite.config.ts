import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { serverPlugins } from './server';

export default defineConfig({
  // custom：禁用 Vite 的 SPA html fallback，所有 HTML 由 pagesPlugin 自己伺服
  appType: 'custom',
  plugins: [react(), vue(), ...serverPlugins()],
  server: {
    port: 5173,
    strictPort: false,
    host: 'localhost',
    // 关闭 Vite 自带的红色错误浮层，由 admin/src/components/ViteErrorOverlay 提供带「复制错误信息」按钮的版本
    hmr: { overlay: false },
  },
});
