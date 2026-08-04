import type { Plugin } from 'vite';
import fs from 'fs';
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
  elementText?: string; // 目标元素的文本内容（用于漂移兜底匹配）
  elementDescription?: string; // 富上下文描述（供 AI 精准定位源码）
  status: 'open' | 'done' | 'resolved';
  createdAt: string;
  resolvedBy?: string; // 标记完成时使用的 AI 模型名称
}

type Store = Record<string, Annotation[]>;

const STATUS_VALUES = ['open', 'done', 'resolved'] as const;
/** 状态白名单：仅允许已知值，非法值归为 'open'，避免脏数据污染 */
function normalizeStatus(s: unknown): 'open' | 'done' | 'resolved' {
  return (STATUS_VALUES as readonly string[]).includes(s as string)
    ? (s as 'open' | 'done' | 'resolved')
    : 'open';
}

const storePath = () => path.join(projectRoot, 'annotations.json');
const backupPath = () => path.join(projectRoot, 'annotations.json.bak');

/** 安全写入：先备份旧文件，再原子替换，避免写入中断导致数据丢失 */
function writeStore(file: string, store: Store) {
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, backupPath());
  } catch {
    /* 备份失败不阻断主流程 */
  }
  writeJsonFile(file, store);
}

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
              id: body.id || randomUUID().slice(0, 8),
              target: body.target,
              selector: body.selector || '',
              x: Number(body.x) || 0,
              y: Number(body.y) || 0,
              text: body.text.trim(),
              elementText: (body as any).elementText?.trim(),
              elementDescription: (body as any).elementDescription?.trim(),
              status: body.status || 'open',
              createdAt: body.createdAt || new Date().toISOString(),
            };
            store[annotation.target] = [...(store[annotation.target] || []), annotation];
            writeStore(storePath(), store);
            return sendJson(res, { success: true, data: annotation });
          }

          // 更新（标记完成 / 改文本）
          if (id && req.method === 'PUT') {
            const body = await readJsonBody<Partial<Annotation>>(req);
            for (const target of Object.keys(store)) {
              const idx = store[target].findIndex((a) => a.id === id);
              if (idx >= 0) {
                store[target][idx] = { ...store[target][idx], ...body, id };
                if (body.status) store[target][idx].status = normalizeStatus(body.status);
                writeStore(storePath(), store);
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
                writeStore(storePath(), store);
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
