import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { serverPlugins } from './server';

export default defineConfig({
  // custom：禁用 Vite 的 SPA html fallback，所有 HTML 由 pagesPlugin 自己伺服
  appType: 'custom',
  plugins: [react(), vue(), ...serverPlugins()],
  // 原型入口由 mount.tsx 运行时动态 import（@vite-ignore），Vite 启动扫描不到，
  // 首次访问若发现未预构建的依赖（如 dayjs）会触发「重新优化 + 整页 reload」导致白屏卡顿。
  // 这里把原型常用库提前预构建，避免运行时补构建。
  optimizeDeps: {
    include: [
      // React 引擎
      'react',
      'react-dom',
      'antd',
      '@ant-design/icons',
      'dayjs',
      // Vue 引擎
      'vue',
      'ant-design-vue',
      'element-plus',
      '@element-plus/icons-vue',
      '@ant-design/icons-vue',
    ],
  },
  server: {
    port: 5173,
    strictPort: false,
    // 监听所有网卡，使「复制链接」中自动替换的局域网 IP（如 192.168.x.x）可被本机及其他局域网设备访问
    host: true,
    // 关闭 Vite 自带的红色错误浮层，由 admin/src/components/ViteErrorOverlay 提供带「复制错误信息」按钮的版本
    hmr: { overlay: false },
  },
});
