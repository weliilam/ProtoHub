import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Popconfirm, Space, Spin, Table, message } from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '../api';

type Row = Record<string, any>;

export default function DataTableEditor({ name }: { name: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .readTable(name)
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [name]);

  const columns = useMemo(() => {
    const keys: string[] = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => !keys.includes(k) && keys.push(k)));
    return keys.filter((k) => k !== 'key');
  }, [rows]);

  const updateCell = (rowIdx: number, col: string, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
  };

  const addRow = () => {
    const newRow: Row = { key: `row-${Date.now()}` };
    columns.forEach((c) => (newRow[c] = ''));
    setRows((prev) => [...prev, newRow]);
  };

  const removeRow = (rowIdx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  };

  const addColumn = () => {
    const colName = window.prompt('新列名：');
    if (!colName?.trim()) return;
    const col = colName.trim();
    if (columns.includes(col)) {
      message.warning('列已存在');
      return;
    }
    setRows((prev) => {
      const base = prev.length > 0 ? prev : [{ key: `row-${Date.now()}` }];
      return base.map((r) => ({ ...r, [col]: '' }));
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveTable(name, rows);
      message.success('已保存');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ margin: '80px auto' }} />;

  return (
    <>
      <div className="ph-toolbar">
        <span className="ph-toolbar-title">数据表：{name}.json（{rows.length} 行）</span>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addRow}>行</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={addColumn}>列</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存</Button>
        </Space>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: 16 }}>
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={rows.map((r, i) => ({ ...r, key: r.key ?? i }))}
          columns={[
            ...columns.map((col) => ({
              title: col,
              dataIndex: col,
              render: (v: any, _r: Row, idx: number) => (
                <Input
                  size="small"
                  variant="borderless"
                  value={v === undefined || v === null ? '' : String(v)}
                  onChange={(e) => updateCell(idx, col, e.target.value)}
                />
              ),
            })),
            {
              title: '',
              width: 48,
              render: (_v: any, _r: Row, idx: number) => (
                <Popconfirm title="删除该行？" okText="删除" cancelText="取消" onConfirm={() => removeRow(idx)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
