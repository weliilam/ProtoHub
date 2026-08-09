import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Empty, Input, Modal, Select, Space, Tabs, Tag, Tooltip, message } from 'antd';
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
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SkinOutlined,
  UngroupOutlined,
} from '@ant-design/icons';
import type { EntryItem, EntryType, GroupConfig, PrdDoc, PrototypeInfo } from '../types';
import { api } from '../api';

interface SidebarProps {
  entries: EntryItem[];
  selected: EntryItem | null;
  onSelect: (item: EntryItem) => void;
  onCreate: (type: EntryType, name: string, title: string) => Promise<void>;
  onRename: (item: EntryItem, newName: string) => Promise<void>;
  onDelete: (item: EntryItem) => Promise<void>;
  onRefresh: () => void;
  onPrdPreview?: (doc: PrdDoc | null) => void;
  onOpenCmdk?: () => void;
}

const TYPE_ICON: Record<EntryType, React.ReactNode> = {
  prototype: <AppstoreOutlined />,
  component: <AppstoreOutlined style={{ color: 'var(--ph-accent-2)' }} />,
  doc: <FileTextOutlined />,
  theme: <SkinOutlined />,
  table: <DatabaseOutlined />,
};

function EntryRow(props: {
  item: EntryItem;
  active: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
  groups: GroupConfig[];
  onMoveGroup: (prototype: string, groupId?: string) => Promise<void>;
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
      className={`ph-entry-item${active ? ' active' : ''}${item.groupId ? '' : ' root-level'}`}
      onClick={props.onSelect}
    >
      {TYPE_ICON[item.type]}
      <Tooltip title={item.name} placement="right">
        <span className="ph-entry-name">{item.title}</span>
      </Tooltip>
      <span className="ph-entry-actions" onClick={(e) => e.stopPropagation()}>
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
  allGroups: GroupConfig[];
  isOpen: boolean;
  onToggle: () => void;
  /** 分组整体上移/下移 */
  index?: number;
  total?: number;
  onMoveGroupOrder?: (id: string, dir: -1 | 1) => void;
}) {
  const { group, items, selected, allGroups } = props;
  const [dropIndex, setDropIndex] = useState<number | null>(null);

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

  // ── 拖拽排序 ──
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/plain', items[idx].name);
    e.dataTransfer.effectAllowed = 'move';
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
  };

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault();
    setDropIndex(null);
    const fromName = e.dataTransfer.getData('text/plain');
    const fromIdx = items.findIndex((i) => i.name === fromName);
    if (fromIdx === -1 || fromIdx === toIdx || fromIdx + 1 === toIdx) return;
    const newOrder = [...items];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, moved);
    props.onReorder?.(group.id, newOrder.map((i) => i.name));
  };

  return (
    <div className="ph-folder-group">
      <div className="ph-folder-header" onClick={props.onToggle}>
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
            <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ph-sidebar-meta)', textAlign: 'center' }}>
              暂无原型，可将原型移入此分组
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.name}
                draggable
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
                />
              </div>
            ))
          )}
          {/* 末尾可放置位：拖到最后一个元素下方 */}
          {items.length > 0 && (
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
  const { entries, selected } = props;
  const [tab, setTab] = useState('prototype');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [groups, setGroups] = useState<GroupConfig[]>([]);
  const [openFolders, setOpenFoldersRaw] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('ph_open_folders');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const hadSavedState = useRef(localStorage.getItem('ph_open_folders') !== null);
  const createNameRef = useRef<Input>(null);

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
    let name = '';
    let title = '';
    // 由标题自动生成 kebab-case 目录名（仅保留英文/数字，中文标题走时间戳兜底，避免中文目录 404）
    const autoDirName = (t: string) => {
      const base = t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      return base || `proto-${Date.now().toString(36)}`;
    };
    // 标题失焦时，若目录名尚未填写则自动填入
    const applyAutoName = () => {
      if (type !== 'prototype') return;
      const el = createNameRef.current?.input as HTMLInputElement | undefined;
      if (el && !el.value.trim() && title.trim()) {
        const n = autoDirName(title);
        el.value = n;
        name = n;
      }
    };
    Modal.confirm({
      title: `新建${type === 'prototype' ? '原型' : type === 'doc' ? '文档' : '数据表'}`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Input
            placeholder="显示标题（如 B2B 订单列表）"
            onChange={(e) => (title = e.target.value)}
            onBlur={applyAutoName}
          />
          {type === 'prototype' ? (
            <Input
              ref={createNameRef}
              placeholder="目录名（根据标题自动生成，可修改）"
              onChange={(e) => (name = e.target.value)}
            />
          ) : (
            <Input placeholder="目录名（英文/中划线，如 order-list）" onChange={(e) => (name = e.target.value)} />
          )}
        </div>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        // 直接点创建未触发失焦时，兜底自动生成
        if (type === 'prototype' && !name.trim() && title.trim()) {
          name = autoDirName(title);
        }
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
    const orderedGroups = groups; // 显示全部分组，包括空分组
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
            allGroups={groups}
            index={idx}
            total={orderedGroups.length}
            onMoveGroupOrder={handleMoveGroupOrder}
            isOpen={openFolders.has(g.id)}
            onToggle={() =>
              setOpenFolders((prev) => {
                const next = new Set(prev);
                next.has(g.id) ? next.delete(g.id) : next.add(g.id);
                return next;
              })
            }
          />
        ))}
        {ungrouped.length > 0 && (
          <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--ph-sidebar-desc)', marginTop: 8, fontWeight: 600 }}>
            未分组 ({ungrouped.length})
          </div>
        )}
        {ungrouped.map((item) => (
          <EntryRow
            key={`ug-${item.name}`}
            item={item}
            active={selected?.type === item.type && selected?.name === item.name}
            onSelect={() => props.onSelect(item)}
            onRename={(newName) => props.onRename(item, newName)}
            onDelete={() => props.onDelete(item)}
            groups={groups}
            onMoveGroup={handleMoveGroup}
          />
        ))}
      </>
    );
  };

  return (
    <div className="ph-sidebar">
      <div className="ph-sidebar-header">
        <div className="ph-sidebar-title">
          <div className="ph-logo-mark">
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
          <span className="ph-logo-text">Hatch</span>
        </div>
      </div>
      <div style={{ padding: '8px 12px 0' }}>
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
    </div>
  );
}
