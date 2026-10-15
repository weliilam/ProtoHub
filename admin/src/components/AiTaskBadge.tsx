import { Tooltip } from 'antd';
import { formatDuration, friendlyTarget, isStalled } from '../aiServerTask';
import type { AiTaskSnapshot } from '../types';

/**
 * 顶栏 AI 任务徽标：展示"正在改哪个页面 / 已运行多久 / 预计还要多久 / 排队几个"。
 * 数据取自服务端任务状态（/api/ai/task），因此刷新页面、切换标签页后依然可见，
 * 不像 aiRunStore 那样只反映"本页发起的任务"。
 */
export default function AiTaskBadge({
  localRunning,
  serverTask,
  onClick,
}: {
  /** 本页刚发起任务时的本地标记：用于补上"服务端状态还没轮询到"的极短暂窗口 */
  localRunning: boolean;
  serverTask: AiTaskSnapshot;
  /** 点击回调：批注发布任务时用它跳回批注面板 */
  onClick?: () => void;
}) {
  const task = serverTask.task;
  const queued = serverTask.queue.length;

  if (!task && !localRunning && queued === 0) return null;
  // 本页刚点下发送、服务端状态尚未刷新的瞬间
  if (!task) return <span className="ph-ai-breath">AI 执行中</span>;

  const target = friendlyTarget(task.target);
  const stalled = isStalled(task.idleSec);
  // 批注发布任务：服务端带回了本次发布的批注 id，徽标上直接说清"在发批注"而不是"在改页面"
  const annoCount = task.annotationIds?.length || 0;
  const title = [
    annoCount > 0
      ? `AI 正在发布 ${annoCount} 条批注${target ? `（「${target}」）` : ''}`
      : `AI 正在${target ? `修改「${target}」` : '执行任务'}`,
    task.summary ? `指令：${task.summary}` : '',
    `已运行 ${formatDuration(task.elapsedSec)}`,
    stalled ? `已有 ${task.idleSec} 秒无输出，可能卡住` : '',
    task.remainSec > 0 ? `预计还需 ${formatDuration(task.remainSec)}` : '已超出预计耗时，仍在执行',
    queued > 0 ? `另有 ${queued} 个任务排队中` : '',
    annoCount > 0 && onClick ? '点击查看批注面板' : '',
  ]
    .filter(Boolean)
    .join('｜');

  return (
    <Tooltip title={title}>
      <span
        className="ph-ai-breath"
        onClick={onClick}
        style={{
          whiteSpace: 'nowrap',
          ...(onClick ? { cursor: 'pointer' } : null),
          ...(stalled ? { color: '#d46b08' } : null),
        }}
      >
        {task.label}
        {annoCount > 0 ? ` 正在发布 ${annoCount} 条批注` : target ? ` 正在改 ${target}` : ''} · 已{' '}
        {formatDuration(task.elapsedSec)}
        {task.remainSec > 0 ? ` / 预计 ${formatDuration(task.elapsedSec + task.remainSec)}` : ''}
        {queued > 0 ? ` · 排队 ${queued}` : ''}
      </span>
    </Tooltip>
  );
}
