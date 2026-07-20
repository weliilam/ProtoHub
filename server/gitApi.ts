import type { Plugin } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { sendJson, sendError, readJsonBody, getPathname } from './utils';

const execFileAsync = promisify(execFile);

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, LC_ALL: 'C.UTF-8' },
  });
  return stdout.trim();
}

export function gitApiPlugin(): Plugin {
  return {
    name: 'proto-hub-git-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/git/')) return next();

        try {
          // 状态：当前分支 + 变更文件数
          if (pathname === '/api/git/status' && req.method === 'GET') {
            try {
              const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
              const porcelain = await git(['status', '--porcelain']);
              const changed = porcelain ? porcelain.split('\n').length : 0;
              return sendJson(res, { success: true, data: { branch, changed, initialized: true } });
            } catch {
              return sendJson(res, { success: true, data: { initialized: false } });
            }
          }

          // 快照列表
          if (pathname === '/api/git/log' && req.method === 'GET') {
            const raw = await git(['log', '--pretty=format:%h|%ad|%s', '--date=format:%Y-%m-%d %H:%M', '-30']);
            const list = raw
              ? raw.split('\n').map((line) => {
                  const [hash, date, ...msg] = line.split('|');
                  return { hash, date, message: msg.join('|') };
                })
              : [];
            return sendJson(res, { success: true, data: list });
          }

          // 创建快照
          if (pathname === '/api/git/snapshot' && req.method === 'POST') {
            const body = await readJsonBody<{ message?: string }>(req);
            const message = (body.message || `快照 ${new Date().toLocaleString('zh-CN')}`).slice(0, 200);
            await git(['add', '-A']);
            try {
              await git(['commit', '-m', message]);
            } catch (e: any) {
              if (String(e.message).includes('nothing to commit')) {
                return sendError(res, '没有需要保存的变更');
              }
              throw e;
            }
            const hash = await git(['rev-parse', '--short', 'HEAD']);
            return sendJson(res, { success: true, data: { hash } });
          }

          // 回滚到指定快照（仅恢复工作区文件，可再次快照固化为新版本）
          if (pathname === '/api/git/restore' && req.method === 'POST') {
            const body = await readJsonBody<{ hash?: string }>(req);
            if (!body.hash || !/^[0-9a-f]{6,40}$/i.test(body.hash)) return sendError(res, '快照标识不合法');
            await git(['checkout', body.hash, '--', '.']);
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
