import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, getQuery, isValidName } from './utils';

export interface EntryItem {
  name: string;
  title: string;
  type: 'prototype' | 'component' | 'doc' | 'theme' | 'table';
  url?: string;
  mtime: number;
}

function scanDir(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

function scanFiles(dir: string, ext: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith(ext));
  } catch {
    return [];
  }
}

/** 从 spec.md 第一行提取标题，例如 "# DW送达时段列表" */
function readTitle(specPath: string, fallback: string): string {
  try {
    if (!fs.existsSync(specPath)) return fallback;
    const firstLine = fs.readFileSync(specPath, 'utf8').split('\n').find((l) => l.trim().startsWith('#'));
    if (!firstLine) return fallback;
    return firstLine.replace(/^#+\s*/, '').trim() || fallback;
  } catch {
    return fallback;
  }
}

function dirMtime(dir: string): number {
  try {
    return fs.statSync(dir).mtimeMs;
  } catch {
    return 0;
  }
}

export function collectEntries(): EntryItem[] {
  const items: EntryItem[] = [];

  for (const name of scanDir(path.join(projectRoot, 'src/prototypes'))) {
    if (!fs.existsSync(path.join(projectRoot, 'src/prototypes', name, 'index.tsx'))) continue;
    items.push({
      name,
      title: readTitle(path.join(projectRoot, 'src/prototypes', name, 'spec.md'), name),
      type: 'prototype',
      url: `/p/${name}`,
      mtime: dirMtime(path.join(projectRoot, 'src/prototypes', name)),
    });
  }

  for (const name of scanDir(path.join(projectRoot, 'src/components'))) {
    if (!fs.existsSync(path.join(projectRoot, 'src/components', name, 'index.tsx'))) continue;
    items.push({
      name,
      title: readTitle(path.join(projectRoot, 'src/components', name, 'spec.md'), name),
      type: 'component',
      url: `/p/components/${name}`,
      mtime: dirMtime(path.join(projectRoot, 'src/components', name)),
    });
  }

  for (const file of scanFiles(path.join(projectRoot, 'src/docs'), '.md')) {
    const name = file.replace(/\.md$/, '');
    items.push({
      name,
      title: readTitle(path.join(projectRoot, 'src/docs', file), name),
      type: 'doc',
      mtime: dirMtime(path.join(projectRoot, 'src/docs', file)),
    });
  }

  for (const name of scanDir(path.join(projectRoot, 'src/themes'))) {
    items.push({
      name,
      title: readTitle(path.join(projectRoot, 'src/themes', name, 'README.md'), name),
      type: 'theme',
      mtime: dirMtime(path.join(projectRoot, 'src/themes', name)),
    });
  }

  for (const file of scanFiles(path.join(projectRoot, 'src/database'), '.json')) {
    items.push({
      name: file.replace(/\.json$/, ''),
      title: file.replace(/\.json$/, ''),
      type: 'table',
      mtime: dirMtime(path.join(projectRoot, 'src/database', file)),
    });
  }

  return items.sort((a, b) => b.mtime - a.mtime);
}

const PROTOTYPE_TEMPLATE = (title: string) => `import { useState } from 'react';
import { Button, Card, Space, Table, Tag } from 'antd';

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Card title="${title}">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space>
            <Button type="primary" onClick={() => setCount((c) => c + 1)}>点击计数</Button>
            <Tag color="blue">{count}</Tag>
          </Space>
          <Table
            size="small"
            pagination={false}
            columns={[
              { title: '单号', dataIndex: 'id' },
              { title: '名称', dataIndex: 'name' },
              { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color="green">{v}</Tag> },
            ]}
            dataSource={[
              { key: 1, id: 'YT0001', name: '示例数据', status: '已审核' },
              { key: 2, id: 'YT0002', name: '示例数据', status: '已审核' },
            ]}
          />
        </Space>
      </Card>
    </div>
  );
}
`;

function typeDir(type: string): string | null {
  if (type === 'prototype') return path.join(projectRoot, 'src/prototypes');
  if (type === 'component') return path.join(projectRoot, 'src/components');
  return null;
}

export function entriesApiPlugin(): Plugin {
  return {
    name: 'proto-hub-entries-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        try {
          if (pathname === '/api/entries' && req.method === 'GET') {
            sendJson(res, { success: true, data: collectEntries() });
            return;
          }

          // 新建原型/组件骨架
          if (pathname === '/api/entries' && req.method === 'POST') {
            const body = await readJsonBody<{ type?: string; name?: string; title?: string }>(req);
            const dir = body.type ? typeDir(body.type) : null;
            if (!dir) return sendError(res, '仅支持新建 prototype / component');
            if (!body.name || !isValidName(body.name)) return sendError(res, '名称不合法（字母/数字/中文/中划线/下划线）');
            const target = path.join(dir, body.name);
            if (!target.startsWith(dir)) return sendError(res, '路径非法', 403);
            if (fs.existsSync(target)) return sendError(res, '已存在同名条目');
            fs.mkdirSync(target, { recursive: true });
            const title = body.title?.trim() || body.name;
            fs.writeFileSync(path.join(target, 'index.tsx'), PROTOTYPE_TEMPLATE(title), 'utf8');
            fs.writeFileSync(path.join(target, 'spec.md'), `# ${title}\n\n## 功能概述\n\n（在此描述原型的目标与功能）\n`, 'utf8');
            sendJson(res, { success: true });
            return;
          }

          // 重命名
          if (pathname === '/api/entries/rename' && req.method === 'POST') {
            const body = await readJsonBody<{ type?: string; name?: string; newName?: string }>(req);
            const dir = body.type ? typeDir(body.type) : null;
            if (!dir) return sendError(res, '类型不支持');
            if (!body.name || !body.newName || !isValidName(body.newName)) return sendError(res, '名称不合法');
            const from = path.join(dir, body.name);
            const to = path.join(dir, body.newName);
            if (!from.startsWith(dir) || !to.startsWith(dir)) return sendError(res, '路径非法', 403);
            if (!fs.existsSync(from)) return sendError(res, '条目不存在', 404);
            if (fs.existsSync(to)) return sendError(res, '目标名称已存在');
            fs.renameSync(from, to);
            sendJson(res, { success: true });
            return;
          }

          // 删除
          if (pathname === '/api/entries' && req.method === 'DELETE') {
            const type = getQuery(req).get('type') || '';
            const name = getQuery(req).get('name') || '';
            const dir = typeDir(type);
            if (!dir) return sendError(res, '类型不支持');
            if (!name) return sendError(res, '缺少名称');
            const target = path.join(dir, name);
            if (!target.startsWith(dir)) return sendError(res, '路径非法', 403);
            if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
            sendJson(res, { success: true });
            return;
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '操作失败', 500);
        }
      });
    },
  };
}
