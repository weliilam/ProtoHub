import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Empty, Input, Modal, Segmented, Space, Tooltip, message } from 'antd';
import {
  CloseOutlined,
  CommentOutlined,
  DesktopOutlined,
  FileTextOutlined,
  HistoryOutlined,
  MobileOutlined,
  ReloadOutlined,
  RobotOutlined,
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
import { api } from './api';
import type { PickedElement } from './annotation';
import type { Annotation, EntryItem, PrdDoc } from './types';

type RightPanel = 'annotation' | 'git' | 'ai' | 'prd' | null;

/** 批注操作的可撤销记录 */
type UndoAction =
  | { kind: 'add'; annotation: Annotation }
  | { kind: 'delete'; annotation: Annotation }
  | { kind: 'toggle'; id: string; target: string; prevStatus: 'open' | 'done' };

/** 将同步后的功能描述文本转为排版良好的 HTML */
function renderPrdContent(text: string): string {
  const css = `
    .ph-prd-body h3 { font-size:15px; font-weight:700; color:#1a1a1a; margin:18px 0 8px; }
    .ph-prd-body p { margin:0 0 10px; color:#333; }
    .ph-prd-body ul { margin:4px 0 10px; padding-left:18px; }
    .ph-prd-body li { margin:2px 0; color:#444; }
    .ph-prd-body table { width:100%; border-collapse:collapse; margin:8px 0 12px; font-size:13px; }
    .ph-prd-body th { background:#f0f5ff; padding:6px 10px; border:1px solid #d6e4ff; text-align:left; font-weight:600; color:#1a1a1a; }
    .ph-prd-body td { padding:5px 10px; border:1px solid #e8e8e8; color:#444; }
    .ph-prd-body strong { color:#1a1a1a; }
    .ph-prd-body em { color:#666; }
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
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  // 找不到对应元素的失效批注（可能已被 AI 改动删除/结构变化）
  const [orphanAnnotations, setOrphanAnnotations] = useState<Annotation[]>([]);

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
    setSelected(item);
    setPrdDoc(null);
    setRefreshKey((k) => k + 1);
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
        setSelected({ ...item, name: newName, title: newName, url: `/p/${newName}` });
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
  };

  // ESC 逐级退出：有批注弹窗 → 关弹窗；有右侧面板 → 关面板；否则 → 退出批注模式
  const pendingPickRef = useRef(pendingPick);
  pendingPickRef.current = pendingPick;
  const rightPanelRef = useRef(rightPanel);
  rightPanelRef.current = rightPanel;
  const annotationModeRef = useRef(annotationMode);
  annotationModeRef.current = annotationMode;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (pendingPickRef.current) {
        setPendingPick(null);
      } else if (rightPanelRef.current) {
        setRightPanel(null);
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

  // 发布成功后把已勾选批注标记为已完成（页面标记自动变绿），并记录可撤销
  const markAnnotationsDone = async (ids: string[]) => {
    if (!selected || ids.length === 0) return;
    for (const id of ids) {
      await api.updateAnnotation(id, { status: 'done' });
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

  const togglePanel = (panel: Exclude<RightPanel, null>) => {
    setRightPanel((cur) => (cur === panel ? null : panel));
  };

  // PRD 关联管理入口在 Sidebar「文档」Tab；点击文档在右侧面板展示预览
  const [prdDoc, setPrdDoc] = useState<PrdDoc | null>(null);

  const openCount = annotations.filter((a) => a.status === 'open').length;

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
      />

      <div className="ph-main">
        {prdDoc ? (
          <div className="ph-doc-preview" style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                <h2 style={{ margin: 0, fontSize: 20 }}>{prdDoc.title || '飞书 PRD 文档'}</h2>
              </div>
              <Space>
                <Button onClick={() => setPrdDoc(null)}>返回</Button>
                <Button type="primary" onClick={() => window.open(prdDoc.url, '_blank')}>
                  在飞书打开
                </Button>
              </Space>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 16, wordBreak: 'break-all' }}>
              <a href={prdDoc.url} target="_blank" rel="noreferrer">{prdDoc.url}</a>
            </div>
            <div style={{ fontSize: 12, color: '#bbb', marginBottom: 16 }}>
              最后同步：{prdDoc.syncedAt ? new Date(prdDoc.syncedAt).toLocaleString('zh-CN') : '尚未同步'}
            </div>
            <div style={{
              border: '1px solid #f0f0f0', borderRadius: 8, padding: '20px 24px',
              background: '#fafafa', minHeight: 200, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto',
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
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefreshKey((k) => k + 1)} />
                </Tooltip>
                <Tooltip title={annotationMode ? '退出批注模式' : '进入批注模式，点击页面元素添加批注'}>
                  <Button
                    size="small"
                    type={annotationMode ? 'primary' : 'default'}
                    icon={<CommentOutlined />}
                    onClick={() => setAnnotationMode((m) => !m)}
                  >
                    批注
                  </Button>
                </Tooltip>
                <Badge count={openCount} size="small">
                  <Button
                    size="small"
                    type={rightPanel === 'annotation' ? 'primary' : 'default'}
                    icon={<CommentOutlined />}
                    onClick={() => togglePanel('annotation')}
                  >
                    列表
                  </Button>
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
                <Tooltip title="AI CLI">
                  <Button
                    size="small"
                    type={rightPanel === 'ai' ? 'primary' : 'default'}
                    icon={<RobotOutlined />}
                    onClick={() => togglePanel('ai')}
                  >
                    CLI
                  </Button>
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
                  setRightPanel(null);
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

      {rightPanel && (
        <>
          <div
            className="ph-right-panel-backdrop"
            onClick={() => setRightPanel(null)}
          />
          <div className="ph-right-panel">
            <Button
              className="ph-right-panel-close"
              size="small"
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRightPanel(null)}
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
        </>
      )}

      <Modal
        title="添加批注"
        open={!!pendingPick}
        okText="保存"
        cancelText="取消"
        onOk={submitAnnotation}
        onCancel={() => setPendingPick(null)}
      >
        <p style={{ fontSize: 12, color: '#999', wordBreak: 'break-all' }}>{pendingPick?.selector}</p>
        <Input.TextArea
          rows={4}
          autoFocus
          placeholder="写下修改意见，例如：这个按钮改成主色，文字改为「导出订单」"
          value={annotationText}
          onChange={(e) => setAnnotationText(e.target.value)}
        />
      </Modal>

    </div>
  );
}
