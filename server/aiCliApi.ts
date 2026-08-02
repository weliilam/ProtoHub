import type { Plugin } from 'vite';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { sendJson, sendError, readJsonBody, getPathname } from './utils';

const execFileAsync = promisify(execFile);

/** 支持的 AI CLI 及其非交互执行参数（prompt 经 stdin 传入，避免命令行注入） */
const CLI_DEFS: Record<string, { bin: string[]; args: string[]; label: string }> = {
  codebuddy: { bin: ['codebuddy'], args: ['-p', '--permission-mode', 'bypassPermissions'], label: 'CodeBuddy' },
  claude: { bin: ['claude'], args: ['-p'], label: 'Claude Code' },
  'cursor-agent': { bin: ['cursor-agent'], args: ['-p'], label: 'Cursor Agent' },
  gemini: { bin: ['gemini'], args: ['-p'], label: 'Gemini CLI' },
  codex: { bin: ['codex'], args: ['exec', '-'], label: 'OpenAI Codex' },
  opencode: { bin: ['opencode'], args: ['run'], label: 'OpenCode' },
};

async function which(bin: string): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(cmd, [bin]);
    return true;
  } catch {
    return false;
  }
}

/** 全局互斥锁：同一时刻只允许一个 AI CLI 在跑，避免并发改代码互相覆盖 */
let aiRunning = false;
let aiRunningSince = 0;
/** 互斥锁兜底超时（ms）：必须 >= 执行超时，否则 AI 正常跑完前锁就被重置，导致并发改代码 */
const AI_RUNNING_TIMEOUT = 660_000; // 11 分钟（执行超时 10 分钟 + 1 分钟缓冲）

function runCli(
  bin: string,
  args: string[],
  prompt: string,
  timeoutMs: number,
  onProgress?: (chunk: string) => void,
): { promise: Promise<{ output: string; timedOut: boolean }>; child: ChildProcess } {
  const child = spawn(bin, args, {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  let output = '';
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, timeoutMs);
  const push = (d: any) => {
    const s = d.toString();
    output += s;
    onProgress?.(s);
  };
  child.stdout?.on('data', push);
  child.stderr?.on('data', push);
  const promise = new Promise<{ output: string; timedOut: boolean }>((resolve, reject) => {
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ output: output.trim(), timedOut });
    });
  });
  child.stdin?.write(prompt);
  child.stdin?.end();
  return { promise, child };
}

export function aiCliApiPlugin(): Plugin {
  return {
    name: 'proto-hub-ai-cli-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/ai/')) return next();

        try {
          if (pathname === '/api/ai/status' && req.method === 'GET') {
            const entries = await Promise.all(
              Object.entries(CLI_DEFS).map(async ([key, def]) => {
                const results = await Promise.all(def.bin.map((b) => which(b)));
                return [key, { label: def.label, available: results.some(Boolean) }] as const;
              }),
            );
            return sendJson(res, { success: true, data: Object.fromEntries(entries) });
          }

          if (pathname === '/api/ai/execute' && req.method === 'POST') {
            const body = await readJsonBody<{ cli?: string; prompt?: string }>(req);
            const def = body.cli ? CLI_DEFS[body.cli] : null;
            if (!def) return sendError(res, '不支持的 CLI');
            if (!body.prompt?.trim()) return sendError(res, 'prompt 不能为空');

            const bin = def.bin[0];
            if (!(await which(bin))) return sendError(res, `${def.label}（${bin}）未安装或不在 PATH 中`);

            // 互斥锁：已有 AI 在运行时拒绝并发执行，避免同时改代码互相覆盖
            if (aiRunning) {
              // 兜底：如果锁超过超时时间未释放（进程崩溃导致），自动重置
              if (Date.now() - aiRunningSince > AI_RUNNING_TIMEOUT) {
                aiRunning = false;
                aiRunningSince = 0;
              } else {
                return sendError(res, '已有 AI 任务正在执行，请等待其完成后再试', 429);
              }
            }

            aiRunning = true;
            aiRunningSince = Date.now();

            // 强制即时发送头部，避免浏览器等待首段数据才建立流
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 代理缓冲
            res.flushHeaders();

            // 用 NDJSON 流式回传执行进度，前端可实时看到 AI 输出
            let clientClosed = false;
            const { promise, child } = runCli(bin, def.args, body.prompt!, 600_000, (chunk) => {
              if (clientClosed) return;
              try { res.write(JSON.stringify({ type: 'chunk', data: chunk }) + '\n'); } catch {}
            });

            // 客户端断开/刷新页面时立即杀子进程，防止 AI 继续改代码
            req.on('close', () => {
              clientClosed = true;
              child.kill();
            });

            res.write(JSON.stringify({ type: 'start', cli: body.cli, label: def.label }) + '\n');
            try {
              const { output, timedOut } = await promise;
              res.write(JSON.stringify({ type: 'done', output, timedOut }) + '\n');
            } catch (e: any) {
              res.write(JSON.stringify({ type: 'error', error: e.message || 'AI CLI 执行失败' }) + '\n');
            } finally {
              aiRunning = false;
              aiRunningSince = 0;
              res.end();
            }
            return;
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || 'AI CLI 执行失败', 500);
        }
      });
    },
  };
}
