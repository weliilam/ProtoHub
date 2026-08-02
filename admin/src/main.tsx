import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ViteErrorOverlay } from './components/ViteErrorOverlay';
import { ThemeProvider } from './theme';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <ErrorBoundary>
      <ViteErrorOverlay />
      <App />
    </ErrorBoundary>
  </ThemeProvider>,
);
