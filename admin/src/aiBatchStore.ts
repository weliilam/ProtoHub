import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api';
import type { BatchJob } from './types';

/**
 * 批量任务状态（全局单例轮询）。
 *
 * 数据全部来自服务端（/api/ai/batch/list），因此刷新页面、切换标签页后
 * 依然能看到"哪一批任务跑到第几个页面、每个页面排队/执行/成功/失败"。
 *
 * 轮询策略：有任务在跑（或排队）时 2s，全部结束后 5s。
 * 某个 job 从"未结束"变为"结束"的瞬间，除了通知订阅者，
 * 还会记入 fresh（待用户查看的汇总），用于浏览器通知 + 站内汇总浮层。
 */

export interface BatchState {
  jobs: BatchJob[];
  /** 有任何 job 未结束（执行中或排队中） */
  active: boolean;
  /** 刚结束、用户还没看过的汇总（点击关闭后移出） */
  fresh: BatchJob[];
}

const empty: BatchState = { jobs: [], active: false, fresh: [] };

let state: BatchState = empty;
let lastJson = '';
/** 已经处理过"结束"事件的 job id：避免重复通知（也用于首次加载时抑制历史任务的通知） */
const notified = new Set<string>();
let seeded = false;
let polling = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<BatchState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stopPolling();
  };
}

function getSnapshot(): BatchState {
  return state;
}

function schedule(delay: number) {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void poll();
  }, delay);
}

function stopPolling() {
  polling = false;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

async function poll() {
  if (!polling) return;
  try {
    const { jobs } = await api.aiBatchList();
    const list = jobs || [];
    const active = list.some((j) => j.status !== 'done');
    const newlyDone: BatchJob[] = [];
    const doneIds = new Set(list.filter((j) => j.status === 'done').map((j) => j.id));
    // 首次加载：历史任务不弹通知，只登记为"已知"
    if (!seeded) {
      seeded = true;
      doneIds.forEach((id) => notified.add(id));
    } else {
      doneIds.forEach((id) => {
        if (!notified.has(id)) {
          notified.add(id);
          newlyDone.push(list.find((j) => j.id === id)!);
        }
      });
      // 已被移除的任务无需再记
      notified.forEach((id) => {
        if (!list.some((j) => j.id === id)) notified.delete(id);
      });
    }
    const json = JSON.stringify({ list, active });
    if (json !== lastJson || newlyDone.length > 0) {
      lastJson = json;
      setState({
        jobs: list,
        active,
        fresh: newlyDone.length > 0 ? [...state.fresh, ...newlyDone] : state.fresh,
      });
    }
    newlyDone.forEach(notifyJobDone);
    schedule(active ? 2000 : 5000);
  } catch {
    // 服务重启 / 请求失败：退避后继续，面板不会卡死
    schedule(5000);
  }
}

function ensurePolling() {
  if (polling) return;
  polling = true;
  void poll();
}

/** 主动刷新一次（创建任务 / 面板操作后调用，避免最长 5s 的延迟） */
export async function refreshAiBatch() {
  if (!polling) return;
  try {
    const { jobs } = await api.aiBatchList();
    const list = jobs || [];
    const active = list.some((j) => j.status !== 'done');
    lastJson = JSON.stringify({ list, active });
    setState({ jobs: list, active });
  } catch {
    /* 忽略：下次轮询会自愈 */
  }
}

/** 关闭一条"已完成"的站内汇总提示 */
export function dismissBatchNotice(jobId: string) {
  setState({ fresh: state.fresh.filter((j) => j.id !== jobId) });
}

/** 请求浏览器通知权限（创建批量任务时调用；用户可随时拒绝，不影响功能） */
export function requestBatchNotifyPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    /* 某些环境下 Notification 不可用（非安全上下文），忽略 */
  }
}

/** 批量任务结束时：浏览器通知（用户去干别的也能收到） */
function notifyJobDone(job: BatchJob) {
  const s = job.summary;
  const detail = s
    ? `共 ${s.total} 个页面：成功 ${s.done}、失败 ${s.failed}、取消 ${s.cancelled}，改动 ${s.files} 个文件`
    : '任务已结束';
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const n = new Notification('批量 AI 任务已完成', { body: detail, tag: job.id });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch {
    /* 忽略：站内汇总浮层仍会展示 */
  }
}

export function useAiBatch(): BatchState {
  return useSyncExternalStore(
    (fn) => {
      const unsub = subscribe(fn);
      ensurePolling();
      return unsub;
    },
    getSnapshot,
    getSnapshot,
  );
}

/**
 * 运行中的秒表：批量任务执行期间每秒 tick 一次，
 * 用于显示"已运行 / 预计剩余"（服务端只在子任务结束时回填耗时）。
 */
export function useTicker(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);
  return now;
}
