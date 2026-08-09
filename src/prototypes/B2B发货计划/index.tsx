import React, { useState } from 'react';
import {
  ClientToolbar,
  ClientFilterPanel,
  ClientTable,
  ClientPager,
} from '/admin/src/components/client';
import type { GridColumn } from '/admin/src/components/client';

interface DeliveryRow {
  id: string;
  no: number;
  planCode: string;
  deliveryPlan: string;
  transferNo: string;
  status: string;
  deliveryDate: string;
  planType: string;
  bizMode: string;
  serviceProvider: string;
  flight: string;
  headTransport: string;
  originCode: string;
  originName: string;
}

const STATUS_MAP: Record<string, string> = {
  '装车中': '装车中',
  '已发货': '已发货',
};

const INITIAL_ROWS: DeliveryRow[] = [
  { id: '1', no: 1, planCode: 'KYDL260803-0001', deliveryPlan: '260803-KYDL-TK-1-0001', transferNo: '', status: '装车中', deliveryDate: '2026-08-04', planType: '', bizMode: '空运', serviceProvider: '', flight: '', headTransport: '空运', originCode: 'CNTN', originName: '杭州萧山国际机' },
  { id: '2', no: 2, planCode: 'CNHYJH260803-0001', deliveryPlan: '260803-C0162-CNYTN-USLSA-0001', transferNo: 'TTNCN0005-2026080300006', status: '已发货', deliveryDate: '2026-08-04', planType: '', bizMode: '海运拼柜', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'CNTN', originName: '杭州萧山国际机' },
  { id: '3', no: 3, planCode: 'HKJH260803-0001', deliveryPlan: '260803-CA0269-HKG-TK-1-0001', transferNo: 'TTNCN0005-2026080400003', status: '装车中', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HKG', originName: '香港国际机场' },
  { id: '4', no: 4, planCode: 'HKJH260803-0002', deliveryPlan: '260803-CA0269-HKG-TK-1-0002', transferNo: '', status: '装车中', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: '', flight: '', headTransport: '空运', originCode: 'HKG', originName: '香港国际机场' },
  { id: '5', no: 5, planCode: 'HKJH260803-0003', deliveryPlan: '260803-CA0269-HKG-TK-1-0003', transferNo: 'TTNCN0005-2026080300018', status: '已发货', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HKG', originName: '杭州萧山国际机' },
  { id: '6', no: 6, planCode: 'CNJH260803-0008', deliveryPlan: '260803-CA0269-HKG-TK-1-0006', transferNo: 'TTNCN0005-2026080300017', status: '已发货', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HGH', originName: '杭州萧山国际机' },
  { id: '7', no: 7, planCode: 'CNJH260803-0003', deliveryPlan: '260803-CA0269-HKG-TK-1-0005', transferNo: 'TTNCN0005-2026080400007', status: '装车中', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HGH', originName: '杭州萧山国际机' },
  { id: '8', no: 8, planCode: 'HKJH260803-0006', deliveryPlan: '260803-CA0269-HKG-TK-1-0005', transferNo: '', status: '装车中', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HKG', originName: '香港国际机场' },
  { id: '9', no: 9, planCode: 'KYDL260803-0002', deliveryPlan: '260803-KYDL-TK-3-0002', transferNo: '', status: '装车中', deliveryDate: '2026-08-04', planType: '', bizMode: '空运代理', serviceProvider: '', flight: '', headTransport: '空运', originCode: '', originName: '' },
  { id: '10', no: 10, planCode: 'CNHYJH260803-0002', deliveryPlan: '260803-C0164-CNSZX-NLMS-0001', transferNo: '', status: '已发货', deliveryDate: '2026-08-04', planType: '', bizMode: '海运拼柜', serviceProvider: '', flight: '', headTransport: '空运', originCode: 'CNSZX', originName: '香港国际机场' },
  { id: '11', no: 11, planCode: 'HKJH260803-0018', deliveryPlan: '260803-CA0269-HKG-TK-1-0011', transferNo: 'TTNCN0005-2026080300033', status: '已发货', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '统配', headTransport: '空运', originCode: 'HKG', originName: '香港国际机场' },
  { id: '12', no: 12, planCode: 'HKJH260803-0019', deliveryPlan: '260803-CA0269-HKG-TK-1-0018', transferNo: 'TTNCN0005-2026080300034', status: '已发货', deliveryDate: '2026-08-03', planType: '', bizMode: '海运拼柜', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '统配', headTransport: '空运', originCode: 'CNSZX', originName: '香港国际机场' },
  { id: '13', no: 13, planCode: 'CNHYJH260803-0003', deliveryPlan: '260803-C0162-CNSZX-NLMS-0001', transferNo: 'TTNCN0005-2026080400008', status: '已发货', deliveryDate: '2026-08-04', planType: '', bizMode: '海运拼柜', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '统配', headTransport: '空运', originCode: 'CNSZX', originName: '香港国际机场' },
  { id: '14', no: 14, planCode: 'HKJH260803-0004', deliveryPlan: '260803-CA0269-HKG-TK-1-0004', transferNo: 'TTNCN0005-2026080400006', status: '装车中', deliveryDate: '2026-08-03', planType: '', bizMode: '空运', serviceProvider: 'CA0269-(勿动)皓悦（厦门）航空运输有限公司', flight: '香港航空', headTransport: '空运', originCode: 'HKG', originName: '香港国际机场' },
];

export default function B2BDeliveryPlan() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('plan');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const pageRows = INITIAL_ROWS.slice((page - 1) * pageSize, page * pageSize);

  const toolbarItems = [
    {
      key: 'planDetail',
      label: '计划详情',
      icon: '/icons/toolbar/btn_View_Image.png',
      onClick: () => setActiveTab('plan'),
    },
    {
      key: 'allocation',
      label: '配货明细',
      icon: '/icons/toolbar/btn_View_Image.png',
      separatorBefore: true,
      onClick: () => setActiveTab('allocation'),
    },
    {
      key: 'log',
      label: '日志',
      icon: '/icons/toolbar/btn_LogInfo_Image.png',
      separatorBefore: true,
      onClick: () => setActiveTab('log'),
    },
    {
      key: 'print',
      label: '打印标签',
      icon: '/icons/toolbar/btnExport_Image.png',
      separatorBefore: true,
    },
    {
      key: 'report',
      label: '上报配货异常',
      icon: '/icons/toolbar/btn_Add_Image.png',
      separatorBefore: true,
    },
    {
      key: 'complete',
      label: '完成配货',
      icon: '/icons/toolbar/btn_Enable_Image.png',
      separatorBefore: true,
    },
    {
      key: 'revoke',
      label: '撤销完成',
      icon: '/icons/toolbar/btnCancelAudit_Image.png',
      separatorBefore: true,
    },
    {
      key: 'void',
      label: '确认作废',
      icon: '/icons/toolbar/btn_Disabled_Image.png',
      separatorBefore: true,
    },
  ];

  // 基础筛选项：只有发货计划 + 查询按钮
  const baseFilterFields = [
    { key: 'planNo', label: '发货计划', width: 150 },
  ];

  // 更多查询条件下的额外筛选项
  const moreFilterFields = [
    { key: 'transferNo', label: '中转单号', width: 150 },
    { key: 'status', label: '配货状态', width: 143, type: 'select' as const, options: [
      { value: '', label: '全部' },
      { value: '装车中', label: '装车中' },
      { value: '已发货', label: '已发货' },
    ] },
    { key: 'priority', label: '配货优先级', width: 143, type: 'select' as const, options: [
      { value: '', label: '全部' },
      { value: 'high', label: '高' },
      { value: 'normal', label: '普通' },
      { value: 'low', label: '低' },
    ] },
    { key: 'bizMode', label: '业务模式', width: 143, type: 'select' as const, options: [
      { value: '', label: '全部' },
      { value: '空运', label: '空运' },
      { value: '海运拼柜', label: '海运拼柜' },
      { value: '空运代理', label: '空运代理' },
    ] },
    { key: 'port', label: '口岸', width: 150 },
    { key: 'consignee', label: '配货人', width: 150 },
  ];

  const columns: GridColumn<DeliveryRow>[] = [
    { key: 'no', title: 'NO.', width: 40, align: 'center' },
    { key: 'planCode', title: '计划编号', width: 140 },
    { key: 'deliveryPlan', title: '发货计划', width: 220 },
    { key: 'transferNo', title: '中转单号', width: 180 },
    { key: 'status', title: '配货状态', width: 80, align: 'center' },
    { key: 'deliveryDate', title: '发货日期', width: 100, align: 'center' },
    { key: 'planType', title: '计划类型', width: 80, align: 'center' },
    { key: 'bizMode', title: '业务模式', width: 90, align: 'center' },
    { key: 'serviceProvider', title: '服务商', width: 260 },
    { key: 'flight', title: '航司', width: 80, align: 'center' },
    { key: 'headTransport', title: '头程运输', width: 80, align: 'center' },
    { key: 'originCode', title: '始发地代码', width: 90, align: 'center' },
    { key: 'originName', title: '始发地名称', width: 120 },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 第一行：发货计划 + 查询按钮 + 更多查询条件 */}
      <ClientFilterPanel
        fields={baseFilterFields}
        values={filters}
        onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
        onSearch={() => {
          setPage(1);
        }}
        onReset={() => {
          setFilters({});
          setPage(1);
        }}
        searchIcon="/icons/toolbar/btnFind_Image.png"
        extraButtons={[
          { key: 'more', label: '更多查询条件', onClick: () => setShowMoreFilters((prev) => !prev) },
          { key: 'clear', label: '清空查询条件', onClick: () => setFilters({}) },
        ]}
      />

      {/* 更多查询条件下的额外筛选项 */}
      {showMoreFilters && (
        <div className="client-filter is-compact">
          <div className="client-filter-row">
            {moreFilterFields.map((f) => {
              const value = filters[f.key] ?? '';
              if (f.type === 'select') {
                return (
                  <div className="client-filter-item" key={f.key}>
                    <label>{f.label}</label>
                    <select
                      className="client-select"
                      style={f.width ? { width: f.width } : undefined}
                      value={value}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    >
                      {(f.options ?? []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return (
                <div className="client-filter-item" key={f.key}>
                  <label>{f.label}</label>
                  <input
                    className="client-input"
                    style={f.width ? { width: f.width } : undefined}
                    value={value}
                    placeholder=""
                    onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 列表上方的操作按钮 */}
      <div style={{ marginTop: 4 }}>
        <ClientToolbar items={toolbarItems} />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <ClientTable
          columns={columns}
          dataSource={pageRows}
          rowKey={(r) => r.id}
          selectedKey={selected}
          onSelectRow={(r) => setSelected(r.id)}
          checkedKeys={checked}
          onCheck={(keys) => setChecked(keys)}
          centerKeys={['no', 'status', 'deliveryDate', 'planType', 'bizMode', 'flight', 'headTransport', 'originCode']}
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
    </div>
  );
}
