import type { Plugin } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
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

/** 校验 scope 路径必须位于项目根内（如 src/prototypes/xxx） */
function resolveScope(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..')) return null;
  const abs = path.resolve(projectRoot, normalized);
  if (!abs.startsWith(projectRoot)) return null;
  return normalized;
}

export function gitApiPlugin(): Plugin {
  return {
    name: 'proto-hub-git-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/git/')) return next();

        try {
          // 状态：当前分支 + 变更数（可按 scope 过滤）
          if (pathname === '/api/git/status' && req.method === 'GET') {
            try {
              const scope = resolveScope(getQuery(req).get('scope'));
              const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
              const args = ['status', '--porcelain'];
              if (scope) args.push('--', scope);
              const porcelain = await git(args);
              const changed = porcelain ? porcelain.split('\n').length : 0;
              return sendJson(res, { success: true, data: { branch, changed, initialized: true } });
            } catch {
              return sendJson(res, { success: true, data: { initialized: false } });
            }
          }

          // 快照列表（可按 scope 过滤，只显示影响该路径的提交）
          if (pathname === '/api/git/log' && req.method === 'GET') {
            const scope = resolveScope(getQuery(req).get('scope'));
            const args = ['log', '--pretty=format:%h|%ad|%s', '--date=format:%Y-%m-%d %H:%M', '-30'];
            if (scope) args.push('--', scope);
            const raw = await git(args);
            const list = raw
              ? raw.split('\n').map((line) => {
                  const [hash, date, ...msg] = line.split('|');
                  return { hash, date, message: msg.join('|') };
                })
              : [];
            return sendJson(res, { success: true, data: list });
          }

          // 创建快照（scope 存在时只提交该路径的变更）
          if (pathname === '/api/git/snapshot' && req.method === 'POST') {
            const body = await readJsonBody<{ message?: string; scope?: string }>(req);
            const scope = resolveScope(body.scope ?? null);
            // 1. 清空暂存区（不动工作区文件），确保本次提交只包含目标路径
            try { await git(['reset', '-q']); } catch { /* 空仓库时忽略 */ }
            // 2. 暂存目标路径（含新增/修改/删除）
            await git(['add', '-A', '--', scope || '.']);
            // 3. 检查暂存区是否有内容
            const staged = await git(['diff', '--cached', '--name-only']);
            if (!staged) {
              return sendError(res, scope ? '该原型没有需要保存的变更' : '没有需要保存的变更');
            }
            try {
              const defaultMsg = `快照 ${new Date().toLocaleString('zh-CN')}`;
              const message = (body.message || defaultMsg).slice(0, 200);
              await git(['commit', '-m', message]);
            } catch (e: any) {
              return sendError(res, `提交失败：${e.stderr || e.message}`, 500);
            }
            const hash = await git(['rev-parse', '--short', 'HEAD']);
            return sendJson(res, { success: true, data: { hash } });
          }

          // 回滚到指定快照（scope 存在时只恢复该路径，不影响其他文件）
          if (pathname === '/api/git/restore' && req.method === 'POST') {
            const body = await readJsonBody<{ hash?: string; scope?: string }>(req);
            if (!body.hash || !/^[0-9a-f]{6,40}$/i.test(body.hash)) return sendError(res, '快照标识不合法');
            const scope = resolveScope(body.scope ?? null);
            await git(['checkout', body.hash, '--', scope || '.']);
            return sendJson(res, { success: true });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || 'Git 操作失败', 500);
        }
      });
    },
  };
}
