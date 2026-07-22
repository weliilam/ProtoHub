import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, getQuery, isValidName } from './utils';

const PRD_LINK_FILE = 'prd.link';

interface PrdDoc {
  url: string;
  title?: string;
  summary?: string;
  syncedAt?: string;
}

/** 读取 prd.link：优先 JSON（v2），兼容旧纯文本格式 */
function readDocs(file: string): PrdDoc[] {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8').trim();
  // JSON 数组格式（v2）
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map((d: any) => (typeof d === 'string' ? { url: d } : d));
    } catch { /* fallback */ }
  }
  // 旧格式：每行一个 URL → 兼容转换
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//.test(l))
    .map((url) => ({ url }));
}

function writeDocs(file: string, docs: PrdDoc[]): void {
  fs.writeFileSync(file, JSON.stringify(docs, null, 2), 'utf8');
}

/** 调用 lark-cli 获取飞书文档标题 + 功能描述章节（Markdown 格式） */
function fetchDocInfo(docUrl: string): { title: string; summary: string } {
  try {
    const out = execSync(
      `lark-cli docs +fetch --doc "${docUrl}" --doc-format markdown`,
      { timeout: 15000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(out);
    if (!parsed.ok || !parsed.data?.document?.content) return { title: '', summary: '' };
    const content: string = parsed.data.document.content;

    // 提取标题（第一个 # 开头的行）
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch?.[1]?.trim() || '';

    // 提取「八、功能描述」到下一章（或文档末尾），同时移除章节序号标记
    let section = '';
    const funcMatch = content.match(/(?:#{1,3}\s+)?八[、.]?\s*功能描述\s*\n([\s\S]*?)(?=\n#{1,2}\s+九[、.]|\n#{1,2}\s+十[、.]|\n#{1}\s|$)/);
    if (funcMatch) {
      section = funcMatch[1].trim();
    } else {
      // 回退：取全文中去掉非功能描述的部分（前面章节）
      const idx = content.search(/(?:#{1,3}\s+)?八[、.]?\s*功能描述/);
      if (idx > 0) {
        section = content.slice(idx).replace(/^.*?功能描述\s*\n/, '').trim();
      }
    }

    // 简单 Markdown → 纯文本（保留结构但去掉标记符号，适合 pre-wrap 展示）
    let clean = (section || content)
      // 处理表格：用空格分隔列，保留行结构
      .replace(/^\|(.+)\|\n\|[-|\s]+\|\n/gm, '')
      .replace(/^\|(.+)\|$/gm, (_, row) => row.replace(/\|/g, '  │  '))
      // 标题 → 加粗
      .replace(/^#{1,3}\s+(.+)$/gm, '■ $1')
      // 无序列表
      .replace(/^(\s*)-\s+(.+)$/gm, '$1· $2')
      // 有序列表（保留序号）
      .replace(/^(\s*)\d+\.\s+(.+)$/gm, '$1$2')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '$1')
      // 链接
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // 清理空行
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 8000);

    return { title, summary: clean };
  } catch (e: any) {
    console.error('lark-cli sync failed:', e.message?.slice(0, 120));
    return { title: '', summary: '' };
  }
}

export function prdApiPlugin(): Plugin {
  return {
    name: 'prd-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/prd/')) return next();
        try {
          const method = req.method || 'GET';

          // ── 同步飞书文档信息（标题 + 摘要）──
          if (pathname === '/api/prd/sync' && method === 'POST') {
            const body = await readJsonBody<{ name?: string; url?: string }>(req);
            const protoName = (body.name || '').trim();
            const docUrl = (body.url || '').trim();
            if (!protoName || !isValidName(protoName)) return sendError(res, '非法的原型名称');
            if (!docUrl || !/^https?:\/\//.test(docUrl)) return sendError(res, '链接格式错误');
            const file = path.join(projectRoot, 'src/prototypes', protoName, PRD_LINK_FILE);
            const docs = readDocs(file);
            const target = docs.find((d) => d.url === docUrl);
            if (!target) return sendError(res, '未找到该链接', 404);
            const { title, summary } = fetchDocInfo(docUrl);
            target.title = title || target.title;
            target.summary = summary || target.summary;
            target.syncedAt = new Date().toISOString();
            writeDocs(file, docs);
            return sendJson(res, { success: true, data: { docs } });
          }

          // ── 单个原型 PRD 链接 CRUD ──
          if (pathname === '/api/prd/link') {
            const name = getQuery(req).get('name') || '';
            if (!isValidName(name)) return sendError(res, '非法的原型名称');
            const file = path.join(projectRoot, 'src/prototypes', name, PRD_LINK_FILE);

            if (method === 'GET') {
              return sendJson(res, { success: true, data: { docs: readDocs(file) } });
            }
            if (method === 'POST') {
              const { link, title, summary } = await readJsonBody<{ link?: string; title?: string; summary?: string }>(req);
              const url = (link || '').trim();
              if (!url) return sendError(res, '链接不能为空');
              if (!/^https?:\/\//.test(url)) return sendError(res, '链接必须以 http(s):// 开头');
              const docs = readDocs(file);
              if (!docs.find((d) => d.url === url)) {
                docs.push({
                  url,
                  title: title || '',
                  summary: summary || '',
                  syncedAt: title ? new Date().toISOString() : undefined,
                });
              }
              writeDocs(file, docs);
              return sendJson(res, { success: true, data: { docs } });
            }
            if (method === 'DELETE') {
              const { link } = await readJsonBody<{ link?: string }>(req);
              const url = (link || '').trim();
              const docs = readDocs(file).filter((d) => d.url !== url);
              writeDocs(file, docs);
              return sendJson(res, { success: true, data: { docs } });
            }
            return sendError(res, '不支持的方法', 405);
          }

          // ── 汇总所有原型的飞书 PRD 文档 ──
          if (pathname === '/api/prd/all') {
            if (method !== 'GET') return sendError(res, '不支持的方法', 405);
            const protoDir = path.join(projectRoot, 'src/prototypes');
            const items: { name: string; docs: PrdDoc[] }[] = [];
            if (fs.existsSync(protoDir)) {
              for (const name of fs.readdirSync(protoDir)) {
                const docs = readDocs(path.join(protoDir, name, PRD_LINK_FILE));
                if (docs.length) items.push({ name, docs });
              }
            }
            return sendJson(res, { success: true, data: { items } });
          }
          return sendError(res, '未找到接口', 404);
        } catch (e: any) {
          return sendError(res, e.message || '服务器错误');
        }
      });
    },
  };
}
