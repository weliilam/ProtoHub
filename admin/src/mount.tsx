import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ViteErrorOverlay } from './components/ViteErrorOverlay';

declare global {
  interface Window {
    __ENTRY__?: string;
    __ENGINE__?: string;
    __UI__?: string;
  }
}

// ── Vue 引擎：让不同原型使用 Vue 组件库（Element Plus / yt-design-vue 等） ──
// 运行时按 proto.config.json 声明的 ui 动态注入全局组件，互不干扰、不污染 React 原型。
async function mountVue(container: HTMLElement, entry: string) {
  try {
    const { createApp } = await import('vue');
    const ui = window.__UI__ || 'ant-design-vue';
    const App = (await import(/* @vite-ignore */ entry)).default;
    const app = createApp(App);

    try {
      if (ui === 'ant-design-vue') {
        const ant = await import('ant-design-vue');
        await import('ant-design-vue/dist/reset.css');
        app.use(ant.default);
      } else if (ui === 'yt-design-vue') {
        const ytPkg = '@yt-design-vue/components';
        const yt = await import(/* @vite-ignore */ ytPkg);
        await import(/* @vite-ignore */ `${ytPkg}/dist/index.css`);
        app.use(yt.default);
      } else {
        const ep = await import('element-plus');
        await import('element-plus/dist/index.css');
        app.use(ep.default);
      }
    } catch (e) {
      // 私有库/其它库装不上时回退到公开的 Ant Design Vue（与真实系统一致）
      const ant = await import('ant-design-vue');
      await import('ant-design-vue/dist/reset.css');
      app.use(ant.default);
      console.warn('[hatch] UI 库加载失败，已回退 Ant Design Vue：', e);
    }

    app.mount(container);
  } catch (e: any) {
    container.innerHTML = `<pre style="color:var(--ph-anno-warn-color);padding:16px;white-space:pre-wrap">Vue 原型加载失败：${e?.message || e}</pre>`;
  }
}

async function bootstrap() {
  const container = document.getElementById('root');
  if (!container || !window.__ENTRY__) return;

  // Vue 引擎走独立挂载，不与 antd 的 React 上下文耦合
  if (window.__ENGINE__ === 'vue') {
    await mountVue(container, window.__ENTRY__);
    return;
  }

  // ---------- React 引擎（默认） ----------
  // 同一个 container 只能 createRoot 一次，后续用 root.render 更新，避免重复挂载警告
  const root = createRoot(container);
  // 先把错误浮层挂上，确保原型加载失败时也有「复制错误信息」按钮可用
  root.render(
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

    // ── client 模式（WinForms 客户端视觉）：proto.config.json 声明 "ui": "client" ──
    // 用 ClientShell（.client-theme 命名空间）包裹原型，注入客户端主题 CSS。
    // 未声明 client 的原型完全不受影响。
    if (window.__UI__ === 'client') {
      const { ClientShell } = await import('./components/client');
      root.render(
        <ConfigProvider locale={zhCN}>
          <AntdApp>
            <ViteErrorOverlay />
            <div className="client-theme" style={{ height: '100vh', overflow: 'hidden' }}>
              <ClientShell>
                <App />
              </ClientShell>
            </div>
          </AntdApp>
        </ConfigProvider>,
      );
      return;
    }

    // 原型加载成功：把 root 重新交给原型组件（替换浮层）
    root.render(
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
