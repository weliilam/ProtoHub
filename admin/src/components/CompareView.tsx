import { useEffect, useMemo, useState } from 'react';
import { Button, Collapse, Empty, Modal, Space, Spin, Tag, message } from 'antd';
import {
  CloseOutlined,
  CopyOutlined,
  LeftOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import type { GitLogItem } from '../types';

interface Props {
  open: boolean;
  snapshots: GitLogItem[];
  selected: string[];
  prototype: string;
  scope: string;
  onClose: () => void;
}

/** 友好文件名映射 */
function friendlyName(file: string): string {
  const base = file.split('/').pop() || file;
  const map: Record<string, string> = {
    'index.tsx': '主页面代码',
    'spec.md': '需求/规格文档',
    'style.css': '样式文件',
    'README.md': '说明文档',
  };
  if (map[base]) return map[base];
  if (base.endsWith('.tsx') || base.endsWith('.ts')) return base.replace(/\\.\\w+$/, '') + '（代码）';
  if (base.endsWith('.css')) return base + '（样式）';
  if (base.endsWith('.md')) return base + '（文档）';
  if (base.endsWith('.json')) return base + '（数据）';
  return base;
}

interface FileChange {
  file: string;
  friendly: string;
  added: number;
  removed: number;
  status: '新增' | '修改' | '删除' | '重命名';
}

function parseCompareDiff(diff: string): { files: FileChange[]; added: number; removed: number } {
  const files: FileChange[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  const blocks = diff.split(/^diff --git /m).slice(1);
  for (const block of blocks) {
    const headerLine = block.split('\n', 1)[0];
    const m = headerLine.match(/b\/(.+)$/);
    const file = m ? m[1] : headerLine;
    let status: FileChange['status'] = '修改';
    if (/^new file mode/m.test(block)) status = '新增';
    else if (/^deleted file mode/m.test(block)) status = '删除';
    else if (/^rename from /m.test(block)) status = '重命名';
    let added = 0;
    let removed = 0;
    for (const ln of block.split('\n')) {
      if (ln.startsWith('+') && !ln.startsWith('+++')) added++;
      else if (ln.startsWith('-') && !ln.startsWith('---')) removed++;
    }
    totalAdded += added;
    totalRemoved += removed;
    files.push({ file, friendly: friendlyName(file), added, removed, status });
  }
  return { files, added: totalAdded, removed: totalRemoved };
}

const STATUS_COLOR: Record<FileChange['status'], string> = {
  新增: 'green',
  修改: 'blue',
  删除: 'red',
  重命名: 'gold',
};

/** 构建复制用的结构化文本 */
function buildCopyText(
  snapshotA: GitLogItem,
  snapshotB: GitLogItem,
  summary: ReturnType<typeof parseCompareDiff>,
  messages: string[],
) {
  const lines = [
    `=== 原型版本对比 ===`,
    `原型：${snapshotA.message || '（无说明）'}`,
    ``,
    `【左 · 旧版本】${snapshotA.hash} - ${snapshotA.date}`,
    `  说明：${snapshotA.message || '（无说明）'}`,
    ``,
    `【右 · 新版本】${snapshotB.hash} - ${snapshotB.date}`,
    `  说明：${snapshotB.message || '（无说明）'}`,
    ``,
    `【改动概要】`,
    `共改动 ${summary.files.length} 个文件（新增约 ${summary.added} 处、删减约 ${summary.removed} 处）`,
    ``,
    ...(messages.length > 0 ? [`【中间提交说明】`, ...messages.map((m, i) => `  ${i + 1}. ${m}`), ``] : []),
    `【文件清单】`,
    ...summary.files.map((f) => `  ${f.friendly}（${f.status}，+${f.added}/-${f.removed})`),
  ];
  return lines.join('\n');
}

export function CompareView({ open, snapshots, selected, prototype, scope, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [diffData, setDiffData] = useState<{
    diff: string;
    stat: string;
    messages: string[];
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const snapshotA = snapshots.find((s) => s.hash === selected[0])!;
  const snapshotB = snapshots.find((s) => s.hash === selected[1])!;

  const summary = useMemo(
    () => (diffData?.diff ? parseCompareDiff(diffData.diff) : null),
    [diffData],
  );

  // 准备对比 + 拉取 diff
  useEffect(() => {
    if (!open || selected.length < 2) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setUrlA('');
      setUrlB('');
      setDiffData(null);
      try {
        const [prep, diffRes] = await Promise.all([
          api.comparePrepare(selected[0], selected[1], prototype),
          api.compareDiff(selected[0], selected[1], scope),
        ]);
        if (cancelled) return;
        // 给 URL 加时间戳避免缓存
        const ts = Date.now();
        setUrlA(`${prep.urlA}?t=${ts}`);
        setUrlB(`${prep.urlB}?t=${ts}`);
        setDiffData({ diff: diffRes.diff, stat: diffRes.stat, messages: diffRes.messages });
      } catch (e: any) {
        if (!cancelled) message.error(e.message || '版本对比失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      api.compareCleanup().catch(() => {});
    };
  }, [open, selected[0], selected[1]]);

  const handleCopy = async () => {
    if (!summary) return;
    const text = buildCopyText(snapshotA, snapshotB, summary, diffData?.messages || []);
    try {
      await navigator.clipboard.writeText(text);
      message.success('对比摘要已复制');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width="96vw"
      footer={null}
      centered
      destroyOnClose
      style={{ top: 20 }}
      styles={{ body: { padding: 0, height: 'calc(96vh - 100px)' } }}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        <Space size={8}>
          <Tag color="default" style={{ fontSize: 12 }}>
            {snapshotA?.hash || '旧版本'}
          </Tag>
          <LeftOutlined style={{ color: '#999', fontSize: 12 }} />
          <RightOutlined style={{ color: '#1677ff', fontSize: 12 }} />
          <Tag color="blue" style={{ fontSize: 12 }}>
            {snapshotB?.hash || '新版本'}
          </Tag>
          <span style={{ fontSize: 13, color: '#666', marginLeft: 4 }}>{prototype}</span>
        </Space>
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={!summary}>
            复制对比摘要
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} disabled={!urlA}>
            刷新
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </Space>
      </div>

      {/* 内容区 */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 42px)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip="正在提取历史版本文件…" />
          </div>
        ) : !urlA ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="对比加载失败" />
          </div>
        ) : (
          <>
            {/* 分屏预览 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                minHeight: 0,
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              {/* 左：旧版本 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid #e8e8e8' }}>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    color: '#888',
                    background: '#fffbe6',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <Tag color="default" style={{ marginRight: 4 }}>
                      旧版本
                    </Tag>
                    {snapshotA?.hash} · {snapshotA?.date}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${urlA.split('?')[0]}`,
                        );
                        message.success('旧版本链接已复制');
                      } catch {
                        message.error('复制失败');
                      }
                    }}
                  />
                </div>
                <iframe
                  key={`cmp-a-${refreshKey}-${urlA}`}
                  src={urlA}
                  style={{ flex: 1, width: '100%', border: 'none' }}
                  title="旧版本预览"
                />
              </div>

              {/* 右：新版本 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    color: '#888',
                    background: '#f6ffed',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <Tag color="blue" style={{ marginRight: 4 }}>
                      新版本
                    </Tag>
                    {snapshotB?.hash} · {snapshotB?.date}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${urlB.split('?')[0]}`,
                        );
                        message.success('新版本链接已复制');
                      } catch {
                        message.error('复制失败');
                      }
                    }}
                  />
                </div>
                <iframe
                  key={`cmp-b-${refreshKey}-${snapshotB.hash}`}
                  src={urlB}
                  style={{ flex: 1, width: '100%', border: 'none' }}
                  title="新版本预览"
                />
              </div>
            </div>

            {/* 底部：改动概览 */}
            {summary && (
              <div
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  padding: '12px 16px',
                  background: '#fafafa',
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>
                  <b>改动概览</b>：共改动 <b>{summary.files.length}</b> 个文件（新增约{' '}
                  {summary.added} 处、删减约 {summary.removed} 处）
                </div>
                {diffData?.messages && diffData.messages.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#666' }}>中间提交：</span>
                    {diffData.messages.map((msg, i) => (
                      <Tag key={i} style={{ marginBottom: 4 }}>
                        {msg}
                      </Tag>
                    ))}
                  </div>
                )}
                <Space size={[6, 6]} wrap>
                  {summary.files.map((f) => (
                    <Tag key={f.file} color={STATUS_COLOR[f.status]}>
                      {f.friendly}（{f.status}，+{f.added}/-{f.removed}）
                    </Tag>
                  ))}
                </Space>
                <Collapse
                  ghost
                  size="small"
                  style={{ marginTop: 8 }}
                  items={[
                    {
                      key: 'detail',
                      label: (
                        <span style={{ color: '#888', fontSize: 12 }}>技术细节（开发参考，点击展开）</span>
                      ),
                      children: (
                        <pre
                          style={{
                            fontSize: 11,
                            lineHeight: 1.5,
                            background: '#1e1e1e',
                            color: '#d4d4d4',
                            padding: 12,
                            borderRadius: 6,
                            overflow: 'auto',
                            maxHeight: 300,
                          }}
                        >
                          {diffData?.diff || '无差异'}
                        </pre>
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
