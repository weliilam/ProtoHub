import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendError, getPathname } from './utils';

/** 读取原型目录下的 proto.config.json，决定渲染引擎与组件库 */
function readProtoConfig(dir: string): { engine?: string; ui?: string } {
  const p = path.join(dir, 'proto.config.json');
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
  }
  return {};
}

function resolveEntry(pathname: string): { name: string; entry: string; engine: string; ui: string } | null {
  const decoded = decodeURIComponent(pathname);
  // /p/demo-dashboard → src/prototypes/demo-dashboard/
  const protoMatch = decoded.match(/^\/p\/([\w一-龥-]+)\/?$/);
  if (protoMatch) {
    const name = protoMatch[1];
    const dir = path.join(projectRoot, 'src/prototypes', name);
    const cfg = readProtoConfig(dir);
    const engine = cfg.engine || 'react';
    const ui = cfg.ui || 'element-plus';
    const file = engine === 'vue' ? 'index.vue' : 'index.tsx';
    const entry = path.join(dir, file);
    if (fs.existsSync(entry)) return { name, entry: `/src/prototypes/${name}/${file}`, engine, ui };
    // Vue 引擎但缺 index.vue 时回退 index.tsx
    if (engine === 'vue') {
      const fallback = path.join(dir, 'index.tsx');
      if (fs.existsSync(fallback)) return { name, entry: `/src/prototypes/${name}/index.tsx`, engine, ui };
    }
    return null;
  }
  // /p/components/demo-button → src/components/demo-button/index.tsx
  const compMatch = decoded.match(/^\/p\/components\/([\w一-龥-]+)\/?$/);
  if (compMatch) {
    const name = compMatch[1];
    const entry = path.join(projectRoot, 'src/components', name, 'index.tsx');
    if (fs.existsSync(entry)) return { name, entry: `/src/components/${name}/index.tsx`, engine: 'react', ui: 'element-plus' };
    return null;
  }
  return null;
}

function buildVirtualHtml(name: string, entry: string, engine: string, ui: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} - Proto Hub</title>
  <style>html,body,#root{margin:0;padding:0;min-height:100vh;background:#f5f5f5;}</style>
</head>
<body>
  <div id="root"></div>
  <script>window.__ENTRY__ = ${JSON.stringify(entry)}; window.__ENGINE__ = ${JSON.stringify(engine)}; window.__UI__ = ${JSON.stringify(ui)};</script>
  <script type="module" src="/admin/src/mount.tsx"></script>
</body>
</html>`;
}

export function pagesPlugin(): Plugin {
  return {
    name: 'proto-hub-pages',
    configureServer(server) {
      // return 函数形式：注册在 Vite 内部中间件之后，让 /src/*、/@vite/* 等先被处理
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const pathname = getPathname(req);
          try {
            // 首页 → 管理台
            if (pathname === '/' || pathname === '/index.html') {
              const adminHtml = path.join(projectRoot, 'admin/index.html');
              if (!fs.existsSync(adminHtml)) return sendError(res, 'admin/index.html 不存在', 404);
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
              const html = await server.transformIndexHtml('/admin/index.html', fs.readFileSync(adminHtml, 'utf8'));
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }

            // 原型/组件预览页（虚拟 HTML，引擎由 proto.config.json 决定）
            const resolved = resolveEntry(pathname);
            if (resolved) {
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
              const html = await server.transformIndexHtml(pathname, buildVirtualHtml(resolved.name, resolved.entry + '?t=' + Date.now(), resolved.engine, resolved.ui));
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }

            next();
          } catch (e: any) {
            next(e);
          }
        });
      };
    },
  };
}
