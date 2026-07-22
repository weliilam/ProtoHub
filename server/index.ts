import type { Plugin } from 'vite';
import { entriesApiPlugin } from './entriesApi';
import { docsApiPlugin } from './docsApi';
import { themesApiPlugin } from './themesApi';
import { dataApiPlugin } from './dataApi';
import { gitApiPlugin } from './gitApi';
import { aiCliApiPlugin } from './aiCliApi';
import { annotationApiPlugin } from './annotationApi';
import { prdApiPlugin } from './prdApi';
import { prototypeInfoPlugin } from './prototypeInfoApi';
import { pagesPlugin } from './pagesPlugin';
import { comparePlugin } from './comparePlugin';

export function serverPlugins(): Plugin[] {
  return [
    entriesApiPlugin(),
    docsApiPlugin(),
    themesApiPlugin(),
    dataApiPlugin(),
    gitApiPlugin(),
    comparePlugin(),
    aiCliApiPlugin(),
    annotationApiPlugin(),
    prdApiPlugin(),
    prototypeInfoPlugin(),
    pagesPlugin(), // 页面路由放最后（兜底 next）
  ];
}
