import type { Plugin } from 'vite';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createHash } from 'crypto';
import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { projectRoot, sendJson, sendError, readJsonBody, getPathname, getQuery } from './utils';

const execFileAsync = promisify(execFile);

async function git(args: string[], extraEnv?: Record<string, string>): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: projectRoot,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, LC_ALL: 'C.UTF-8', ...extraEnv },
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

/**
 * 条目级快照的存放位置：refs/hatch-backups/<编码后的路径>。
 *
 * 为什么不直接 commit 到当前分支：原型目录在 .gitignore 里（只属于使用者本机），
 * 一旦成为分支上的提交，任何一次 git push / 别人 pull 都会把某个人的原型带进公共
 * 仓库，再把其他人的本地原型覆盖掉。挂到自定义 ref 后：它不属于任何分支，日常
 * `git push`（只推分支）不会把它带上远程；但对象仍被该 ref 引用、不会被 gc 回收，
 * 本地"回滚到某个快照"的能力完整保留。
 */
const BACKUP_REF_PREFIX = 'refs/hatch-backups/';

/** 路径 → 备份 ref 名（中文等非 ASCII 走 URL 编码；过长时退化为内容哈希，保证一一对应） */
function backupRefName(scope: string): string {
  const encoded = encodeURIComponent(scope);
  const slug =
    encoded.length <= 120
      ? encoded
      : 'h-' + createHash('sha1').update(scope).digest('hex').slice(0, 16);
  return `${BACKUP_REF_PREFIX}${slug}`;
}

/** 备份 ref 是否已存在（还没保存过任何快照时不存在） */
async function refExists(ref: string): Promise<boolean> {
  try {
    await git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 条目路径是否被 .gitignore 忽略 —— 决定快照的存放方式。
 * 被忽略的（使用者的个人原型、src/docs）只该存在于本机 → 走备份 ref，不进分支、不被 push；
 * 未被忽略的（示例原型、组件、主题、数据表）本来就是框架产物 → 保持普通提交，可正常 push 给他人。
 */
async function isIgnoredPath(scope: string): Promise<boolean> {
  try {
    await git(['check-ignore', '-q', '--', scope]);
    return true;
  } catch {
    return false; // 退出码 1 = 未被忽略；其它异常也退化成原来的提交行为
  }
}

/** 解析 `--pretty=format:%h|%ad|%s` 的输出为快照列表 */
function parseLog(raw: string): Array<{ hash: string; date: string; message: string }> {
  if (!raw) return [];
  return raw.split('\n').map((line) => {
    const [hash, date, ...msg] = line.split('|');
    return { hash, date, message: msg.join('|') };
  });
}

/**
 * 统计某条目相对"上次快照"的待保存文件数。
 * 原型目录被 .gitignore 忽略，git status 看不到它，所以改用：
 * 1) 已有备份快照 → 借临时索引把当前工作区叠加到快照上做精确 diff（全程不碰用户的暂存区）；
 * 2) 还没有快照 → 用 `git add -n` 试算将会纳入快照的文件数。
 */
async function pendingChangeCount(ref: string, scope: string): Promise<number> {
  try {
    if (await refExists(ref)) {
      const tmpIndex = path.join(tmpdir(), `hatch-idx-${process.pid}-${Date.now()}`);
      const env = { GIT_INDEX_FILE: tmpIndex };
      try {
        await git(['read-tree', ref], env);
        await git(['add', '-A', '-f', '--', scope], env);
        const out = await git(['diff-index', '--cached', '--name-only', '-z', ref, '--', scope], env);
        return out ? out.split('\0').filter(Boolean).length : 0;
      } finally {
        try { rmSync(tmpIndex, { force: true }); } catch { /* 临时索引清理失败不影响结果 */ }
      }
    }
    const dry = await git(['add', '-A', '-f', '-n', '--', scope]);
    return dry ? dry.split('\n').filter(Boolean).length : 0;
  } catch {
    return 0; // 路径不存在 / 索引异常时只影响提示数字，不该让整个状态接口失败
  }
}

/**
 * 生成一个"只挂 ref、不进分支"的备份提交。
 * 用 write-tree + commit-tree 造出提交对象，再用 update-ref 写进备份 ref——
 * 全程不移动 HEAD，因此这条备份不会出现在分支历史里，也不会被 push 推到远程。
 * 父提交优先取上一次备份（快照链更紧凑），没有则取当前 HEAD（回滚时 diff 更直观）。
 */
async function createBackupCommit(ref: string, message: string): Promise<string> {
  const tree = await git(['write-tree']);
  const args = ['commit-tree', tree, '-m', message];
  if (await refExists(ref)) {
    args.push('-p', await git(['rev-parse', ref]));
  } else {
    try { args.push('-p', await git(['rev-parse', 'HEAD'])); } catch { /* 空仓库：无父提交也能建 */ }
  }
  let hash: string;
  try {
    hash = await git(args);
  } catch (e: any) {
    // 本机未配置 user.name/user.email 时 commit-tree 会失败，用一次性身份兜底（只作用于这条本地备份）
    const err = String(e?.stderr || e?.message || '');
    if (!/ident/i.test(err) && !/empty/i.test(err)) throw e;
    hash = await git(['-c', 'user.name=Hatch', '-c', 'user.email=hatch@local', ...args]);
  }
  await git(['update-ref', ref, hash]);
  return hash;
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
              let changed = 0;
              if (scope) {
                changed = await pendingChangeCount(backupRefName(scope), scope);
              } else {
                const porcelain = await git(['status', '--porcelain']);
                changed = porcelain ? porcelain.split('\n').length : 0;
              }
              return sendJson(res, { success: true, data: { branch, changed, initialized: true } });
            } catch {
              return sendJson(res, { success: true, data: { initialized: false } });
            }
          }

          // 快照列表（可按 scope 过滤）
          if (pathname === '/api/git/log' && req.method === 'GET') {
            const scope = resolveScope(getQuery(req).get('scope'));
            const logArgs = ['log', '--pretty=format:%h|%ad|%s', '--date=format:%Y-%m-%d %H:%M'];
            if (!scope) {
              return sendJson(res, { success: true, data: parseLog(await git([...logArgs, '-30'])) });
            }
            // 条目级：本地备份 ref 的历史 + 分支上历史上动过该路径的提交（兼容旧数据），合并去重按时间倒序
            const ref = backupRefName(scope);
            const merged = new Map<string, { hash: string; date: string; message: string }>();
            if (await refExists(ref)) {
              for (const item of parseLog(await git([...logArgs, '-30', ref]))) merged.set(item.hash, item);
            }
            for (const item of parseLog(await git([...logArgs, '-30', '--', scope]))) merged.set(item.hash, item);
            const list = [...merged.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
            return sendJson(res, { success: true, data: list });
          }

          // 创建快照
          // - 条目被 .gitignore 忽略（使用者的个人原型、src/docs）：写成本地备份提交，挂到
          //   refs/hatch-backups/<scope>，不推进当前分支（原因见文件顶部 BACKUP_REF_PREFIX 说明）
          // - 其余（示例原型、组件、主题、数据表）与全仓库快照：保持原来的普通提交，可正常 push
          if (pathname === '/api/git/snapshot' && req.method === 'POST') {
            const body = await readJsonBody<{ message?: string; scope?: string }>(req);
            const scope = resolveScope(body.scope ?? null);
            const defaultMsg = `快照 ${new Date().toLocaleString('zh-CN')}`;
            const message = (body.message || defaultMsg).slice(0, 200);
            // 1. 清空暂存区（不动工作区文件），确保本次快照只包含目标路径
            try { await git(['reset', '-q']); } catch { /* 空仓库时忽略 */ }
            // 2. 暂存目标路径（含新增/修改/删除）
            // 若 scope 指向被 .gitignore 忽略的条目（原型/文档），用 -f 强制纳入快照；
            // 全仓库快照（scope 为空）不加 -f，避免把 node_modules 等忽略项强制纳入
            const addArgs = scope ? ['add', '-A', '-f', '--', scope] : ['add', '-A', '--', '.'];
            await git(addArgs);
            // 3. 检查暂存区是否有内容
            const staged = await git(['diff', '--cached', '--name-only']);
            if (!staged) {
              return sendError(res, scope ? '该原型没有需要保存的变更' : '没有需要保存的变更');
            }
            if (scope && (await isIgnoredPath(scope))) {
              const ref = backupRefName(scope);
              try {
                const hash = await createBackupCommit(ref, message);
                // 4. 把暂存区还原成 HEAD，避免把备份内容留在使用者的待提交状态里
                try { await git(['reset', '-q']); } catch { /* 忽略 */ }
                return sendJson(res, { success: true, data: { hash: hash.slice(0, 7) } });
              } catch (e: any) {
                try { await git(['reset', '-q']); } catch { /* 忽略 */ }
                return sendError(res, `保存快照失败：${e.stderr || e.message}`, 500);
              }
            }
            try {
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
            // 清理快照之后新建的未跟踪文件，确保完整回滚（否则 AI 新建的文件会残留）。
            // scope 限定时额外加 -x：原型目录被 .gitignore 忽略，不加 -x 这些新文件清不掉；
            // 全仓库回滚（scope 为空）绝不能加 -x，否则会连 node_modules 一起删掉。
            await git(scope ? ['clean', '-fdx', '--', scope] : ['clean', '-fd', '--', '.']);
            return sendJson(res, { success: true });
          }

          // 当前工作区相对 HEAD 的代码改动（可按 scope 过滤），用于发布后展示给产品同学确认
          if (pathname === '/api/git/diff' && req.method === 'GET') {
            const scope = resolveScope(getQuery(req).get('scope'));
            try {
              const diff = await git(['--no-pager', 'diff', 'HEAD', '--', scope || '.']);
              return sendJson(res, { success: true, data: { diff } });
            } catch {
              return sendJson(res, { success: true, data: { diff: '' } });
            }
          }

          // 单次提交相对其父提交的改动（git show），用于在 GitPanel 查看"这次改了什么"
          if (pathname === '/api/git/show' && req.method === 'GET') {
            const hash = getQuery(req).get('hash');
            if (!hash || !/^[0-9a-f]{6,40}$/i.test(hash)) return sendError(res, '快照标识不合法');
            const scope = resolveScope(getQuery(req).get('scope'));
            try {
              const args = ['--no-pager', 'show', '--format=medium', hash];
              if (scope) args.push('--', scope);
              const diff = await git(args);
              return sendJson(res, { success: true, data: { diff } });
            } catch (e: any) {
              return sendError(res, `读取提交内容失败：${e.stderr || e.message}`, 500);
            }
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || 'Git 操作失败', 500);
        }
      });
    },
  };
}
