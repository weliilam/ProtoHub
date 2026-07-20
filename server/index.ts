import type { Plugin } from 'vite';
import { entriesApiPlugin } from './entriesApi';
import { docsApiPlugin } from './docsApi';
import { themesApiPlugin } from './themesApi';
import { dataApiPlugin } from './dataApi';
import { gitApiPlugin } from './gitApi';
import { aiCliApiPlugin } from './aiCliApi';
import { annotationApiPlugin } from './annotationApi';
import { pagesPlugin } from './pagesPlugin';

export function serverPlugins(): Plugin[] {
  return [
    entriesApiPlugin(),
    docsApiPlugin(),
    themesApiPlugin(),
    dataApiPlugin(),
    gitApiPlugin(),
    aiCliApiPlugin(),
    annotationApiPlugin(),
    pagesPlugin(), // 页面路由放最后（兜底 next）
  ];
}
