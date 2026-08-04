import { useSyncExternalStore } from 'react';

/**
 * 固定的 AI 模型（仅对 codebuddy 生效）。
 * 用户一旦在 AI 面板中选择某个模型，即持久化到 localStorage，
 * 之后聊天 / 批注发布 / Git 解读都会固定使用该模型。
 * 值为空字符串表示“自动（跟随 CLI 默认）”。
 */
const KEY = 'hatch-ai-model';

/** 模型 id → 显示名（与 server/aiCliApi.ts 的 SUPPORTED_MODELS 保持一致） */
const MODEL_LABELS: Record<string, string> = {
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'kimi-k3-2': 'Kimi K3.2',
  'kimi-k2.7': 'Kimi K2.7',
  'kimi-k2.6': 'Kimi K2.6',
  'glm-5.2': 'GLM 5.2',
  'glm-5.1': 'GLM 5.1',
  'glm-5v-turbo': 'GLM 5V Turbo',
  'minimax-m3-pay': 'MiniMax M3',
  'minimax-m2.7': 'MiniMax M2.7',
  hy3: 'Hy3',
  'custom-local:kimi-k2.5': '本地 Kimi K2.5',
  'custom-local:GPT5.4': '本地 GPT 5.4',
  'custom-local:K2.7 Code': '本地 K2.7 Code',
  'custom-local:deepseek-v4-pro': '本地 DeepSeek V4 Pro',
};

/** 取当前固定模型的显示名；空表示"自动（跟随 CLI 默认）" */
export function getAiModelLabel(): string {
  return current ? MODEL_LABELS[current] || current : '自动（跟随 CLI 默认）';
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
