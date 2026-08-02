import { useEffect, useState } from 'react';

/**
 * AI 执行状态的全局微 store：
 * 任何面板（AI CLI / 批注发布）执行时置为 true，
 * 顶栏据此展示呼吸灯，实现全局状态感知。
 */
let running = false;
const listeners = new Set<(r: boolean) => void>();

export const aiRunStore = {
  set(r: boolean) {
    if (running === r) return;
    running = r;
    listeners.forEach((l) => l(r));
  },
  get() {
    return running;
  },
  subscribe(l: (r: boolean) => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useAiRunning(): boolean {
  const [r, setR] = useState(aiRunStore.get());
  useEffect(() => aiRunStore.subscribe(setR), []);
  return r;
}
