import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendError, getPathname } from './utils';

function resolveEntry(pathname: string): { name: string; entry: string } | null {
  // /p/demo-dashboard → src/prototypes/demo-dashboard/index.tsx
  const protoMatch = pathname.match(/^\/p\/([\w一-龥-]+)\/?$/);
  if (protoMatch) {
    const name = protoMatch[1];
    const entry = path.join(projectRoot, 'src/prototypes', name, 'index.tsx');
    if (fs.existsSync(entry)) return { name, entry: `/src/prototypes/${name}/index.tsx` };
    return null;
  }
  // /p/components/demo-button → src/components/demo-button/index.tsx
  const compMatch = pathname.match(/^\/p\/components\/([\w一-龥-]+)\/?$/);
  if (compMatch) {
    const name = compMatch[1];
    const entry = path.join(projectRoot, 'src/components', name, 'index.tsx');
    if (fs.existsSync(entry)) return { name, entry: `/src/components/${name}/index.tsx` };
    return null;
  }
  return null;
}

function buildVirtualHtml(name: string, entry: string): string {
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
  <script>window.__ENTRY__ = ${JSON.stringify(entry)};</script>
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
              const html = await server.transformIndexHtml('/admin/index.html', fs.readFileSync(adminHtml, 'utf8'));
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
              return;
            }

            // 原型/组件预览页（虚拟 HTML）
            const resolved = resolveEntry(pathname);
            if (resolved) {
              const html = await server.transformIndexHtml(pathname, buildVirtualHtml(resolved.name, resolved.entry));
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
