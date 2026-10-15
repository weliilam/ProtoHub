import { Button, Checkbox, Collapse, Empty, Modal, Popconfirm, Space, Tag, Tooltip, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, CopyOutlined, DeleteOutlined, LoadingOutlined, ReloadOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { aiRunStore } from '../aiRunStore';
import { getAiModel, getAiModelLabel } from '../aiModelStore';
import { useAiServerTask } from '../aiServerTask';
import {
  PUBLISH_STAGES,
  appendPublishChunk,
  appendPublishThinking,
  deriveStage,
  dismissPublish,
  finishPublish,
  markPublishQueued,
  markPublishStarted,
  setPublishMeta,
  stageLabel,
  startPublish,
  usePublishBatches,
  type PublishOutcome,
  type PublishStage,
} from '../aiPublishStore';
import { annotationPaneLabel } from '../annotation';
import type { Annotation, CliStatus } from '../types';

/** 从 CSS 选择器中提炼出友好标签（取最后一个有意义的 class 名 + 元素名） */
function friendlySelectorHint(selector: string): string {
  // 优先从末段（最贴近目标的层级）抽取元素 + 关键 class
  const segments = selector.split('>').map((s) => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1] || selector;
  const m = last.match(/^([\w-]+)(?:(?:\.([\w-]+(?:-[\w-]+)*))|$)/);
  if (m) {
    const tag = m[1];
    const cls = m[2] || '';
    // ant-* / 自定义短类
    const shortCls = cls.replace(/^ant-/, '').split('-')[0];
    return shortCls ? `${tag}.${shortCls}` : tag;
  }
  return selector.slice(0, 40) + (selector.length > 40 ? '…' : '');
}

interface Props {
  target: string;
  annotations: Annotation[];
  onToggleStatus: (a: Annotation) => Promise<void>;
  onDelete: (a: Annotation) => Promise<void>;
  onApplied?: () => void;
  /** 发布成功后把已勾选批注标记为已完成（让页面标记变绿），并记录使用的 AI 模型；target 为发布时的原型名 */
  onMarkDone?: (ids: string[], resolvedBy?: string, target?: string) => Promise<void>;
  /** 服务端上本原型的发布任务结束（可能是其它标签页发起）→ 重新拉取批注状态 */
  onReload?: (target: string) => Promise<void> | void;
  /** 元素已不存在的失效批注 */
  missingAnnotations?: Annotation[];
  /** 元素仍在但当前视图不可见的批注（在其他页签 / 未打开的弹窗） */
  hiddenAnnotations?: Annotation[];
  /** 一键删除失效批注（仅针对元素已不存在的） */
  onDeleteMissing?: (ids: string[]) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
}

/** 把待发布的批注整理成给 AI 的修改指令 */
export function buildAiPrompt(target: string, list: Annotation[]): string {
  const lines = list.map((a, i) => {
    const targetDesc = a.elementDescription || `元素 \`${a.selector}\``;
    const extra = a.elementText && !a.elementDescription?.includes(a.elementText)
      ? `（文字内容："${a.elementText}"）`
      : '';
    const src = a.elementSource
      ? `【源码定位】${a.elementSource.file}:${a.elementSource.line} \`${a.elementSource.code}\`（所属：${a.elementSource.container}）`
      : '';
    return `${i + 1}. ${targetDesc}：${a.text}${extra}${src ? ` ${src}` : ''}`;
  });

  const hasContainer = list.some((a) => a.elementDescription?.includes('弹窗中') || a.elementDescription?.includes('抽屉中') || a.elementDescription?.includes('卡片中') || a.elementDescription?.includes('标签页中'));

  const containerHint = hasContainer
    ? `\n\n重要：上述描述中的「XX弹窗」「XX抽屉」等前缀表示该元素所属的 UI 容器。请只修改该容器内部的代码（modal 的 <a-table>、弹窗内的组件等），不要修改页面主列表或其他容器内名称相似的元素。两个不同容器内的同名列/按钮是独立的，不要互相影响。`
    : '';

  const hasSource = list.some((a) => a.elementSource);
  const sourceHint = hasSource
    ? `\n\n重要：部分批注末尾附带了【源码定位】（我方已按源码扫描给出精确位置：文件:行号 + 代码原文，其中「所属」表示它所在的 UI 容器）。请以【源码定位】为准直接修改对应代码位置；只改该容器内部，不要改动其他容器内名称相似的元素。若行号与实际略有偏移，请结合【源码定位】中的代码原文与批注描述中的文字特征二次核对后再改。`
    : '';

  const suffix = list.length <= 1
    ? `\n\n要求：精准修改相关代码，保持原有结构和风格；改完后用一行分隔符 \`===业务变更说明===\` 写 2-3 句面向产品的变更说明（大白话，不要代码/技术术语）。`
    : `\n\n定位：根据描述中的列标题、按钮文字、菜单项等在源码中定位。\n要求：只编辑源码不改dev server；保持原有结构风格；改完后 2-3 句话说明改动。\n最后用分隔符 \`===业务变更说明===\` 写面向产品的变更说明（大白话）。`;

  return `修改原型 src/prototypes/${target}（及其相关文件）：\n${lines.join('\n')}${containerHint}${sourceHint}${suffix}`;
}

/** AI 输出里标记业务说明的分隔符 */
const BUSINESS_SUMMARY_SEP = '===业务变更说明===';

/** 从 AI 输出中提取面向业务同学的变更说明；提取不到返回空串 */
function extractBusinessSummary(output: string): string {
  const idx = output.indexOf(BUSINESS_SUMMARY_SEP);
  if (idx < 0) return '';
  return output
    .slice(idx + BUSINESS_SUMMARY_SEP.length)
    .replace(/^[\s\r\n`#*\-]+/, '')
    .replace(/[\s\r\n`]+$/, '')
    .trim();
}

/** 当 AI 未产出业务说明时，用发布的批注清单回退生成一份业务可读的改动说明 */
function buildBusinessFallback(list: Annotation[]): string {
  const items = list.map((a, i) => `${i + 1}. ${a.text}`);
  return `本次共按以下 ${list.length} 条意见调整了原型：\n${items.join('\n')}`;
}

const DIFF_STYLE: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  maxHeight: 280,
  overflow: 'auto',
  background: 'var(--ph-terminal-bg)',
  color: 'var(--ph-terminal-color)',
  padding: 10,
  borderRadius: 6,
  fontSize: 12,
  margin: 0,
  fontFamily: 'monospace',
};

export default function AnnotationPanel({ target, annotations, onToggleStatus, onDelete, onApplied, onMarkDone, onReload, missingAnnotations = [], hiddenAnnotations = [], onDeleteMissing, canUndo, onUndo }: Props) {
  /** 发布状态在全局 store 里（跨面板关闭/切换原型存活），这里只订阅渲染 */
  const batches = usePublishBatches();
  const serverTask = useAiServerTask();
  /** 排队提示只弹一次（服务端的 onQueued 每 5s 回调一次） */
  const queuedNotifiedRef = useRef(false);
  /**
   * 发布进行中的同步闸门：必须在任何 await 之前置位。
   * 因为发布要先备份快照 + 探测 CLI 才登记批次，这段准备期 store 里还是空的，
   * 按钮的 loading / disabled 都来不及生效，用户连点两下就会重复发起。
   */
  const publishBusyRef = useRef(false);
  /** 上一轮服务端任务：用于识别"本原型的发布刚跑完"（可能是别的标签页发起的） */
  const prevServerTaskRef = useRef<typeof serverTask | null>(null);

  /** 本页发起的、针对本原型的发布（进行中 / 最近结束） */
  const myActiveBatches = useMemo(() => batches.filter((b) => b.target === target && !b.outcome), [batches, target]);
  const myDoneBatches = useMemo(
    () => batches.filter((b) => b.target === target && b.outcome).slice(0, 2),
    [batches, target],
  );
  /** 服务端正在跑的本页面发布（可能是其它标签页发起的） */
  const serverIds = useMemo(() => {
    const t = serverTask.task;
    if (!t?.annotationIds?.length) return [] as string[];
    const name = (t.target || '').replace(/\/+$/, '').split('/').pop() || '';
    return name === target ? t.annotationIds : [];
  }, [serverTask, target]);
  /** 正在发布中的批注 id：这些不再算"待处理"，也不能被再次勾选发布 */
  const publishingIds = useMemo(
    () => new Set<string>([...myActiveBatches.flatMap((b) => b.annotationIds), ...serverIds]),
    [myActiveBatches, serverIds],
  );
  const publishing = myActiveBatches.length > 0 || serverIds.length > 0;
  // 自动勾选的 effect 里要读最新的"发布中"集合，用 ref 兜住，避免把它加进依赖反复重跑
  const publishingIdsRef = useRef(publishingIds);
  publishingIdsRef.current = publishingIds;

  // 发布耗时计时（发布中才需要每秒重渲染）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!publishing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [publishing]);

  const activeBatch = myActiveBatches[0];
  const liveOutput = activeBatch?.output ?? '';
  const liveThinking = activeBatch?.thinking ?? '';
  // 本页发起的发布能推导到"改文件/生成说明"等阶段；其它标签页发起的只有服务端进度
  const publishStage = activeBatch
    ? activeBatch.stage ?? deriveStage(activeBatch.output, activeBatch.thinking)
    : serverIds.length > 0
      ? 'analyzing'
      : '';
  const activeIdx = PUBLISH_STAGES.findIndex((s) => s.key === publishStage);
  const publishElapsed = activeBatch ? Math.max(0, Math.floor((now - activeBatch.startedAt) / 1000)) : serverTask.task?.elapsedSec ?? 0;
  const queuePosition = activeBatch?.queuePosition ?? 0;
  const fmtTime = (s: number) => `${Math.floor(s / 60)} 分 ${s % 60} 秒`;

  // 待发布批注的勾选集合（仅针对 open 批注）
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(annotations.filter((a) => a.status === 'open').map((a) => a.id)),
  );

  const openAnnotations = useMemo(() => annotations.filter((a) => a.status === 'open'), [annotations]);
  /** 可勾选（可发布）的批注：正在发布中的那批要排除，否则会造成同一批批注重复发布 */
  const selectableOpen = useMemo(
    () => openAnnotations.filter((a) => !publishingIds.has(a.id)),
    [openAnnotations, publishingIds],
  );
  // 列表按创建时间降序，最新的批注排在最上面
  const sortedAnnotations = useMemo(
    () => [...annotations].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [annotations],
  );
  const selectedOpen = useMemo(() => selectableOpen.filter((a) => selected.has(a.id)), [selectableOpen, selected]);
  const allSelected = selectableOpen.length > 0 && selectedOpen.length === selectableOpen.length;

  /** 上一次发布失败/超时且这批批注仍待处理的：列表里标出来并给"重试"入口 */
  const lastOutcomeBatch = myDoneBatches[0];
  const failedIds = useMemo(() => {
    const b = lastOutcomeBatch;
    if (!b?.outcome || b.outcome.kind === 'success') return new Set<string>();
    // 超时/失败的批注若已被后续发布成功（不再是 open），就不再标红
    return new Set(b.annotationIds.filter((id) => openAnnotations.some((a) => a.id === id)));
  }, [lastOutcomeBatch, openAnnotations]);
  /** 刚被本次发布改动的批注（10 分钟内）：列表里高亮，方便逐条核对 */
  const justChangedIds = useMemo(() => {
    const b = lastOutcomeBatch;
    if (!b?.outcome || b.outcome.kind !== 'success' || !b.finishedAt) return new Set<string>();
    if (Date.now() - b.finishedAt > 10 * 60 * 1000) return new Set<string>();
    return new Set(b.annotationIds);
  }, [lastOutcomeBatch, now]);

  // 跟踪上一次批注列表的 ID 集合，避免重置用户手动取消的勾选
  const prevAnnIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(annotations.map((a) => a.id));
    const prevIds = prevAnnIdsRef.current;

    setSelected((prev) => {
      const next = new Set(prev);
      // 新增的 open 批注自动勾选；已有的保留用户选择（不管是勾上还是取消）
      // 正在发布中的批注不自动勾选（它们已经提交给 AI 了，勾着会让人误以为还能再发一次）
      annotations
        .filter((a) => a.status === 'open' && !prevIds.has(a.id) && !publishingIdsRef.current.has(a.id))
        .forEach((a) => next.add(a.id));
      // 移除已经不存在的批注 ID（被删除了）
      prev.forEach((id) => {
        if (!currentIds.has(id)) next.delete(id);
      });
      return next;
    });

    prevAnnIdsRef.current = currentIds;
  }, [annotations]);

  // 服务端上本原型的发布任务结束了（比如说：别的标签页发布完、本页刷新前发起的任务收尾）
  // → 重新拉一次批注，让"发布中"标记自动消失、已完成状态自动补上
  useEffect(() => {
    const prev = prevServerTaskRef.current;
    prevServerTaskRef.current = serverTask;
    const prevTask = prev?.task;
    if (!prevTask?.annotationIds?.length) return;
    const prevTarget = (prevTask.target || '').replace(/\/+$/, '').split('/').pop() || '';
    if (prevTarget !== target) return;
    const cur = serverTask.task;
    // 同一个任务还在跑就不动；换成别的任务/已结束 → 说明这一批发布了结
    if (cur && cur.id === prevTask.id) return;
    void onReload?.(target);
  }, [serverTask, target, onReload]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelected(new Set(checked ? openAnnotations.map((a) => a.id) : []));
  };

  const copyPrompt = async () => {
    if (selectedOpen.length === 0) {
      message.warning('请先勾选要复制的批注');
      return;
    }
    try {
      await navigator.clipboard.writeText(buildAiPrompt(target, selectedOpen));
      message.success('已复制 AI 修改指令，粘贴给 AI 即可');
    } catch {
      message.error('复制失败');
    }
  };

  /** 本次发布的批注列表：重试/查看结果时要复原这一批，不能依赖"当前勾选" */
  const lastPublishedRef = useRef<Annotation[]>([]);

  /** 按 id 找回这批批注（可能已被标为 done，所以不能只从 openAnnotations 里找） */
  const listByIds = (ids: string[]) => annotations.filter((a) => ids.includes(a.id));

  /** 重新发布某一批批注（失败/超时后的一键重试）；不传则重发上一次那批 */
  const retry = (ids?: string[] | unknown) => {
    Modal.destroyAll();
    const list = Array.isArray(ids) ? listByIds(ids as string[]) : lastPublishedRef.current;
    if (list.length === 0) {
      // 兜底：如果历史批次找不到了（例如刷新过页面），退回当前勾选
      void publishToCodeBuddy();
      return;
    }
    void publishToCodeBuddy(list);
  };

  /** 打开"上次发布结果"详情：业务说明 + diff + 日志 + 还原/重试入口 */
  const showStoredOutcome = (o: PublishOutcome, ids: string[]) => {
    const timedOut = o.kind === 'timeout';
    const failed = o.kind === 'error';
    Modal.info({
      title: failed
        ? `发布失败（${o.cli}）`
        : timedOut
          ? `AI 执行超时（${o.cli} · ${o.model}），请人工确认改动是否完整`
          : `CodeBuddy 已应用修改（${o.cli} · ${o.model}）`,
      width: 760,
      content: (
        <div>
          <div
            style={{
              background: 'var(--ph-anno-highlight-bg)',
              border: '1px solid var(--ph-anno-highlight-border)',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-anno-title-color)' }}>
              📋 本次原型改动说明（给产品 / 业务同学）
            </div>
            <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {o.message}
            </Typography.Paragraph>
          </div>
          {timedOut && (
            <Typography.Paragraph type="warning" style={{ marginBottom: 8 }}>
              本次执行超时被终止，可能只改了一半。请展开下方「技术改动明细」核对 diff 与批注是否已全部落实，未落实的部分建议点「重试」补齐。
            </Typography.Paragraph>
          )}
          <Space style={{ marginBottom: 12 }}>
            {!failed && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => retry(ids)}>
                再发一次
              </Button>
            )}
            {failed && (
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => retry(ids)}>
                重试
              </Button>
            )}
            {o.backupHash && (
              <Button danger icon={<UndoOutlined />} onClick={() => restoreBackup(o.backupHash)}>
                还原到发布前
              </Button>
            )}
          </Space>
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'detail',
                label: <span style={{ color: 'var(--ph-text-secondary)', fontSize: 13 }}>技术改动明细（开发参考，点击展开）</span>,
                children: (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-text-secondary)' }}>代码改动（git diff）</div>
                    <pre style={DIFF_STYLE}>{o.diff || '（无代码变更，或项目尚未纳入 Git 版本管理）'}</pre>
                    <div style={{ fontWeight: 600, margin: '12px 0 6px', color: 'var(--ph-text-secondary)' }}>AI 执行日志</div>
                    <pre style={{ ...DIFF_STYLE, background: 'var(--ph-anno-diff-bg)', color: 'var(--ph-anno-diff-color)' }}>
                      {o.output || '（无日志）'}
                    </pre>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    });
  };

  /** 还原到发布前的自动快照（AI 改错后兜底） */
  const restoreBackup = async (hash: string) => {
    Modal.destroyAll();
    try {
      await api.gitRestore(hash, `src/prototypes/${target}`);
      message.success('已还原到发布前状态，请刷新预览查看');
      onApplied?.();
    } catch (e: any) {
      message.error(`还原失败：${e.message}`);
    }
  };

  /**
   * 一键把批注发布给 AI CLI，直接改写原型文件。
   * 发布状态写在全局 store 里：关闭右侧面板（组件卸载）不影响执行，重开面板能看到进度，
   * 完成后状态与结果也不丢，避免"发布完又变回待发布"的错觉。
   */
  const publishToCodeBuddy = async (preset?: Annotation[] | unknown) => {
    const list = Array.isArray(preset) ? (preset as Annotation[]) : selectedOpen;
    if (list.length === 0) {
      message.warning('请先勾选要发布的批注');
      return;
    }
    // 同步闸门放在所有 await 之前：准备期（备份 + 探测 CLI）界面还没有进行态，
    // 快速双击会连发两次（第二次要么重复改代码，要么被服务端 409 拒掉）。
    if (publishBusyRef.current || publishing) {
      message.info('已有批注正在发布中，请等它结束后再发布剩余的');
      return;
    }
    publishBusyRef.current = true;
    aiRunStore.set(true);
    queuedNotifiedRef.current = false;
    const appliedIds = list.map((a) => a.id);
    const publishedAt = Date.now();
    // 关键：在点击的这一刻就把批次登记进 store，让按钮立刻 loading、进度区立刻出现；
    // 否则"备份快照 + 探测 CLI"这段（可能是几百毫秒到几秒）界面毫无反应，用户会以为没点上。
    // cli / modelLabel 先留空，准备完成后补写。
    const batchId = startPublish({
      target,
      cli: '',
      modelLabel: '',
      annotationIds: appliedIds,
      annotationTexts: list.map((a) => a.text),
    });
    lastPublishedRef.current = list;
    // 发布后立刻取消这几条的勾选，避免用户以为还能再发一次
    setSelected((prev) => {
      const next = new Set(prev);
      appliedIds.forEach((id) => next.delete(id));
      return next;
    });
    // 批次已同步登记，后续重复点击由 store 的 publishing 状态拦截，闸门可以放开了
    publishBusyRef.current = false;
    // 兜底保险用的快照 hash：AI 改动前拍快照，改错后可一键还原（提升到函数级，失败弹窗也能用）
    let backupHash = '';
    // 这几个变量在 catch 里也要用（失败时同样要落一条发布结果），所以提到 try 外面
    let cli = '';
    let modelLabel = '';
    try {
      // ── 准备阶段：拍快照 + 探测可用 CLI，两者互不依赖，并行跑以缩短这段"空窗期" ──
      const [snap, aiStatus] = await Promise.all([
        // 无 Git / 该原型没有变更时跳过自动备份，不影响发布
        api.gitSnapshot(`批注发布前自动备份：${target}`, `src/prototypes/${target}`).catch(() => null),
        api.aiStatus(),
      ]);
      backupHash = snap?.hash ?? '';
      const available = Object.entries(aiStatus.clis)
        .filter(([, v]) => v.available)
        .map(([k]) => k);
      cli = available.includes('codebuddy') ? 'codebuddy' : available[0] || '';
      if (!cli) {
        // 没发出去：撤掉批次，并把勾选还给用户，免得白勾一遍
        dismissPublish(batchId);
        setSelected((prev) => new Set([...prev, ...appliedIds]));
        message.error('未检测到可用的 AI CLI（CodeBuddy / Claude / Cursor 等），请先安装后再发布');
        return;
      }
      // 记录本次实际生效的模型（仅 codebuddy 支持 --model，其它 CLI 用各自默认模型）
      modelLabel = cli === 'codebuddy' ? (getAiModel() ? getAiModelLabel() : 'CLI 默认') : `CLI 默认（${cli}）`;
      // 准备结束：补上 CLI/模型信息，并把阶段交还给实时输出推导
      setPublishMeta(batchId, { cli, modelLabel, stage: null });
      const prompt = buildAiPrompt(target, list);
      const { output, timedOut } = await api.aiExecute(
        cli,
        prompt,
        (chunk) => {
          appendPublishChunk(batchId, chunk);
        },
        undefined,
        getAiModel(), // 固定模型（仅 codebuddy 生效）
        undefined,
        undefined,
        (thinking) => {
          appendPublishThinking(batchId, thinking);
        },
        {
          target: `src/prototypes/${target}`,
          annotationIds: appliedIds,
          // 已有任务在跑时不再"拒绝"，而是排队；首次排队时给用户一个明确提示
          onQueued: (info) => {
            markPublishQueued(batchId, info.position);
            if (queuedNotifiedRef.current) return;
            queuedNotifiedRef.current = true;
            message.info(
              `已有 AI 任务在执行，本次发布已排队（前面还有 ${Math.max(0, info.position - 1)} 个），会自动开始`,
            );
          },
          onStart: () => markPublishStarted(batchId),
        },
      );

      // 发布后抓取该原型相对 HEAD 的代码改动，让产品同学直接看到改了什么
      const scope = `src/prototypes/${target}`;
      let diff = '';
      try {
        diff = (await api.gitDiff(scope)).diff;
      } catch {
        /* 未初始化 Git 时无法取 diff */
      }

      // 优先用 AI 产出的业务说明；缺失时回退到批注清单
      const businessSummary = extractBusinessSummary(output) || buildBusinessFallback(list);
      // 先落"发布结果"，再标完成：即使后面标记接口失败，面板上也留着这次发布的结果入口
      finishPublish(batchId, {
        kind: timedOut ? 'timeout' : 'success',
        message: businessSummary,
        businessSummary,
        diff,
        output,
        cli,
        model: modelLabel,
        elapsedSec: Math.round((Date.now() - publishedAt) / 1000),
        backupHash,
        annotationTexts: list.map((a) => a.text),
      });
      // 超时 = AI 可能被中途杀掉，存在半截改动。不自动标完成，交给用户人工确认。
      if (!timedOut && onMarkDone && appliedIds.length > 0) {
        try {
          // 必须带上 target：发布期间用户可能已切到别的原型或关掉面板，
          // 不能再拿"当前选中"去刷新列表（否则会把别的原型的批注灌进面板）
          await onMarkDone(appliedIds, modelLabel, target);
        } catch {
          /* 标记失败不影响已完成的代码改动 */
        }
      }

      Modal.info({
        title: timedOut ? `AI 执行超时（${cli} · ${modelLabel}），请人工确认改动是否完整` : `CodeBuddy 已应用修改（${cli} · ${modelLabel}）`,
        width: 760,
        content: (
          <div>
            {/* 业务 / 产品同学看的非技术变更说明，放在最醒目位置 */}
            <div
              style={{
                background: 'var(--ph-anno-highlight-bg)',
                border: '1px solid var(--ph-anno-highlight-border)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-anno-title-color)' }}>
                📋 本次原型改动说明（给产品 / 业务同学）
              </div>
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {businessSummary}
              </Typography.Paragraph>
            </div>
            {timedOut && (
              <Typography.Paragraph type="warning" style={{ marginBottom: 8 }}>
                本次执行超时被终止，可能只改了一半。请展开下方「技术改动明细」核对 diff 与批注是否已全部落实，未落实的部分建议点「重试」补齐；确认落实后再把对应批注标记为已完成。
              </Typography.Paragraph>
            )}
            {timedOut && (
              <Button type="primary" icon={<ReloadOutlined />} style={{ marginBottom: 12 }} onClick={retry}>
                重试
              </Button>
            )}
            {backupHash && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 12,
                  padding: '8px 12px',
                  border: '1px dashed var(--ph-anno-warn-border)',
                  background: 'var(--ph-anno-warn-bg)',
                  borderRadius: 6,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  已自动备份（{backupHash.slice(0, 7)}）。若改动不符合预期，可一键还原到发布前状态。
                </Typography.Text>
                <Button size="small" danger icon={<UndoOutlined />} onClick={() => restoreBackup(backupHash)}>
                  还原到发布前
                </Button>
              </div>
            )}
            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: 'detail',
                  label: <span style={{ color: 'var(--ph-text-secondary)', fontSize: 13 }}>技术改动明细（开发参考，点击展开）</span>,
                  children: (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-text-secondary)' }}>代码改动（git diff）</div>
                      <pre style={DIFF_STYLE}>{diff || '（无代码变更，或项目尚未纳入 Git 版本管理）'}</pre>
                      <div style={{ fontWeight: 600, margin: '12px 0 6px', color: 'var(--ph-text-secondary)' }}>AI 执行日志</div>
                      <pre style={{ ...DIFF_STYLE, background: 'var(--ph-anno-diff-bg)', color: 'var(--ph-anno-diff-color)' }}>
                        {output + (timedOut ? '\n\n[已超时（10 分钟），进程被终止，可点下方「重试」继续]' : '')}
                      </pre>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ),
      });
      message.success({ content: `已通过 ${cli} 应用批注，请刷新预览查看效果`, key: 'publish' });
      onApplied?.();
    } catch (e: any) {
      // 失败也要落一条结果：面板上会留下"这批批注发布失败 + 一键重试"，
      // 而不是让它们静默回到"待处理"
      if (batchId) finishPublish(batchId, {
        kind: 'error',
        message: e?.message || '发布失败',
        businessSummary: '',
        diff: '',
        output: '',
        cli,
        model: modelLabel,
        elapsedSec: Math.round((Date.now() - publishedAt) / 1000),
        backupHash,
        annotationTexts: list.map((a) => a.text),
      });
      Modal.error({
        title: '发布失败',
        width: 520,
        content: (
          <div>
            <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
              {e.message}
            </Typography.Paragraph>
            {backupHash && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '8px 12px',
                  border: '1px dashed var(--ph-anno-warn-border)',
                  background: 'var(--ph-anno-warn-bg)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  发布前已自动备份，若 AI 已改动部分文件，可先还原到发布前状态再重试。
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Button size="small" danger icon={<UndoOutlined />} onClick={() => restoreBackup(backupHash)}>
                    还原到发布前
                  </Button>
                </div>
              </div>
            )}
            <Space>
              <Button type="primary" icon={<ReloadOutlined />} onClick={retry}>
                重试
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(e.message || '');
                    message.success('错误信息已复制，可粘贴发给开发同学排查');
                  } catch {
                    message.error('复制失败，请手动选择文本复制');
                  }
                }}
              >
                复制错误信息
              </Button>
            </Space>
          </div>
        ),
      });
    } finally {
      // 双保险：准备期异常时也要把闸门放开，否则发布按钮会永久失效
      publishBusyRef.current = false;
      aiRunStore.set(false);
    }
  };

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          批注（{selectableOpen.length} 待处理
          {publishingIds.size > 0 && ` / ${publishingIds.size} 发布中`} / 已选 {selectedOpen.length}）
        </span>
      </div>
      <div className="ph-right-panel-body">
        {/* 动作区：所有按钮统一大小、统一风格，主操作放右侧 */}
        <div className="ph-action-bar">
          <Checkbox
            checked={allSelected}
            indeterminate={selectedOpen.length > 0 && !allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
          >
            全选
          </Checkbox>
          <div className="ph-action-bar-right">
            <Button
              size="small"
              icon={<UndoOutlined />}
              disabled={!canUndo}
              onClick={() => onUndo?.()}
            >
              撤销
            </Button>
            <Button
              size="small"
              icon={<CopyOutlined />}
              disabled={selectedOpen.length === 0}
              onClick={copyPrompt}
            >
              复制 AI 指令
            </Button>
            <Tooltip
              title={
                publishing
                  ? `本页 ${publishingIds.size} 条批注正在发布中，完成后可继续发布剩余的`
                  : selectedOpen.length === 0
                    ? '请先勾选要发布的批注'
                    : '把勾选的批注直接交给 AI 改代码'
              }
            >
              <Button
                size="small"
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={myActiveBatches.length > 0}
                disabled={selectedOpen.length === 0 || publishing}
                onClick={publishToCodeBuddy}
              >
                发布{selectedOpen.length > 0 ? `（${selectedOpen.length}）` : ''}
              </Button>
            </Tooltip>
          </div>
        </div>
        {/* 上次发布结果：常驻入口，避免"发过了但看不到结果" */}
        {myDoneBatches.map((b) => {
          const o = b.outcome!;
          const ok = o.kind === 'success';
          const timeout = o.kind === 'timeout';
          return (
            <div
              key={b.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px dashed var(--ph-anno-${ok ? 'highlight' : 'warn'}-border)`,
                background: `var(--ph-anno-${ok ? 'highlight' : 'warn'}-bg)`,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--ph-anno-section-title)' }}>
                {ok ? '✅' : timeout ? '⚠️' : '❌'} 上次发布
                {ok ? '已完成' : timeout ? '超时（请人工确认）' : '失败'}：{b.annotationIds.length} 条批注 · {o.cli} ·{' '}
                {fmtTime(o.elapsedSec || 0)}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <Button size="small" onClick={() => showStoredOutcome(o, b.annotationIds)}>
                  查看改动说明
                </Button>
                {!ok && (
                  <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={() => retry(b.annotationIds)}>
                    重试
                  </Button>
                )}
                <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => dismissPublish(b.id)} />
              </span>
            </div>
          );
        })}
        {hiddenAnnotations.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              border: '1px solid var(--ph-anno-highlight-border)',
              background: 'var(--ph-anno-highlight-bg)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ph-anno-title-color)', marginBottom: 6 }}>
              有 {hiddenAnnotations.length} 条批注的元素不在当前视图（在其它页签或未打开的弹窗中），
              对应页签上已用红点标出数量，切换后即可看到标记：
            </div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {hiddenAnnotations.map((a) => {
                const pane = annotationPaneLabel(a);
                return (
                  <div key={a.id} style={{ fontSize: 12, color: 'var(--ph-anno-section-title)' }}>
                    • {a.text}
                    {pane && <span style={{ opacity: 0.7 }}>（「{pane}」页签）</span>}
                  </div>
                );
              })}
            </Space>
          </div>
        )}
        {missingAnnotations.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              border: '1px solid var(--ph-anno-warn-border)',
              background: 'var(--ph-anno-warn-bg)',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--ph-anno-warn-color)', marginBottom: 6 }}>
              有 {missingAnnotations.length} 条批注对应的页面元素已不存在（可能已被 AI 改动删除/结构变化），标记已无法显示：
            </div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {missingAnnotations.map((a) => (
                <div key={a.id} style={{ fontSize: 12, color: 'var(--ph-anno-section-title)' }}>
                  • {a.text}
                </div>
              ))}
            </Space>
            {onDeleteMissing && (
              <Popconfirm
                title={`确认删除 ${missingAnnotations.length} 条失效批注？`}
                description="这些批注对应的页面元素已不存在，删除后不可恢复"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDeleteMissing(missingAnnotations.map((a) => a.id))}
              >
                <Button size="small" danger style={{ marginTop: 8 }}>
                  一键清理失效批注
                </Button>
              </Popconfirm>
            )}
          </div>
        )}
        {publishing && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: 'var(--ph-anno-loading-bg)',
              border: '1px solid var(--ph-anno-highlight-border)',
              borderRadius: 8,
            }}
          >
            {/* 阶段进度条 */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, rowGap: 6, marginBottom: 10 }}>
              {PUBLISH_STAGES.map((stg, i) => {
                const done = activeIdx > i;
                const current = activeIdx === i;
                return (
                  <React.Fragment key={stg.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: done ? 'var(--ph-anno-resolved-color, #52c41a)'
                            : current ? 'var(--ph-primary-color, #1677ff)'
                            : 'var(--ph-anno-input-border, #d9d9d9)',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: current ? 'var(--ph-primary-color, #1677ff)' : 'var(--ph-text-secondary)',
                          fontWeight: current ? 600 : 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {stg.label}
                      </span>
                    </div>
                    {i < PUBLISH_STAGES.length - 1 && (
                      <div
                        style={{
                          flex: 'none',
                          width: 12,
                          height: 1,
                          background: done ? 'var(--ph-anno-resolved-color, #52c41a)' : 'var(--ph-anno-input-border, #d9d9d9)',
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            {/* 当前状态行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <LoadingOutlined style={{ fontSize: 18, color: 'var(--ph-primary-color)' }} spin />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ph-primary-color)' }}>
                {queuePosition > 0
                  ? `排队中（前面还有 ${Math.max(0, queuePosition - 1)} 个任务）`
                  : publishStage === 'preparing'
                    ? '正在备份原型、检查 AI 环境…'
                    : `${stageLabel((publishStage || 'connecting') as PublishStage)}…`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ph-text-secondary)', marginLeft: 'auto' }}>
                已耗时 {fmtTime(publishElapsed)}
              </span>
            </div>
            {/* 正在发布的是哪些批注 + 关掉面板也不会中断 */}
            <div style={{ fontSize: 11, color: 'var(--ph-text-secondary)', marginBottom: 10, lineHeight: 1.7 }}>
              本次发布 {publishingIds.size} 条批注
              {activeBatch && activeBatch.annotationTexts.length > 0 ? `：${activeBatch.annotationTexts.join('；')}` : ''}。
              可以关闭本面板，发布会在后台继续，完成后自动标记为「已完成」。
              {!activeBatch && '（这条发布由其它标签页发起，此处只显示服务端进度）'}
            </div>
            {/* 实时输出 */}
            {liveThinking && !liveOutput && (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: 140,
                  overflow: 'auto',
                  background: 'var(--ph-anno-loading-bg)',
                  color: 'var(--ph-text-secondary)',
                  padding: 8,
                  borderRadius: 6,
                  fontSize: 11,
                  margin: 0,
                  fontFamily: 'monospace',
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                }}
              >
                {liveThinking.slice(-800)}
              </pre>
            )}
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 180,
                overflow: 'auto',
                background: 'var(--ph-anno-diff-bg)',
                color: 'var(--ph-anno-diff-color)',
                padding: 10,
                borderRadius: 6,
                fontSize: 11,
                margin: 0,
                fontFamily: 'monospace',
                lineHeight: 1.5,
                border: '1px solid var(--ph-anno-input-border)',
              }}
            >
              {liveOutput || (!liveThinking ? '（等待 AI 开始输出…）' : '（AI 思考完成，正在生成改动…）')}
            </pre>
          </div>
        )}
        {annotations.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="在工具栏开启批注后，点击原型页面元素即可添加" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {sortedAnnotations.map((a, idx) => (
              <div key={a.id} style={{ border: '1px solid var(--ph-anno-card-border)', borderRadius: 8, padding: 10 }}>
                <Space style={{ marginBottom: 6 }} wrap>
                  {a.status === 'open' && !publishingIds.has(a.id) && (
                    <Checkbox
                      checked={selected.has(a.id)}
                      onChange={(e) => toggleSelect(a.id, e.target.checked)}
                    />
                  )}
                  <Tag color={a.status === 'open' ? 'blue' : 'green'}>#{idx + 1}</Tag>
                  {/* 已提交给 AI、还没跑完的批注：单列"发布中"，不要再显示成"待处理" */}
                  {publishingIds.has(a.id) ? (
                    <Tag color="orange" icon={<LoadingOutlined spin />}>
                      发布中
                    </Tag>
                  ) : (
                    <Tag color={a.status === 'open' ? 'red' : a.status === 'resolved' ? 'blue' : 'green'}>
                      {a.status === 'open' ? '待处理' : a.status === 'resolved' ? '已解决' : '已完成'}
                    </Tag>
                  )}
                  {failedIds.has(a.id) && <Tag color="volcano">上次发布未完成，可重试</Tag>}
                  {justChangedIds.has(a.id) && <Tag color="green">本次已改</Tag>}
                  {a.status !== 'open' && a.resolvedBy && (
                    <Tag color="cyan">由 {a.resolvedBy} 修改</Tag>
                  )}
                </Space>
                <Typography.Paragraph style={{ marginBottom: 6, fontSize: 13 }}>{a.text}</Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  标注元素：{a.elementDescription || a.elementText || friendlySelectorHint(a.selector)}
                </Typography.Text>
                {annotationPaneLabel(a) && (
                  <div style={{ marginTop: 4 }}>
                    <Tag color="purple" style={{ fontSize: 11, marginInlineEnd: 0 }}>
                      「{annotationPaneLabel(a)}」页签
                    </Tag>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={a.status === 'open' ? <CheckOutlined /> : <UndoOutlined />}
                      disabled={publishingIds.has(a.id)}
                      onClick={() => onToggleStatus(a)}
                    >
                      {a.status === 'open' ? '完成' : '重开'}
                    </Button>
                    <Popconfirm title="删除该批注？" okText="删除" cancelText="取消" onConfirm={() => onDelete(a)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </Space>
        )}
      </div>
    </>
  );
}
