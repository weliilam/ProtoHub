import { useEffect, useState } from 'react';
import { api } from './api';
import type { AiTaskSnapshot } from './types';

/**
 * 服务端 AI 任务状态（全局单例轮询）。
 *
 * 与 aiRunStore / aiCliTask 的区别：那两个是"当前标签页内存态"，只反映本页发起的任务；
 * 这里读的是服务端真实状态，因此刷新页面、切换标签页、重开面板后
 * 依然能看到"AI 正在改哪个页面、已经跑了多久、预计还要多久、队列里还排着几个"。
 *
 * 轮询策略：有任务时 2s，空闲时 5s（本地请求，开销可忽略）。
 */
const empty: AiTaskSnapshot = { running: false, task: null, queue: [], etaSec: 0 };

let snapshot: AiTaskSnapshot = empty;
const listeners = new Set<(s: AiTaskSnapshot) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;

function emit() {
  listeners.forEach((l) => l(snapshot));
}

function schedule(delay: number) {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void poll();
  }, delay);
}

async function poll() {
  if (!polling) return;
  try {
    const next = await api.aiTask();
    // 仅在状态实际变化时通知，避免无意义重渲染
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
      emit();
    }
    schedule(next.running || next.queue.length > 0 ? 2000 : 5000);
  } catch {
    // 请求失败（服务重启中等）：退避后继续
    schedule(5000);
  }
}

function ensurePolling() {
  if (polling) return;
  polling = true;
  void poll();
}

/** 主动刷新一次（任务刚结束时调用，避免最长 5s 的状态延迟） */
export async function refreshAiServerTask() {
  if (!polling) return;
  try {
    const next = await api.aiTask();
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
      emit();
    }
  } catch {
    /* 忽略：下次轮询会自愈 */
  }
}

export function useAiServerTask(): AiTaskSnapshot {
  const [value, setValue] = useState(snapshot);
  useEffect(() => {
    const listener = (s: AiTaskSnapshot) => setValue(s);
    listeners.add(listener);
    setValue(snapshot); // 订阅时立即同步一次当前值
    ensurePolling();
    return () => {
      listeners.delete(listener);
      // 无人订阅时停止轮询，避免后台空转
      if (listeners.size === 0) {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        polling = false;
      }
    };
  }, []);
  return value;
}

/** 秒 → "3:12" / "1:02:30"，用于展示已运行时长与预计剩余 */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const rr = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
}

/** 操作目标路径 → 可读名称：src/prototypes/b2b-order-list/ → b2b-order-list */
export function friendlyTarget(target?: string): string {
  if (!target) return '';
  const trimmed = target.replace(/\/+$/, '');
  const name = trimmed.split('/').pop() || trimmed;
  // 文档是单文件（src/docs/xxx.md），去掉扩展名
  return name.replace(/\.(md|json)$/i, '');
}

/** 距上次输出的停滞提示：超过 60s 认为可能卡住 */
export function isStalled(idleSec: number): boolean {
  return idleSec > 60;
}
