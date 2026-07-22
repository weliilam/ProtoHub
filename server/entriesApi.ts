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
  groupId?: string;
  groupName?: string;
}

// ── 分组配置 ──
interface GroupConfig {
  id: string;
  name: string;
  prototypes: string[];
}

const GROUPS_FILE = path.join(projectRoot, 'src/prototypes', '.groups.json');

function readGroups(): GroupConfig[] {
  try {
    if (!fs.existsSync(GROUPS_FILE)) return [];
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeGroups(groups: GroupConfig[]) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf8');
}

function buildProtoGroupMap(): Map<string, { groupId: string; groupName: string }> {
  const map = new Map<string, { groupId: string; groupName: string }>();
  for (const g of readGroups()) {
    for (const p of g.prototypes) {
      map.set(p, { groupId: g.id, groupName: g.name });
    }
  }
  return map;
}

// ── 扫描工具 ──
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

// ── 收集所有条目 ──
export function collectEntries(): EntryItem[] {
  const items: EntryItem[] = [];
  const groupMap = buildProtoGroupMap();

  for (const name of scanDir(path.join(projectRoot, 'src/prototypes'))) {
    if (name.startsWith('.')) continue; // 跳过 .groups.json 等隐藏文件
    if (!fs.existsSync(path.join(projectRoot, 'src/prototypes', name, 'index.tsx'))) continue;
    const g = groupMap.get(name);
    items.push({
      name,
      title: readTitle(path.join(projectRoot, 'src/prototypes', name, 'spec.md'), name),
      type: 'prototype',
      url: `/p/${name}`,
      mtime: dirMtime(path.join(projectRoot, 'src/prototypes', name)),
      groupId: g?.groupId,
      groupName: g?.groupName,
    });
  }

  // 按 .groups.json 内各分组的 prototypes 顺序排列，确保拖拽排序后页面反映实际顺序
  const protoRank = new Map<string, number>();
  let rank = 0;
  for (const g of readGroups()) {
    for (const p of g.prototypes) {
      protoRank.set(p, rank++);
    }
  }
  if (protoRank.size > 0) {
    items.sort((a, b) => {
      if (a.type !== 'prototype' || b.type !== 'prototype') return 0;
      const ra = protoRank.get(a.name);
      const rb = protoRank.get(b.name);
      if (ra === undefined && rb === undefined) return 0;
      if (ra === undefined) return 1;   // 不在任何分组 → 排到分组原型之后
      if (rb === undefined) return -1;
      return ra - rb;
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

// ── 模板 ──
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

// ── 条目缓存：避免每次请求都全量扫盘 + 读 spec.md ──
const CACHE_TTL_MS = 2000;
let entriesCache: { items: EntryItem[]; at: number } | null = null;

function getEntries(): EntryItem[] {
  const now = Date.now();
  if (entriesCache && now - entriesCache.at < CACHE_TTL_MS) return entriesCache.items;
  const items = collectEntries();
  entriesCache = { items, at: now };
  return items;
}

function invalidateEntries() {
  entriesCache = null;
}

// ── Vite 插件 ──
export function entriesApiPlugin(): Plugin {
  return {
    name: 'proto-hub-entries-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        try {
          // ── 分组 CRUD ──
          if (pathname === '/api/groups' && req.method === 'GET') {
            sendJson(res, { success: true, data: readGroups() });
            return;
          }

          if (pathname === '/api/groups' && req.method === 'POST') {
            const body = await readJsonBody<{ id?: string; name?: string; prototypes?: string[] }>(req);
            if (!body.id || !body.name) return sendError(res, 'id 和 name 必填');
            const groups = readGroups();
            if (groups.find((g) => g.id === body.id)) return sendError(res, '分组 ID 已存在');
            groups.push({ id: body.id, name: body.name, prototypes: body.prototypes || [] });
            writeGroups(groups);
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          if (pathname === '/api/groups' && req.method === 'PUT') {
            const body = await readJsonBody<{ id?: string; name?: string; prototypes?: string[] }>(req);
            if (!body.id || !body.name) return sendError(res, 'id 和 name 必填');
            const groups = readGroups();
            const idx = groups.findIndex((g) => g.id === body.id);
            if (idx === -1) return sendError(res, '分组不存在', 404);
            groups[idx] = { id: body.id, name: body.name, prototypes: body.prototypes || groups[idx].prototypes };
            writeGroups(groups);
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          if (pathname === '/api/groups' && req.method === 'DELETE') {
            const id = getQuery(req).get('id');
            if (!id) return sendError(res, '缺少 id');
            const groups = readGroups().filter((g) => g.id !== id);
            writeGroups(groups);
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          // 原型移入分组 / 移出分组
          if (pathname === '/api/groups/move' && req.method === 'POST') {
            const body = await readJsonBody<{ prototype: string; groupId?: string }>(req);
            if (!body.prototype) return sendError(res, '缺少 prototype');
            const groups = readGroups();
            // 先从所有分组中移除
            for (const g of groups) {
              g.prototypes = g.prototypes.filter((p) => p !== body.prototype);
            }
            // 再放入目标分组
            if (body.groupId) {
              const target = groups.find((g) => g.id === body.groupId);
              if (!target) return sendError(res, '目标分组不存在', 404);
              target.prototypes.push(body.prototype);
            }
            writeGroups(groups);
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          // ── 条目 CRUD ──
          if (pathname === '/api/entries' && req.method === 'GET') {
            sendJson(res, { success: true, data: getEntries() });
            return;
          }

          if (pathname === '/api/entries' && req.method === 'POST') {
            const body = await readJsonBody<{ type?: string; name?: string; title?: string }>(req);
            const dir = body.type ? typeDir(body.type) : null;
            if (!dir) return sendError(res, '仅支持新建 prototype / component');
            if (!body.name || !isValidName(body.name)) return sendError(res, '名称不合法（字母/数字/中文/中划线/下划线）');
            const target = path.join(dir, body.name);
            if (fs.existsSync(target)) return sendError(res, '已存在同名条目');
            fs.mkdirSync(target, { recursive: true });
            const title = body.title?.trim() || body.name;
            fs.writeFileSync(path.join(target, 'index.tsx'), PROTOTYPE_TEMPLATE(title), 'utf8');
            fs.writeFileSync(path.join(target, 'spec.md'), `# ${title}\n\n## 功能概述\n\n（在此描述原型的目标与功能）\n`, 'utf8');
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          if (pathname === '/api/entries/rename' && req.method === 'POST') {
            const body = await readJsonBody<{ type?: string; name?: string; newName?: string }>(req);
            const dir = body.type ? typeDir(body.type) : null;
            if (!dir) return sendError(res, '类型不支持');
            if (!body.name || !body.newName || !isValidName(body.newName)) return sendError(res, '名称不合法');
            const from = path.join(dir, body.name);
            const to = path.join(dir, body.newName);
            if (!fs.existsSync(from)) return sendError(res, '条目不存在', 404);
            if (fs.existsSync(to)) return sendError(res, '目标名称已存在');
            fs.renameSync(from, to);
            // 同步更新分组配置中的引用
            const groups = readGroups();
            let groupsChanged = false;
            for (const g of groups) {
              const idx = g.prototypes.indexOf(body.name);
              if (idx !== -1) {
                g.prototypes[idx] = body.newName;
                groupsChanged = true;
              }
            }
            if (groupsChanged) writeGroups(groups);
            const specPath = path.join(to, 'spec.md');
            if (fs.existsSync(specPath)) {
              const spec = fs.readFileSync(specPath, 'utf8');
              fs.writeFileSync(specPath, spec.replace(/^#\s+.*/m, `# ${body.newName}`), 'utf8');
            }
            invalidateEntries();
            sendJson(res, { success: true });
            return;
          }

          if (pathname === '/api/entries' && req.method === 'DELETE') {
            const type = getQuery(req).get('type') || '';
            const name = getQuery(req).get('name') || '';
            const dir = typeDir(type);
            if (!dir) return sendError(res, '类型不支持');
            if (!name) return sendError(res, '缺少名称');
            const target = path.join(dir, name);
            if (fs.existsSync(target)) {
              fs.rmSync(target, { recursive: true, force: true });
              // 同步清理分组引用
              const groups = readGroups();
              let changed = false;
              for (const g of groups) {
                const before = g.prototypes.length;
                g.prototypes = g.prototypes.filter((p) => p !== name);
                if (g.prototypes.length !== before) changed = true;
              }
              if (changed) writeGroups(groups);
            }
            invalidateEntries();
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
