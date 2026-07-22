import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ViteErrorOverlay } from './components/ViteErrorOverlay';

declare global {
  interface Window {
    __ENTRY__?: string;
  }
}

async function bootstrap() {
  const container = document.getElementById('root');
  if (!container || !window.__ENTRY__) return;
  // 先把错误浮层挂上，确保原型加载失败时也有「复制错误信息」按钮可用
  createRoot(container).render(
    <ConfigProvider locale={zhCN}>
      <AntdApp>
        <ViteErrorOverlay />
      </AntdApp>
    </ConfigProvider>,
  );
  try {
    const mod = await import(/* @vite-ignore */ window.__ENTRY__);
    const App = mod.default;
    if (!App) throw new Error(`${window.__ENTRY__} 缺少默认导出组件`);
    // 原型加载成功：把 root 重新交给原型组件（替换浮层）
    createRoot(container).render(
      <ConfigProvider locale={zhCN}>
        <AntdApp>
          <ViteErrorOverlay />
          <App />
        </AntdApp>
      </ConfigProvider>,
    );
  } catch (e: any) {
    // 主动触发一次运行时错误，让 ViteErrorOverlay 捕获并显示复制按钮
    setTimeout(() => {
      throw new Error(`原型加载失败：${e?.message || e}`);
    }, 0);
  }
}

bootstrap();
