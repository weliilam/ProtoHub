/**
 * AI CLI 任务的全局微 store：
 * 任务由 AiCliPanel 发起，但生命周期独立于组件 ——
 * 关闭面板 / 切换条目时任务继续在后台执行并保存结果，
 * 重开面板后通过订阅恢复运行状态与已累积的流式输出。
 */
export interface AiTaskState {
  running: boolean;
  /** 排队中：前面还有任务在跑，服务端尚未开始执行本任务 */
  queued: boolean;
  /** 排队位置（1 = 下一个执行；0 = 未排队） */
  queuePosition: number;
  /** 预计还需等待秒数 */
  queueWaitSec: number;
  /** 任务所属条目 key（与会话持久化 key 一致），用于重开面板时判断是否恢复 */
  entryKey: string;
  cli: string;
  target: string;
  streaming: string;
  thinking: string;
  elapsed: number;
  controller: AbortController | null;
}

const initial: AiTaskState = {
  running: false,
  queued: false,
  queuePosition: 0,
  queueWaitSec: 0,
  entryKey: '',
  cli: '',
  target: '',
  streaming: '',
  thinking: '',
  elapsed: 0,
  controller: null,
};

let state: AiTaskState = initial;
const listeners = new Set<(s: AiTaskState) => void>();

function emit() {
  const snapshot = { ...state };
  listeners.forEach((l) => l(snapshot));
}

export const aiTaskStore = {
  get(): AiTaskState {
    return { ...state };
  },
  subscribe(l: (s: AiTaskState) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  start(p: { entryKey: string; cli: string; target: string }) {
    state = {
      running: true,
      queued: false,
      queuePosition: 0,
      queueWaitSec: 0,
      entryKey: p.entryKey,
      cli: p.cli,
      target: p.target,
      streaming: '',
      thinking: '',
      elapsed: 0,
      controller: null,
    };
    emit();
  },
  setController(c: AbortController | null) {
    state = { ...state, controller: c };
    emit();
  },
  appendStream(chunk: string) {
    state = { ...state, streaming: state.streaming + chunk };
    emit();
  },
  appendThinking(chunk: string) {
    state = { ...state, thinking: state.thinking + chunk };
    emit();
  },
  setElapsed(e: number) {
    state = { ...state, elapsed: e };
    emit();
  },
  /**
   * 排队进度（服务端每 5s 推一次）。position 为 0 表示已轮到自己开始执行，
   * 此时清空排队标记并重置计时（执行时长由服务端心跳校准）。
   */
  setQueue(position: number, waitSec: number) {
    state = {
      ...state,
      queued: position > 0,
      queuePosition: position,
      queueWaitSec: waitSec,
      ...(position > 0 ? null : { elapsed: 0 }),
    };
    emit();
  },
  /** 任务结束（成功/失败/停止）后清理全局状态 */
  stop() {
    state = { ...initial };
    emit();
  },
};
