import { Button, Checkbox, Collapse, Empty, Modal, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { CheckOutlined, CopyOutlined, DeleteOutlined, LoadingOutlined, ReloadOutlined, ThunderboltOutlined, UndoOutlined } from '@ant-design/icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { aiRunStore } from '../aiRunStore';
import { getAiModel, getAiModelLabel } from '../aiModelStore';
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
  /** 发布成功后把已勾选批注标记为已完成（让页面标记变绿），并记录使用的 AI 模型 */
  onMarkDone?: (ids: string[], resolvedBy?: string) => Promise<void>;
  /** 找不到对应元素的失效批注 */
  orphanAnnotations?: Annotation[];
  /** 一键删除失效批注 */
  onDeleteOrphans?: (ids: string[]) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
}

/** 把待发布的批注整理成给 AI 的修改指令 */
export function buildAiPrompt(target: string, list: Annotation[]): string {
  const lines = list.map((a, i) => {
    // 优先使用 elementDescription（富上下文），否则回退到裸选择器
    const targetDesc = a.elementDescription || `元素 \`${a.selector}\``;
    // 如果 elementText 和 elementDescription 不同，也附上文字兜底
    const extra = a.elementText && !a.elementDescription?.includes(a.elementText)
      ? `（文字内容："${a.elementText}"）`
      : '';
    return `${i + 1}. ${targetDesc}：${a.text}${extra}`;
  });

  return `请修改原型 src/prototypes/${target}/index.tsx（及其相关文件），按以下批注意见调整：
${lines.join('\n')}

定位说明（重要）：
- 每条批注开头用「」标注了被点击元素的描述（如"表格"订单号"列（第2列，"ID"左侧）"），请根据列标题文字、列序号、相邻列上下文在源码中定位，不要仅凭 CSS 选择器猜测；
- 若批注描述包含「表格」「列」，请在 JSX 的 table columns 数组（或 <Table> 组件的 columns 属性）中查找；
- 若批注描述包含「按钮」「表单字段」「菜单项」，请根据文字内容搜索源码中的可见文案；
- 若描述中包含列序号（如"第2列"），结合左侧/右侧列标题文字一起定位，避免同名列混淆。

执行约束（必须严格遵守）：
- 只通过编辑源码文件完成修改，不要启动开发服务器、不要执行 tsc / build / 测试、不要截图或打开浏览器；
- 精准修改与批注相关的部分，保持原有结构、样式与现有功能；
- 若批注对应的功能尚未实现或不完整，请直接补充代码实现，不要只做分析；
- 改完后用 2-3 句话说明修改了哪些文件与内容即可，不要做额外验证。

最后，请用一行固定分隔符 \`===业务变更说明===\` 另起一段，写一段**给不懂技术的产品 / 业务同事看**的变更说明：
- 用大白话说明这次原型页面改了哪些地方、对使用者（用户）有什么影响；
- 绝对不要出现代码、文件路径、技术术语、函数名、变量名；
- 2-4 句即可，可分条列出改动的页面或功能点。`;
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

export default function AnnotationPanel({ target, annotations, onToggleStatus, onDelete, onApplied, onMarkDone, orphanAnnotations = [], onDeleteOrphans, canUndo, onUndo }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [liveOutput, setLiveOutput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const publishTimerRef = useRef<ReturnType<typeof setInterval>>();

  // 发布耗时计时
  useEffect(() => {
    if (publishing) {
      setElapsed(0);
      publishTimerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(publishTimerRef.current);
    }
    return () => clearInterval(publishTimerRef.current);
  }, [publishing]);

  // 根据 AI 实时输出推导当前所处阶段
  const publishStage = useMemo(() => {
    if (!publishing) return '';
    if (!liveOutput) return 'connecting';
    if (liveOutput.includes('===业务变更说明===')) return 'summary';
    if (/replace_in_file|write_to_file|edit_file/.test(liveOutput)) return 'writing';
    if (/read_file|Read|reading|查看文件/.test(liveOutput)) return 'reading';
    return 'analyzing';
  }, [publishing, liveOutput]);

  const STAGES: { key: string; label: string }[] = [
    { key: 'connecting', label: '连接 AI CLI' },
    { key: 'analyzing', label: '分析批注' },
    { key: 'reading', label: '读取源码' },
    { key: 'writing', label: '改写文件' },
    { key: 'summary', label: '生成说明' },
  ];

  const activeIdx = STAGES.findIndex((s) => s.key === publishStage);
  const fmtTime = (s: number) => `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
  // 待发布批注的勾选集合（仅针对 open 批注）
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(annotations.filter((a) => a.status === 'open').map((a) => a.id)),
  );

  const openAnnotations = useMemo(() => annotations.filter((a) => a.status === 'open'), [annotations]);
  // 列表按创建时间降序，最新的批注排在最上面
  const sortedAnnotations = useMemo(
    () => [...annotations].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [annotations],
  );
  const selectedOpen = useMemo(() => openAnnotations.filter((a) => selected.has(a.id)), [openAnnotations, selected]);
  const allSelected = openAnnotations.length > 0 && selectedOpen.length === openAnnotations.length;

  // 跟踪上一次批注列表的 ID 集合，避免重置用户手动取消的勾选
  const prevAnnIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(annotations.map((a) => a.id));
    const prevIds = prevAnnIdsRef.current;

    setSelected((prev) => {
      const next = new Set(prev);
      // 新增的 open 批注自动勾选；已有的保留用户选择（不管是勾上还是取消）
      annotations
        .filter((a) => a.status === 'open' && !prevIds.has(a.id))
        .forEach((a) => next.add(a.id));
      // 移除已经不存在的批注 ID（被删除了）
      prev.forEach((id) => {
        if (!currentIds.has(id)) next.delete(id);
      });
      return next;
    });

    prevAnnIdsRef.current = currentIds;
  }, [annotations]);

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

  /** 重新执行本次发布（用于失败/超时后一键重试） */
  const retry = () => {
    Modal.destroyAll();
    publishToCodeBuddy();
  };

  /** 一键把勾选的批注发布给 AI CLI，直接改写原型文件 */
  const publishToCodeBuddy = async () => {
    if (selectedOpen.length === 0) {
      message.warning('请先勾选要发布的批注');
      return;
    }
    setPublishing(true);
    setLiveOutput('');
    aiRunStore.set(true);
    try {
      const status = (await api.aiStatus()).clis;
      const available = Object.entries(status)
        .filter(([, v]) => v.available)
        .map(([k]) => k);
      const cli = available.includes('codebuddy') ? 'codebuddy' : available[0];
      if (!cli) {
        message.error('未检测到可用的 AI CLI（CodeBuddy / Claude / Cursor 等），请先安装后再发布');
        return;
      }
      const prompt = buildAiPrompt(target, selectedOpen);
      const { output, timedOut } = await api.aiExecute(
        cli,
        prompt,
        (chunk) => {
          setLiveOutput((prev) => prev + chunk);
        },
        undefined,
        getAiModel(), // 固定模型（仅 codebuddy 生效）
      );

      // 发布后抓取该原型相对 HEAD 的代码改动，让产品同学直接看到改了什么
      const scope = `src/prototypes/${target}`;
      let diff = '';
      try {
        diff = (await api.gitDiff(scope)).diff;
      } catch {
        /* 未初始化 Git 时无法取 diff */
      }

      // 超时 = AI 可能被中途杀掉，存在半截改动。不自动标完成，交给用户人工确认。
      const appliedIds = selectedOpen.map((a) => a.id);
      // 记录本次实际生效的模型（仅 codebuddy 支持 --model，其它 CLI 用各自默认模型）
      const modelLabel = cli === 'codebuddy' ? (getAiModel() ? getAiModelLabel() : 'CLI 默认') : `CLI 默认（${cli}）`;
      // 优先用 AI 产出的业务说明；缺失时回退到批注清单
      const businessSummary = extractBusinessSummary(output) || buildBusinessFallback(selectedOpen);
      if (!timedOut && onMarkDone && appliedIds.length > 0) {
        try {
          await onMarkDone(appliedIds, modelLabel);
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
      Modal.error({
        title: '发布失败',
        width: 520,
        content: (
          <div>
            <Typography.Paragraph type="danger" style={{ marginBottom: 12 }}>
              {e.message}
            </Typography.Paragraph>
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
      setPublishing(false);
      aiRunStore.set(false);
    }
  };

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          批注（{openAnnotations.length} 待处理 / 已选 {selectedOpen.length}）
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
            <Button
              size="small"
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={publishing}
              disabled={selectedOpen.length === 0}
              onClick={publishToCodeBuddy}
            >
              发布
            </Button>
          </div>
        </div>
        {orphanAnnotations.length > 0 && (
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
              有 {orphanAnnotations.length} 条批注对应的页面元素已不存在（可能已被 AI 改动删除/结构变化），标记已无法显示：
            </div>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {orphanAnnotations.map((a) => (
                <div key={a.id} style={{ fontSize: 12, color: 'var(--ph-anno-section-title)' }}>
                  • {a.text}
                </div>
              ))}
            </Space>
            {onDeleteOrphans && (
              <Popconfirm
                title={`确认删除 ${orphanAnnotations.length} 条失效批注？`}
                description="这些批注对应的页面元素已不存在，删除后不可恢复"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDeleteOrphans(orphanAnnotations.map((a) => a.id))}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
              {STAGES.map((stg, i) => {
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
                    {i < STAGES.length - 1 && (
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
                {STAGES[Math.max(0, activeIdx)]?.label || '处理中'}…
              </span>
              <span style={{ fontSize: 11, color: 'var(--ph-text-secondary)', marginLeft: 'auto' }}>
                已耗时 {fmtTime(elapsed)}
              </span>
            </div>
            {/* 实时输出 */}
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
              {liveOutput || '（等待 AI 开始输出…）'}
            </pre>
          </div>
        )}
        {annotations.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="在工具栏开启批注后，点击原型页面元素即可添加" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {sortedAnnotations.map((a, idx) => (
              <div key={a.id} style={{ border: '1px solid var(--ph-anno-card-border)', borderRadius: 8, padding: 10 }}>
                <Space style={{ marginBottom: 6 }}>
                  {a.status === 'open' && (
                    <Checkbox
                      size="small"
                      checked={selected.has(a.id)}
                      onChange={(e) => toggleSelect(a.id, e.target.checked)}
                    />
                  )}
                  <Tag color={a.status === 'open' ? 'blue' : 'green'}>#{idx + 1}</Tag>
                  <Tag color={a.status === 'open' ? 'red' : a.status === 'resolved' ? 'blue' : 'green'}>
                    {a.status === 'open' ? '待处理' : a.status === 'resolved' ? '已解决' : '已完成'}
                  </Tag>
                  {a.status !== 'open' && a.resolvedBy && (
                    <Tag color="cyan">由 {a.resolvedBy} 修改</Tag>
                  )}
                </Space>
                <Typography.Paragraph style={{ marginBottom: 6, fontSize: 13 }}>{a.text}</Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  标注元素：{a.elementDescription || a.elementText || friendlySelectorHint(a.selector)}
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={a.status === 'open' ? <CheckOutlined /> : <UndoOutlined />}
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
