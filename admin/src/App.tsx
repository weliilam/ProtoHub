import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Empty, Input, Modal, Segmented, Space, Tooltip, message } from 'antd';
import {
  CommentOutlined,
  DesktopOutlined,
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
import type { Annotation, EntryItem } from './types';

type RightPanel = 'annotation' | 'git' | 'ai' | null;

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
  }, [selected, isPreviewable]);

  const handleSelect = (item: EntryItem) => {
    setSelected(item);
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
        setSelected({ ...item, name: newName, title: newName });
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

  const submitAnnotation = async () => {
    if (!selected || !pendingPick || !annotationText.trim()) return;
    try {
      await api.createAnnotation({
        target: selected.name,
        selector: pendingPick.selector,
        x: pendingPick.x,
        y: pendingPick.y,
        text: annotationText.trim(),
      });
      setAnnotations(await api.listAnnotations(selected.name));
      setPendingPick(null);
      message.success('批注已添加');
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const toggleAnnotationStatus = async (a: Annotation) => {
    await api.updateAnnotation(a.id, { status: a.status === 'open' ? 'done' : 'open' });
    if (selected) setAnnotations(await api.listAnnotations(selected.name));
  };

  const deleteAnnotation = async (a: Annotation) => {
    await api.deleteAnnotation(a.id);
    if (selected) setAnnotations(await api.listAnnotations(selected.name));
  };

  const togglePanel = (panel: Exclude<RightPanel, null>) => {
    setRightPanel((cur) => (cur === panel ? null : panel));
  };

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
      />

      <div className="ph-main">
        {!selected ? (
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
                  <Button size="small" icon={<CommentOutlined />} onClick={() => togglePanel('annotation')}>
                    列表
                  </Button>
                </Badge>
                <Tooltip title="Git 快照">
                  <Button size="small" icon={<HistoryOutlined />} onClick={() => togglePanel('git')} />
                </Tooltip>
                <Tooltip title="AI CLI">
                  <Button size="small" icon={<RobotOutlined />} onClick={() => togglePanel('ai')} />
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
        <div className="ph-right-panel">
          {rightPanel === 'annotation' && selected && (
            <AnnotationPanel
              target={selected.name}
              annotations={annotations}
              onToggleStatus={toggleAnnotationStatus}
              onDelete={deleteAnnotation}
            />
          )}
          {rightPanel === 'git' && <GitPanel selected={selected} onRestored={() => setRefreshKey((k) => k + 1)} />}
          {rightPanel === 'ai' && <AiCliPanel selected={selected} />}
        </div>
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
