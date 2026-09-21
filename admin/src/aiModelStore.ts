import { useSyncExternalStore } from 'react';
import type { AiModelOption } from './types';

/**
 * 固定的 AI 模型（仅对 codebuddy 生效）。
 * 用户一旦在 AI 面板中选择某个模型，即持久化到 localStorage，
 * 之后聊天 / 批注发布 / Git 解读都会固定使用该模型。
 * 值为空字符串表示“自动（跟随 CLI 默认）”。
 */
const KEY = 'hatch-ai-model';

/**
 * 模型清单由服务端 /api/ai/status 动态返回（跟随 CLI --help 与本地 models.json），
 * 这里缓存一份用于把 id 翻译成显示名，避免前端再维护一份会过期的静态映射。
 */
let options: AiModelOption[] = [];

/** AI 面板拉到最新模型清单后回填，供 getAiModelLabel 使用 */
export function setAiModelOptions(list: AiModelOption[]) {
  options = Array.isArray(list) ? list : [];
}

/** 取当前固定模型的显示名；空表示"自动（跟随 CLI 默认）" */
export function getAiModelLabel(): string {
  if (!current) return '自动（跟随 CLI 默认）';
  return options.find((m) => m.id === current)?.label || current;
}

let current: string = '';
try {
  current = localStorage.getItem(KEY) || '';
} catch {
  current = '';
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function getAiModel(): string {
  return current;
}

export function setAiModel(model: string) {
  current = model;
  try {
    localStorage.setItem(KEY, model);
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAiModel(): string {
  return useSyncExternalStore(subscribe, getAiModel, getAiModel);
}
