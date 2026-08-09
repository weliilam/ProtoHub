import React, { useState } from 'react';
import {
  ClientToolbar,
  ClientFilterPanel,
  ClientTable,
  ClientPager,
  ClientWindow,
} from '/admin/src/components/client';
import type { GridColumn } from '/admin/src/components/client';

interface ProductRow {
  id: string;
  code: string;
  name: string;
  group: string;
  status: string;
  audit: string;
}

const INITIAL_ROWS: ProductRow[] = Array.from({ length: 23 }, (_, i) => ({
  id: String(i + 1),
  code: `P${String(1001 + i)}`,
  name: `示例产品 ${i + 1}`,
  group: i % 2 === 0 ? '标准产品组' : '定制产品组',
  status: i % 3 === 0 ? '停用' : '启用',
  audit: i % 4 === 0 ? '已上市' : '待审核',
}));

/**
 * 客户端原型模板 —— 复制本目录到 src/prototypes/<你的原型名>/ 后改写。
 * proto.config.json 已声明 "ui": "client"，mount.tsx 会自动套用 WinForms 客户端视觉。
 */
export default function ClientPrototypeTemplate() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const pageRows = INITIAL_ROWS.slice((page - 1) * pageSize, page * pageSize);

  const toolbarItems = [
    {
      key: 'view',
      label: '查看',
      icon: '/icons/toolbar/btn_View_Image.png',
      onClick: () => setDetailOpen(true),
    },
    {
      key: 'add',
      label: '新增审核',
      icon: '/icons/toolbar/btn_Add_Image.png',
      separatorBefore: true,
    },
    {
      key: 'modify',
      label: '修改审核',
      icon: '/icons/toolbar/btn_Modify_Image.png',
    },
    {
      key: 'submit',
      label: '提交审核',
      icon: '/icons/toolbar/btnSubmitAudit_Image.png',
      separatorBefore: true,
    },
    {
      key: 'cancel',
      label: '撤销审核',
      icon: '/icons/toolbar/btnCancelAudit_Image.png',
    },
    {
      key: 'enable',
      label: '上市',
      icon: '/icons/toolbar/btn_Enable_Image.png',
      separatorBefore: true,
    },
    {
      key: 'disable',
      label: '退市',
      icon: '/icons/toolbar/btn_Disabled_Image.png',
    },
    {
      key: 'export',
      label: '导出',
      icon: '/icons/toolbar/btnExport_Image.png',
      separatorBefore: true,
    },
  ];

  const filterFields = [
    { key: 'code', label: '产品代码', width: 150 },
    { key: 'name', label: '产品名称', width: 150 },
    { key: 'group', label: '产品组', width: 143, type: 'select' as const, options: [
      { value: '', label: '' },
      { value: '标准产品组', label: '标准产品组' },
      { value: '定制产品组', label: '定制产品组' },
    ] },
    {
      key: 'status',
      label: '状态',
      width: 143,
      type: 'select' as const,
      options: [
        { value: '', label: '' },
        { value: '启用', label: '启用' },
        { value: '停用', label: '停用' },
      ],
    },
    {
      key: 'audit',
      label: '审核状态',
      width: 143,
      type: 'select' as const,
      options: [
        { value: '', label: '' },
        { value: '已上市', label: '已上市' },
        { value: '待审核', label: '待审核' },
      ],
    },
  ];

  const columns: GridColumn<ProductRow>[] = [
    { key: 'code', title: '产品代码', width: 110 },
    { key: 'name', title: '产品名称', width: 160 },
    { key: 'group', title: '产品组', width: 130 },
    { key: 'status', title: '状态', width: 80, align: 'center' },
    { key: 'audit', title: '审核状态', width: 100, align: 'center' },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ClientToolbar items={toolbarItems} />
      <ClientFilterPanel
        fields={filterFields}
        values={filters}
        onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        onSearch={() => {
          setPage(1);
        }}
        onReset={() => {
          setFilters({});
          setPage(1);
        }}
        searchIcon="/icons/toolbar/btn_Search_Image.png"
      />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ClientTable
          columns={columns}
          dataSource={pageRows}
          rowKey={(r) => r.id}
          selectedKey={selected}
          onSelectRow={(r) => setSelected(r.id)}
          checkedKeys={checked}
          onCheck={(keys) => setChecked(keys)}
          centerKeys={['status', 'audit']}
        />
      </div>
      <ClientPager
        total={INITIAL_ROWS.length}
        page={page}
        pageSize={pageSize}
        onChange={(p, ps) => {
          setPage(p);
          setPageSize(ps);
        }}
      />
      <ClientWindow
        open={detailOpen}
        title="产品详情"
        icon="/icons/toolbar/btn_View_Image.png"
        width={640}
        height={420}
        onClose={() => setDetailOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="client-btn"
              onClick={() => setDetailOpen(false)}
            >
              关 闭
            </button>
          </>
        }
      >
        <div style={{ padding: 16 }}>
          <p>此处放置两列表单（ClientForm）或详细内容。</p>
          <p>选中行：{selected ? INITIAL_ROWS.find((r) => r.id === selected)?.name : '未选择'}</p>
        </div>
      </ClientWindow>
    </div>
  );
}
