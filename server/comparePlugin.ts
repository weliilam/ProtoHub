import type { Plugin } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, getQuery } from './utils';

const execFileAsync = promisify(execFile);

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: projectRoot,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, LC_ALL: 'C.UTF-8' },
  });
  return stdout.trim();
}

const CMP_A = '__cmp_a';
const CMP_B = '__cmp_b';

function tempDir(slot: string): string {
  return path.join(projectRoot, 'src', 'prototypes', slot);
}

/** 列出某次提交下某个原型目录内的所有文件 */
async function listFilesAtRev(hash: string, protoName: string): Promise<string[]> {
  const prefix = `src/prototypes/${protoName}/`;
  const raw = await git(['ls-tree', '-r', '--name-only', hash, '--', prefix]);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean);
}

/** 把某次提交下的原型全部文件提取到临时目录，返回入口路径 */
async function extractProtoAtRev(hash: string, protoName: string, slot: string): Promise<string> {
  const dest = tempDir(slot);
  // 清空并重建目标目录
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const prefix = `src/prototypes/${protoName}/`;
  const files = await listFilesAtRev(hash, protoName);

  for (const file of files) {
    const rel = file.slice(prefix.length);
    const destPath = path.join(dest, rel);
    const destParent = path.dirname(destPath);
    if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });
    try {
      const content = await git(['show', `${hash}:${file}`]);
      fs.writeFileSync(destPath, content, 'utf-8');
    } catch {
      // 跳过无法读取的文件（二进制等）
    }
  }

  return `/p/${slot}`;
}

/** 清理临时比较目录 */
function cleanupCompareDirs() {
  for (const slot of [CMP_A, CMP_B]) {
    const d = tempDir(slot);
    if (fs.existsSync(d)) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

export function comparePlugin(): Plugin {
  return {
    name: 'proto-hub-compare',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/compare/')) return next();

        try {
          // 准备对比：提取两个版本的原型文件到临时目录
          if (pathname === '/api/compare/prepare' && req.method === 'POST') {
            const body = await readJsonBody<{
              hashA?: string;
              hashB?: string;
              prototype?: string;
            }>(req);
            if (!body.hashA || !body.hashB || !body.prototype) {
              return sendError(res, '缺少参数 hashA / hashB / prototype');
            }
            if (!/^[0-9a-f]{6,40}$/i.test(body.hashA) || !/^[0-9a-f]{6,40}$/i.test(body.hashB)) {
              return sendError(res, '快照标识不合法');
            }

            cleanupCompareDirs();

            const urlA = await extractProtoAtRev(body.hashA, body.prototype, CMP_A);
            const urlB = await extractProtoAtRev(body.hashB, body.prototype, CMP_B);

            return sendJson(res, {
              success: true,
              data: { urlA, urlB, slotA: CMP_A, slotB: CMP_B },
            });
          }

          // 两个版本之间的 diff 概要（给产品看的文件级概览）
          if (pathname === '/api/compare/diff' && req.method === 'GET') {
            const q = getQuery(req);
            const from = q.get('from');
            const to = q.get('to');
            const scope = q.get('scope');
            if (!from || !to) return sendError(res, '缺少 from / to 参数');
            if (!/^[0-9a-f]{6,40}$/i.test(from) || !/^[0-9a-f]{6,40}$/i.test(to)) {
              return sendError(res, '快照标识不合法');
            }
            try {
              const args = ['--no-pager', 'diff', '--stat', from, to];
              if (scope) args.push('--', scope);
              const stat = await git(args);
              // 也获取完整 diff 便于前端解析
              const fullArgs = ['--no-pager', 'diff', from, to];
              if (scope) fullArgs.push('--', scope);
              const diff = await git(fullArgs);
              const messages = await git(['log', '--pretty=format:%s', `${from}..${to}`, '--', scope || '.']);
              return sendJson(res, {
                success: true,
                data: { stat, diff, messages: messages ? messages.split('\n') : [] },
              });
            } catch (e: any) {
              return sendError(res, `对比失败：${e.stderr || e.message}`, 500);
            }
          }

          // 清理比较临时目录
          if (pathname === '/api/compare/cleanup' && req.method === 'POST') {
            cleanupCompareDirs();
            return sendJson(res, { success: true });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || '对比操作失败', 500);
        }
      });
    },
  };
}
