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

/** CodeBuddy CLI 支持的模型（来自 `codebuddy --help` 的 --model 候选，仅对 codebuddy 生效） */
export const SUPPORTED_MODELS: { id: string; label: string }[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'kimi-k3-2', label: 'Kimi K3.2' },
  { id: 'kimi-k2.7', label: 'Kimi K2.7' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
  { id: 'glm-5.2', label: 'GLM 5.2' },
  { id: 'glm-5.1', label: 'GLM 5.1' },
  { id: 'glm-5v-turbo', label: 'GLM 5V Turbo' },
  { id: 'minimax-m3-pay', label: 'MiniMax M3' },
  { id: 'minimax-m2.7', label: 'MiniMax M2.7' },
  { id: 'hy3', label: 'Hy3' },
  { id: 'custom-local:kimi-k2.5', label: '本地 Kimi K2.5' },
  { id: 'custom-local:GPT5.4', label: '本地 GPT 5.4' },
  { id: 'custom-local:K2.7 Code', label: '本地 K2.7 Code' },
  { id: 'custom-local:deepseek-v4-pro', label: '本地 DeepSeek V4 Pro' },
  { id: 'custom-local:deepseek-v4-flash', label: '本地 DeepSeek V4 Flash' },
  { id: 'custom-local:kimi-k2.6', label: '本地 Kimi K2.6' },
];

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

interface RunCliOptions {
  /** true = codebuddy `--output-format stream-json`：stdout 每行一个 NDJSON 事件，需逐行解析 */
  streamJson?: boolean;
  /** 正文增量（不含思考过程） */
  onChunk?: (chunk: string) => void;
  /** 思考过程增量（thinking_delta），用于前端展示"AI 正在思考" */
  onThinking?: (chunk: string) => void;
  /** 执行失败（如 401 认证失败）：让前端明确看到错误而不是空回复 */
  onError?: (message: string) => void;
}

/**
 * 强制终止 AI 子进程及其整个进程树，完成后回调 onDone（用于及时释放互斥锁）。
 * Windows 下 spawn 用的是 cmd 包装进程：child.kill() 只杀掉 cmd.exe，
 * 真实 CLI 进程会变成孤儿继续运行并持有 stdio 管道，导致 'close' 事件永不触发、
 * 互斥锁无法释放（后续请求全部 429）。因此必须按进程树强杀（taskkill /T /F）。
 */
function killTree(child: ChildProcess, onDone?: () => void) {
  const finish = () => {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    onDone?.();
  };
  try {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => finish());
    } else {
      // Unix：负 pid = 杀整个进程组（含孙进程）
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        /* ignore */
      }
      finish();
    }
  } catch {
    finish();
  }
}

function runCli(
  bin: string,
  args: string[],
  prompt: string,
  timeoutMs: number,
  opts: RunCliOptions = {},
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
    killTree(child);
  }, timeoutMs);
  const pushText = (s: string) => {
    output += s;
    opts.onChunk?.(s);
  };
  const pushThinking = (s: string) => {
    opts.onThinking?.(s);
  };

  if (opts.streamJson) {
    // codebuddy stream-json：按行解析 NDJSON 事件，只转发增量文本 / 思考过程
    let buf = '';
    const handleLine = (raw: string) => {
      const line = raw.replace(/\r$/, '');
      if (!line.trim()) return;
      let evt: any;
      try {
        evt = JSON.parse(line);
      } catch {
        return; // 非 JSON 行（如 CLI 自身 banner），忽略
      }
      if (evt.type === 'stream_event') {
        const e = evt.event;
        if (e?.type === 'content_block_delta' && e.delta) {
          if (e.delta.type === 'text_delta' && typeof e.delta.text === 'string') {
            pushText(e.delta.text);
          } else if (e.delta.type === 'thinking_delta' && typeof e.delta.thinking === 'string') {
            pushThinking(e.delta.thinking);
          }
        }
      } else if (evt.type === 'result') {
        // 执行失败（401 认证失败等）：把错误明确上报，避免前端收到空回复
        if (evt.is_error) {
          const errMsg = Array.isArray(evt.errors) && evt.errors.length
            ? evt.errors.join('; ')
            : (evt.error || 'AI 执行失败');
          output = `[错误] ${errMsg}`;
          opts.onError?.(errMsg);
        } else if (typeof evt.result === 'string' && evt.result) {
          // 最终结果兜底：部分场景无流式事件（如任务被截断），以 result 为准
          output = evt.result;
        }
      }
      // 其余事件（system / file-history-snapshot / assistant 完整块等）忽略，避免重复输出
    };
    child.stdout?.on('data', (d) => {
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    });
  } else {
    child.stdout?.on('data', (d) => pushText(d.toString()));
  }
  child.stderr?.on('data', (d) => pushText(d.toString()));
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
            return sendJson(res, {
              success: true,
              data: { clis: Object.fromEntries(entries), models: SUPPORTED_MODELS },
            });
          }

          if (pathname === '/api/ai/execute' && req.method === 'POST') {
            const body = await readJsonBody<{ cli?: string; prompt?: string; model?: string; fallbackModel?: string }>(req);
            const def = body.cli ? CLI_DEFS[body.cli] : null;
            if (!def) return sendError(res, '不支持的 CLI');
            if (!body.prompt?.trim()) return sendError(res, 'prompt 不能为空');

            // 固定模型：仅 codebuddy 支持 --model / --fallback-model，其它 CLI 忽略
            const args = [...def.args];
            const isCodebuddy = def === CLI_DEFS.codebuddy;
            if (isCodebuddy) {
              const model = body.model?.trim();
              if (model) args.push('--model', model);
              const fallback = body.fallbackModel?.trim();
              if (fallback) args.push('--fallback-model', fallback);
              // 实时流式输出：stream-json + 逐 token 增量。否则 text 模式下 codebuddy
              // 会把所有输出缓冲到整个任务结束才一次性返回，长任务期间前端只能看到倒计时。
              args.push('--output-format', 'stream-json', '--include-partial-messages');
            }

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
            const { promise, child } = runCli(bin, args, body.prompt!, 600_000, {
              streamJson: isCodebuddy,
              onChunk: (chunk) => {
                if (clientClosed) return;
                try { res.write(JSON.stringify({ type: 'chunk', data: chunk }) + '\n'); } catch {}
              },
              onThinking: (chunk) => {
                if (clientClosed) return;
                try { res.write(JSON.stringify({ type: 'thinking', data: chunk }) + '\n'); } catch {}
              },
              onError: (message) => {
                if (clientClosed) return;
                try { res.write(JSON.stringify({ type: 'error', error: message }) + '\n'); } catch {}
              },
            });

            // 客户端断开/刷新页面时立即终止子进程树，防止 AI 继续改代码；
            // 进程树强杀完成后立即释放互斥锁，让用户停止后马上能发起新任务；
            // 另加 3s 兜底：即使 killTree 回调未触发（极端情况），也强制释放锁，避免"停止后一直 429"
            req.on('close', () => {
              clientClosed = true;
              let forceTimer: NodeJS.Timeout | undefined;
              const release = () => {
                clearTimeout(forceTimer);
                aiRunning = false;
                aiRunningSince = 0;
              };
              forceTimer = setTimeout(release, 3000);
              killTree(child, release);
            });

            const startedAt = Date.now();
            res.write(
              JSON.stringify({ type: 'start', cli: body.cli, label: def.label, model: body.model || null }) + '\n',
            );
            // 心跳：每 5s 发一次 ping，让前端持续确认进程存活（也避免代理/浏览器空闲断连）
            const heartbeat = setInterval(() => {
              if (clientClosed) {
                clearInterval(heartbeat);
                return;
              }
              try {
                res.write(
                  JSON.stringify({ type: 'ping', elapsed: Math.round((Date.now() - startedAt) / 1000) }) + '\n',
                );
              } catch {
                clearInterval(heartbeat);
              }
            }, 5000);
            try {
              const { output, timedOut } = await promise;
              res.write(JSON.stringify({ type: 'done', output, timedOut }) + '\n');
            } catch (e: any) {
              res.write(JSON.stringify({ type: 'error', error: e.message || 'AI CLI 执行失败' }) + '\n');
            } finally {
              clearInterval(heartbeat);
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
