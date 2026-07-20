import type { Plugin } from 'vite';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { sendJson, sendError, readJsonBody, getPathname } from './utils';

const execFileAsync = promisify(execFile);

/** 支持的 AI CLI 及其非交互执行参数（prompt 经 stdin 传入，避免命令行注入） */
const CLI_DEFS: Record<string, { bin: string[]; args: string[]; label: string }> = {
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

function runCli(bin: string, args: string[], prompt: string, timeoutMs: number): Promise<{ output: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
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
    child.stdout?.on('data', (d) => (output += d.toString()));
    child.stderr?.on('data', (d) => (output += d.toString()));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve({ output: output.trim(), timedOut });
    });
    child.stdin?.write(prompt);
    child.stdin?.end();
  });
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

            const { output, timedOut } = await runCli(bin, def.args, body.prompt, 180_000);
            return sendJson(res, { success: true, data: { output, timedOut } });
          }

          next();
        } catch (e: any) {
          sendError(res, e.message || 'AI CLI 执行失败', 500);
        }
      });
    },
  };
}
