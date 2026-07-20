import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, isValidName } from './utils';

const docsDir = () => path.join(projectRoot, 'src/docs');

export function docsApiPlugin(): Plugin {
  return {
    name: 'proto-hub-docs-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        const match = pathname.match(/^\/api\/docs(?:\/([^/]+))?$/);
        if (!match) return next();

        const name = match[1] ? decodeURIComponent(match[1]) : null;
        try {
          // 列表
          if (!name && req.method === 'GET') {
            if (!fs.existsSync(docsDir())) return sendJson(res, { success: true, data: [] });
            const files = fs.readdirSync(docsDir()).filter((f) => f.endsWith('.md'));
            return sendJson(res, { success: true, data: files.map((f) => f.replace(/\.md$/, '')) });
          }

          if (!name || !isValidName(name)) return sendError(res, '文档名不合法');

          const filePath = path.join(docsDir(), `${name}.md`);
          if (!filePath.startsWith(docsDir())) return sendError(res, '路径非法', 403);

          if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) return sendError(res, '文档不存在', 404);
            return sendJson(res, { success: true, data: { name, content: fs.readFileSync(filePath, 'utf8') } });
          }

          if (req.method === 'POST' || req.method === 'PUT') {
            const body = await readJsonBody<{ content?: string }>(req);
            fs.mkdirSync(docsDir(), { recursive: true });
            fs.writeFileSync(filePath, body.content ?? '', 'utf8');
            return sendJson(res, { success: true });
          }

          if (req.method === 'DELETE') {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return sendJson(res, { success: true });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '文档操作失败', 500);
        }
      });
    },
  };
}
