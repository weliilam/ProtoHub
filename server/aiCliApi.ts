import type { Plugin } from 'vite';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { basename, join } from 'path';
import { safeResolve, sendJson, sendError, readJsonBody, getPathname } from './utils';

const execFileAsync = promisify(execFile);

/** 支持的 AI CLI 及其非交互执行参数（prompt 经 stdin 传入，避免命令行注入） */
const CLI_DEFS: Record<string, { bin: string[]; args: string[]; label: string }> = {
  codebuddy: { bin: ['codebuddy'], args: ['-p', '--permission-mode', 'bypassPermissions'], label: 'CodeBuddy' },
  workbuddy: { bin: ['codebuddy'], args: ['-p', '--permission-mode', 'bypassPermissions'], label: 'WorkBuddy' },
  claude: { bin: ['claude'], args: ['-p'], label: 'Claude Code' },
  'cursor-agent': { bin: ['cursor-agent'], args: ['-p'], label: 'Cursor Agent' },
  gemini: { bin: ['gemini'], args: ['-p'], label: 'Gemini CLI' },
  codex: { bin: ['codex'], args: ['exec', '-'], label: 'OpenAI Codex' },
  opencode: { bin: ['opencode'], args: ['run'], label: 'OpenCode' },
};

/** 模型是否支持图片输入（多模态）。前端据此决定是否允许粘贴/上传图片 */
export interface AiModelDef {
  id: string;
  label: string;
  /** true = 多模态，可理解图片；false = 纯文本模型，图片对它不可见 */
  vision: boolean;
}

/** 自定义（本地）模型在 --model 候选里的前缀，CodeBuddy CLI 约定 */
const LOCAL_MODEL_PREFIX = 'custom-local:';

/** 本地自定义模型配置：取自 ~/.codebuddy/models.json 的 models[] */
interface LocalModelCfg {
  id: string;
  name?: string;
  /** 关键能力位：本地模型是否支持图片输入，由模型配置直供，不再靠猜 */
  supportsImages?: boolean;
}

/** 内置模型的显示名（CLI 帮助文本只有 id，这里补可读标题，未命中则直接用 id） */
const BUILTIN_LABELS: Record<string, string> = {
  'hy4-preview': 'Hy4 Preview',
  hy3: 'Hy3',
  'hy3-x': 'Hy3 X',
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4.1-flash': 'DeepSeek V4.1 Flash',
  'kimi-k3-2': 'Kimi K3.2',
  'kimi-k2.8-preview': 'Kimi K2.8 Preview',
  'kimi-k2.7': 'Kimi K2.7',
  'kimi-k2.6': 'Kimi K2.6',
  'glm-5.3': 'GLM 5.3',
  'glm-5.3-flash': 'GLM 5.3 Flash',
  'glm-5.3-flashx': 'GLM 5.3 FlashX',
  'glm-5.2': 'GLM 5.2',
  'glm-5.1': 'GLM 5.1',
  'glm-5v-turbo': 'GLM 5V Turbo',
  'minimax-m3-pay': 'MiniMax M3',
  'minimax-m2.7': 'MiniMax M2.7',
};

/** 本地模型名里的常见厂商词，按品牌大小写还原 */
const MODEL_NAME_WORDS: Record<string, string> = {
  deepseek: 'DeepSeek',
  kimi: 'Kimi',
  qwen: 'Qwen',
  glm: 'GLM',
  gpt: 'GPT',
  minimax: 'MiniMax',
};

/** 本地模型 id 转可读标题：deepseek-v4-flash → DeepSeek V4 Flash（版本号 3.7 / 5.4 原样保留） */
function prettyModelName(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split('.')
        .map((seg) => {
          // 纯数字段是版本号（如 3.7），保持原样
          if (!/^[a-z]/.test(seg)) return seg;
          const matched = /^([a-z]+)(.*)$/.exec(seg);
          if (!matched) return seg;
          const head = MODEL_NAME_WORDS[matched[1]] || matched[1].charAt(0).toUpperCase() + matched[1].slice(1);
          return head + matched[2];
        })
        .join('.'),
    )
    .join(' ');
}

/** 名称特征兜底：CLI 内置模型帮助文本不含能力位，按命名推断是否多模态 */
const VISION_NAME_RE = /vision|v[-_]?turbo|(^|[-:_])[45]v([-:_]|$)|[-_:]vl([-_:]|$)/i;

/** 读不到 CLI 候选列表时的兜底清单，保证面板仍然可用 */
const FALLBACK_MODELS: AiModelDef[] = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', vision: false },
  { id: 'kimi-k2.7', label: 'Kimi K2.7', vision: false },
  { id: 'kimi-k2.6', label: 'Kimi K2.6', vision: false },
  { id: 'glm-5.2', label: 'GLM 5.2', vision: false },
  { id: 'glm-5v-turbo', label: 'GLM 5V Turbo', vision: true },
  { id: 'minimax-m2.7', label: 'MiniMax M2.7', vision: false },
  { id: 'hy3', label: 'Hy3', vision: false },
];

/** 读取本地自定义模型配置（~/.codebuddy/models.json），文件缺失/损坏时返回空数组 */
function readLocalModels(): LocalModelCfg[] {
  const file = join(homedir(), '.codebuddy', 'models.json');
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { models?: LocalModelCfg[] };
    return Array.isArray(parsed.models) ? parsed.models.filter((m) => !!m?.id) : [];
  } catch {
    return [];
  }
}

/** `codebuddy --help` 输出的候选模型 id 清单（解析结果进程内缓存，避免每次请求都起进程） */
let helpModels: { at: number; ids: string[] } | null = null;
const HELP_MODELS_TTL = 5 * 60 * 1000;

async function listCliModelIds(): Promise<string[]> {
  if (helpModels && Date.now() - helpModels.at < HELP_MODELS_TTL) return helpModels.ids;
  let ids: string[] = [];
  try {
    // Windows 上 codebuddy 实际是 codebuddy.cmd，execFile 不能直接拉起 .cmd，
    // 这里显式用 cmd.exe /c 执行（不开 shell:true，避免参数拼接带来的风险）
    const win = process.platform === 'win32';
    const { stdout } = await execFileAsync(win ? 'cmd.exe' : 'codebuddy', win ? ['/c', 'codebuddy', '--help'] : ['--help'], {
      timeout: 20_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    // 形如：Currently supported: (hy4-preview, hy3, ..., custom-local:deepseek-flash, ...)
    const matched = /Currently supported:\s*\(([^)]*)\)/.exec(stdout || '');
    if (matched) {
      ids = matched[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch {
    /* CLI 未安装或执行失败：退回兜底清单 */
  }
  if (ids.length) helpModels = { at: Date.now(), ids };
  return ids;
}

/**
 * 当前可选的模型清单。
 * 每次都按「CLI --help 的 --model 候选」动态生成——本地 models.json 里新增/改名/删除模型后，
 * 面板上的可选模型会自动跟随，不会再出现"本地明明有 deepseek-flash 多模态却选不到"的情况。
 * 多模态判定：custom-local:* 直接读 models.json 的 supportsImages；内置模型按名称特征推断。
 */
export async function getSupportedModels(): Promise<AiModelDef[]> {
  const ids = await listCliModelIds();
  if (!ids.length) return FALLBACK_MODELS;
  const localMap = new Map(readLocalModels().map((m) => [m.id, m]));
  return ids.map((id) => {
    if (id.startsWith(LOCAL_MODEL_PREFIX)) {
      const key = id.slice(LOCAL_MODEL_PREFIX.length);
      const cfg = localMap.get(key);
      // 用户在 models.json 里写了自定义 name 就用它，否则把 id 美化成人读得懂的标题
      const name = cfg?.name && cfg.name !== key ? cfg.name : prettyModelName(key);
      return { id, label: `本地 ${name}`, vision: !!cfg?.supportsImages };
    }
    return { id, label: BUILTIN_LABELS[id] || id, vision: VISION_NAME_RE.test(id) };
  });
}

/** 判定模型是否支持图片输入：本地模型查 models.json，其余按名称特征兜底 */
export function isVisionModel(id: string): boolean {
  if (!id) return false;
  if (id.startsWith(LOCAL_MODEL_PREFIX)) {
    const key = id.slice(LOCAL_MODEL_PREFIX.length);
    const cfg = readLocalModels().find((m) => m.id === key);
    return !!cfg?.supportsImages;
  }
  return VISION_NAME_RE.test(id);
}

/** 图片上传：仅接受这几种格式，扩展名由 MIME 决定，不采信前端文件名 */
const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
/** 单张图片体积上限 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** 图片落盘目录（相对项目根）：AI CLI 以项目根为 cwd，可用相对路径直接读取 */
const IMAGE_DIR_REL = '.codebuddy/tmp/ai-images';
/** 旧图片保留时长，超过即清理，避免临时目录无限增长 */
const IMAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** 清理过期图片（上传时顺带执行，无需额外的生命周期管理） */
function cleanupOldImages() {
  const absDir = safeResolve(IMAGE_DIR_REL);
  if (!absDir || !existsSync(absDir)) return;
  const now = Date.now();
  try {
    for (const name of readdirSync(absDir)) {
      const p = join(absDir, name);
      try {
        if (now - statSync(p).mtimeMs > IMAGE_TTL_MS) unlinkSync(p);
      } catch {
        /* 单个文件清理失败不影响上传 */
      }
    }
  } catch {
    /* 目录不可读时忽略 */
  }
}

async function which(bin: string): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    await execFileAsync(cmd, [bin]);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检测 CLI 是否已完成授权（纯文件 IO，毫秒级）。
 * - codebuddy/workbuddy：检查 ~/.codebuddy/user-state.json 是否存在（CLI 首次初始化后生成）
 * - 其他 CLI：暂不做授权检测，返回 true（取决于各 CLI 自身机制）
 */
function checkAuthorized(cliKey: string): boolean {
  if (cliKey === 'codebuddy' || cliKey === 'workbuddy') {
    const home = homedir();
    // user-state.json 是 codebuddy CLI 首次启动/初始化时生成的配置文件，
    // 其存在即表示 CLI 已完成基本初始化（含授权）
    return existsSync(join(home, '.codebuddy', 'user-state.json'));
  }
  // 其他 CLI 暂不主动检测授权状态
  return true;
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
                const available = results.some(Boolean);
                const authorized = available && checkAuthorized(key);
                return [key, { label: def.label, available, authorized }] as const;
              }),
            );
            return sendJson(res, {
              success: true,
              data: { clis: Object.fromEntries(entries), models: await getSupportedModels() },
            });
          }

          /**
           * 图片上传：前端把剪贴板/选择的图片转成 dataURL 发过来，这里落盘成真实文件。
           * 必须落盘——AI CLI 读图靠的是 Read 工具读本地文件，base64 字符串它无法识别。
           */
          if (pathname === '/api/ai/upload' && req.method === 'POST') {
            // 先按 Content-Length 挡掉超大请求体，避免整个 body 被读进内存
            const declared = Number(req.headers['content-length'] || 0);
            if (declared > MAX_IMAGE_BYTES * 1.4) {
              return sendError(res, `单张图片不能超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`, 413);
            }
            const body = await readJsonBody<{ name?: string; dataUrl?: string }>(req);
            const matched = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]+)$/.exec(body.dataUrl || '');
            if (!matched) return sendError(res, '图片数据格式不正确（需为 dataURL base64）');
            const ext = IMAGE_MIME_EXT[matched[1].toLowerCase()];
            if (!ext) return sendError(res, '仅支持 png / jpg / gif / webp 格式的图片');
            const buf = Buffer.from(matched[2], 'base64');
            if (!buf.length) return sendError(res, '图片内容为空');
            if (buf.length > MAX_IMAGE_BYTES) {
              return sendError(res, `单张图片不能超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
            }
            const absDir = safeResolve(IMAGE_DIR_REL);
            if (!absDir) return sendError(res, '图片存放目录不合法', 500);
            mkdirSync(absDir, { recursive: true });
            cleanupOldImages();
            // 文件名只由时间戳 + 随机串 + MIME 决定的扩展名组成，不使用前端传来的名字
            const file = join(absDir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
            writeFileSync(file, buf);
            return sendJson(res, {
              success: true,
              data: { path: `${IMAGE_DIR_REL}/${basename(file)}`, size: buf.length },
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
