import { useMemo, useState } from 'react';
import { Button, Dropdown, Empty, Input, Modal, Tabs, Tooltip, message } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  PlusOutlined,
  SkinOutlined,
} from '@ant-design/icons';
import type { EntryItem, EntryType } from '../types';

interface SidebarProps {
  entries: EntryItem[];
  selected: EntryItem | null;
  onSelect: (item: EntryItem) => void;
  onCreate: (type: EntryType, name: string, title: string) => Promise<void>;
  onRename: (item: EntryItem, newName: string) => Promise<void>;
  onDelete: (item: EntryItem) => Promise<void>;
}

const TYPE_ICON: Record<EntryType, React.ReactNode> = {
  prototype: <AppstoreOutlined />,
  component: <AppstoreOutlined style={{ color: '#722ed1' }} />,
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
}) {
  const { item, active } = props;

  const handleRename = () => {
    let value = item.name;
    Modal.confirm({
      title: '重命名',
      content: (
        <Input
          defaultValue={item.name}
          onChange={(e) => (value = e.target.value)}
          style={{ marginTop: 8 }}
        />
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: () => props.onRename(value.trim()),
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

  return (
    <div className={`ph-entry-item${active ? ' active' : ''}`} onClick={props.onSelect}>
      {TYPE_ICON[item.type]}
      <Tooltip title={item.name} placement="right">
        <span className="ph-entry-name">{item.title}</span>
      </Tooltip>
      <span className="ph-entry-actions" onClick={(e) => e.stopPropagation()}>
        <Dropdown
          menu={{
            items: [
              { key: 'rename', icon: <EditOutlined />, label: '重命名' },
              { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === 'rename') handleRename();
              if (key === 'delete') handleDelete();
            },
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<MoreOutlined />} />
        </Dropdown>
      </span>
    </div>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { entries, selected } = props;
  const [tab, setTab] = useState('prototype');
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return entries.filter((e) => !kw || e.name.toLowerCase().includes(kw) || e.title.toLowerCase().includes(kw));
  }, [entries, keyword]);

  const byType = (t: EntryType) => filtered.filter((e) => e.type === t);

  const handleCreate = (type: EntryType) => {
    let name = '';
    let title = '';
    Modal.confirm({
      title: `新建${type === 'prototype' ? '原型' : type === 'doc' ? '文档' : '数据表'}`,
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <Input placeholder="目录名（英文/中划线，如 order-list）" onChange={(e) => (name = e.target.value)} />
          <Input placeholder="显示标题（可选）" onChange={(e) => (title = e.target.value)} />
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
        />
      ))
    );

  return (
    <div className="ph-sidebar">
      <div className="ph-sidebar-header">
        <div className="ph-sidebar-title">
          <AppstoreOutlined style={{ color: '#1677ff' }} />
          Proto Hub
        </div>
      </div>
      <div style={{ padding: '8px 12px' }}>
        <Input.Search placeholder="搜索..." size="small" allowClear onChange={(e) => setKeyword(e.target.value)} />
      </div>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        size="small"
        centered
        items={[
          { key: 'prototype', label: '原型' },
          { key: 'doc', label: '文档' },
          { key: 'resource', label: '资源' },
        ]}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      />
      <div className="ph-sidebar-body">
        {tab === 'prototype' && (
          <>
            <Button block size="small" icon={<PlusOutlined />} style={{ marginBottom: 8 }} onClick={() => handleCreate('prototype')}>
              新建原型
            </Button>
            {renderList(byType('prototype'))}
          </>
        )}
        {tab === 'doc' && (
          <>
            <Button block size="small" icon={<PlusOutlined />} style={{ marginBottom: 8 }} onClick={() => handleCreate('doc')}>
              新建文档
            </Button>
            {renderList(byType('doc'))}
          </>
        )}
        {tab === 'resource' && (
          <>
            <div style={{ padding: '4px 8px', fontSize: 12, color: '#999' }}>组件</div>
            {renderList(byType('component'))}
            <div style={{ padding: '12px 8px 4px', fontSize: 12, color: '#999' }}>主题</div>
            {renderList(byType('theme'))}
            <div style={{ padding: '12px 8px 4px', fontSize: 12, color: '#999', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              数据表
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleCreate('table')} />
            </div>
            {renderList(byType('table'))}
          </>
        )}
      </div>
    </div>
  );
}
