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

/**
 * 组装 CLI 非交互执行参数。
 * 固定模型（--model / --fallback-model）与实时流式输出只有 codebuddy 支持，
 * 其它 CLI 保持各自原生参数。单页 AI 助手与批量任务共用，避免两处参数漂移。
 */
export function buildCliArgs(cliKey: string, model?: string | null, fallbackModel?: string | null): string[] {
  const def = CLI_DEFS[cliKey];
  if (!def) throw new Error('不支持的 CLI');
  const args = [...def.args];
  if (cliKey === 'codebuddy') {
    const m = model?.trim();
    if (m) args.push('--model', m);
    const f = fallbackModel?.trim();
    if (f) args.push('--fallback-model', f);
    // stream-json + 逐 token 增量：text 模式下 codebuddy 会把输出缓冲到任务结束才返回
    args.push('--output-format', 'stream-json', '--include-partial-messages');
  }
  return args;
}

/**
 * AI 任务调度：同一时刻仍只允许一个 AI CLI 在跑（串行执行，避免并发改代码互相覆盖），
 * 但不再"拒绝"后来者 —— 后来的任务进入 FIFO 队列，等前一个跑完自动开始，
 * 并通过 /api/ai/task 把"在跑什么、跑了多久、还要多久、队列里有几个"暴露给前端。
 */
interface RunningTask {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  /** 操作目标（如 src/prototypes/xxx/），用于展示"正在改哪个页面" */
  target: string;
  /** 指令摘要（prompt 前 60 字） */
  summary: string;
  /** 批注发布任务对应的批注 id（其它任务为空）：透出给前端展示"这 N 条批注正在发布中" */
  annotationIds?: string[];
  startedAt: number;
  /** 最近一次收到输出的时间，用于判断"是否卡住" */
  lastChunkAt: number;
}

interface QueueEntry {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  target: string;
  summary: string;
  annotationIds?: string[];
  enqueuedAt: number;
  /** 调度器唤醒：true = 轮到执行；false = 已取消（客户端断开） */
  grant: (ok: boolean) => void;
}

/** 正在执行的任务（null = 空闲） */
let currentTask: RunningTask | null = null;
/** 等待执行的任务队列（FIFO） */
const pendingQueue: QueueEntry[] = [];
/** 队列长度上限：串行执行，队太长等待无意义，同时也防误操作堆积 */
const MAX_QUEUE = 5;

/** 从环境变量读超时配置（ms）；非法或非正数时回退默认值 */
function envMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/**
 * 空闲超时（ms）：连续这么久没有收到任何输出（stdout / stderr / 流式事件）即判定卡死并强杀。
 *
 * 按"空闲"而非"总时长"判定，是因为真正要防的是进程僵死，而不是任务本身耗时长 ——
 * 长任务只要持续有输出就应该让它跑完，一刀切的总时长会误杀正常任务。
 * 可用环境变量 HATCH_AI_IDLE_MS 覆盖（如 180000 = 3 分钟）。
 */
const IDLE_TIMEOUT_MS = envMs('HATCH_AI_IDLE_MS', 5 * 60_000);

/**
 * 单任务总时长上限（ms）：无论是否持续有输出都不会超过。
 *
 * 串行执行下必须留这道闸：空闲超时防得住"卡死"，防不住"正常但极慢" ——
 * 一个跑几小时的任务会把后面所有排队任务堵死。
 * 可用环境变量 HATCH_AI_MAX_MS 覆盖。
 */
const MAX_TOTAL_MS = envMs('HATCH_AI_MAX_MS', 40 * 60_000);

/**
 * 占位兜底回收（ms）：空闲超时 + 1 分钟缓冲。极端情况下（进程回调未触发）占位一直不释放会导致队列永久卡死。
 *
 * 判定依据必须是"最后活跃时间"（lastChunkAt）而不是"开始时间"：正常跑的长任务 lastChunkAt 一直在推进，
 * 不该被回收；只有真的没动静了才算僵尸。
 */
const TASK_STALE_MS = IDLE_TIMEOUT_MS + 60_000;

/**
 * 正在运行的子进程（taskId → child）。
 *
 * 兜底回收（reapStaleTask）命中时必须真正终止进程：只清空槽位引用会让被判"卡死"的 CLI
 * 继续在后台改文件，而槽位已经放行给下一个任务 —— 两个 CLI 同时改同一个项目。
 * 这会破坏"同一时刻只有一个 CLI 改代码"这个前提，批量任务基于串行假设的改动统计与回滚都会串。
 */
const runningChildren = new Map<string, ChildProcess>();

/** 历史任务耗时（用于估算 ETA），按 cli+model 分组取中位数 */
const durationHistory: { key: string; ms: number }[] = [];
const DURATION_HISTORY_MAX = 50;
/** 无历史样本时的兜底预估（秒） */
const DEFAULT_ETA_SEC = 180;

function durationKey(cli: string, model: string | null): string {
  return `${cli}::${model || ''}`;
}

function recordDuration(cli: string, model: string | null, ms: number) {
  durationHistory.push({ key: durationKey(cli, model), ms });
  if (durationHistory.length > DURATION_HISTORY_MAX) {
    durationHistory.splice(0, durationHistory.length - DURATION_HISTORY_MAX);
  }
}

/** 预估某类任务耗时（秒）：取同 cli+model 的历史中位数（比均值抗长尾），样本不足时用兜底值 */
function estimateDurationSec(cli: string, model: string | null): number {
  const samples = durationHistory
    .filter((h) => h.key === durationKey(cli, model))
    .map((h) => h.ms)
    .sort((a, b) => a - b);
  if (!samples.length) return DEFAULT_ETA_SEC;
  const mid = Math.floor(samples.length / 2);
  const median = samples.length % 2 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2;
  return Math.max(15, Math.round(median / 1000));
}

function makeTaskId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** prompt → 单行摘要，仅用于"正在改什么"的展示 */
function summarizePrompt(prompt: string): string {
  const flat = prompt.replace(/\s+/g, ' ').trim();
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat;
}

/** 队列快照（含排队位置与已等待时长） */
function queueSnapshot() {
  const now = Date.now();
  return pendingQueue.map((q, i) => ({
    id: q.id,
    cli: q.cli,
    label: q.label,
    model: q.model,
    target: q.target,
    summary: q.summary,
    annotationIds: q.annotationIds,
    enqueuedAt: q.enqueuedAt,
    waitedSec: Math.round((now - q.enqueuedAt) / 1000),
    position: i + 1,
  }));
}

/** 某排队任务预计还要等多少秒 = 正在跑的剩余时间 + 它前面所有任务的预估耗时 */
function estimateWaitSec(taskId: string): number {
  const idx = pendingQueue.findIndex((q) => q.id === taskId);
  if (idx < 0) return 0;
  let total = 0;
  if (currentTask) {
    const eta = estimateDurationSec(currentTask.cli, currentTask.model);
    const elapsed = Math.round((Date.now() - currentTask.startedAt) / 1000);
    total += Math.max(0, eta - elapsed);
  }
  for (let i = 0; i < idx; i++) total += estimateDurationSec(pendingQueue[i].cli, pendingQueue[i].model);
  return total;
}

/** 全局任务状态（GET /api/ai/task），前端据此展示"在改什么 / 多久 / 排队几人" */
function taskSnapshot() {
  const now = Date.now();
  if (!currentTask) {
    return { running: false, task: null, queue: queueSnapshot(), etaSec: 0 };
  }
  const elapsedSec = Math.round((now - currentTask.startedAt) / 1000);
  const etaSec = estimateDurationSec(currentTask.cli, currentTask.model);
  return {
    running: true,
    task: {
      id: currentTask.id,
      cli: currentTask.cli,
      label: currentTask.label,
      model: currentTask.model,
      target: currentTask.target,
      summary: currentTask.summary,
      annotationIds: currentTask.annotationIds,
      startedAt: currentTask.startedAt,
      elapsedSec,
      etaSec,
      /** 预计剩余秒数；0 表示已超出预估（任务仍在跑） */
      remainSec: Math.max(0, etaSec - elapsedSec),
      /** 距上次输出多少秒，前端据此提示"可能卡住" */
      idleSec: Math.round((now - currentTask.lastChunkAt) / 1000),
    },
    queue: queueSnapshot(),
    etaSec,
  };
}

/** 从队列头唤醒下一个任务（仅在空闲时；grant 前先占位，避免同一时刻唤醒两个） */
function dispatchNextTask() {
  if (currentTask) return;
  const next = pendingQueue.shift();
  if (!next) return;
  const startedAt = Date.now();
  currentTask = {
    id: next.id, cli: next.cli, label: next.label, model: next.model,
    target: next.target, summary: next.summary, annotationIds: next.annotationIds,
    startedAt, lastChunkAt: startedAt,
  };
  next.grant(true);
}

/**
 * 兜底回收：极端情况下（进程回调未触发）占位一直不释放会导致队列永久卡死。
 *
 * 判定用 lastChunkAt（最后活跃时间）而不是 startedAt：长任务只要还在输出就不该被判定为僵尸。
 * 命中后必须先真正终止进程、再放行下一个 —— 旧实现在这里只清空引用不杀进程，
 * 一旦任务能活过阈值（空闲超时改造后必然如此），就会变成"新旧两个 CLI 同时改代码"。
 */
function reapStaleTask() {
  if (!currentTask) return;
  if (Date.now() - currentTask.lastChunkAt <= TASK_STALE_MS) return;
  const id = currentTask.id;
  const child = runningChildren.get(id);
  runningChildren.delete(id);
  if (child) killTree(child);
  // killTree 的 'close' 回调是异步的，这里直接清位并放行；之后 runCli 的收尾会因 id 不匹配而跳过
  if (currentTask?.id === id) currentTask = null;
  dispatchNextTask();
}

/** 任务被强制结束的原因：idle = 长时间无输出判定卡死；total = 撞到总时长上限 */
type RunCliTimeoutReason = 'idle' | 'total' | null;

interface RunCliOptions {
  /** true = codebuddy `--output-format stream-json`：stdout 每行一个 NDJSON 事件，需逐行解析 */
  streamJson?: boolean;
  /** 正文增量（不含思考过程） */
  onChunk?: (chunk: string) => void;
  /** 思考过程增量（thinking_delta），用于前端展示"AI 正在思考" */
  onThinking?: (chunk: string) => void;
  /** 任意一条输出到达时的回调：调用方自己的活跃度处理（打点已在 runCli 内部统一完成） */
  onActivity?: () => void;
  /** 执行失败（如 401 认证失败）：让前端明确看到错误而不是空回复 */
  onError?: (message: string) => void;
  /**
   * 所属执行槽位 id：传入后本进程登记到 runningChildren，
   * 兜底回收（reapStaleTask）命中时才能被真正强杀，而不是留下一个继续改文件的孤儿进程。
   */
  taskId?: string;
  /** 覆盖默认空闲超时（ms）；传 0 关闭空闲判定 */
  idleTimeoutMs?: number;
  /** 覆盖默认总时长上限（ms）；传 0 关闭上限 */
  maxTotalMs?: number;
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
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
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
  opts: RunCliOptions = {},
): {
  promise: Promise<{ output: string; timedOut: boolean; timeoutReason: RunCliTimeoutReason }>;
  child: ChildProcess;
} {
  const child = spawn(bin, args, {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  const idleLimitMs = opts.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
  const totalLimitMs = opts.maxTotalMs ?? MAX_TOTAL_MS;
  let output = '';
  let timeoutReason: RunCliTimeoutReason = null;
  let finished = false;
  let idleTimer: NodeJS.Timeout | null = null;
  let totalTimer: NodeJS.Timeout | null = null;

  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (totalTimer) clearTimeout(totalTimer);
    idleTimer = null;
    totalTimer = null;
  };
  /** 强制结束：记录原因并强杀进程树。两种超时只认先到的那个（幂等） */
  const forceStop = (reason: 'idle' | 'total') => {
    if (finished || timeoutReason) return;
    timeoutReason = reason;
    killTree(child);
  };
  /** 重置空闲倒计时：每收到一次输出就往后推，只有真的长时间没动静才会触发 */
  const armIdle = () => {
    if (finished || idleLimitMs <= 0) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => forceStop('idle'), idleLimitMs);
  };
  armIdle();
  if (totalLimitMs > 0) totalTimer = setTimeout(() => forceStop('total'), totalLimitMs);

  /**
   * 有动静：推后空闲倒计时，并刷新槽位的 lastChunkAt（前端 idleSec 与兜底回收都以此为准）。
   *
   * 打点放在最底层 —— stdout/stderr 的原始数据一到就算活跃，不依赖上层能否解析出文本。
   * 否则非 stream-json 的 CLI 在长时间工具调用期间完全静默（只在最后一次性吐结果），
   * 会被空闲超时误判成卡死。
   */
  const touch = () => {
    if (finished) return;
    armIdle();
    if (opts.taskId) touchTask(opts.taskId);
    opts.onActivity?.();
  };

  if (opts.taskId) runningChildren.set(opts.taskId, child);

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
      touch();
      buf += d.toString();
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        handleLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    });
  } else {
    child.stdout?.on('data', (d) => {
      touch();
      pushText(d.toString());
    });
  }
  child.stderr?.on('data', (d) => {
    touch();
    pushText(d.toString());
  });
  /** 收尾：停表并注销进程登记（taskId 若已被新任务复用则不能误删） */
  const settle = () => {
    finished = true;
    clearTimers();
    if (opts.taskId && runningChildren.get(opts.taskId) === child) runningChildren.delete(opts.taskId);
  };

  const promise = new Promise<{ output: string; timedOut: boolean; timeoutReason: RunCliTimeoutReason }>(
    (resolve, reject) => {
      child.on('error', (e) => {
        settle();
        reject(e);
      });
      child.on('close', () => {
        settle();
        resolve({ output: output.trim(), timedOut: timeoutReason !== null, timeoutReason });
      });
    },
  );
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
           * 全局 AI 任务状态：当前在跑什么、跑了多久、预计还要多久、队列里还排着几个。
           * 前端顶栏/面板据此展示（刷新页面、切换标签页同样能看到，不再只反映"本页发起的任务"）。
           */
          if (pathname === '/api/ai/task' && req.method === 'GET') {
            reapStaleTask();
            return sendJson(res, { success: true, data: taskSnapshot() });
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
            const body = await readJsonBody<{
              cli?: string;
              prompt?: string;
              model?: string;
              fallbackModel?: string;
              /** 操作目标（如 src/prototypes/xxx/）：仅用于状态展示"正在改哪个页面" */
              target?: string;
              /** 批注发布任务涉及的批注 id：用于拒绝重复发布，并透出给前端展示发布中的批注 */
              annotationIds?: string[];
            }>(req);
            const def = body.cli ? CLI_DEFS[body.cli] : null;
            if (!def) return sendError(res, '不支持的 CLI');
            if (!body.prompt?.trim()) return sendError(res, 'prompt 不能为空');

            // 固定模型与流式输出仅 codebuddy 支持：与批量任务共用同一套参数组装，避免两处漂移
            const isCodebuddy = body.cli === 'codebuddy';
            const args = buildCliArgs(body.cli!, body.model, body.fallbackModel);

            const bin = def.bin[0];
            if (!(await which(bin))) return sendError(res, `${def.label}（${bin}）未安装或不在 PATH 中`);

            reapStaleTask();
            if (pendingQueue.length >= MAX_QUEUE) {
              return sendError(res, `排队任务已达上限（${MAX_QUEUE} 个），请等待当前任务完成后再试`, 429);
            }

            const cli = body.cli!;
            const model = body.model?.trim() || null;
            const target = (body.target || '').trim();
            const annotationIds = Array.isArray(body.annotationIds)
              ? [...new Set(body.annotationIds.filter((id) => typeof id === 'string' && id.trim()))]
              : [];
            // 同一批批注禁止重复发布：否则会给 AI 发两遍同样的改动指令，
            // 第二遍是在已被改过的代码上再改一次，既浪费额度又容易把改动改坏。
            if (annotationIds.length > 0) {
              const busyIds = new Set([
                ...(currentTask?.annotationIds || []),
                ...pendingQueue.flatMap((q) => q.annotationIds || []),
              ]);
              const dup = annotationIds.filter((id) => busyIds.has(id));
              if (dup.length > 0) {
                const running = !!currentTask?.annotationIds?.some((id) => dup.includes(id));
                const who = running
                  ? `正在执行的任务（${currentTask?.label}${currentTask?.target ? ` · ${currentTask.target}` : ''}）`
                  : '排队中的任务';
                return sendError(res, `有 ${dup.length} 条批注已在${who}中发布，请等它结束后再试`, 409);
              }
            }
            const summary = summarizePrompt(body.prompt!);
            const taskId = makeTaskId();

            // 排队与执行共用同一条 NDJSON 流：排队时推 queued，轮到时推 start，之后推 chunk/thinking/ping/done。
            // 这样前端无需区分两种形态，用户也不会再被"已有任务正在执行"直接拒之门外。
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 代理缓冲
            res.flushHeaders();

            let clientClosed = false;
            let child: ChildProcess | null = null;
            let heartbeat: NodeJS.Timeout | null = null;
            let queueTimer: NodeJS.Timeout | null = null;

            /** 释放占位（仅当仍属于本任务）并唤醒队列中的下一个 */
            const finishTask = () => {
              if (currentTask?.id === taskId) currentTask = null;
              dispatchNextTask();
            };

            // ── 入队：空闲时会被 dispatchNextTask 立即唤醒，否则等前一个任务跑完 ──
            const entry: QueueEntry = {
              id: taskId, cli, label: def.label, model, target, summary,
              annotationIds: annotationIds.length > 0 ? annotationIds : undefined,
              enqueuedAt: Date.now(),
              grant: () => {},
            };
            const granted = new Promise<boolean>((resolve) => {
              entry.grant = resolve;
            });

            /** 推送排队进度（位置 / 前面排了谁 / 预计等待），同时充当排队期间的心跳 */
            const pushQueued = () => {
              if (clientClosed) return;
              try {
                const snap = taskSnapshot();
                res.write(
                  JSON.stringify({
                    type: 'queued',
                    taskId,
                    position: snap.queue.findIndex((q) => q.id === taskId) + 1,
                    queue: snap.queue,
                    waitEtaSec: estimateWaitSec(taskId),
                    running: snap.task,
                  }) + '\n',
                );
              } catch {
                /* 连接已断，忽略 */
              }
            };

            pendingQueue.push(entry);

            // 客户端断开（关闭页面/点停止）：排队中直接出队，执行中强杀进程树。
            //
            // 注意：必须监听 res 而不是 req。Node 15.1+ 中 IncomingMessage 的 'close' 表示"请求已接收完毕"，
            // 请求体在 readJsonBody 阶段就已读完并触发过，这里再注册永远收不到 —— 历史上正是这个原因
            // 导致"点了停止服务端却毫无感知"：子进程继续在后台改代码、占位不释放，用户再发一律 429。
            // res 的 'close' 才是真正的"连接关闭"：正常跑完时 writableEnded 为 true，直接跳过即可。
            res.on('close', () => {
              if (res.writableEnded) return; // 正常结束，finally 已收尾
              clientClosed = true;
              if (queueTimer) clearInterval(queueTimer);
              if (heartbeat) clearInterval(heartbeat);
              const idx = pendingQueue.indexOf(entry);
              if (idx >= 0) {
                // 还在排队：出队并解除等待（否则这个请求会一直挂着）
                pendingQueue.splice(idx, 1);
                entry.grant(false);
                return;
              }
              if (child) {
                // 正在执行：按进程树强杀（Windows 下 spawn 的是 cmd 包装进程，只 kill 它会留下孤儿），
                // 杀完立即释放占位，让下一个排队任务马上开始
                let forceTimer: NodeJS.Timeout | undefined;
                const release = () => {
                  clearTimeout(forceTimer);
                  finishTask();
                };
                forceTimer = setTimeout(release, 3000);
                killTree(child, release);
              }
            });

            dispatchNextTask();
            if (currentTask?.id !== taskId) {
              // 没轮到自己 → 排队中，每 5s 刷新一次排队位置（也避免代理/浏览器空闲断连）
              pushQueued();
              queueTimer = setInterval(pushQueued, 5000);
            }

            const grantedOk = await granted;
            if (queueTimer) clearInterval(queueTimer);
            queueTimer = null;
            if (!grantedOk || clientClosed || currentTask?.id !== taskId) {
              try {
                if (!res.writableEnded) res.end();
              } catch {
                /* 连接已断 */
              }
              return;
            }

            // ── 轮到自己：正式开始执行 ──
            const startedAt = currentTask?.startedAt ?? Date.now();
            try {
              res.write(
                JSON.stringify({ type: 'start', taskId, cli, label: def.label, model, target, startedAt }) + '\n',
              );
            } catch {
              /* 连接刚断，后续写入会因 clientClosed 短路 */
            }

            // 用 NDJSON 流式回传执行进度，前端可实时看到 AI 输出
            // taskId 让进程登记到 runningChildren：兜底回收命中时能被真正强杀，不留继续改文件的孤儿
            const { promise, child: proc } = runCli(bin, args, body.prompt!, {
              taskId,
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
            child = proc;

            // 心跳：每 5s 发一次 ping，让前端持续确认进程存活（也避免代理/浏览器空闲断连）
            heartbeat = setInterval(() => {
              if (clientClosed) {
                if (heartbeat) clearInterval(heartbeat);
                heartbeat = null;
                return;
              }
              try {
                res.write(
                  JSON.stringify({ type: 'ping', elapsed: Math.round((Date.now() - startedAt) / 1000) }) + '\n',
                );
              } catch {
                if (heartbeat) clearInterval(heartbeat);
                heartbeat = null;
              }
            }, 5000);

            try {
              const { output, timedOut, timeoutReason } = await promise;
              recordDuration(cli, model, Date.now() - startedAt);
              if (!clientClosed) {
                res.write(JSON.stringify({ type: 'done', output, timedOut, timeoutReason }) + '\n');
              }
            } catch (e: any) {
              if (!clientClosed) {
                try { res.write(JSON.stringify({ type: 'error', error: e.message || 'AI CLI 执行失败' }) + '\n'); } catch {}
              }
            } finally {
              if (heartbeat) clearInterval(heartbeat);
              child = null;
              finishTask();
              if (!res.writableEnded) res.end();
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

// ── 批量任务（server/aiBatchApi.ts）复用的执行槽位 ──
//
// 批量任务的每个子任务都要走这里，与单页 AI 助手共用同一套 currentTask / pendingQueue：
// 同一时刻只有一个 AI CLI 在改代码，批量任务与面板任务天然互斥，不会并发覆盖文件。

export interface SlotRequest {
  cli: string;
  label: string;
  model: string | null;
  /** 操作目标（如 src/prototypes/xxx/） */
  target: string;
  /** 指令摘要（展示用） */
  summary: string;
  /** 批注发布任务对应的批注 id（批量任务不用） */
  annotationIds?: string[];
}

export interface SlotHandle {
  id: string;
  /** 等待轮到执行：true = 放行；false = 排队期间被取消 */
  wait: Promise<boolean>;
  /** 排队中的位置（1 = 队首）；已放行或被取消返回 0 */
  position(): number;
  /** 排队中预计还要等多少秒 */
  waitSec(): number;
  /** 是否已拿到执行权（正在跑） */
  isRunning(): boolean;
  /** 排队中：出队取消，返回是否成功 */
  cancel(): boolean;
  /** 排队中：插到队首（正在执行时不生效） */
  promote(): boolean;
}

/** 申请执行槽位：空闲时立即放行，否则进入 FIFO 队列等待 */
export function acquireSlot(req: SlotRequest): SlotHandle {
  reapStaleTask();
  const id = makeTaskId();
  let waiting = true;
  const entry: QueueEntry = {
    id,
    cli: req.cli,
    label: req.label,
    model: req.model,
    target: req.target,
    summary: req.summary,
    annotationIds: req.annotationIds,
    enqueuedAt: Date.now(),
    grant: () => {},
  };
  const wait = new Promise<boolean>((resolve) => {
    entry.grant = (ok) => {
      waiting = false;
      resolve(ok);
    };
  });
  pendingQueue.push(entry);
  dispatchNextTask();
  return {
    id,
    wait,
    position: () => (waiting ? pendingQueue.findIndex((q) => q.id === id) + 1 : 0),
    waitSec: () => (waiting ? estimateWaitSec(id) : 0),
    isRunning: () => currentTask?.id === id,
    cancel: () => {
      const idx = pendingQueue.findIndex((q) => q.id === id);
      if (idx < 0) return false;
      pendingQueue.splice(idx, 1);
      entry.grant(false);
      return true;
    },
    promote: () => {
      const idx = pendingQueue.findIndex((q) => q.id === id);
      if (idx < 0) return false;
      if (idx === 0) return true;
      const [moved] = pendingQueue.splice(idx, 1);
      pendingQueue.unshift(moved);
      return true;
    },
  };
}

/** 任务收尾：释放槽位并放行下一个（成功 / 失败 / 被停止都必须调用，否则队列永久卡死） */
export function releaseSlot(id: string) {
  if (currentTask?.id === id) currentTask = null;
  dispatchNextTask();
}

/** 收到输出时打点，用于 idleSec（"是否卡住"）判定 */
export function touchTask(id: string) {
  if (currentTask?.id === id) currentTask.lastChunkAt = Date.now();
}

/** 队列是否已满（批量任务据此决定"继续提交"还是"稍后再试"） */
export function queueFull(): boolean {
  return pendingQueue.length >= MAX_QUEUE;
}

export {
  CLI_DEFS,
  which,
  checkAuthorized,
  recordDuration,
  summarizePrompt,
  taskSnapshot,
  killTree,
  runCli,
  estimateDurationSec,
  IDLE_TIMEOUT_MS,
  MAX_TOTAL_MS,
};
export type { RunCliTimeoutReason };
export type { RunCliOptions };
