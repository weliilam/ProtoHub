import { useSyncExternalStore } from 'react';
import type { AiTimeoutReason } from './aiTimeout';

/**
 * 批注发布任务状态（全局单例，跨面板关闭 / 切换原型存活）。
 *
 * 背景：发布批注 = 跑一次 AI CLI 改原型源码，通常要几分钟。原来"发布中"只是
 * AnnotationPanel 组件内的 state，一旦关闭右侧面板（组件卸载）就全部丢失：
 * 面板重开看不到任何进行态，已提交发布的批注仍是红色"待处理"，用户会以为
 * 发布没生效而重复发布。这里把发布任务提到模块级单例，面板只做订阅渲染。
 *
 * 两层可见性：
 *  1) 本页发起的发布 → 走本 store（有完整实时输出、阶段、耗时）；
 *  2) 其它标签页/刷新后仍在跑的发布 → 由服务端任务快照（/api/ai/task 的
 *     annotationIds）兜底，面板据此仍能标出"这批批注正在发布中"。
 *
 * 已完成的结果额外落 localStorage（只存结论，不存实时输出），刷新页面后
 * 面板顶部依然能看到"上次发布结果"入口。
 */

export type PublishStage =
  /** 发布前置准备：拍快照备份 + 探测可用 CLI（这段没有任何 AI 输出，必须单独给个阶段） */
  | 'preparing'
  | 'connecting'
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'summary'
  | 'analyzing';

export type PublishOutcomeKind = 'success' | 'timeout' | 'error';

export interface PublishOutcome {
  kind: PublishOutcomeKind;
  /** 面向用户的一句话结论 */
  message: string;
  /** 面向产品/业务的变更说明 */
  businessSummary: string;
  /** 代码改动 diff */
  diff: string;
  /** AI 执行日志 */
  output: string;
  cli: string;
  model: string;
  elapsedSec: number;
  /** 发布前的自动快照 hash（可一键还原） */
  backupHash: string;
  /** 本次发布涉及的批注文案（结果入口里直接展示，不用回查） */
  annotationTexts: string[];
  /**
   * 被强制结束的原因（kind === 'timeout' 时有值）：
   * idle = 长时间无输出判定卡死；total = 撞到总时长上限；undefined = 未超时或早于本次更新的记录
   */
  timeoutReason?: AiTimeoutReason;
  }

export interface PublishBatch {
  id: string;
  /** 原型目录名（AnnotationPanel 的 target，不是 src/prototypes/xxx 路径） */
  target: string;
  cli: string;
  modelLabel: string;
  annotationIds: string[];
  annotationTexts: string[];
  startedAt: number;
  finishedAt: number | null;
  queuedSec: number;
  /** 排队位置（1 = 队首）；0 = 已开始执行 */
  queuePosition: number;
  output: string;
  thinking: string;
  /**
   * 显式指定的阶段；null = 交给实时输出推导（deriveStage）。
   * 仅用于"还没有任何 AI 输出"的准备期，否则进度条会误显示成「连接AI」。
   */
  stage: PublishStage | null;
  /** null = 进行中 */
  outcome: PublishOutcome | null;
}

/** 面板顶部常驻结果入口的保留时长（超过则不再展示） */
const RESULT_KEEP_MS = 24 * 3600 * 1000;
/** 实时输出只保留末尾这么多字符，避免流式输出无限增长 */
const OUTPUT_TAIL = 20_000;
const STORAGE_KEY = 'ph-publish-results';
const STORAGE_MAX = 6;

export const PUBLISH_STAGES: { key: PublishStage; label: string }[] = [
  // 标签取 2 字，6 个阶段才放得下 420px 面板的一行；详细说明在状态行里给
  { key: 'preparing', label: '准备' },
  { key: 'connecting', label: '连接AI' },
  { key: 'thinking', label: '思考中' },
  { key: 'reading', label: '读源码' },
  { key: 'writing', label: '改文件' },
  { key: 'summary', label: '生成说明' },
];

/** 根据 AI 实时输出推导当前所处阶段 */
export function deriveStage(output: string, thinking: string): PublishStage {
  if (!output && !thinking) return 'connecting';
  if (thinking && !output) return 'thinking';
  if (output.includes('===业务变更说明===')) return 'summary';
  if (/replace_in_file|write_to_file|edit_file/.test(output)) return 'writing';
  if (/read_file|Read|reading|查看文件/.test(output)) return 'reading';
  return output ? 'analyzing' : 'thinking';
}

export function stageLabel(stage: PublishStage): string {
  return PUBLISH_STAGES.find((s) => s.key === stage)?.label || '处理中';
}

// ── 状态容器 ──

let batches: PublishBatch[] = [];
/** 流式输出在内存里累积，按 120ms 节流后才通知订阅者，避免逐 token 触发重渲染 */
const draft = new Map<string, { output: string; thinking: string }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function loadPersisted(): PublishBatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PublishBatch[];
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list
      .filter((b) => b && b.outcome && b.finishedAt && now - b.finishedAt < RESULT_KEEP_MS)
      .slice(0, STORAGE_MAX);
  } catch {
    return [];
  }
}

function persist() {
  try {
    const done = batches.filter((b) => b.outcome && b.finishedAt).slice(0, STORAGE_MAX);
    const slim = done.map((b) => ({
      ...b,
      // 结果里已带一份 output，batch 上的实时输出不再重复落盘
      output: '',
      thinking: '',
      outcome: b.outcome
        ? {
            ...b.outcome,
            // 日志可能很长，localStorage 只留末尾片段
            output: b.outcome.output.slice(-8000),
            diff: b.outcome.diff.slice(0, 8000),
          }
        : null,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch {
    /* 隐私模式/超配额：结果入口降级为仅内存 */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setBatches(next: PublishBatch[]) {
  batches = next;
  emit();
}

function patch(id: string, updater: (b: PublishBatch) => PublishBatch) {
  let hit = false;
  const next = batches.map((b) => {
    if (b.id !== id) return b;
    hit = true;
    return updater(b);
  });
  if (hit) setBatches(next);
}

function flushDraft() {
  flushTimer = null;
  let changed = false;
  const next = batches.map((b) => {
    const d = draft.get(b.id);
    if (!d || (d.output === b.output && d.thinking === b.thinking)) return b;
    changed = true;
    return { ...b, output: d.output, thinking: d.thinking };
  });
  if (changed) setBatches(next);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushDraft, 120);
}

// ── 对外操作 ──

/**
 * 发起一次发布：返回批次 id，后续用 appendChunk / finishPublish 更新。
 *
 * 注意：要在"点击发布的那一刻"就调用（而不是等备份快照、探测 CLI 之后再调），
 * 否则这段准备期面板上没有任何进行态，用户会以为没点上而重复点击。
 * cli / modelLabel 允许先留空，准备完再 setPublishMeta 补写。
 */
export function startPublish(input: {
  target: string;
  cli: string;
  modelLabel: string;
  annotationIds: string[];
  annotationTexts: string[];
}): string {
  const id = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  draft.set(id, { output: '', thinking: '' });
  setBatches([
    {
      id,
      target: input.target,
      cli: input.cli,
      modelLabel: input.modelLabel,
      annotationIds: input.annotationIds,
      annotationTexts: input.annotationTexts,
      startedAt: Date.now(),
      finishedAt: null,
      queuedSec: 0,
      queuePosition: 0,
      output: '',
      thinking: '',
      stage: 'preparing',
      outcome: null,
    },
    ...batches,
  ]);
  return id;
}

/** 补写 / 更新发布批次信息（cli、模型）；stage 传 null 表示交回实时输出推导 */
export function setPublishMeta(
  id: string,
  meta: { cli?: string; modelLabel?: string; stage?: PublishStage | null },
) {
  patch(id, (b) => ({
    ...b,
    cli: meta.cli ?? b.cli,
    modelLabel: meta.modelLabel ?? b.modelLabel,
    stage: meta.stage === undefined ? b.stage : meta.stage,
  }));
}

export function appendPublishChunk(id: string, chunk: string) {
  const d = draft.get(id);
  if (!d) return;
  d.output = (d.output + chunk).slice(-OUTPUT_TAIL);
  scheduleFlush();
}

export function appendPublishThinking(id: string, chunk: string) {
  const d = draft.get(id);
  if (!d) return;
  d.thinking = (d.thinking + chunk).slice(-OUTPUT_TAIL);
  scheduleFlush();
}

/** 排队中：更新排队位置与已等待时长 */
export function markPublishQueued(id: string, position: number) {
  patch(id, (b) => (b.outcome ? b : { ...b, queuePosition: position, queuedSec: Math.round((Date.now() - b.startedAt) / 1000) }));
}

/** 排队结束，轮到执行 */
export function markPublishStarted(id: string) {
  patch(id, (b) => (b.outcome ? b : { ...b, queuePosition: 0 }));
}

export function finishPublish(id: string, outcome: PublishOutcome) {
  const d = draft.get(id);
  draft.delete(id);
  const elapsedSec = outcome.elapsedSec;
  setBatches(
    batches.map((b) =>
      b.id === id
        ? {
            ...b,
            output: d?.output ?? b.output,
            thinking: d?.thinking ?? b.thinking,
            finishedAt: Date.now(),
            outcome: { ...outcome, elapsedSec },
          }
        : b,
    ),
  );
  persist();
}

/** 移除一条已结束的批次记录（面板上的"知道了"） */
export function dismissPublish(id: string) {
  draft.delete(id);
  setBatches(batches.filter((b) => b.id !== id));
  persist();
}

/** 某个原型当前是否有发布在进行（本页发起的） */
export function hasActivePublish(target: string): boolean {
  return batches.some((b) => b.target === target && !b.outcome);
}

/** 本页是否有任何发布在进行（用于页面级提示） */
export function hasAnyActivePublish(): boolean {
  return batches.some((b) => !b.outcome);
}

// ── React 绑定 ──

const persisted = loadPersisted();
if (persisted.length > 0) batches = persisted;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot() {
  return batches;
}

export function usePublishBatches(): PublishBatch[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
