import type { Plugin } from 'vite';
import path from 'path';
import { randomUUID } from 'crypto';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, getQuery, readJsonFile, writeJsonFile } from './utils';

export interface Annotation {
  id: string;
  target: string; // 原型/组件名
  selector: string; // 元素 CSS 路径
  x: number; // 相对元素的位置信息（用于回显标记）
  y: number;
  text: string;
  status: 'open' | 'done';
  createdAt: string;
}

type Store = Record<string, Annotation[]>;

const storePath = () => path.join(projectRoot, 'annotations.json');

export function annotationApiPlugin(): Plugin {
  return {
    name: 'proto-hub-annotation-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        const match = pathname.match(/^\/api\/annotations(?:\/([^/]+))?$/);
        if (!match) return next();

        const id = match[1];
        try {
          const store = readJsonFile<Store>(storePath(), {});

          // 查询（可按 target 过滤）
          if (!id && req.method === 'GET') {
            const target = getQuery(req).get('target');
            if (target) return sendJson(res, { success: true, data: store[target] || [] });
            return sendJson(res, { success: true, data: store });
          }

          // 新增
          if (!id && req.method === 'POST') {
            const body = await readJsonBody<Partial<Annotation>>(req);
            if (!body.target || !body.text?.trim()) return sendError(res, 'target 和 text 必填');
            const annotation: Annotation = {
              id: randomUUID().slice(0, 8),
              target: body.target,
              selector: body.selector || '',
              x: Number(body.x) || 0,
              y: Number(body.y) || 0,
              text: body.text.trim(),
              status: 'open',
              createdAt: new Date().toISOString(),
            };
            store[annotation.target] = [...(store[annotation.target] || []), annotation];
            writeJsonFile(storePath(), store);
            return sendJson(res, { success: true, data: annotation });
          }

          // 更新（标记完成 / 改文本）
          if (id && req.method === 'PUT') {
            const body = await readJsonBody<Partial<Annotation>>(req);
            for (const target of Object.keys(store)) {
              const idx = store[target].findIndex((a) => a.id === id);
              if (idx >= 0) {
                store[target][idx] = { ...store[target][idx], ...body, id };
                writeJsonFile(storePath(), store);
                return sendJson(res, { success: true, data: store[target][idx] });
              }
            }
            return sendError(res, '批注不存在', 404);
          }

          // 删除
          if (id && req.method === 'DELETE') {
            for (const target of Object.keys(store)) {
              const before = store[target].length;
              store[target] = store[target].filter((a) => a.id !== id);
              if (store[target].length !== before) {
                writeJsonFile(storePath(), store);
                return sendJson(res, { success: true });
              }
            }
            return sendError(res, '批注不存在', 404);
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '批注操作失败', 500);
        }
      });
    },
  };
}
