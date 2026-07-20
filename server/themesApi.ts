import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, isValidName, readJsonFile, writeJsonFile } from './utils';

const themesDir = () => path.join(projectRoot, 'src/themes');

export function themesApiPlugin(): Plugin {
  return {
    name: 'proto-hub-themes-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        const match = pathname.match(/^\/api\/themes(?:\/([^/]+))?$/);
        if (!match) return next();

        const name = match[1] ? decodeURIComponent(match[1]) : null;
        try {
          if (!name && req.method === 'GET') {
            if (!fs.existsSync(themesDir())) return sendJson(res, { success: true, data: [] });
            const dirs = fs.readdirSync(themesDir(), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
            const data = dirs.map((n) => {
              const themeJson = path.join(themesDir(), n, 'theme.json');
              return { name: n, config: readJsonFile(themeJson, null) };
            });
            return sendJson(res, { success: true, data });
          }

          if (!name || !isValidName(name)) return sendError(res, '主题名不合法');
          const dir = path.join(themesDir(), name);
          if (!dir.startsWith(themesDir())) return sendError(res, '路径非法', 403);
          const themeJson = path.join(dir, 'theme.json');

          if (req.method === 'GET') {
            if (!fs.existsSync(themeJson)) return sendError(res, '主题不存在', 404);
            return sendJson(res, { success: true, data: readJsonFile(themeJson, {}) });
          }

          if (req.method === 'PUT') {
            const body = await readJsonBody(req);
            writeJsonFile(themeJson, body);
            return sendJson(res, { success: true });
          }

          if (req.method === 'DELETE') {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
            return sendJson(res, { success: true });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '主题操作失败', 500);
        }
      });
    },
  };
}
