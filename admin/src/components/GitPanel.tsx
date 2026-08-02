import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Empty, Input, List, Popconfirm, Space, Tag, message } from 'antd';
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

/** 去掉 AI 输出中残留的 markdown 标记（## / ** / * / `），保持纯文本可读 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,4}\s+/gm, '')    // 去掉 ## / ### 等标题标记
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold** → bold
    .replace(/\*(.+?)\*/g, '$1')     // *italic* → italic
    .replace(/`(.+?)`/g, '$1')       // `code` → code
    .replace(/^\s*[-*+]\s+/gm, '· ') // 无序列表项
    .replace(/^\s*\d+[.)]\s+/gm, '') // 有序列表序号
    .trim();
}

/** 将 AI 输出按行渲染为列表 */
function renderAiSummary(text: string): React.ReactNode {
  const clean = stripMarkdown(text);
  return clean.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    return (
      <div key={i} style={{ fontSize: 13, color: 'var(--ph-git-text)', lineHeight: 1.8 }}>
        {trimmed}
      </div>
    );
  });
}

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
  const LS_KEY_AI = 'proto-hub-ai-summaries';

  // 读取 localStorage 中持久化的 AI 解读
  function loadAiSummaries(): Record<string, string> {
    try {
      const raw = localStorage.getItem(LS_KEY_AI);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveAiSummaries(updates: Record<string, string>) {
    try {
      const all = loadAiSummaries();
      Object.assign(all, updates);
      localStorage.setItem(LS_KEY_AI, JSON.stringify(all));
    } catch { /* 忽略 */ }
  }

  // 按快照 hash 缓存 AI 生成的产品语言解读（大白话改动说明），刷新不丢失
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>(loadAiSummaries);
  // 标记哪些 hash 正在流式生成中（用于显示 loading 指示器）
  const [streamingHashes, setStreamingHashes] = useState<Set<string>>(new Set());

  // 大白话解读：调用 AI 把代码 diff 翻译成非技术说明（流式显示，实时更新）
  const explainWithAi = async (hash: string) => {
    const diffObj = expanded[hash];
    if (!diffObj || diffObj === 'loading') return;
    // 先置为空字符串，标记为正在流式生成
    const initVal: Record<string, string> = { ...aiSummaries, [hash]: '' };
    setAiSummaries(initVal);
    saveAiSummaries(initVal);
    setStreamingHashes((prev) => new Set(prev).add(hash));
    try {
      const status = (await api.aiStatus()) as Record<string, CliStatus>;
      const available = Object.entries(status)
        .filter(([, v]) => v.available)
        .map(([k]) => k);
      const cli = available.includes('codebuddy') ? 'codebuddy' : available[0];
      if (!cli) {
        const fallback = {
          ...aiSummaries,
          [hash]: '未检测到可用的 AI CLI（CodeBuddy / Claude 等），无法生成解读。',
        };
        setAiSummaries(fallback);
        saveAiSummaries(fallback);
        setStreamingHashes((prev) => {
          const next = new Set(prev);
          next.delete(hash);
          return next;
        });
        return;
      }
      const prompt = `你是一个简洁的需求说明助手。根据下面的代码改动（diff），用大白话（一行一条）写出具体改了什么。

必须用界面元素的名称来描述，例如：某某列、某某按钮、某某搜索框、某某下拉框、某某弹窗、某某Tab、某某筛选器、某某输入框。

输出示例（模仿这种风格）：
调整了IOSS识别码搜索框的高度，同其他搜索框对齐
新增了审核状态列
新增了客户名称搜索项
删除了旧的批量导出按钮

要求：
- 一行一条改动，用"调整了xx"、"新增了xx"、"删除了xx"、"修改了xx"开头
- 必须说清具体是哪个界面元素（列/按钮/搜索框/下拉框/弹窗/Tab/筛选器等）
- 严禁出现：组件名、CSS类名、函数名、变量名、文件路径、API地址、import/export
- 整体不超过 6 行，小改动1行即可
- 不要用 markdown 格式

改动内容：
${diffObj.diff.slice(0, 8000)}`;
      // 用 streaming 回调实时更新 aiSummaries[hash]，前端逐字可见
      let streaming = '';
      const { output, timedOut } = await api.aiExecute(cli, prompt, (chunk) => {
        streaming += chunk;
        setAiSummaries((prev) => {
          const next = { ...prev, [hash]: streaming };
          saveAiSummaries(next);
          return next;
        });
      });
      const text = output.trim() || '（AI 未返回说明）';
      const finalText = timedOut ? `${text}\n\n[提示：AI 执行超时，说明可能不完整]` : text;
      setAiSummaries((prev) => {
        const next = { ...prev, [hash]: finalText };
        saveAiSummaries(next);
        return next;
      });
    } catch (e: any) {
      setAiSummaries((prev) => {
        const next = { ...prev, [hash]: `解读失败：${e.message}` };
        saveAiSummaries(next);
        return next;
      });
    } finally {
      setStreamingHashes((prev) => {
        const next = new Set(prev);
        next.delete(hash);
        return next;
      });
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
      <style>{`
        @keyframes ai-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .ai-cursor-blink {
          animation: ai-blink 0.8s infinite;
        }
      `}</style>
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
                  <span style={{ fontSize: 12, color: 'var(--ph-text-secondary)' }}>
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
                          <span style={{ fontSize: 11, color: 'var(--ph-text-tertiary)', marginLeft: 'auto' }}>
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
                            <div style={{ color: 'var(--ph-text-secondary)', fontSize: 12, marginTop: 8 }}>加载中…</div>
                          ) : (
                            <div style={{ marginTop: 10, marginLeft: 28 }}>
                              {/* AI 改动解读（紧凑样式） */}
                              <div
                                style={{
                                  padding: '10px 12px',
                                  background: 'var(--ph-git-accent-bg)',
                                  borderLeft: '3px solid var(--ph-git-accent-border)',
                                  borderRadius: 4,
                                }}
                              >
                                {aiSummaries[item.hash] !== undefined ? (
                                  <>
                                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ph-git-accent-color)', fontSize: 12 }}>
                                      📋 本次改动说明
                                    </div>
                                    {aiSummaries[item.hash] ? (
                                      <div style={{ lineHeight: 1.7 }}>
                                        {renderAiSummary(aiSummaries[item.hash])}
                                        {streamingHashes.has(item.hash) && (
                                          <span className="ai-cursor-blink" style={{
                                            display: 'inline-block', width: 2, height: 14,
                                            background: 'var(--ph-git-accent-color)', marginLeft: 1, verticalAlign: 'text-bottom',
                                          }} />
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: 12, color: 'var(--ph-git-link)' }}>
                                        AI 正在解读本次改动…
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <Space size={6}>
                                    <Button
                                      size="small"
                                      type="link"
                                      icon={<FileTextOutlined />}
                                      style={{ padding: 0, fontSize: 13 }}
                                      onClick={() => explainWithAi(item.hash)}
                                    >
                                      用大白话解读本次改动
                                    </Button>
                                    <span style={{ fontSize: 11, color: 'var(--ph-text-tertiary)' }}>（需 AI CLI）</span>
                                  </Space>
                                )}
                              </div>
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
