import type { Plugin } from 'vite';
import type { ChildProcess } from 'child_process';
import { getPathname, readJsonBody, sendError, sendJson } from './utils';
import {
  CLI_DEFS,
  acquireSlot,
  buildCliArgs,
  killTree,
  recordDuration,
  releaseSlot,
  runCli,
  touchTask,
  which,
} from './aiCliApi';
import type { SlotHandle } from './aiCliApi';
import { changedFilesSince, createBaselineSnapshot, resolveScope, restoreScopeTo } from './gitApi';

/**
 * 批量任务：一条指令 → 多个原型页面各跑一遍 AI。
 *
 * 调度分两层：
 * 1. 批量任务之间 FIFO（同一时刻只跑一个 job），保证一批目标被连续处理、进度不交错；
 * 2. 子任务再向全局 AI 槽位排队（与单页 AI 助手共用），保证任何时刻只有一个 CLI 在改代码。
 *
 * 每个子任务执行前会先给目标目录建基线快照，执行后据此统计改动文件，并支持一键回滚。
 */

export type BatchItemStatus = 'pending' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface BatchItem {
  id: string;
  /** 原型目录名 */
  name: string;
  title: string;
  /** 操作目标（src/prototypes/<name>/） */
  target: string;
  status: BatchItemStatus;
  /** 执行前的基线快照（完整 hash）；null = 目标为空或建快照失败，此时无法回滚 */
  baselineHash: string | null;
  /** 相对基线改动的文件清单 */
  changedFiles: string[];
  /** AI 输出（只保留末尾，避免长任务把内存撑爆） */
  output: string;
  /** 失败原因 / 停止说明 */
  error: string;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedSec: number;
  /** 排队位置（1 = 队首），仅排队中有意义 */
  position: number;
  /** 排队预计还要等多少秒 */
  waitSec: number;
  /** 是否被要求停止 */
  stopRequested: boolean;
  /** 是否已回滚 */
  rolledBack: boolean;
}

export interface BatchSummary {
  total: number;
  done: number;
  failed: number;
  cancelled: number;
  /** 本次批量共改动的文件数（去重） */
  files: number;
  elapsedSec: number;
}

export interface BatchJob {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  /** 用户输入的指令（各子任务共享） */
  instruction: string;
  status: 'queued' | 'running' | 'done';
  /** 在批量任务队列中的位置（1 = 下一个执行） */
  queuePosition: number;
  createdAt: number;
  finishedAt: number | null;
  cancelRequested: boolean;
  items: BatchItem[];
  /** 全部结束后的汇总报告 */
  summary: BatchSummary | null;
}

/** 最多保留的任务记录数（新的在前） */
const MAX_JOBS = 20;
/** 单个子任务保留的输出字符数 */
const MAX_OUTPUT_CHARS = 20000;

const jobs: BatchJob[] = [];
const jobQueue: BatchJob[] = [];
let activeJob: BatchJob | null = null;
/** 子任务 id → 全局槽位句柄，用于排队中取消 / 置顶 */
const slotMap = new Map<string, SlotHandle>();
/** 正在执行的子进程，用于「停止」 */
let activeChild: ChildProcess | null = null;
let activeItemId: string | null = null;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeItem(name: string, title: string, scope: string): BatchItem {
  return {
    id: makeId('item'),
    name,
    title,
    target: `${scope}/`,
    status: 'pending',
    baselineHash: null,
    changedFiles: [],
    output: '',
    error: '',
    startedAt: null,
    finishedAt: null,
    elapsedSec: 0,
    position: 0,
    waitSec: 0,
    stopRequested: false,
    rolledBack: false,
  };
}

/** 子任务 prompt：与单页 AI 助手保持同样的目标约束，避免 AI 顺手改了别的页面 */
function buildItemPrompt(instruction: string, item: BatchItem): string {
  return (
    `当前项目为原型开发项目。本次任务的操作目标是原型页面「${item.title || item.name}」` +
    `（src/prototypes/${item.name}/）。请仅针对该目标进行修改/处理，` +
    `不要修改其它原型或无关文件（除非确有必要并说明理由）。\n\n${instruction}`
  );
}

function buildSummary(job: BatchJob): BatchSummary {
  const files = new Set<string>();
  job.items.forEach((it) => it.changedFiles.forEach((f) => files.add(f)));
  return {
    total: job.items.length,
    done: job.items.filter((i) => i.status === 'done').length,
    failed: job.items.filter((i) => i.status === 'failed').length,
    cancelled: job.items.filter((i) => i.status === 'cancelled').length,
    files: files.size,
    elapsedSec: Math.round(((job.finishedAt || Date.now()) - job.createdAt) / 1000),
  };
}

/** 对外快照：排队位置、等待时间这些动态字段现算 */
function snapshotJob(job: BatchJob): BatchJob {
  const qi = jobQueue.indexOf(job);
  job.queuePosition = job.status === 'queued' && qi >= 0 ? qi + 1 : 0;
  for (const item of job.items) {
    const slot = item.status === 'queued' ? slotMap.get(item.id) : undefined;
    item.position = slot ? slot.position() : 0;
    item.waitSec = slot ? slot.waitSec() : 0;
  }
  return job;
}

function pumpJobs() {
  if (activeJob) return;
  const next = jobQueue.shift();
  if (!next) return;
  activeJob = next;
  next.status = 'running';
  void runJob(next);
}

async function runJob(job: BatchJob) {
  for (const item of job.items) {
    if (item.status === 'cancelled') continue;
    if (job.cancelRequested) {
      item.status = 'cancelled';
      item.error = '已被取消';
      continue;
    }
    await runItem(job, item);
  }
  job.finishedAt = Date.now();
  job.status = 'done';
  job.summary = buildSummary(job);
  activeJob = null;
  pumpJobs();
}

/** 强制结束当前子进程（停止 / 取消）并等它真正退出，避免下一个任务与它抢同一批文件 */
async function stopActiveChild() {
  const child = activeChild;
  if (!child) return;
  activeChild = null;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000);
    killTree(child, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function runItem(job: BatchJob, item: BatchItem) {
  // 1. 基线快照必须在 AI 动手之前建好，否则无从回滚
  try {
    item.baselineHash = await createBaselineSnapshot(item.target, `批量任务前基线：${item.title || item.name}`);
  } catch {
    item.baselineHash = null;
  }
  if (job.cancelRequested) {
    item.status = 'cancelled';
    item.error = '已被取消';
    return;
  }

  // 2. 向全局槽位排队（与单页 AI 助手互斥）
  const slot = acquireSlot({
    cli: job.cli,
    label: job.label,
    model: job.model,
    target: item.target,
    summary: `${item.name}：${job.instruction}`,
  });
  slotMap.set(item.id, slot);
  item.status = 'queued';
  const granted = await slot.wait;
  if (!granted) {
    slotMap.delete(item.id);
    item.status = 'cancelled';
    item.error = '排队时被取消';
    return;
  }

  // 3. 执行
  item.status = 'running';
  item.startedAt = Date.now();
  activeItemId = item.id;
  const bin = CLI_DEFS[job.cli].bin[0];
  const args = buildCliArgs(job.cli, job.model, null);
  let streamed = '';
  const { promise, child } = runCli(bin, args, buildItemPrompt(job.instruction, item), 600_000, {
    streamJson: job.cli === 'codebuddy',
    onChunk: (c) => {
      streamed += c;
      item.output = streamed.length > MAX_OUTPUT_CHARS ? streamed.slice(-MAX_OUTPUT_CHARS) : streamed;
      touchTask(slot.id);
    },
    onThinking: () => touchTask(slot.id),
    onActivity: () => touchTask(slot.id),
    onError: (m) => {
      item.error = m;
    },
  });
  activeChild = child;

  let result: { output: string; timedOut: boolean } | null = null;
  try {
    result = await promise;
  } catch (e: any) {
    item.error = e?.message || 'AI CLI 启动失败';
  }
  activeChild = null;
  activeItemId = null;
  slotMap.delete(item.id);
  releaseSlot(slot.id);

  const elapsed = Date.now() - (item.startedAt || Date.now());
  item.elapsedSec = Math.round(elapsed / 1000);
  item.finishedAt = Date.now();
  recordDuration(job.cli, job.model, elapsed);

  if (!result) item.status = 'failed';
  else if (item.stopRequested) {
    item.status = 'cancelled';
    item.error = '已手动停止';
  } else if (result.timedOut) {
    item.status = 'failed';
    item.error = '执行超时（超过 10 分钟）已强制结束';
  } else if (item.error) item.status = 'failed';
  else item.status = 'done';
  if (result?.output) item.output = result.output;

  // 4. 统计改动：失败/取消也要统计，文件可能已被改过，仍需要能回滚
  if (item.baselineHash) {
    item.changedFiles = await changedFilesSince(item.baselineHash, item.target);
  }
}

function cancelJob(job: BatchJob) {
  job.cancelRequested = true;
  if (job.status === 'queued') {
    const idx = jobQueue.indexOf(job);
    if (idx >= 0) jobQueue.splice(idx, 1);
    job.items.forEach((it) => {
      if (it.status === 'pending') {
        it.status = 'cancelled';
        it.error = '已被取消';
      }
    });
    job.status = 'done';
    job.finishedAt = Date.now();
    job.summary = buildSummary(job);
    return;
  }
  job.items.forEach((it) => {
    if (it.status === 'pending') {
      it.status = 'cancelled';
      it.error = '已被取消';
    } else if (it.status === 'queued') {
      slotMap.get(it.id)?.cancel();
    }
  });
  const current = job.items.find((it) => it.id === activeItemId);
  if (current) {
    current.stopRequested = true;
    void stopActiveChild();
  }
}

export function aiBatchApiPlugin(): Plugin {
  return {
    name: 'proto-hub-ai-batch-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith('/api/ai/batch')) return next();

        try {
          // 全部任务快照（面板轮询）
          if (pathname === '/api/ai/batch/list' && req.method === 'GET') {
            return sendJson(res, { success: true, data: { jobs: jobs.map(snapshotJob) } });
          }

          // 创建批量任务
          if (pathname === '/api/ai/batch/create' && req.method === 'POST') {
            const body = await readJsonBody<{
              cli?: string;
              model?: string | null;
              prompt?: string;
              targets?: { name?: string; title?: string }[];
            }>(req);
            const cli = (body.cli || '').trim();
            const def = CLI_DEFS[cli];
            if (!def) return sendError(res, '不支持的 CLI');
            const instruction = (body.prompt || '').trim();
            if (!instruction) return sendError(res, '指令不能为空');
            const targets = Array.isArray(body.targets) ? body.targets : [];
            if (!targets.length) return sendError(res, '请至少选择一个原型页面');
            const bin = def.bin[0];
            if (!(await which(bin))) return sendError(res, `${def.label}（${bin}）未安装或不在 PATH 中`);

            const items: BatchItem[] = [];
            for (const t of targets) {
              const name = String(t?.name || '').trim();
              if (!name) continue;
              const scope = resolveScope(`src/prototypes/${name}`);
              if (!scope) return sendError(res, `目标不合法：${name}`);
              items.push(makeItem(name, String(t?.title || name), scope));
            }
            if (!items.length) return sendError(res, '没有有效的目标页面');

            const job: BatchJob = {
              id: makeId('job'),
              cli,
              label: def.label,
              model: (body.model || '').trim() || null,
              instruction,
              status: 'queued',
              queuePosition: 0,
              createdAt: Date.now(),
              finishedAt: null,
              cancelRequested: false,
              items,
              summary: null,
            };
            jobs.unshift(job);
            if (jobs.length > MAX_JOBS) jobs.splice(MAX_JOBS);
            jobQueue.push(job);
            pumpJobs();
            return sendJson(res, { success: true, data: { job: snapshotJob(job) } });
          }

          // 取消整个任务（未开始的标记取消，正在跑的停止）
          if (pathname === '/api/ai/batch/cancel' && req.method === 'POST') {
            const body = await readJsonBody<{ jobId?: string }>(req);
            const job = jobs.find((j) => j.id === body.jobId);
            if (!job) return sendError(res, '任务不存在');
            if (job.status !== 'done') cancelJob(job);
            return sendJson(res, { success: true, data: { job: snapshotJob(job) } });
          }

          // 移除任务记录（还在跑的会先取消）
          if (pathname === '/api/ai/batch/remove' && req.method === 'POST') {
            const body = await readJsonBody<{ jobId?: string }>(req);
            const idx = jobs.findIndex((j) => j.id === body.jobId);
            if (idx < 0) return sendError(res, '任务不存在');
            if (jobs[idx].status !== 'done') cancelJob(jobs[idx]);
            jobs.splice(idx, 1);
            return sendJson(res, { success: true });
          }

          // 单个子任务：排队中取消 / 置顶，执行中停止
          if (pathname === '/api/ai/batch/item' && req.method === 'POST') {
            const body = await readJsonBody<{ jobId?: string; itemId?: string; action?: string }>(req);
            const job = jobs.find((j) => j.id === body.jobId);
            const item = job?.items.find((i) => i.id === body.itemId);
            if (!job || !item) return sendError(res, '子任务不存在');
            const slot = slotMap.get(item.id);
            if (body.action === 'cancel') {
              if (!slot || !slot.cancel()) return sendError(res, '该任务不在排队中，无法取消');
              item.status = 'cancelled';
              item.error = '排队时被取消';
            } else if (body.action === 'promote') {
              if (!slot || !slot.promote()) return sendError(res, '该任务不在排队中，无法置顶');
            } else if (body.action === 'stop') {
              if (item.status !== 'running') return sendError(res, '该任务不在执行中');
              item.stopRequested = true;
              await stopActiveChild();
            } else {
              return sendError(res, '未知操作');
            }
            return sendJson(res, { success: true, data: { job: snapshotJob(job) } });
          }

          // 重试失败/取消的子任务：新建一个只含该目标的批量任务，排到队尾
          if (pathname === '/api/ai/batch/retry' && req.method === 'POST') {
            const body = await readJsonBody<{ jobId?: string; itemId?: string }>(req);
            const job = jobs.find((j) => j.id === body.jobId);
            const item = job?.items.find((i) => i.id === body.itemId);
            if (!job || !item) return sendError(res, '子任务不存在');
            const scope = resolveScope(item.target.replace(/\/$/, ''));
            if (!scope) return sendError(res, '目标不合法');
            const retryJob: BatchJob = {
              id: makeId('job'),
              cli: job.cli,
              label: job.label,
              model: job.model,
              instruction: job.instruction,
              status: 'queued',
              queuePosition: 0,
              createdAt: Date.now(),
              finishedAt: null,
              cancelRequested: false,
              items: [makeItem(item.name, item.title, scope)],
              summary: null,
            };
            jobs.unshift(retryJob);
            if (jobs.length > MAX_JOBS) jobs.splice(MAX_JOBS);
            jobQueue.push(retryJob);
            pumpJobs();
            return sendJson(res, { success: true, data: { job: snapshotJob(retryJob) } });
          }

          // 一键回滚该目标的这次改动
          if (pathname === '/api/ai/batch/rollback' && req.method === 'POST') {
            const body = await readJsonBody<{ jobId?: string; itemId?: string }>(req);
            const job = jobs.find((j) => j.id === body.jobId);
            const item = job?.items.find((i) => i.id === body.itemId);
            if (!job || !item) return sendError(res, '子任务不存在');
            if (item.status === 'running' || item.status === 'queued') {
              return sendError(res, '任务正在执行，请先停止再回滚');
            }
            if (!item.baselineHash) return sendError(res, '该目标没有可用的基线快照，无法回滚');
            const scope = resolveScope(item.target.replace(/\/$/, ''));
            if (!scope) return sendError(res, '目标不合法');
            try {
              await restoreScopeTo(item.baselineHash, scope);
              item.rolledBack = true;
              return sendJson(res, { success: true, data: { job: snapshotJob(job) } });
            } catch (e: any) {
              return sendError(res, `回滚失败：${e?.stderr || e?.message || e}`, 500);
            }
          }

          next();
        } catch (e: any) {
          sendError(res, e?.message || '批量任务处理失败', 500);
        }
      });
    },
  };
}
