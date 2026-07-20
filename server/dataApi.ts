import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, isValidName, readJsonFile, writeJsonFile } from './utils';

const dbDir = () => path.join(projectRoot, 'src/database');

function tablePath(name: string) {
  return path.join(dbDir(), `${name}.json`);
}

export function dataApiPlugin(): Plugin {
  return {
    name: 'proto-hub-data-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        const match = pathname.match(/^\/api\/data\/tables(?:\/([^/]+))?$/);
        if (!match) return next();

        const name = match[1] ? decodeURIComponent(match[1]) : null;
        try {
          // 表列表
          if (!name && req.method === 'GET') {
            if (!fs.existsSync(dbDir())) return sendJson(res, { success: true, data: [] });
            const files = fs.readdirSync(dbDir()).filter((f) => f.endsWith('.json'));
            return sendJson(res, {
              success: true,
              data: files.map((f) => {
                const rows = readJsonFile<any[]>(tablePath(f.replace(/\.json$/, '')), []);
                return { name: f.replace(/\.json$/, ''), count: Array.isArray(rows) ? rows.length : 0 };
              }),
            });
          }

          // 新建表
          if (!name && req.method === 'POST') {
            const body = await readJsonBody<{ name: string }>(req);
            if (!body.name || !isValidName(body.name)) return sendError(res, '表名不合法');
            const p = tablePath(body.name);
            if (fs.existsSync(p)) return sendError(res, '表已存在');
            writeJsonFile(p, []);
            return sendJson(res, { success: true });
          }

          if (!name || !isValidName(name)) return sendError(res, '表名不合法');
          const p = tablePath(name);
          if (!p.startsWith(dbDir())) return sendError(res, '路径非法', 403);

          // 读表数据
          if (req.method === 'GET') {
            if (!fs.existsSync(p)) return sendError(res, '表不存在', 404);
            return sendJson(res, { success: true, data: readJsonFile(p, []) });
          }

          // 整表覆盖（编辑器保存）
          if (req.method === 'PUT') {
            const body = await readJsonBody<{ rows: any[] }>(req);
            if (!Array.isArray(body.rows)) return sendError(res, 'rows 必须是数组');
            writeJsonFile(p, body.rows);
            return sendJson(res, { success: true });
          }

          if (req.method === 'DELETE') {
            if (fs.existsSync(p)) fs.unlinkSync(p);
            return sendJson(res, { success: true });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '数据表操作失败', 500);
        }
      });
    },
  };
}
