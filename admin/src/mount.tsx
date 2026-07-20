import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    __ENTRY__?: string;
  }
}

async function bootstrap() {
  const container = document.getElementById('root');
  if (!container || !window.__ENTRY__) return;
  try {
    const mod = await import(/* @vite-ignore */ window.__ENTRY__);
    const App = mod.default;
    if (!App) throw new Error(`${window.__ENTRY__} 缺少默认导出组件`);
    createRoot(container).render(createElement(App));
  } catch (e: any) {
    container.innerHTML = `<pre style="padding:24px;color:#cf1322;white-space:pre-wrap;">原型加载失败：${e?.message || e}</pre>`;
  }
}

bootstrap();
