import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { ViteErrorOverlay } from './components/ViteErrorOverlay';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
    <AntdApp>
      <ViteErrorOverlay />
      <App />
    </AntdApp>
  </ConfigProvider>,
);
