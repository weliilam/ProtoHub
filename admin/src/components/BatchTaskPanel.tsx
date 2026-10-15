import { useState } from 'react';
import { Button, Empty, Modal, Popconfirm, Progress, Space, Tag, Tooltip, message } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  LoadingOutlined,
  ReloadOutlined,
  RightOutlined,
  StopOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { refreshAiBatch, useAiBatch, useTicker } from '../aiBatchStore';
import { formatDuration } from '../aiServerTask';
import type { BatchItem, BatchItemStatus, BatchJob } from '../types';

/**
 * 批量任务面板：一条指令作用于多个原型页面时，
 * 逐个显示每个页面的排队 / 执行（含已用时间与预计剩余）/ 成功 / 失败状态，
 * 并提供停止、置顶、取消、重试、查看变更、一键回滚。
 *
 * 数据来自服务端轮询（aiBatchStore），因此刷新页面、换个标签页都能接着看。
 */

const STATUS_META: Record<BatchItemStatus, { text: string; color: string }> = {
  pending: { text: '等待中', color: 'default' },
  queued: { text: '排队中', color: 'blue' },
  running: { text: '执行中', color: 'processing' },
  cancelling: { text: '正在停止', color: 'orange' },
  done: { text: '已完成', color: 'success' },
  failed: { text: '失败', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

function StatusIcon({ status }: { status: BatchItemStatus }) {
  if (status === 'running' || status === 'cancelling') return <LoadingOutlined style={{ color: 'var(--ph-accent)' }} />;
  if (status === 'queued') return <ClockCircleOutlined style={{ color: '#1677ff' }} />;
  if (status === 'done') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
  if (status === 'failed') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  return <StopOutlined style={{ color: 'var(--ph-text-tertiary)' }} />;
}

/** 子任务实际运行了多久（执行中按当前时间实时计算；服务端只在结束时回填耗时） */
function itemElapsedSec(item: BatchItem, now: number): number {
  if (item.status === 'running' && item.startedAt) return Math.max(0, (now - item.startedAt) / 1000);
  return item.elapsedSec;
}

export default function BatchTaskPanel(props: { onChanged?: () => void }) {
  const { jobs, active } = useAiBatch();
  const now = useTicker(active);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const act = async (key: string, fn: () => Promise<unknown>, okMsg?: string) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await fn();
      await refreshAiBatch();
      if (okMsg) message.success(okMsg);
      props.onChanged?.();
    } catch (e: any) {
      message.error(e?.message || '操作失败');
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  const toggleOutput = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const rollback = (job: BatchJob, item: BatchItem) => {
    const n = item.changedFiles.length;
    Modal.confirm({
      title: `回滚「${item.title}」的本次改动`,
      content: (
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          将把 <code>{item.target}</code> 恢复到本次批量执行前的快照，
          {n > 0 ? `本次 AI 改动的 ${n} 个文件会被还原。` : '该页面本次没有检测到文件改动。'}
          <br />
          如果之后你又手动改过这个页面，那部分改动也会一起丢失，请确认后再回滚。
        </div>
      ),
      okText: '确认回滚',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => act(`${job.id}:${item.id}:rollback`, () => api.aiBatchRollback(job.id, item.id), '已回滚到执行前的状态'),
    });
  };

  const removeJob = (job: BatchJob) => {
    Modal.confirm({
      title: '移除这条批量任务记录',
      content:
        job.status === 'done'
          ? '只删除任务记录，不会改动任何文件；已回滚/已完成的文件保持现状。'
          : '该任务还在执行，移除会先停止它。已写入的文件会保留，可在 Git 面板里回滚。',
      okText: '移除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => act(`${job.id}:remove`, () => api.aiBatchRemove(job.id), '已移除任务记录'),
    });
  };

  /** 同一批里已完成子任务的平均耗时 → 估算当前页面的预计剩余时间 */
  const batchAvgSec = (job: BatchJob): number => {
    const done = job.items.filter((i) => i.status === 'done' && i.elapsedSec > 0);
    if (!done.length) return 0;
    return done.reduce((sum, i) => sum + i.elapsedSec, 0) / done.length;
  };

  const renderItem = (job: BatchJob, item: BatchItem) => {
    const meta = STATUS_META[item.status] || STATUS_META.pending;
    const key = `${job.id}:${item.id}`;
    const isBusy = !!busy[key];
    const elapsed = itemElapsedSec(item, now);
    const avg = batchAvgSec(job);
    const remain = item.status === 'running' && avg > 0 ? Math.max(0, avg - elapsed) : 0;
    const open = expanded.has(item.id);
    const hasOutput = !!item.output || !!item.error;

    return (
      <div className={`ph-batch-item${item.status === 'running' ? ' running' : ''}`} key={item.id}>
        <div className="ph-batch-item-head">
          <StatusIcon status={item.status} />
          <Tooltip title={item.target}>
            <span className="ph-batch-item-title">{item.title}</span>
          </Tooltip>
          <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
            {meta.text}
            {item.status === 'queued' && item.position > 1 ? ` · 第 ${item.position} 位` : ''}
            {item.status === 'pending' && item.position > 1 ? ` · 第 ${item.position} 位` : ''}
          </Tag>
        </div>

        <div className="ph-batch-item-meta">
          {item.status === 'running' && (
            <>
              <span>已用 {formatDuration(elapsed)}</span>
              {avg > 0 && <span>预计还剩 {formatDuration(remain)}</span>}
            </>
          )}
          {item.status === 'queued' && (
            <>
              <span>前面还有 {Math.max(0, item.position - 1)} 个页面</span>
              {item.waitSec > 0 && <span>约需等待 {formatDuration(item.waitSec)}</span>}
            </>
          )}
          {item.status === 'done' && (
            <>
              <span>用时 {formatDuration(item.elapsedSec)}</span>
              <span>
                改动{' '}
                {item.changedFiles.length ? (
                  <a onClick={() => toggleOutput(item.id)}>{item.changedFiles.length} 个文件</a>
                ) : (
                  '0 个文件'
                )}
              </span>
              {item.rolledBack && <Tag color="orange">已回滚</Tag>}
            </>
          )}
          {item.status === 'failed' && <span className="ph-batch-err">{item.error || '执行失败'}</span>}
          {item.status === 'cancelled' && <span>{item.error || '已取消'}</span>}
          {item.status === 'cancelling' && <span>正在停止，稍候…</span>}
        </div>

        <div className="ph-batch-item-actions">
          {item.status === 'running' && (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              loading={isBusy}
              onClick={() => act(key + ':stop', () => api.aiBatchItemAction(job.id, item.id, 'stop'), '已停止该页面')}
            >
              停止
            </Button>
          )}
          {(item.status === 'queued' || item.status === 'pending') && (
            <>
              <Button
                size="small"
                icon={<VerticalAlignTopOutlined />}
                loading={isBusy}
                onClick={() => act(key + ':promote', () => api.aiBatchItemAction(job.id, item.id, 'promote'), '已置顶')}
              >
                置顶
              </Button>
              <Button
                size="small"
                icon={<CloseCircleOutlined />}
                loading={isBusy}
                onClick={() => act(key + ':cancel', () => api.aiBatchItemAction(job.id, item.id, 'cancel'), '已取消')}
              >
                取消
              </Button>
            </>
          )}
          {(item.status === 'failed' || item.status === 'cancelled') && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ReloadOutlined />}
              loading={isBusy}
              onClick={() => act(key + ':retry', () => api.aiBatchRetry(job.id, item.id), '已重新排队')}
            >
              重试
            </Button>
          )}
          {hasOutput && (
            <Button size="small" type="link" icon={open ? <DownOutlined /> : <RightOutlined />} onClick={() => toggleOutput(item.id)}>
              {open ? '收起' : '查看输出'}
            </Button>
          )}
          {item.status === 'done' && item.baselineHash && !item.rolledBack && (
            <Tooltip title="把该页面恢复到本次执行前的快照">
              <Button size="small" icon={<UndoOutlined />} loading={isBusy} onClick={() => rollback(job, item)}>
                回滚
              </Button>
            </Tooltip>
          )}
          {item.status === 'failed' && item.baselineHash && !item.rolledBack && item.changedFiles.length > 0 && (
            <Tooltip title="恢复该页面本次已写入的改动">
              <Button size="small" danger icon={<UndoOutlined />} loading={isBusy} onClick={() => rollback(job, item)}>
                回滚改动
              </Button>
            </Tooltip>
          )}
        </div>

        {open && (
          <div className="ph-batch-output-wrap">
            {item.changedFiles.length > 0 && (
              <div className="ph-batch-files">
                <div className="ph-batch-files-title">改动的文件（{item.changedFiles.length}）</div>
                {item.changedFiles.map((f) => (
                  <div key={f} className="ph-batch-file">
                    {f}
                  </div>
                ))}
              </div>
            )}
            <pre className="ph-batch-output">{item.output || item.error || '（没有输出）'}</pre>
          </div>
        )}
      </div>
    );
  };

  const renderJob = (job: BatchJob) => {
    const finished = job.items.filter((i) => i.status === 'done' || i.status === 'failed' || i.status === 'cancelled').length;
    const total = job.items.length;
    const running = job.items.find((i) => i.status === 'running');
    const jobBusy = !!busy[`${job.id}:cancel`] || !!busy[`${job.id}:remove`];

    return (
      <div className="ph-batch-job" key={job.id}>
        <div className="ph-batch-job-head">
          <ThunderboltOutlined style={{ color: 'var(--ph-accent)' }} />
          <span className="ph-batch-job-title">
            {job.status === 'queued'
              ? `排队中（第 ${job.queuePosition} 批）`
              : job.status === 'running'
                ? running
                  ? `正在处理：${running.title}`
                  : '执行中'
                : '已结束'}
          </span>
          <span className="ph-batch-job-count">
            {finished}/{total}
          </span>
          {job.status !== 'done' && (
            <Popconfirm
              title="取消这一批剩余任务？"
              description="未开始的会标记取消，正在执行的会被停止；已完成的页面保留结果。"
              okText="取消剩余任务"
              cancelText="继续执行"
              onConfirm={() => act(`${job.id}:cancel`, () => api.aiBatchCancel(job.id), '已取消剩余任务')}
            >
              <Button size="small" type="text" danger loading={jobBusy} disabled={job.cancelRequested}>
                {job.cancelRequested ? '正在取消…' : '全部取消'}
              </Button>
            </Popconfirm>
          )}
          {job.status === 'done' && (
            <Button size="small" type="text" onClick={() => removeJob(job)} loading={jobBusy}>
              移除记录
            </Button>
          )}
        </div>

        <div className="ph-batch-instruction">「{job.instruction}」</div>
        <Progress
          percent={total ? Math.round((finished / total) * 100) : 0}
          size="small"
          status={job.status === 'done' && job.items.some((i) => i.status === 'failed') ? 'exception' : job.status === 'done' ? 'success' : 'active'}
        />

        <div className="ph-batch-items">{job.items.map((i) => renderItem(job, i))}</div>

        {job.summary && (
          <div className="ph-batch-summary">
            <div className="ph-batch-summary-title">
              <CheckCircleOutlined style={{ color: '#52c41a' }} /> 本次批量结果
            </div>
            <Space size={12} wrap>
              <span>
                成功 <b style={{ color: '#52c41a' }}>{job.summary.done}</b>
              </span>
              {job.summary.failed > 0 && (
                <span>
                  失败 <b style={{ color: '#ff4d4f' }}>{job.summary.failed}</b>
                </span>
              )}
              {job.summary.cancelled > 0 && <span>取消 {job.summary.cancelled}</span>}
              <span>共 {job.summary.total} 个页面</span>
              <span>改动 {job.summary.files} 个文件</span>
              <span>总耗时 {formatDuration(job.summary.elapsedSec)}</span>
            </Space>
          </div>
        )}
      </div>
    );
  };

  // 最新的任务排在最上面
  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          批量任务{active ? `（${jobs.filter((j) => j.status !== 'done').length} 批进行中）` : ''}
        </span>
        <Space size={4}>
          <Tooltip title="刷新">
            <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => void refreshAiBatch()} />
          </Tooltip>
        </Space>
      </div>
      <div className="ph-right-panel-body">
        {sorted.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: 13 }}>
                还没有批量任务
                <br />
                在左侧「原型」列表点「批量修改」勾选多个页面，即可用一条指令统一修改
              </span>
            }
            style={{ marginTop: 80 }}
          />
        ) : (
          sorted.map(renderJob)
        )}
      </div>
    </>
  );
}
