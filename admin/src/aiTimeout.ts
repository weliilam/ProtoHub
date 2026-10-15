/**
 * AI 执行被服务端强制结束的原因，以及对应的用户提示文案。
 *
 * 服务端不再用"固定 10 分钟"一刀切，而是分两种结局：
 *  - idle：连续一段时间没有任何输出 → 判定进程卡死，强杀；
 *  - total：任务总时长撞到上限 → 强杀（避免一个极慢的任务拖住串行的执行队列）。
 *
 * 两个阈值都可以用环境变量调整，所以文案里不写死分钟数，避免提示与实际配置不一致。
 */
export type AiTimeoutReason = 'idle' | 'total' | null;

/** 解析服务端 done 事件里的 timeoutReason；旧版服务端不返回该字段时回退为 null */
export function normalizeTimeoutReason(raw: unknown): AiTimeoutReason {
  return raw === 'idle' || raw === 'total' ? raw : null;
}

/**
 * 超时提示（不含句末标点，便于调用方自行拼接）；未超时返回空串。
 * reason 缺失（旧版服务端）时给出通用说法，保证拼接后的文案不出现空洞。
 */
export function timeoutHint(timedOut: boolean, reason: AiTimeoutReason): string {
  if (!timedOut) return '';
  if (reason === 'idle') return 'AI 连续无输出，判定卡死已终止';
  if (reason === 'total') return 'AI 执行超过时长上限，已终止';
  return 'AI 执行超时，已终止';
}
