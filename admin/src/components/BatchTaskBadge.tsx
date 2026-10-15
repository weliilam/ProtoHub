import { Tooltip } from 'antd';
import { formatDuration } from '../aiServerTask';
import { useAiBatch, useTicker } from '../aiBatchStore';

/**
 * 顶栏「批量任务」徽标：批量执行时显示"第几个页面 / 正在改谁 / 已用多久 / 预计还要多久"。
 *
 * 与单个 AI 助手共用同一个执行槽位，所以批量执行时用它替代 AiTaskBadge，
 * 信息更完整（进度 + 当前页面 + 排队情况），点一下打开右侧批量任务面板。
 */
export default function BatchTaskBadge({ onClick }: { onClick?: () => void }) {
  const { jobs, active } = useAiBatch();
  const now = useTicker(active);

  const runningJobs = jobs.filter((j) => j.status !== 'done');
  if (!runningJobs.length) return null;
  const job = runningJobs[runningJobs.length - 1];
  const total = job.items.length;
  const finished = job.items.filter((i) => i.status === 'done' || i.status === 'failed' || i.status === 'cancelled').length;
  const current = job.items.find((i) => i.status === 'running');
  const elapsed = current?.startedAt ? Math.max(0, (now - current.startedAt) / 1000) : 0;
  const doneItems = job.items.filter((i) => i.status === 'done' && i.elapsedSec > 0);
  const avg = doneItems.length ? doneItems.reduce((s, i) => s + i.elapsedSec, 0) / doneItems.length : 0;
  const queuedJob = job.status === 'queued';

  const title = [
    queuedJob ? `批量任务排队中（第 ${job.queuePosition} 批）` : `批量任务执行中：${finished}/${total} 个页面已完成`,
    current ? `正在改「${current.title}」` : '',
    current ? `已用 ${formatDuration(elapsed)}` : '',
    current && avg > 0 ? `预计还需 ${formatDuration(Math.max(0, avg - elapsed))}` : '',
    `指令：${job.instruction}`,
    '点击查看每个页面的状态',
  ]
    .filter(Boolean)
    .join('｜');

  return (
    <Tooltip title={title}>
      <span
        className="ph-ai-breath"
        style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
        onClick={onClick}
      >
        {queuedJob
          ? `批量排队中 · 第 ${job.queuePosition} 批`
          : `批量 ${finished}/${total}${current ? ` · 正在改 ${current.title}` : ''} · 已 ${formatDuration(elapsed)}`}
      </span>
    </Tooltip>
  );
}
