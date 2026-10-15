import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Dropdown, Empty, Input, Modal, Select, Space, Tabs, Tag, Tooltip, message } from 'antd';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  RobotOutlined,
  SearchOutlined,
  SkinOutlined,
  ThunderboltOutlined,
  UngroupOutlined,
} from '@ant-design/icons';
import type { BatchJob, CreateEntryOptions, EntryItem, EntryType, GroupConfig, PrdDoc, PrototypeInfo } from '../types';
import { api } from '../api';
import CreatePrototypeModal from './CreatePrototypeModal';
import BatchAiModal from './BatchAiModal';

interface SidebarProps {
  entries: EntryItem[];
  selected: EntryItem | null;
  onSelect: (item: EntryItem) => void;
  onCreate: (type: EntryType, name: string, title: string, options?: CreateEntryOptions) => Promise<void>;
  onRename: (item: EntryItem, newName: string) => Promise<void>;
  onDelete: (item: EntryItem) => Promise<void>;
  onRefresh: () => void;
  onPrdPreview?: (doc: PrdDoc | null) => void;
  onOpenCmdk?: () => void;
  /** 批量任务创建后打开右侧「批量任务」面板 */
  onOpenBatchPanel?: () => void;
}

const TYPE_ICON: Record<EntryType, React.ReactNode> = {
  prototype: <AppstoreOutlined />,
  component: <AppstoreOutlined style={{ color: 'var(--ph-accent-2)' }} />,
  doc: <FileTextOutlined />,
  theme: <SkinOutlined />,
  table: <DatabaseOutlined />,
};

const TYPE_LABEL: Record<EntryType, string> = {
  prototype: '原型页面',
  component: '组件',
  doc: '文档',
  theme: '主题',
  table: '数据表',
};

// ── 收起态（图标条）用：字母缩略块 ──
/** 中文取首字；英文单词数 ≥2 取两词首字母，否则取前 2 字符 */
function thumbChar(title: string, name: string) {
  const t = (title || name || '').trim();
  if (!t) return '·';
  if (/[\u4e00-\u9fa5]/.test(t[0])) return t[0];
  const words = t.split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

/** 收起态单个条目：字母缩略块 + 悬停飞出预览卡片 */
function RailItem(props: {
  item: EntryItem;
  active: boolean;
  groupName?: string;
  selectMode?: boolean;
  checked?: boolean;
  onSelect: () => void;
  onToggleCheck?: () => void;
}) {
  const { item, active, groupName, selectMode, checked } = props;
  const isProto = item.type === 'prototype';
  // 卡片头部复用条目栏里那块字母块（放大 + 品牌色），扫一眼就知道悬停的是哪一条
  const preview = (
    <div className="ph-rail-preview">
      <div className="ph-rail-preview-head">
        <span className={`ph-rail-preview-avatar${isProto ? '' : ' neutral'}`}>
          {isProto ? thumbChar(item.title, item.name) : TYPE_ICON[item.type]}
        </span>
        <div className="ph-rail-preview-heading">
          <div className="ph-rail-preview-title">{item.title || item.name}</div>
          <div className="ph-rail-preview-sub">{item.name}</div>
        </div>
      </div>
      {/* 分组名占据底部的品牌色主位（长列表里靠它认位置），类型退成右侧灰字 */}
      <div className="ph-rail-preview-foot">
        {isProto ? (
          <span className={`ph-rail-preview-group${groupName ? '' : ' muted'}`}>
            <FolderOutlined />
            <span className="ph-rail-preview-group-text">{groupName || '未分组'}</span>
          </span>
        ) : (
          <span className="ph-rail-preview-group">{TYPE_LABEL[item.type]}</span>
        )}
        {isProto && <span className="ph-rail-preview-type">{TYPE_LABEL[item.type]}</span>}
      </div>
    </div>
  );

  return (
    <Tooltip title={preview} placement="right" mouseEnterDelay={0.18} classNames={{ root: 'ph-rail-tip' }}>
      <button
        type="button"
        className={`ph-rail-item${active ? ' active' : ''}${checked ? ' checked' : ''}`}
        onClick={selectMode ? props.onToggleCheck : props.onSelect}
      >
        {isProto ? (
          <span className="ph-rail-thumb">{thumbChar(item.title, item.name)}</span>
        ) : (
          <span className="ph-rail-icon">{TYPE_ICON[item.type]}</span>
        )}
        {selectMode && <span className={`ph-rail-check${checked ? ' on' : ''}`} />}
      </button>
    </Tooltip>
  );
}

function EntryRow(props: {
  item: EntryItem;
  active: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  groups: GroupConfig[];
  onMoveGroup: (prototype: string, groupId?: string) => Promise<void>;
  /** 批量选择模式：整行点击 = 勾选/取消勾选（不切换预览） */
  selectMode?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
}) {
  const { item, active, groups, onMoveGroup } = props;

  const handleRename = () => {
    let value = item.name;
    Modal.confirm({
      title: '重命名',
      content: <Input defaultValue={item.name} onChange={(e) => (value = e.target.value)} style={{ marginTop: 8 }} />,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const newName = value.trim();
        if (!newName || newName === item.name) return;
        return props.onRename(newName);
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `删除「${item.title}」后不可恢复，确定吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => props.onDelete(),
    });
  };

  const currentGroupId = item.groupId;

  const [infoData, setInfoData] = useState<PrototypeInfo | null>(null);

  const handleShowInfo = async () => {
    try {
      setInfoData(await api.prototypeInfo(item.name));
    } catch (e: any) {
      message.error(e?.message || '读取原型信息失败');
    }
  };

  const menuItems: any[] = [
    {
      key: 'move',
      icon: <FolderOutlined />,
      label: '移动到分组',
      children: [
        ...(currentGroupId
          ? [{ key: 'move-out', icon: <UngroupOutlined />, label: '移出分组' }]
          : []),
        ...groups.map((g) => ({
          key: `move-${g.id}`,
          label: currentGroupId === g.id ? `${g.name} ✓` : g.name,
          disabled: currentGroupId === g.id,
        })),
      ],
    },
  { type: 'divider' },
  ...(item.type === 'prototype'
    ? [{ key: 'info', icon: <FileTextOutlined />, label: '查看原型信息' }]
    : []),
  { key: 'rename', icon: <EditOutlined />, label: '重命名' },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
  ];

  return (
    <div
      className={`ph-entry-item${active ? ' active' : ''}${item.groupId ? '' : ' root-level'}${props.checked ? ' checked' : ''}`}
      onClick={props.selectMode ? props.onToggleCheck : props.onSelect}
    >
      {props.selectMode && <Checkbox checked={!!props.checked} />}
      {TYPE_ICON[item.type]}
      <Tooltip title={item.name} placement="right">
        <span className="ph-entry-name">{item.title}</span>
      </Tooltip>
      <span className="ph-entry-actions" onClick={(e) => e.stopPropagation()}>
        {!props.selectMode && (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'rename') handleRename();
                else if (key === 'delete') handleDelete();
                else if (key === 'move-out') onMoveGroup(item.name, undefined);
                else if (key.startsWith('move-')) onMoveGroup(item.name, key.replace('move-', ''));
                else if (key === 'info') handleShowInfo();
              },
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        )}
      </span>
      <Modal
        open={!!infoData}
        title={`原型信息 · ${infoData?.title ?? ''}`}
        footer={null}
        width={600}
        onCancel={() => setInfoData(null)}
      >
        {infoData && <PrototypeInfoView info={infoData} />}
      </Modal>
    </div>
  );
}

// ── 原型信息展示（用业务语言，面向非技术同学） ──
function PrototypeInfoView({ info }: { info: PrototypeInfo }) {
  const time = info.mtime ? new Date(info.mtime).toLocaleString('zh-CN') : '未知';
  const { antd, icons, local, libs } = info.components;
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-sidebar-section)' }}>基本信息</div>
        <div style={{ fontSize: 13, lineHeight: 1.9 }}>
          <div>原型名称：{info.name}</div>
          <div>显示标题：{info.title}</div>
          <div>原型类型：原型页面（模式：{info.mode || '未标注'}）</div>
          <div>目录路径：{info.path}</div>
          <div>最后修改：{time}</div>
          <div>批注数量：{info.annotationCount} 条</div>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-sidebar-section)' }}>使用的界面组件（{antd.length}）</div>
        {antd.length ? (
          <Space size={[4, 4]} wrap>
            {antd.map((c) => (
              <Tag key={c.name} color="blue">
                {c.zh}
              </Tag>
            ))}
          </Space>
        ) : (
          '无'
        )}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-sidebar-section)' }}>本地模块（{local.length}）</div>
        {local.length ? (
          <Space size={[4, 4]} wrap>
            {local.map((m) => (
              <Tag key={m}>{m}</Tag>
            ))}
          </Space>
        ) : (
          '全部内联在单个文件中，无独立模块'
        )}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-sidebar-section)' }}>依赖的第三方库（{libs.length}）</div>
        {libs.length ? (
          <Space size={[4, 4]} wrap>
            {libs.map((l) => (
              <Tag key={l}>{l}</Tag>
            ))}
          </Space>
        ) : (
          '无'
        )}
      </div>
      {icons.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-sidebar-section)' }}>使用的图标（{icons.length}）</div>
          <Space size={[4, 4]} wrap>
            {icons.map((i) => (
              <Tag key={i} color="purple">
                {i}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}

// ── 分组面板 ──

/**
 * 当前正在拖拽的原型。
 * HTML5 拖放规范限制：dragover 阶段读不到 dataTransfer 的数据（只能读 types），
 * 因此「拖来的原型属于哪个分组」必须靠模块级状态判断，否则无法在悬停时给高亮反馈。
 */
let draggingProto: { name: string; groupId?: string } | null = null;

function GroupPanel(props: {
  group: GroupConfig;
  items: EntryItem[];
  selected: EntryItem | null;
  onSelect: (item: EntryItem) => void;
  onRename: (item: EntryItem, newName: string) => Promise<void>;
  onDelete: (item: EntryItem) => Promise<void>;
  onMoveGroup: (prototype: string, groupId?: string) => Promise<void>;
  onRenameGroup: (id: string, name: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onReorder?: (groupId: string, protoNames: string[]) => void;
  /** 有外部原型落入本分组时调用（分组内排序仍走 onReorder） */
  onDropIntoGroup?: (protoName: string, groupId: string) => void;
  allGroups: GroupConfig[];
  isOpen: boolean;
  onToggle: () => void;
  /** 分组整体上移/下移 */
  index?: number;
  total?: number;
  onMoveGroupOrder?: (id: string, dir: -1 | 1) => void;
  /** 批量选择模式（禁用拖拽，整行点击 = 勾选） */
  selectMode?: boolean;
  selectSet?: Set<string>;
  onToggleCheck?: (name: string) => void;
}) {
  const { group, items, selected, allGroups } = props;
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  /** 分组头 / 空分组提示是否处于「可放入」高亮态 */
  const [dropActive, setDropActive] = useState(false);

  const handleRenameGroup = () => {
    let value = group.name;
    Modal.confirm({
      title: '重命名分组',
      content: <Input defaultValue={group.name} onChange={(e) => (value = e.target.value)} style={{ marginTop: 8 }} />,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const n = value.trim();
        if (!n || n === group.name) return;
        return props.onRenameGroup(group.id, n);
      },
    });
  };

  const handleDeleteGroup = () => {
    Modal.confirm({
      title: '删除分组',
      content: `删除分组「${group.name}」后，分组内原型不会被删除，确定吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => props.onDeleteGroup(group.id),
    });
  };

  // ── 拖拽排序 / 跨分组拖入 ──
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', items[idx].name);
    e.dataTransfer.effectAllowed = 'move';
    // dragover 阶段读不到 dataTransfer，用模块级状态供其它分组判断来源
    draggingProto = { name: items[idx].name, groupId: group.id };
    (e.currentTarget as HTMLElement).style.opacity = '0.4';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(idx);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    setDropIndex(null);
    setDropActive(false);
    draggingProto = null;
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    setDropIndex(null);
    setDropActive(false);
    const fromName = e.dataTransfer.getData('text/plain');
    const fromIdx = items.findIndex((i) => i.name === fromName);
    // 来自分组外（未分组 / 其它分组）：走「移入本分组」，而不是组内排序
    if (fromIdx === -1) {
      if (fromName) props.onDropIntoGroup?.(fromName, group.id);
      draggingProto = null;
      return;
    }
    if (fromIdx === toIdx || fromIdx + 1 === toIdx) return;
    const newOrder = [...items];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, moved);
    props.onReorder?.(group.id, newOrder.map((i) => i.name));
  };

  /** 分组头 / 空分组提示作为放置目标：把外部原型移入本分组 */
  const canAcceptExternal = () => !!draggingProto && draggingProto.groupId !== group.id;

  const handleHeaderDragOver = (e: React.DragEvent) => {
    if (!canAcceptExternal()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropActive(true);
  };

  const handleHeaderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const name = e.dataTransfer.getData('text/plain') || draggingProto?.name;
    if (name && canAcceptExternal()) props.onDropIntoGroup?.(name, group.id);
    draggingProto = null;
  };

  return (
    <div className="ph-folder-group">
      <div
        className={`ph-folder-header${dropActive ? ' drop-target' : ''}`}
        onClick={props.onToggle}
        onDragOver={handleHeaderDragOver}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleHeaderDrop}
      >
        <RightOutlined className={`ph-folder-icon${props.isOpen ? ' open' : ''}`} />
        {props.isOpen ? <FolderOpenOutlined style={{ color: 'var(--ph-sidebar-folder-open)' }} /> : <FolderOutlined style={{ color: 'var(--ph-sidebar-folder-closed)' }} />}
        <span className="ph-folder-title">{group.name}</span>
        <span className="ph-folder-count">{items.length}</span>
        <span onClick={(e) => e.stopPropagation()} className="ph-folder-actions">
          <Dropdown
            menu={{
              items: [
                {
                  key: 'moveUp',
                  icon: <ArrowUpOutlined />,
                  label: '上移分组',
                  disabled: (props.index ?? 0) === 0,
                },
                {
                  key: 'moveDown',
                  icon: <ArrowDownOutlined />,
                  label: '下移分组',
                  disabled: (props.index ?? 0) >= (props.total ?? 1) - 1,
                },
                { type: 'divider' },
                { key: 'rename', icon: <EditOutlined />, label: '重命名' },
                { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                if (key === 'moveUp') props.onMoveGroupOrder?.(group.id, -1);
                if (key === 'moveDown') props.onMoveGroupOrder?.(group.id, 1);
                if (key === 'rename') handleRenameGroup();
                if (key === 'delete') handleDeleteGroup();
              },
            }}
            trigger={['click']}
          >
            <Button type="text" size="small" icon={<MoreOutlined />} style={{ visibility: 'inherit' }} />
          </Dropdown>
        </span>
      </div>
      {props.isOpen && (
        <div className="ph-folder-body">
          {items.length === 0 ? (
            <div
              className={`ph-folder-empty${dropActive ? ' drop-active' : ''}`}
              onDragOver={handleHeaderDragOver}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleHeaderDrop}
            >
              暂无原型，把原型拖到这里即可加入本分组
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.name}
                draggable={!props.selectMode}
                className={`ph-drag-item${dropIndex === idx ? ' drop-active' : ''}`}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
              >
                <EntryRow
                  item={item}
                  active={selected?.type === item.type && selected?.name === item.name}
                  onSelect={() => props.onSelect(item)}
                  onRename={(newName) => props.onRename(item, newName)}
                  onDelete={() => props.onDelete(item)}
                  groups={allGroups}
                  onMoveGroup={props.onMoveGroup}
                  selectMode={props.selectMode}
                  checked={props.selectSet?.has(item.name)}
                  onToggleCheck={() => props.onToggleCheck?.(item.name)}
                />
              </div>
            ))
          )}
          {/* 末尾可放置位：拖到最后一个元素下方（批量选择时不需要） */}
          {items.length > 0 && !props.selectMode && (
            <div
              className={`ph-drag-item ph-drag-end${dropIndex === items.length ? ' drop-active' : ''}`}
              onDragOver={(e) => handleDragOver(e, items.length)}
              onDrop={(e) => handleDrop(e, items.length)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── 主 Sidebar ──
export default function Sidebar(props: SidebarProps) {
  const { entries, selected, onSelect } = props;
  const [tab, setTab] = useState('prototype');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  /** 侧边栏收起为图标条（收起后展示字母缩略图 + 悬停飞出预览） */
  const [collapsed, setCollapsedRaw] = useState(() => localStorage.getItem('ph_sidebar_collapsed') === '1');
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  /** 收起态条目列表的滚动容器（用于把当前预览的条目滚进视野） */
  const railBodyRef = useRef<HTMLDivElement | null>(null);
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  /** 未分组区域是否处于「可移入」高亮态（把分组内的原型拖出来时） */
  const [ugDropActive, setUgDropActive] = useState(false);
  const [openFolders, setOpenFoldersRaw] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('ph_open_folders');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const hadSavedState = useRef(localStorage.getItem('ph_open_folders') !== null);
  /** 新建原型弹框（模板创建 / AI 上传设计稿生成） */
  const [createOpen, setCreateOpen] = useState(false);
  /** 创建完成后待自动选中的原型目录名：等列表刷新出该条目再选中 */
  const [pendingProto, setPendingProto] = useState<string | null>(null);
  /** 批量修改模式：勾选多个原型页面 → 一条指令 → 1 个批量任务 */
  const [batchMode, setBatchMode] = useState(false);
  const [batchSel, setBatchSel] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);

  const exitBatchMode = () => {
    setBatchMode(false);
    setBatchSel([]);
  };

  // 收起状态持久化（下次进入保持用户习惯）
  const setCollapsed = (next: boolean) => {
    setCollapsedRaw(next);
    try { localStorage.setItem('ph_sidebar_collapsed', next ? '1' : '0'); } catch {}
  };

  // Ctrl/⌘ + B 切换收起；收起态下输入任意可打印字符自动展开并聚焦搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsedRaw((prev) => {
          const next = !prev;
          try { localStorage.setItem('ph_sidebar_collapsed', next ? '1' : '0'); } catch {}
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * 收起态：当前预览的条目自动滚进视野——选完原型收回去，不必手动往下拉。
   * 已经完整可见时不打扰（用户自己滚过的地方不会被抢回来），需要滚动时居中，
   * 上下留出邻近条目做位置参照。
   */
  useLayoutEffect(() => {
    if (!collapsed) return;
    const body = railBodyRef.current;
    if (!body) return;
    const el = body.querySelector<HTMLElement>('.ph-rail-item.active');
    if (!el) return;
    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (elRect.top >= bodyRect.top && elRect.bottom <= bodyRect.bottom) return;
    const top = body.scrollTop + (elRect.top - bodyRect.top) - (body.clientHeight - elRect.height) / 2;
    const max = body.scrollHeight - body.clientHeight;
    body.scrollTo({ top: Math.max(0, Math.min(top, max)), behavior: 'smooth' });
  }, [collapsed, tab, debouncedKeyword, entries, selected?.type, selected?.name]);

  /** 收起态点搜索：先展开，再把焦点交给搜索框 */
  const expandAndFocusSearch = () => {
    setCollapsed(false);
    setTimeout(() => searchBoxRef.current?.querySelector('input')?.focus(), 240);
  };

  /** 收起态底部「新建」菜单：原展开态里的新建入口在图标条下收进 Dropdown */
  const railCreateMenu = {
    items: [
      { key: 'prototype', icon: <PlusOutlined />, label: '新建原型' },
      ...(tab === 'prototype' ? [{ key: 'group', icon: <FolderOutlined />, label: '新建分组' }] : []),
      ...(tab === 'doc' ? [{ key: 'doc', icon: <FileTextOutlined />, label: '新建文档' }] : []),
      ...(tab === 'doc' ? [{ key: 'prd', icon: <LinkOutlined />, label: '关联飞书 PRD' }] : []),
      ...(tab === 'resource' ? [{ key: 'table', icon: <DatabaseOutlined />, label: '新建数据表' }] : []),
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'group') handleCreateGroup();
      else if (key === 'prd') {
        setPrdAddProto(undefined);
        setPrdAddUrl('');
        setPrdAddOpen(true);
      } else handleCreate(key as EntryType);
    },
  };

  const toggleBatchCheck = (name: string) =>
    setBatchSel((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  /** 勾选目录名 → 任务目标（过滤掉已被删除/重命名的原型） */
  const batchTargets = useMemo(
    () =>
      batchSel
        .map((name) => entries.find((e) => e.type === 'prototype' && e.name === name))
        .filter((e): e is EntryItem => !!e)
        .map((e) => ({ name: e.name, title: e.title || e.name })),
    [batchSel, entries],
  );

  const batchSelectedSet = useMemo(() => new Set(batchSel), [batchSel]);

  // 切到「文档/资源」Tab 时自动退出批量修改（批量只针对原型页面）
  useEffect(() => {
    if (tab !== 'prototype' && batchMode) {
      setBatchMode(false);
      setBatchSel([]);
    }
  }, [tab, batchMode]);

  useEffect(() => {
    if (!pendingProto) return;
    const found = entries.find((e) => e.type === 'prototype' && e.name === pendingProto);
    if (found) {
      onSelect(found);
      setPendingProto(null);
    }
  }, [entries, pendingProto, onSelect]);

  // 搜索关键词 150ms 防抖
  const handleKeywordChange = (val: string) => {
    setKeyword(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedKeyword(val), 150);
  };

  // 用户手动切换折叠时持久化到 localStorage
  const setOpenFolders = (updater: (prev: Set<string>) => Set<string>) => {
    setOpenFoldersRaw((prev) => {
      const next = updater(prev);
      try { localStorage.setItem('ph_open_folders', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // 程序化展开（不覆盖用户已折叠的项）
  const expandFolders = (...ids: string[]) => {
    setOpenFoldersRaw((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      try { localStorage.setItem('ph_open_folders', JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  // 文档 Tab 中「飞书PRD」分组展示所有原型关联的飞书 PRD 文档
  const [prdItems, setPrdItems] = useState<{ name: string; docs: PrdDoc[] }[]>([]);
  const [prdSyncing, setPrdSyncing] = useState<Set<string>>(new Set());
  const [prdAddOpen, setPrdAddOpen] = useState(false);
  const [prdAddLoading, setPrdAddLoading] = useState(false);
  const [prdAddProto, setPrdAddProto] = useState<string | undefined>(undefined);
  const [prdAddUrl, setPrdAddUrl] = useState('');

  useEffect(() => {
    if (tab !== 'doc') return;
    api
      .prdGetAll()
      .then((d) => {
        const items = d.items || [];
        setPrdItems(items);
      })
      .catch(() => setPrdItems([]));
  }, [tab, entries]);

  useEffect(() => {
    api.fetchGroups().then((groups) => {
      setGroups(groups || []);
      const ids = (groups || []).map((g) => g.id);
      if (!hadSavedState.current) {
        // 首次访问：展开所有分组
        expandFolders(...ids);
        hadSavedState.current = true;
      } else {
        // 后续访问：仅清理已删除的分组 ID，保留用户手动折叠/展开状态
        setOpenFolders((prev) => {
          const next = new Set(prev);
          let changed = false;
          next.forEach((id) => {
            if (!ids.includes(id)) { next.delete(id); changed = true; }
          });
          return changed ? next : prev;
        });
      }
    }).catch(() => {});
  }, [entries]);

  // 卸载时清理搜索防抖定时器
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const filtered = useMemo(() => {
    const kw = debouncedKeyword.trim().toLowerCase();
    return entries.filter((e) => !kw || e.name.toLowerCase().includes(kw) || (e.title || '').toLowerCase().includes(kw));
  }, [entries, debouncedKeyword]);

  const byType = (t: EntryType) => filtered.filter((e) => e.type === t);

  const groupedProtos = useMemo(() => {
    const protos = byType('prototype');
    const grouped: Record<string, EntryItem[]> = {};
    const ungrouped: EntryItem[] = [];
    for (const p of protos) {
      if (p.groupId) {
        (grouped[p.groupId] ||= []).push(p);
      } else {
        ungrouped.push(p);
      }
    }
    return { grouped, ungrouped };
  }, [filtered, tab]);

  const handleMoveGroup = async (prototype: string, groupId?: string) => {
    try {
      await api.moveToGroup(prototype, groupId);
      message.success(groupId ? '已移入分组' : '已移出分组');
      const res = await api.fetchGroups();
      setGroups(res || []);
      props.onRefresh();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  /** 拖拽落入分组：分组处于折叠状态时自动展开，避免「拖完看不到原型去哪了」 */
  const handleDropIntoGroup = async (prototype: string, groupId: string) => {
    if (!openFolders.has(groupId)) {
      setOpenFolders((prev) => new Set(prev).add(groupId));
    }
    await handleMoveGroup(prototype, groupId);
  };

  // 分组（文件夹）整体上移/下移
  const handleMoveGroupOrder = async (id: string, dir: -1 | 1) => {
    const idx = groups.findIndex((g) => g.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= groups.length) return;
    const next = [...groups];
    const [g] = next.splice(idx, 1);
    next.splice(to, 0, g);
    setGroups(next); // 乐观更新
    try {
      await api.reorderGroups(next.map((g2) => g2.id));
      const res = await api.fetchGroups();
      setGroups(res || []);
      props.onRefresh();
    } catch (e: any) {
      message.error(e.message || '排序失败');
      const res = await api.fetchGroups();
      setGroups(res || []);
    }
  };

  // 分组内拖拽重排原型顺序
  const handleReorder = async (groupId: string, protoNames: string[]) => {
    const g = groups.find((g2) => g2.id === groupId);
    if (!g) return;
    try {
      await api.updateGroup(groupId, g.name, protoNames);
      const res = await api.fetchGroups();
      setGroups(res || []);
      props.onRefresh();
    } catch (e: any) {
      message.error(e.message || '排序失败');
    }
  };

  const handleCreateGroup = () => {
    let name = '';
    Modal.confirm({
      title: '新建分组',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Input placeholder="分组名称（如 B2B-OMS）" onChange={(e) => (name = e.target.value)} />
        </div>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!name.trim()) {
          message.warning('请输入分组名称');
          return Promise.reject();
        }
        // 自动生成 ID：中文转拼音首字母不靠谱，直接用名称 slug 化
        const id = name.trim()
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fff]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || Date.now().toString(36);
        try {
          await api.createGroup(id, name.trim());
          const res = await api.fetchGroups();
          setGroups(res || []);
          message.success('分组已创建');
          // 新分组默认展开
          setOpenFolders((prev) => new Set(prev).add(id));
        } catch (e: any) {
          message.error(e.message || '创建失败');
          return Promise.reject();
        }
      },
    });
  };

  const handleRenameGroup = async (id: string, name: string) => {
    const g = groups.find((g2) => g2.id === id);
    if (!g) return;
    try {
      await api.updateGroup(id, name, g.prototypes);
      const res = await api.fetchGroups();
      setGroups(res || []);
      message.success('已重命名');
    } catch (e: any) {
      message.error(e.message || '重命名失败');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await api.deleteGroup(id);
      const res = await api.fetchGroups();
      setGroups(res || []);
      message.success('分组已删除');
      props.onRefresh();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  // ── 飞书 PRD 关联管理 ──
  const reloadPrd = async (focusProto?: string) => {
    try {
      const d = await api.prdGetAll();
      setPrdItems(d.items || []);
      if (focusProto) {
        setOpenFolders((prev) => {
          const next = new Set(prev);
          next.add(`prd-${focusProto}`);
          return next;
        });
      }
    } catch {
      setPrdItems([]);
    }
  };

  const handleAddPrd = async () => {
    const url = prdAddUrl.trim();
    const proto = prdAddProto;
    if (!proto) { message.warning('请选择要关联的原型'); return; }
    if (!url) { message.warning('请粘贴飞书 PRD 链接'); return; }
    if (!/^https?:\/\//.test(url)) { message.warning('链接必须以 http(s):// 开头'); return; }
    setPrdAddLoading(true);
    try {
      await api.prdAddLink(proto, url);
      message.success('已关联飞书 PRD 文档');
      setPrdAddUrl('');
      setPrdAddOpen(false);
      await reloadPrd(proto);
      // 新关联的文档自动触发一次同步
      try { await api.prdSync(proto, url); await reloadPrd(proto); } catch {}
    } catch (e: any) {
      message.error(e.message || '关联失败');
    } finally {
      setPrdAddLoading(false);
    }
  };

  // 同步飞书文档标题和摘要
  const handleSyncPrd = async (protoName: string, docUrl: string) => {
    const key = `${protoName}::${docUrl}`;
    setPrdSyncing((prev) => new Set(prev).add(key));
    try {
      const { docs } = await api.prdSync(protoName, docUrl);
      await reloadPrd();
      // 同步更新当前展示的 prdDoc，使主区域立即刷新
      const updated = docs.find(d => d.url === docUrl);
      if (updated) props.onPrdPreview?.(updated);
      message.success('已同步文档信息');
    } catch (e: any) {
      message.error(e.message || '同步失败');
    } finally {
      setPrdSyncing((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const handleRemovePrd = async (name: string, url: string) => {
    const protoTitle = entries.find((e) => e.name === name)?.title || name;
    Modal.confirm({
      title: '移除飞书 PRD 关联',
      content: `确定移除「${protoTitle}」的该飞书 PRD 关联？`,
      okText: '移除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.prdRemoveLink(name, url);
          message.success('已移除');
          await reloadPrd();
        } catch (e: any) {
          message.error(e.message || '移除失败');
        }
      },
    });
  };

  // ── 文档 Tab：每个有关联文档的原型作为一个独立文件夹 ──
  const renderPrdGroups = () => {
    if (prdItems.length === 0) return null;
    return prdItems.map((it) => {
      const protoTitle = entries.find((e) => e.type === 'prototype' && e.name === it.name)?.title || it.name;
      const folderKey = `prd-${it.name}`;
      const isOpen = openFolders.has(folderKey);
      return (
        <div className="ph-folder-group" key={folderKey}>
          <div className="ph-folder-header" onClick={() => setOpenFolders((prev) => {
            const next = new Set(prev);
            next.has(folderKey) ? next.delete(folderKey) : next.add(folderKey);
            return next;
          })}>
            <RightOutlined className={`ph-folder-icon${isOpen ? ' open' : ''}`} />
            {isOpen ? <FolderOpenOutlined style={{ color: 'var(--ph-sidebar-folder-open)' }} /> : <FolderOutlined style={{ color: 'var(--ph-sidebar-folder-closed)' }} />}
            <span className="ph-folder-title">{protoTitle}</span>
            <span className="ph-folder-count">{it.docs.length}</span>
            <span onClick={(e) => e.stopPropagation()}>
              <Tooltip title="追加飞书文档">
                <Button type="text" size="small" icon={<PlusOutlined />}
                  onClick={() => { setPrdAddProto(it.name); setPrdAddUrl(''); setPrdAddOpen(true); }} />
              </Tooltip>
            </span>
          </div>
          {isOpen && (
            <div className="ph-folder-body">
              {it.docs.map((doc, i) => {
                const label = doc.title || (it.docs.length > 1 ? `飞书PRD (${i + 1})` : '飞书PRD（未同步标题）');
                const syncKey = `${it.name}::${doc.url}`;
                const syncing = prdSyncing.has(syncKey);
                return (
                  <div key={doc.url} className="ph-entry-item"
                    style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', padding: '6px 8px 6px 12px' }}
                    onClick={() => props.onPrdPreview?.(doc)}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <FileTextOutlined style={{ color: 'var(--ph-sidebar-folder-open)', flexShrink: 0 }} />
                      <span className="ph-entry-name"
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 8 }}>
                        {label}
                      </span>
                      <span className="ph-entry-actions" onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto' }}>
                        <Tooltip title="同步文档标题和内容">
                          <Button type="text" size="small"
                            icon={<ReloadOutlined spin={syncing} />}
                            loading={syncing}
                            onClick={() => handleSyncPrd(it.name, doc.url)} />
                        </Tooltip>
                        <Tooltip title="移除关联">
                          <Button type="text" size="small" danger icon={<DeleteOutlined />}
                            onClick={() => handleRemovePrd(it.name, doc.url)} />
                        </Tooltip>
                      </span>
                    </div>
                    {doc.summary && (
                      <div style={{ fontSize: 11, color: 'var(--ph-sidebar-meta)', marginTop: 4, paddingLeft: 22, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.summary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  const handleCreate = (type: EntryType) => {
    // 原型：走带 AI 助手的新建弹框（模板创建 / 上传设计稿由 AI 生成，由用户自行选择）
    if (type === 'prototype') {
      setCreateOpen(true);
      return;
    }
    let name = '';
    let title = '';
    Modal.confirm({
      title: `新建${type === 'doc' ? '文档' : '数据表'}`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Input placeholder="显示标题（如 接口说明）" onChange={(e) => (title = e.target.value)} />
          <Input placeholder="目录名（英文/中划线，如 order-list）" onChange={(e) => (name = e.target.value)} />
        </div>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        if (!name.trim()) {
          message.warning('请输入目录名');
          return Promise.reject();
        }
        await props.onCreate(type, name.trim(), title.trim() || name.trim());
      },
    });
  };

  const renderList = (list: EntryItem[]) =>
    list.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" style={{ margin: '24px 0' }} />
    ) : (
      list.map((item) => (
        <EntryRow
          key={`${item.type}-${item.name}`}
          item={item}
          active={selected?.type === item.type && selected?.name === item.name}
          onSelect={() => props.onSelect(item)}
          onRename={(newName) => props.onRename(item, newName)}
          onDelete={() => props.onDelete(item)}
          groups={groups}
          onMoveGroup={handleMoveGroup}
        />
      ))
    );

  const renderPrototypeList = () => {
    const { grouped, ungrouped } = groupedProtos;
    // 只显示当前环境存在原型的分组（他人拉取仓库后，本地没有对应原型目录的分组自动隐藏）
    const orderedGroups = groups.filter((g) => (grouped[g.id] || []).length > 0);
    const hasAny = orderedGroups.length > 0 || ungrouped.length > 0;
    if (!hasAny) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无" style={{ margin: '24px 0' }} />;

    return (
      <>
        {orderedGroups.map((g, idx) => (
          <GroupPanel
            key={g.id}
            group={g}
            items={grouped[g.id] || []}
            selected={selected}
            onSelect={props.onSelect}
            onRename={props.onRename}
            onDelete={props.onDelete}
            onMoveGroup={handleMoveGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onReorder={handleReorder}
            onDropIntoGroup={handleDropIntoGroup}
            allGroups={groups}
            index={idx}
            total={orderedGroups.length}
            onMoveGroupOrder={handleMoveGroupOrder}
            isOpen={openFolders.has(g.id)}
            selectMode={batchMode}
            selectSet={batchSelectedSet}
            onToggleCheck={toggleBatchCheck}
            onToggle={() =>
              setOpenFolders((prev) => {
                const next = new Set(prev);
                next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                return next;
              })
            }
          />
        ))}
        {/* 未分组：既是拖拽起点，也是「移出分组」的放置目标 */}
        <div
          className={`ph-ungrouped-zone${ugDropActive ? ' drop-active' : ''}`}
          onDragOver={(e) => {
            // 只有分组内的原型拖过来才有意义（移出分组）；批量选择模式下不接收拖拽
            if (batchMode || !draggingProto?.groupId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setUgDropActive(true);
          }}
          onDragLeave={() => setUgDropActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setUgDropActive(false);
            const name = e.dataTransfer.getData('text/plain') || draggingProto?.name;
            if (name && draggingProto?.groupId) handleMoveGroup(name, undefined);
            draggingProto = null;
          }}
        >
          <div
            style={{
              padding: '4px 8px',
              fontSize: 11,
              color: 'var(--ph-sidebar-desc)',
              fontWeight: 600,
            }}
          >
            未分组 ({ungrouped.length})
          </div>
          {ungrouped.map((item) => (
            <div
              key={`ug-${item.name}`}
              draggable={!batchMode}
              className="ph-drag-item"
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', item.name);
                e.dataTransfer.effectAllowed = 'move';
                draggingProto = { name: item.name, groupId: undefined };
                (e.currentTarget as HTMLElement).style.opacity = '0.4';
              }}
              onDragEnd={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
                draggingProto = null;
                setUgDropActive(false);
              }}
            >
              <EntryRow
                item={item}
                active={selected?.type === item.type && selected?.name === item.name}
                onSelect={() => props.onSelect(item)}
                onRename={(newName) => props.onRename(item, newName)}
                onDelete={() => props.onDelete(item)}
                groups={groups}
                onMoveGroup={handleMoveGroup}
                selectMode={batchMode}
                checked={batchSelectedSet.has(item.name)}
                onToggleCheck={() => toggleBatchCheck(item.name)}
              />
            </div>
          ))}
          {ungrouped.length === 0 && (
            <div className="ph-ungrouped-empty">把分组内的原型拖到这里即可移出</div>
          )}
        </div>
      </>
    );
  };

  /** 收起态：按 Tab 汇总的可跳转条目（原型按分组分段，组名悬停可见） */
  const renderRail = () => {
    const sections: { label: string; items: EntryItem[] }[] = [];
    if (tab === 'prototype') {
      const { grouped, ungrouped } = groupedProtos;
      groups.forEach((g) => {
        const items = grouped[g.id] || [];
        if (items.length) sections.push({ label: g.name, items });
      });
      if (ungrouped.length) sections.push({ label: '未分组', items: ungrouped });
    } else if (tab === 'doc') {
      const docs = byType('doc');
      if (docs.length) sections.push({ label: '文档', items: docs });
    } else {
      const groupsOfType: [string, EntryItem[]][] = [
        ['组件', byType('component')],
        ['主题', byType('theme')],
        ['数据表', byType('table')],
      ];
      groupsOfType.forEach(([label, items]) => {
        if (items.length) sections.push({ label, items });
      });
    }

    const total = sections.reduce((n, s) => n + s.items.length, 0) + (tab === 'doc' ? prdItems.length : 0);
    if (!total) return <div className="ph-rail-empty">{debouncedKeyword ? '无匹配' : '暂无'}</div>;

    const groupNameOf = (item: EntryItem) => groups.find((g) => g.id === item.groupId)?.name;
    const isActive = (item: EntryItem) => selected?.type === item.type && selected?.name === item.name;

    return (
      <>
        {sections.map((s, i) => (
          <Fragment key={`${tab}-${s.label}-${i}`}>
            <Tooltip title={s.label} placement="right">
              <div className="ph-rail-divider">
                <span>{s.label.slice(0, 1)}</span>
              </div>
            </Tooltip>
            {s.items.map((item) => (
              <RailItem
                key={`${item.type}-${item.name}`}
                item={item}
                active={isActive(item)}
                groupName={groupNameOf(item)}
                selectMode={batchMode && item.type === 'prototype'}
                checked={batchSelectedSet.has(item.name)}
                onSelect={() => props.onSelect(item)}
                onToggleCheck={() => toggleBatchCheck(item.name)}
              />
            ))}
          </Fragment>
        ))}
        {/* 文档 Tab 收起态同样保留「飞书 PRD 关联」入口 */}
        {tab === 'doc' && prdItems.length > 0 && (
          <>
            <Tooltip title="飞书 PRD" placement="right">
              <div className="ph-rail-divider">
                <span>飞</span>
              </div>
            </Tooltip>
            {prdItems.map((p) => (
              <RailItem
                key={`prd-${p.name}`}
                item={{ name: p.name, title: p.docs[0]?.title || p.name, type: 'doc', mtime: 0 }}
                active={false}
                groupName="飞书 PRD"
                onSelect={() => props.onPrdPreview?.(p.docs[0] ?? null)}
              />
            ))}
          </>
        )}
      </>
    );
  };

  /** 收起态图标 Tab（带数量角标） */
  const railTabs = [
    { key: 'prototype', label: '原型页面', icon: <AppstoreOutlined />, count: byType('prototype').length },
    { key: 'doc', label: '文档', icon: <FileTextOutlined />, count: byType('doc').length + prdItems.length },
    {
      key: 'resource',
      label: '组件 / 主题 / 数据表',
      icon: <SkinOutlined />,
      count: byType('component').length + byType('theme').length + byType('table').length,
    },
  ];

  return (
    <div className={`ph-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <div className="ph-sidebar-header">
        <Tooltip title={collapsed ? '展开侧边栏（Ctrl+B）' : ''} placement="right">
        <div className="ph-sidebar-title">
          <div
            className={`ph-logo-mark${collapsed ? ' clickable' : ''}`}
            onClick={collapsed ? () => setCollapsed(false) : undefined}
          >
            <svg viewBox="0 0 36 36" width="32" height="32" aria-hidden="true">
              <defs>
                <linearGradient id="ph-logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" style={{ stopColor: 'var(--ph-accent)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--ph-accent-2)' }} />
                </linearGradient>
                <clipPath id="ph-logo-clip">
                  <circle cx="18" cy="20" r="14" />
                </clipPath>
              </defs>
              {/* 飞出的蛋壳碎片 */}
              <rect x="24.5" y="1" width="6.5" height="6.5" rx="1.5" transform="rotate(20 27.75 4.25)" fill="url(#ph-logo-grad)" />
              {/* 蛋体 */}
              <circle cx="18" cy="20" r="14" fill="url(#ph-logo-grad)" />
              {/* 锯齿裂纹：负空间，clip 到蛋体边缘形成"破壳" */}
              <polyline
                points="2,20 7,15.5 12.5,23 18,15.5 23.5,23 29,15.5 34,20"
                clipPath="url(#ph-logo-clip)"
                fill="none"
                style={{ stroke: 'var(--ph-panel-bg)', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }}
              />
            </svg>
          </div>
          {!collapsed && <span className="ph-logo-text">Hatch</span>}
        </div>
        </Tooltip>
        {!collapsed && (
          <Tooltip title="收起侧边栏（Ctrl+B）" placement="left">
            <Button
              type="text"
              size="small"
              className="ph-sidebar-fold"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed(true)}
            />
          </Tooltip>
        )}
      </div>

      {collapsed ? (
        <>
          {/* 收起态顶部入口：展开（与展开态 header 的收起按钮对称）+ 全局搜索 */}
          <div className="ph-rail-tools">
            <Tooltip title="展开侧边栏（Ctrl+B）" placement="right">
              <button className="ph-rail-btn" onClick={() => setCollapsed(false)}>
                <MenuUnfoldOutlined />
              </button>
            </Tooltip>
            {props.onOpenCmdk && (
              <Tooltip title="全局搜索 / 命令（Ctrl+K）" placement="right">
                <button className="ph-rail-btn" onClick={props.onOpenCmdk}>
                  <SearchOutlined />
                </button>
              </Tooltip>
            )}
          </div>
          {/* 收起态：Tab 图标（原型 / 文档 / 资源），悬停看名称，角标看数量 */}
          <div className="ph-rail-tabs">
            {railTabs.map((t) => (
              <Tooltip key={t.key} title={t.label} placement="right">
                <button
                  className={`ph-rail-btn${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key as typeof tab)}
                >
                  {t.icon}
                  {t.count > 0 && <span className="ph-rail-badge">{t.count}</span>}
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="ph-rail-body" ref={railBodyRef}>{renderRail()}</div>
          <div className="ph-rail-footer">
            {batchMode ? (
              <Tooltip title={`批量修改中：已选 ${batchSel.length} 个页面（点击展开继续）`} placement="right">
                <button className="ph-rail-btn active" onClick={() => setCollapsed(false)}>
                  <ThunderboltOutlined />
                  <span className="ph-rail-badge">{batchSel.length}</span>
                </button>
              </Tooltip>
            ) : (
              <Dropdown menu={railCreateMenu} trigger={['click']} placement="topRight">
                <button className="ph-rail-btn" title="新建">
                  <PlusOutlined />
                </button>
              </Dropdown>
            )}
          </div>
        </>
      ) : (
        <>
      <div style={{ padding: '8px 12px 0' }} ref={searchBoxRef}>
        <Input.Search placeholder="搜索..." size="small" allowClear value={keyword} onChange={(e) => handleKeywordChange(e.target.value)} onClear={() => { setKeyword(''); setDebouncedKeyword(''); }} />
        {props.onOpenCmdk && (
          <button className="ph-cmdk-trigger" onClick={props.onOpenCmdk}>
            <SearchOutlined />
            全局搜索 / 命令
            <kbd>Ctrl K</kbd>
          </button>
        )}
      </div>
      <Tabs
        className="ph-sidebar-tabs"
        activeKey={tab}
        onChange={setTab}
        size="small"
        centered
        items={[
          { key: 'prototype', label: '原型' },
          { key: 'doc', label: '文档' },
          { key: 'resource', label: '资源' },
        ]}
      />
      <div className="ph-sidebar-body">
        {tab === 'prototype' && (
          <>
            <div className="ph-create-actions">
              <Button block size="small" icon={<PlusOutlined />} onClick={() => handleCreate('prototype')}>
                新建原型
              </Button>
              <Button size="small" icon={<FolderOutlined />} onClick={handleCreateGroup} title="新建分组" />
              <Tooltip title={batchMode ? '退出批量修改' : '批量修改：勾选多个页面，用一条指令统一改'}>
                <Button
                  size="small"
                  type={batchMode ? 'primary' : 'default'}
                  icon={<ThunderboltOutlined />}
                  onClick={() => (batchMode ? exitBatchMode() : setBatchMode(true))}
                />
              </Tooltip>
            </div>
            {renderPrototypeList()}
          </>
        )}
        {tab === 'doc' && (
          <>
            {renderPrdGroups()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: prdItems.length > 0 ? 12 : 0, marginBottom: 12 }}>
              <Button block size="small" icon={<PlusOutlined />} onClick={() => handleCreate('doc')}>
                新建文档
              </Button>
              <Button block size="small" type="dashed" icon={<LinkOutlined />} onClick={() => {
                setPrdAddProto(undefined);
                setPrdAddUrl('');
                setPrdAddOpen(true);
              }}>
                关联飞书 PRD
              </Button>
            </div>
            {renderList(byType('doc'))}
          </>
        )}
        {tab === 'resource' && (
          <>
            <div style={{ padding: '4px 8px', fontSize: 12, color: 'var(--ph-sidebar-category)' }}>组件</div>
            {renderList(byType('component'))}
            <div style={{ padding: '12px 8px 4px', fontSize: 12, color: 'var(--ph-sidebar-category)' }}>主题</div>
            {renderList(byType('theme'))}
            <div style={{ padding: '12px 8px 4px', fontSize: 12, color: 'var(--ph-sidebar-category)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              数据表
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleCreate('table')} />
            </div>
            {renderList(byType('table'))}
          </>
        )}
      </div>
        </>
      )}

      {/* 批量修改：勾选多个原型页面 → 一条指令 → 1 个批量任务（勾选状态在这里，不随预览切换丢失） */}
      {batchMode && !collapsed && (
        <div className="ph-batch-bar">
          <div className="ph-batch-bar-info">
            <span>
              已选 <b>{batchSel.length}</b> 个页面
            </span>
            <a onClick={() => setBatchSel(byType('prototype').map((p) => p.name))}>全选当前</a>
            {batchSel.length > 0 && <a onClick={() => setBatchSel([])}>清空</a>}
          </div>
          <div className="ph-batch-bar-actions">
            <Button size="small" onClick={exitBatchMode}>
              退出
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<RobotOutlined />}
              disabled={batchSel.length === 0}
              onClick={() => setBatchOpen(true)}
            >
              写指令
            </Button>
          </div>
        </div>
      )}

      {/* 新建飞书 PRD 关联：选择原型 + 粘贴链接 */}
      <Modal
        title="新建飞书 PRD 关联"
        open={prdAddOpen}
        onCancel={() => setPrdAddOpen(false)}
        onOk={handleAddPrd}
        okText="关联"
        cancelText="取消"
        confirmLoading={prdAddLoading}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ph-text-secondary)', marginBottom: 4 }}>关联到原型</div>
            <Select
              showSearch
              allowClear
              placeholder="选择要关联的原型（必填）"
              style={{ width: '100%' }}
              value={prdAddProto}
              onChange={(v) => setPrdAddProto(v)}
              optionFilterProp="label"
              options={byType('prototype').map((p) => ({
                value: p.name,
                label: p.title === p.name ? p.name : `${p.title} (${p.name})`,
              }))}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ph-text-secondary)', marginBottom: 4 }}>飞书 PRD 链接</div>
            <Input
              placeholder="https://xxx.feishu.cn/wiki/..."
              value={prdAddUrl}
              onChange={(e) => setPrdAddUrl(e.target.value)}
              onPressEnter={handleAddPrd}
            />
          </div>
        </div>
      </Modal>

      {/* 新建原型：模板创建 / 上传设计稿由 AI 生成（用户可自行选择，未装 CLI 时仍可模板创建） */}
      <CreatePrototypeModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreate={(name, title, options) => props.onCreate('prototype', name, title, options)}
        onCreated={(name) => setPendingProto(name)}
      />

      {/* 批量 AI 指令：对勾选的 N 个页面下一条统一指令 */}
      <BatchAiModal
        open={batchOpen}
        targets={batchTargets}
        onCancel={() => setBatchOpen(false)}
        onRemoveTarget={(name) => setBatchSel((prev) => prev.filter((n) => n !== name))}
        onCreated={(job: BatchJob) => {
          setBatchOpen(false);
          exitBatchMode();
          props.onOpenBatchPanel?.();
          void job;
        }}
      />
    </div>
  );
}
