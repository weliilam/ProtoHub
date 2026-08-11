import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Empty, Input, Modal, Radio, Segmented, Space, Tag, Tooltip, message } from 'antd';
import {
  CloseOutlined,
  CommentOutlined,
  CopyOutlined,
  DesktopOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LinkOutlined,
  MobileOutlined,
  MoonOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SunOutlined,
  TabletOutlined,
} from '@ant-design/icons';
import Sidebar from './components/Sidebar';
import PrototypePreview from './components/PrototypePreview';
import AnnotationPanel from './components/AnnotationPanel';
import GitPanel from './components/GitPanel';
import AiCliPanel from './components/AiCliPanel';
import DocEditor from './components/DocEditor';
import ThemeViewer from './components/ThemeViewer';
import DataTableEditor from './components/DataTableEditor';
import CommandPalette, { type CommandAction } from './components/CommandPalette';
import { api } from './api';
import { useTheme } from './theme';
import { useAiRunning } from './aiRunStore';
import type { PickedElement } from './annotation';
import type { Annotation, EntryItem, PrdDoc, SourceMatch } from './types';

type RightPanel = 'annotation' | 'git' | 'ai' | 'prd' | null;

/** 批注操作的可撤销记录 */
type UndoAction =
  | { kind: 'add'; annotation: Annotation }
  | { kind: 'delete'; annotation: Annotation }
  | { kind: 'toggle'; id: string; target: string; prevStatus: 'open' | 'done' };

/** 将同步后的功能描述文本转为排版良好的 HTML */
function renderPrdContent(text: string): string {
  const css = `
    .ph-prd-body h3 { font-size:15px; font-weight:700; color:var(--ph-text); margin:18px 0 8px; }
    .ph-prd-body p { margin:0 0 10px; color:var(--ph-text-secondary); }
    .ph-prd-body ul { margin:4px 0 10px; padding-left:18px; }
    .ph-prd-body li { margin:2px 0; color:var(--ph-text-secondary); }
    .ph-prd-body table { width:100%; border-collapse:collapse; margin:8px 0 12px; font-size:13px; }
    .ph-prd-body th { background:var(--ph-git-accent-bg); padding:6px 10px; border:1px solid var(--ph-border-light); text-align:left; font-weight:600; color:var(--ph-text); }
    .ph-prd-body td { padding:5px 10px; border:1px solid var(--ph-border); color:var(--ph-text-secondary); }
    .ph-prd-body strong { color:var(--ph-text); }
    .ph-prd-body em { color:var(--ph-text-secondary); }
  `;
  const lines = text.split('\n');
  const html: string[] = [];

  let inTable = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 空行 → 结束表格/列表
    if (!line.trim()) {
      if (inTable) { html.push('</table>'); inTable = false; }
      if (inList) { html.push('</ul>'); inList = false; }
      continue;
    }

    // ■ 标题 → h3
    if (line.startsWith('■ ')) {
      if (inTable) { html.push('</table>'); inTable = false; }
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${esc(line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))}</h3>`);
      continue;
    }

    // · 列表项
    if (line.startsWith('· ')) {
      if (inTable) { html.push('</table>'); inTable = false; }
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${esc(line.slice(2))}</li>`);
      continue;
    }

    // 表格行（含 │ 分隔符）
    if (line.includes('│')) {
      if (inList) { html.push('</ul>'); inList = false; }
      const cells = line.split('│').map(c => c.trim());
      const isHeader = cells.some(c => /^[-]+$/.test(c)) || cells.some(c => /^-{2,}$/.test(c));
      if (isHeader) continue; // skip separator line
      if (!inTable) {
        // auto-detect header: first row with │
        html.push('<table>');
        inTable = true;
      }
      const tag = html.includes('<table>') && !html.includes('<th>') ? 'th' : 'td';
      html.push(`<tr>${cells.map(c => `<${tag}>${esc(c)}</${tag}>`).join('')}</tr>`);
      continue;
    }

    // 普通段落
    if (inTable) { html.push('</table>'); inTable = false; }
    if (inList) { html.push('</ul>'); inList = false; }
    html.push(`<p>${esc(line)}</p>`);
  }
  if (inTable) html.push('</table>');
  if (inList) html.push('</ul>');

  return `<style>${css}</style>${html.join('')}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

export default function App() {
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [selected, setSelected] = useState<EntryItem | null>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [refreshKey, setRefreshKey] = useState(0);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [pendingPick, setPendingPick] = useState<PickedElement | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  // 源码特征索引匹配：点选元素后异步命中源码位置（null=匹配中，[] = 无命中）
  const [pickMatches, setPickMatches] = useState<SourceMatch[] | null>(null);
  const [pickMatchIdx, setPickMatchIdx] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  // 找不到对应元素的失效批注（可能已被 AI 改动删除/结构变化）
  const [orphanAnnotations, setOrphanAnnotations] = useState<Annotation[]>([]);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [closingPanel, setClosingPanel] = useState(false); // 面板关闭动画状态
  const { mode, toggle: toggleTheme } = useTheme();
  const aiRunning = useAiRunning();
  const [ips, setIps] = useState<string[]>([]);

  const refreshEntries = useCallback(async () => {
    try {
      setEntries(await api.listEntries());
    } catch (e: any) {
      message.error(e.message);
    }
  }, []);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  // 获取本机 IP（优先走接口；失败则用 WebRTC 兜底探测）
  useEffect(() => {
    api
      .networkIps()
      .then((r) => setIps(r.ips.map((ip) => ip.address)))
      .catch(() => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then((offer) => pc.setLocalDescription(offer));
        pc.onicecandidate = (e) => {
          if (!e.candidate) return;
          const m = e.candidate.candidate.match(/(\d{1,3}\.){3}\d{1,3}/);
          if (m && !m[1].startsWith('127.')) {
            setIps((prev) => (prev.includes(m[1]) ? prev : [...prev, m[1]]));
            pc.close();
          }
        };
      });
  }, []);

  // 首次加载 / 刷新后，自动选中第一个原型条目
  useEffect(() => {
    if (selected || entries.length === 0) return;
    const first = entries.find((e) => e.type === 'prototype') || entries[0];
    setSelected(first);
  }, [entries]);

  const handleCopyUrl = useCallback(async () => {
    if (!selected) return;
    // 自动识别本机 IP：localhost 访问时替换为局域网 IP
    let origin = window.location.origin;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && ips.length > 0) {
      const port = window.location.port ? `:${window.location.port}` : '';
      origin = `${window.location.protocol}//${ips[0]}${port}`;
    }
    const url = selected.url
      ? new URL(selected.url, origin).href
      : `${origin}/p/${selected.name}`;

    const fallbackCopy = (text: string) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        message.success('页面地址已复制');
      } catch {
        message.error('复制失败');
      } finally {
        document.body.removeChild(ta);
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        message.success('页面地址已复制');
      } else {
        fallbackCopy(url);
      }
    } catch {
      // clipboard API 不可用时降级
      fallbackCopy(url);
    }
  }, [selected, ips]);

  const isPreviewable = selected?.type === 'prototype' || selected?.type === 'component';

  // 加载当前条目的批注
  useEffect(() => {
    if (!selected || !isPreviewable) {
      setAnnotations([]);
      return;
    }
    api.listAnnotations(selected.name).then(setAnnotations).catch(() => setAnnotations([]));
    setAnnotationMode(false);
    setUndoStack([]);
  }, [selected, isPreviewable]);

  const handleSelect = (item: EntryItem) => {
    // 点击同一原型 = 刷新；不同原型 = 切换（URL 变更会自动触发导航，无需再 +1）
    if (selected?.name === item.name && selected?.type === item.type) {
      setRefreshKey((k) => k + 1);
    }
    setSelected(item);
    setPrdDoc(null);
    setCmdkOpen(false);
  };

  // ── 条目管理 ──
  const handleCreate = async (type: string, name: string, title: string) => {
    try {
      if (type === 'prototype') await api.createEntry('prototype', name, title);
      else if (type === 'doc') await api.createDoc(name, `# ${title}\n\n`);
      else if (type === 'table') await api.createTable(name);
      message.success('已创建');
      await refreshEntries();
    } catch (e: any) {
      message.error(e.message);
      throw e;
    }
  };

  const handleRename = async (item: EntryItem, newName: string) => {
    try {
      await api.renameEntry(item.type, item.name, newName);
      message.success('已重命名');
      await refreshEntries();
      if (selected?.name === item.name && selected?.type === item.type) {
        setSelected({ ...item, name: newName, url: `/p/${newName}` });
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleDelete = async (item: EntryItem) => {
    try {
      if (item.type === 'prototype' || item.type === 'component') await api.deleteEntry(item.type, item.name);
      else if (item.type === 'doc') await api.deleteDoc(item.name);
      else if (item.type === 'theme') await api.deleteTheme(item.name);
      else if (item.type === 'table') await api.deleteTable(item.name);
      message.success('已删除');
      if (selected?.name === item.name && selected?.type === item.type) setSelected(null);
      await refreshEntries();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // ── 批注 ──
  const handlePick = (picked: PickedElement) => {
    setPendingPick(picked);
    setAnnotationText('');
    setPickMatches(null);
    setPickMatchIdx(0);
    if (selected?.type === 'prototype') {
      api
        .matchPrototypeSource(selected.name, {
          description: picked.elementDescription || '',
          text: picked.elementText || '',
        })
        .then((matches) => {
          setPickMatches(matches || []);
          setPickMatchIdx(0);
        })
        .catch(() => setPickMatches([]));
    } else {
      setPickMatches([]);
    }
  };

  // 面板关闭（带动画），220ms 匹配 CSS slide-out 时长
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const closeRightPanel = useCallback(() => {
    if (!rightPanel) return;
    (document.activeElement as HTMLElement)?.blur();
    setClosingPanel(true);
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setRightPanel(null);
      setClosingPanel(false);
    }, 220);
  }, [rightPanel]);

  // ESC 逐级退出：有批注弹窗 → 关弹窗；有右侧面板 → 关面板；否则 → 退出批注模式
  const pendingPickRef = useRef(pendingPick);
  pendingPickRef.current = pendingPick;
  const rightPanelRef = useRef(rightPanel);
  rightPanelRef.current = rightPanel;
  const annotationModeRef = useRef(annotationMode);
  annotationModeRef.current = annotationMode;
  const closePanelRef = useRef(closeRightPanel);
  closePanelRef.current = closeRightPanel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (pendingPickRef.current) {
        setPendingPick(null);
      } else if (rightPanelRef.current) {
        closePanelRef.current();
      } else if (annotationModeRef.current) {
        setAnnotationMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitAnnotation = async () => {
    if (!selected || !pendingPick || !annotationText.trim()) return;
    try {
      const created = await api.createAnnotation({
        target: selected.name,
        selector: pendingPick.selector,
        x: pendingPick.x,
        y: pendingPick.y,
        text: annotationText.trim(),
        elementText: pendingPick.elementText,
        elementDescription: pendingPick.elementDescription,
        elementSource: pickMatches && pickMatches.length > 0 ? pickMatches[pickMatchIdx] : undefined,
      });
      setAnnotations(await api.listAnnotations(selected.name));
      setUndoStack((s) => [...s, { kind: 'add', annotation: created }]);
      setPendingPick(null);
      message.success('批注已添加');
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const toggleAnnotationStatus = async (a: Annotation) => {
    const prevStatus = a.status;
    await api.updateAnnotation(a.id, { status: prevStatus === 'open' ? 'done' : 'open' });
    if (selected) setAnnotations(await api.listAnnotations(selected.name));
    setUndoStack((s) => [...s, { kind: 'toggle', id: a.id, target: a.target, prevStatus }]);
  };

  const deleteAnnotation = async (a: Annotation) => {
    await api.deleteAnnotation(a.id);
    if (selected) setAnnotations(await api.listAnnotations(selected.name));
    setUndoStack((s) => [...s, { kind: 'delete', annotation: a }]);
  };

  // 发布成功后把已勾选批注标记为已完成（页面标记自动变绿），并记录本次修改使用的 AI 模型、记录可撤销
  const markAnnotationsDone = async (ids: string[], resolvedBy?: string) => {
    if (!selected || ids.length === 0) return;
    for (const id of ids) {
      await api.updateAnnotation(id, { status: 'done', resolvedBy });
    }
    setAnnotations(await api.listAnnotations(selected.name));
    setUndoStack((s) => [
      ...s,
      ...ids.map((id) => ({ kind: 'toggle', id, target: selected.name, prevStatus: 'open' as const })),
    ]);
  };

  // 一键删除所有失效批注（元素已不存在，批注失去定位意义）
  const deleteOrphans = async (ids: string[]) => {
    if (!selected || ids.length === 0) return;
    const toDelete = annotations.filter((a) => ids.includes(a.id));
    for (const a of toDelete) {
      await api.deleteAnnotation(a.id);
    }
    setAnnotations(await api.listAnnotations(selected.name));
    setOrphanAnnotations([]);
    setUndoStack((s) => [...s, ...toDelete.map((a) => ({ kind: 'delete', annotation: a }))]);
    message.success('已清理失效批注');
  };

  // 撤销最近一次批注操作（新增/删除/状态切换）
  const undo = useCallback(async () => {
    if (!selected || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    try {
      if (action.kind === 'add') {
        await api.deleteAnnotation(action.annotation.id);
      } else if (action.kind === 'delete') {
        await api.createAnnotation({ ...action.annotation });
      } else {
        await api.updateAnnotation(action.id, { status: action.prevStatus });
      }
      setUndoStack((s) => s.slice(0, -1));
      setAnnotations(await api.listAnnotations(selected.name));
      message.success('已撤销上一步批注操作');
    } catch (e: any) {
      message.error('撤销失败：' + e.message);
    }
  }, [selected, undoStack]);

  // Ctrl/Cmd + Z 撤销（覆盖焦点在父窗口的情况）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo]);

  // Ctrl/Cmd + K 打开命令面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const togglePanel = (panel: Exclude<RightPanel, null>) => {
    if (rightPanel === panel) {
      closeRightPanel();
    } else {
      clearTimeout(closeTimerRef.current);
      setClosingPanel(false);
      setRightPanel(panel);
    }
  };

  // PRD 关联管理入口在 Sidebar「文档」Tab；点击文档在右侧面板展示预览
  const [prdDoc, setPrdDoc] = useState<PrdDoc | null>(null);

  const openCount = annotations.filter((a) => a.status === 'open').length;

  // ⌘K 命令面板的快捷操作
  const cmdActions: CommandAction[] = [
    {
      id: 'toggle-theme',
      label: mode === 'dark' ? '切换为浅色主题' : '切换为深色主题',
      hint: '主题',
      icon: mode === 'dark' ? <SunOutlined /> : <MoonOutlined />,
      keywords: 'theme dark light 主题 深色 浅色',
      run: toggleTheme,
    },
    {
      id: 'open-ai',
      label: '打开 AI 助手',
      hint: '面板',
      icon: <RobotOutlined />,
      keywords: 'ai cli 助手 robot',
      run: () => setRightPanel('ai'),
    },
    {
      id: 'open-git',
      label: '打开 Git 快照',
      hint: '面板',
      icon: <HistoryOutlined />,
      keywords: 'git 快照 历史 版本',
      run: () => setRightPanel('git'),
    },
    {
      id: 'open-annotations',
      label: '打开批注列表',
      hint: '面板',
      icon: <CommentOutlined />,
      keywords: '批注 列表 annotation',
      run: () => setRightPanel('annotation'),
    },
    {
      id: 'refresh',
      label: '刷新预览',
      hint: '预览',
      icon: <ReloadOutlined />,
      keywords: '刷新 refresh reload',
      run: () => setRefreshKey((k) => k + 1),
    },
    {
      id: 'toggle-annotation-mode',
      label: annotationMode ? '退出批注模式' : '进入批注模式',
      hint: '批注',
      icon: <CommentOutlined />,
      keywords: '批注 模式 comment mode',
      run: () => setAnnotationMode((m) => !m),
    },
  ];

  return (
    <div className="ph-layout">
      <Sidebar
        entries={entries}
        selected={selected}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onRename={handleRename}
        onDelete={handleDelete}
        onRefresh={refreshEntries}
        onPrdPreview={setPrdDoc}
        onOpenCmdk={() => setCmdkOpen(true)}
      />

      <div className="ph-main">
        {prdDoc ? (
          <div className="ph-doc-preview" style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: 'var(--ph-sidebar-folder-open)', fontSize: 18 }} />
                <h2 style={{ margin: 0, fontSize: 20 }}>{prdDoc.title || '飞书 PRD 文档'}</h2>
              </div>
              <Space>
                <Button onClick={() => setPrdDoc(null)}>返回</Button>
                <Button type="primary" onClick={() => window.open(prdDoc.url, '_blank')}>
                  在飞书打开
                </Button>
              </Space>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ph-text-tertiary)', marginBottom: 16, wordBreak: 'break-all' }}>
              <a href={prdDoc.url} target="_blank" rel="noreferrer">{prdDoc.url}</a>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ph-text-tertiary)', marginBottom: 16 }}>
              最后同步：{prdDoc.syncedAt ? new Date(prdDoc.syncedAt).toLocaleString('zh-CN') : '尚未同步'}
            </div>
            <div style={{
              border: '1px solid var(--ph-anno-card-border)', borderRadius: 8, padding: '20px 24px',
              background: 'var(--ph-anno-card-bg)', minHeight: 200, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
            }}>
              <div className="ph-prd-body" style={{ fontSize: 14, lineHeight: 1.9 }}
                dangerouslySetInnerHTML={{
                  __html: renderPrdContent(prdDoc.summary || '尚未同步内容，请到左侧文档 Tab 里点击 🔄 同步按钮获取内容。'),
                }}
              />
            </div>
          </div>
        ) : !selected ? (
          <div className="ph-empty">
            <Empty description="从左侧选择一个原型、文档或资源开始" />
          </div>
        ) : isPreviewable ? (
          <>
            <div className="ph-toolbar">
              <span className="ph-toolbar-title">{selected.title}</span>
              {ips.length > 0 && (
                <Tooltip title={`本机 IP：${ips.join('、')}`}>
                  <Tag color="blue" icon={<LinkOutlined />} style={{ marginLeft: 8, cursor: 'default' }}>
                    {ips[0]}
                  </Tag>
                </Tooltip>
              )}
              {aiRunning && (
                <span className="ph-ai-breath" title="AI 正在执行">
                  AI 执行中
                </span>
              )}
              <Segmented
                size="small"
                value={device}
                onChange={(v) => setDevice(v as typeof device)}
                options={[
                  { value: 'desktop', icon: <DesktopOutlined /> },
                  { value: 'tablet', icon: <TabletOutlined /> },
                  { value: 'mobile', icon: <MobileOutlined /> },
                ]}
              />
              <Space size={4}>
                <Tooltip title="刷新预览">
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)}>
                    刷新
                  </Button>
                </Tooltip>
                <Tooltip title={annotationMode ? '退出批注模式' : '进入批注模式'}>
                  <Button
                    size="small"
                    type={annotationMode ? 'primary' : 'default'}
                    icon={<CommentOutlined />}
                    onClick={() => setAnnotationMode((m) => !m)}
                  >
                    批注
                  </Button>
                </Tooltip>
                <Badge count={openCount} size="small" color={openCount >= 5 ? 'red' : openCount >= 1 ? 'orange' : undefined}>
                  <Tooltip title="批注列表">
                    <Button
                      size="small"
                      type={rightPanel === 'annotation' ? 'primary' : 'default'}
                      icon={<OrderedListOutlined />}
                      onClick={() => togglePanel('annotation')}
                    >
                      列表
                    </Button>
                  </Tooltip>
                </Badge>
                <Tooltip title="Git 快照">
                  <Button
                    size="small"
                    type={rightPanel === 'git' ? 'primary' : 'default'}
                    icon={<HistoryOutlined />}
                    onClick={() => togglePanel('git')}
                  >
                    Git
                  </Button>
                </Tooltip>
                <Tooltip title="AI 助手">
                  <Button
                    size="small"
                    type={rightPanel === 'ai' ? 'primary' : 'default'}
                    icon={<RobotOutlined />}
                    onClick={() => togglePanel('ai')}
                  >
                    AI
                  </Button>
                </Tooltip>
                <Tooltip title="复制页面链接">
                  <Button size="small" icon={<CopyOutlined />} onClick={handleCopyUrl}>
                    复制
                  </Button>
                </Tooltip>
                <Tooltip title={mode === 'dark' ? '切换浅色主题' : '切换深色主题'}>
                  <Button
                    size="small"
                    className="ph-theme-toggle"
                    icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
                    onClick={toggleTheme}
                  />
                </Tooltip>
              </Space>
            </div>
            <PrototypePreview
              item={selected}
              device={device}
              refreshKey={refreshKey}
              annotationMode={annotationMode}
              annotations={annotations}
              onPick={handlePick}
              onMarkerClick={() => setRightPanel('annotation')}
              onCancelPick={() => {
                if (pendingPick) {
                  setPendingPick(null);
                } else if (rightPanel) {
                  closeRightPanel();
                } else if (annotationMode) {
                  setAnnotationMode(false);
                }
              }}
              onUndo={undo}
              onOrphans={setOrphanAnnotations}
            />
          </>
        ) : selected.type === 'doc' ? (
          <DocEditor key={selected.name} name={selected.name} />
        ) : selected.type === 'theme' ? (
          <ThemeViewer key={selected.name} name={selected.name} />
        ) : (
          <DataTableEditor key={selected.name} name={selected.name} />
        )}
      </div>

      <div
        className={`ph-right-panel-backdrop${rightPanel ? ' active' : ''}${closingPanel ? ' closing' : ''}`}
        onClick={closeRightPanel}
      />
      <div className={`ph-right-panel${rightPanel ? ' active' : ''}${closingPanel ? ' closing' : ''}`}>
        <Button
          className="ph-right-panel-close"
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={closeRightPanel}
        />
      {rightPanel === 'annotation' && selected && (
        <AnnotationPanel
          target={selected.name}
          annotations={annotations}
          onToggleStatus={toggleAnnotationStatus}
          onDelete={deleteAnnotation}
          onApplied={() => setRefreshKey((k) => k + 1)}
          onMarkDone={markAnnotationsDone}
          orphanAnnotations={orphanAnnotations}
          onDeleteOrphans={deleteOrphans}
          canUndo={undoStack.length > 0}
          onUndo={undo}
        />
      )}
      {rightPanel === 'git' && <GitPanel selected={selected} onRestored={() => setRefreshKey((k) => k + 1)} />}
      {rightPanel === 'ai' && <AiCliPanel selected={selected} />}
    </div>

      <Modal
        title="添加批注"
        open={!!pendingPick}
        okText="保存"
        cancelText="取消"
        onOk={submitAnnotation}
        onCancel={() => setPendingPick(null)}
      >
        <p style={{ fontSize: 12, color: 'var(--ph-text-tertiary)', wordBreak: 'break-all' }}>{pendingPick?.selector}</p>
        {pickMatches === null ? (
          <div style={{ margin: '8px 0', fontSize: 12, color: 'var(--ph-text-tertiary)' }}>正在定位源码…</div>
        ) : pickMatches.length > 0 ? (
          <div
            style={{
              margin: '8px 0',
              padding: '8px 10px',
              border: '1px dashed var(--ph-anno-warn-border)',
              background: 'var(--ph-anno-warn-bg)',
              borderRadius: 6,
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            <div style={{ marginBottom: 6, fontSize: 12 }}>
              <Tag color="green" style={{ marginRight: 6 }}>
                已定位源码
              </Tag>
              <span style={{ color: 'var(--ph-text-secondary)' }}>AI 将优先修改以下位置：</span>
            </div>
            <Radio.Group value={pickMatchIdx} onChange={(e) => setPickMatchIdx(e.target.value)} style={{ width: '100%' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {pickMatches.map((m, i) => (
                  <Radio key={i} value={i} style={{ fontSize: 12, width: '100%', alignItems: 'flex-start', display: 'flex' }}>
                    <span style={{ display: 'inline-block', wordBreak: 'break-all', overflowWrap: 'anywhere', lineHeight: 1.6 }}>
                      <code style={{ color: 'var(--ph-text)', fontWeight: 600, fontSize: 12 }}>{m.file}:{m.line}</code>
                      <Tag style={{ marginLeft: 6, marginRight: 6 }}>{m.container}</Tag>
                      <span style={{ color: 'var(--ph-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>
                        {m.code.length > 120 ? m.code.slice(0, 120) + '…' : m.code}
                      </span>
                    </span>
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </div>
        ) : (
          <div style={{ margin: '8px 0', fontSize: 12, color: 'var(--ph-text-tertiary)' }}>未匹配到源码位置，AI 将按描述定位。</div>
        )}
        <Input.TextArea
          rows={4}
          autoFocus
          placeholder="写下修改意见，例如：这个按钮改成主色，文字改为「导出订单」"
          value={annotationText}
          onChange={(e) => setAnnotationText(e.target.value)}
        />
      </Modal>

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        entries={entries}
        onSelectEntry={handleSelect}
        actions={cmdActions}
      />
    </div>
  );
}
