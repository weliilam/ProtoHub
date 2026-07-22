import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Collapse, Empty, Input, List, Popconfirm, Space, Tag, Typography, message } from 'antd';
import {
  CameraOutlined,
  ColumnWidthOutlined,
  DiffOutlined,
  DownOutlined,
  FileTextOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import { CompareView } from './CompareView';
import type { CliStatus, EntryItem, GitLogItem } from '../types';

const DIFF_STYLE: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  maxHeight: 240,
  overflow: 'auto',
  background: '#0d1117',
  color: '#c9d1d9',
  padding: 10,
  borderRadius: 6,
  fontSize: 12,
  margin: '8px 0 0',
  fontFamily: 'monospace',
};

/** 计算条目对应的仓库内路径（快照粒度） */
export function scopeOf(item: EntryItem | null): string | null {
  if (!item) return null;
  switch (item.type) {
    case 'prototype':
      return `src/prototypes/${item.name}`;
    case 'component':
      return `src/components/${item.name}`;
    case 'doc':
      return `src/docs/${item.name}.md`;
    case 'theme':
      return `src/themes/${item.name}`;
    case 'table':
      return `src/database/${item.name}.json`;
    default:
      return null;
  }
}

/** 把文件名转成产品同学能看懂的说法 */
function friendlyName(file: string): string {
  const base = file.split('/').pop() || file;
  const map: Record<string, string> = {
    'index.tsx': '主页面代码',
    'spec.md': '需求/规格文档',
    'style.css': '样式文件',
    'README.md': '说明文档',
  };
  if (map[base]) return map[base];
  if (base.endsWith('.tsx') || base.endsWith('.ts')) return base.replace(/\.\w+$/, '') + '（代码）';
  if (base.endsWith('.css')) return base + '（样式）';
  if (base.endsWith('.md')) return base + '（文档）';
  if (base.endsWith('.json')) return base + '（数据）';
  return base;
}

interface FileChange {
  file: string;
  friendly: string;
  status: '新增' | '修改' | '删除' | '重命名';
  added: number;
  removed: number;
}

/** 解析 git diff，生成给产品看的文件级改动概览（不暴露代码细节） */
function parseDiffForSummary(diff: string): { files: FileChange[]; added: number; removed: number } {
  const files: FileChange[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  const blocks = diff.split(/^diff --git /m).slice(1);
  for (const block of blocks) {
    const headerLine = block.split('\n', 1)[0]; // "a/x b/y"
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
    files.push({ file, friendly: friendlyName(file), status, added, removed });
  }
  return { files, added: totalAdded, removed: totalRemoved };
}

const STATUS_COLOR: Record<FileChange['status'], string> = {
  新增: 'green',
  修改: 'blue',
  删除: 'red',
  重命名: 'gold',
};

interface Props {
  selected: EntryItem | null;
  onRestored: () => void;
}

export default function GitPanel({ selected, onRestored }: Props) {
  const scope = scopeOf(selected);
  const scopeLabel = selected ? selected.title : null;

  const [initialized, setInitialized] = useState(true);
  const [branch, setBranch] = useState('');
  const [changed, setChanged] = useState(0);
  const [logs, setLogs] = useState<GitLogItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  // 展开查看 diff 的快照：hash -> { diff } 或加载中
  const [expanded, setExpanded] = useState<Record<string, { diff: string } | 'loading'>>({});
  // 按快照 hash 缓存 AI 生成的产品语言解读（大白话改动说明）
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});

  // 用大白话解读本次改动（给产品 / 业务同学看）：调用 AI 把代码 diff 翻译成非技术说明
  const explainWithAi = async (hash: string) => {
    const diffObj = expanded[hash];
    if (!diffObj || diffObj === 'loading') return;
    setAiSummaries((prev) => ({ ...prev, [hash]: 'loading' }));
    try {
      const status = (await api.aiStatus()) as Record<string, CliStatus>;
      const available = Object.entries(status)
        .filter(([, v]) => v.available)
        .map(([k]) => k);
      const cli = available.includes('codebuddy') ? 'codebuddy' : available[0];
      if (!cli) {
        setAiSummaries((prev) => ({
          ...prev,
          [hash]:
            '未检测到可用的 AI CLI（CodeBuddy / Claude 等），无法生成产品解读。可参考下方文件改动概览。',
        }));
        return;
      }
      const prompt = `你是面向产品 / 业务同学的需求助手。下面是一段代码的 git 改动（diff），请用大白话说明：
1）这次改动了哪些页面或功能模块；
2）对用户（使用者）有什么影响、能看到哪些变化；
3）若改动很小也请直接说清改了什么。
严禁出现任何代码、文件路径、技术术语、函数名、变量名。

改动内容：
${diffObj.diff.slice(0, 8000)}`;
      const { output, timedOut } = await api.aiExecute(cli, prompt, () => {});
      const text = output.trim() || '（AI 未返回说明）';
      setAiSummaries((prev) => ({
        ...prev,
        [hash]: timedOut ? `${text}\n\n[提示：AI 执行超时，说明可能不完整，可重新点击按钮解读]` : text,
      }));
    } catch (e: any) {
      setAiSummaries((prev) => ({ ...prev, [hash]: `解读失败：${e.message}` }));
    }
  };

  // ── 版本对比 ──
  const [compareSelected, setCompareSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const toggleCompareSelection = (hash: string, checked: boolean) => {
    setCompareSelected((prev) => {
      if (checked) {
        // 最多选两个，新选中的放在后面（作为较新版本）
        const next = [...prev, hash].slice(-2);
        return next;
      }
      return prev.filter((h) => h !== hash);
    });
  };

  // 选中的快照按时间排序（hashA 为旧版本，hashB 为新版本）
  const sortedCompareHashes = useMemo(() => {
    if (compareSelected.length < 2) return compareSelected;
    const idxA = logs.findIndex((l) => l.hash === compareSelected[0]);
    const idxB = logs.findIndex((l) => l.hash === compareSelected[1]);
    if (idxA === -1 || idxB === -1) return compareSelected;
    // logs 按时间倒序，后面的 item 更旧
    return idxA > idxB ? [compareSelected[0], compareSelected[1]] : [compareSelected[1], compareSelected[0]];
  }, [compareSelected, logs]);

  const handleOpenCompare = () => {
    if (compareSelected.length === 2) setCompareOpen(true);
  };

  const refresh = useCallback(async () => {
    try {
      const status = await api.gitStatus(scope ?? undefined);
      setInitialized(status.initialized);
      setBranch(status.branch || '');
      setChanged(status.changed || 0);
      if (status.initialized) {
        setLogs(await api.gitLog(scope ?? undefined));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const takeSnapshot = async () => {
    setLoading(true);
    try {
      const prefix = scopeLabel ? `[${scopeLabel}] ` : '';
      const { hash } = await api.gitSnapshot(prefix + messageText.trim(), scope ?? undefined);
      message.success(`快照已保存（${hash}）`);
      setMessageText('');
      await refresh();
    } catch (e: any) {
      message.warning(e.message);
    } finally {
      setLoading(false);
    }
  };

  const restore = async (hash: string) => {
    try {
      await api.gitRestore(hash, scope ?? undefined);
      message.success(scope ? `已回滚「${scopeLabel}」到该快照` : '已回滚到该快照');
      await refresh();
      onRestored();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 展开/收起查看某个快照的改动内容
  const toggleDiff = async (hash: string) => {
    if (expanded[hash] !== undefined) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[hash];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [hash]: 'loading' }));
    try {
      const { diff } = await api.gitShow(hash, scope ?? undefined);
      setExpanded((prev) => ({ ...prev, [hash]: { diff: diff || '（该提交在当前范围内无代码改动）' } }));
    } catch (e: any) {
      setExpanded((prev) => ({ ...prev, [hash]: { diff: `读取失败：${e.message}` } }));
    }
  };

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          <HistoryOutlined /> Git 快照
        </span>
        {branch && <Tag>{branch}</Tag>}
      </div>
      <div className="ph-right-panel-body">
        {!initialized ? (
          <Alert type="warning" showIcon message="当前目录尚未初始化 Git" description="在终端执行 git init 后即可使用快照功能。" />
        ) : !scope ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先在左侧选中一个原型，快照将只针对它" />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <span style={{ fontSize: 12 }}>
                  当前范围：<b>{scopeLabel}</b>（{scope}）{changed > 0 ? `，${changed} 个未保存变更` : '，无变更'}
                </span>
              }
            />
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                placeholder={`给「${scopeLabel}」留个快照说明（可选）`}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onPressEnter={takeSnapshot}
              />
              <Button type="primary" icon={<CameraOutlined />} loading={loading} onClick={takeSnapshot}>
                保存
              </Button>
            </Space.Compact>
            {/* 对比按钮 */}
            {compareSelected.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Space>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    已选 {compareSelected.length}/2 个版本
                  </span>
                  {compareSelected.length === 2 && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<ColumnWidthOutlined />}
                      onClick={handleOpenCompare}
                    >
                      对比选中版本
                    </Button>
                  )}
                  <Button size="small" onClick={() => setCompareSelected([])}>
                    取消选择
                  </Button>
                </Space>
              </div>
            )}
            {logs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该原型还没有快照" />
            ) : (
              <List
                size="small"
                dataSource={logs}
                renderItem={(item) => {
                  const diffObj = expanded[item.hash];
                  const isOpen = diffObj !== undefined;
                  const summary =
                    diffObj && diffObj !== 'loading' ? parseDiffForSummary(diffObj.diff) : null;
                  const isChecked = compareSelected.includes(item.hash);
                  return (
                    <List.Item>
                      <div style={{ width: '100%' }}>
                        {/* 头部：复选框 + 哈希 + 日期 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Checkbox
                            checked={isChecked}
                            disabled={!isChecked && compareSelected.length >= 2}
                            onChange={(e) => toggleCompareSelection(item.hash, e.target.checked)}
                          />
                          <Tag color="blue">{item.hash}</Tag>
                          <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                            {item.date}
                          </span>
                        </div>
                        {/* 消息（最多 2 行，超出省略） */}
                        <div
                          style={{
                            fontSize: 13,
                            marginLeft: 28,
                            marginBottom: 8,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.message || '（无说明）'}
                        </div>
                        {/* 操作行 */}
                        <div style={{ display: 'flex', gap: 4, marginLeft: 28 }}>
                          <Button
                            size="small"
                            type="text"
                            icon={isOpen ? <DownOutlined /> : <DiffOutlined />}
                            onClick={() => toggleDiff(item.hash)}
                          >
                            {isOpen ? '收起改动' : '查看改动'}
                          </Button>
                          <Popconfirm
                            title={`回滚「${scopeLabel}」到该快照？`}
                            description="只恢复该原型的文件，不影响其他内容；未保存的当前改动会丢失"
                            okText="回滚"
                            cancelText="取消"
                            onConfirm={() => restore(item.hash)}
                          >
                            <Button size="small" type="text" icon={<RollbackOutlined />}>
                              回滚
                            </Button>
                          </Popconfirm>
                        </div>
                        {isOpen && (
                          diffObj === 'loading' ? (
                            <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>加载中…</div>
                          ) : (
                            <div style={{ marginTop: 8, marginLeft: 28 }}>
                              {/* AI 产品语言解读（给产品看，最醒目） */}
                              <div
                                style={{
                                  marginBottom: 10,
                                  padding: '10px 12px',
                                  background: '#e6f4ff',
                                  border: '1px solid #91caff',
                                  borderRadius: 8,
                                }}
                              >
                                <div style={{ fontWeight: 600, marginBottom: 6, color: '#0958d9', fontSize: 13 }}>
                                  📋 本次改动说明（给产品 / 业务同学）
                                </div>
                                {aiSummaries[item.hash] ? (
                                  aiSummaries[item.hash] === 'loading' ? (
                                    <span style={{ fontSize: 12, color: '#1677ff' }}>AI 正在解读本次改动…</span>
                                  ) : (
                                    <Typography.Paragraph
                                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}
                                    >
                                      {aiSummaries[item.hash]}
                                    </Typography.Paragraph>
                                  )
                                ) : (
                                  <Space>
                                    <Button
                                      size="small"
                                      type="primary"
                                      icon={<FileTextOutlined />}
                                      onClick={() => explainWithAi(item.hash)}
                                    >
                                      用大白话解读本次改动
                                    </Button>
                                    <span style={{ fontSize: 12, color: '#888' }}>
                                      （需可用的 AI CLI，把代码改动翻译成产品语言）
                                    </span>
                                  </Space>
                                )}
                              </div>
                              {/* 给产品看的大白话概览 */}
                              <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                                {item.message && (
                                  <div>
                                    <b>本次改动说明：</b>
                                    {item.message}
                                  </div>
                                )}
                                {summary && summary.files.length > 0 ? (
                                  <div>
                                    共改动 <b>{summary.files.length}</b> 个文件（新增约 {summary.added} 处、删减约{' '}
                                    {summary.removed} 处）：
                                  </div>
                                ) : (
                                  <div>该快照在当前范围内没有代码改动。</div>
                                )}
                              </div>
                              {summary && summary.files.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  <Space size={[6, 6]} wrap>
                                    {summary.files.map((f) => (
                                      <Tag key={f.file} color={STATUS_COLOR[f.status]}>
                                        {f.friendly}（{f.status}）
                                      </Tag>
                                    ))}
                                  </Space>
                                </div>
                              )}
                              {/* 技术细节收起，默认不展示 */}
                              <Collapse
                                ghost
                                size="small"
                                style={{ marginTop: 8 }}
                                items={[
                                  {
                                    key: 'detail',
                                    label: (
                                      <span style={{ color: '#888', fontSize: 12 }}>
                                        技术细节（开发参考，点击展开）
                                      </span>
                                    ),
                                    children: <pre style={DIFF_STYLE}>{diffObj.diff}</pre>,
                                  },
                                ]}
                              />
                            </div>
                          )
                        )}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </>
        )}
      </div>

      {/* 版本对比弹窗 */}
      {selected?.type === 'prototype' && selected.name && (
        <CompareView
          open={compareOpen}
          snapshots={logs}
          selected={sortedCompareHashes}
          prototype={selected.name}
          scope={scope!}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}
