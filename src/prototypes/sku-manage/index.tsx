/**
 * @name SKU管理
 * @mode axure
 */

import './style.css';

import React, { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Input, Select, Button, Table, Tag, Modal, Space, DatePicker, message, Form,
  Row, Col, Upload, Timeline,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined,
  ImportOutlined, FileTextOutlined, DownloadOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
const { RangePicker } = DatePicker;
const { Dragger } = Upload;

// ========================= 类型 =========================

interface SkuRecord {
  Id: number;
  Sku: string;
  ProductCode: string;
  ProductName: string;
  CustomerCode: string;
  CountryCode: string;
  CountryName: string;
  CreateBy: string;
  CreateDate: string;
  UpdateBy: string;
  UpdateDate: string;
  Remark: string;
}

interface SkuLog {
  key: string;
  time: string;
  operator: string;
  action: string;
  content: string;
}

interface EditFormHandle {
  validateFields: () => Promise<any>;
}

// 权限（原型演示默认拥有）
const skumgEdit = true; // 是否可新增/编辑/删除
const canList = true;   // 是否可查看列表（对应权限 oms-skumgtlist）

// ========================= 选项 =========================

const PRODUCT_OPTIONS = [
  { value: 'US-HK-NY', label: '美国海卡(经济)-纽约' },
  { value: 'US-AIR-X', label: '美国空派(特惠普货)-X' },
  { value: 'US-AIR-STD', label: '美国空派(标快普货)' },
  { value: 'US-MS', label: '美森云速达' },
  { value: 'US-HP-CLX', label: '美国海派(特快)-CLX' },
  { value: 'US-HK-LA', label: '美国海卡(经济)-洛杉矶' },
  { value: 'B2B-AIR', label: 'B2B-TEST-空运' },
];

const CUSTOMER_OPTIONS = [
  { value: 'BCNHC40325', label: 'BCNHC40325' },
  { value: 'BCN0C09842', label: 'BCN0C09842' },
  { value: 'F00ITDDT08', label: 'F00ITDDT08' },
  { value: 'BCNHC21498', label: 'BCNHC21498' },
  { value: 'BCN0C03286', label: 'BCN0C03286' },
];

const COUNTRY_OPTIONS = [
  { value: 'US', label: '美国' },
  { value: 'DE', label: '德国' },
  { value: 'GB', label: '英国' },
  { value: 'JP', label: '日本' },
  { value: 'FR', label: '法国' },
  { value: 'CA', label: '加拿大' },
];

const productNameOf = (code?: string) => PRODUCT_OPTIONS.find((p) => p.value === code)?.label || code || '';
const countryNameOf = (code?: string) => COUNTRY_OPTIONS.find((c) => c.value === code)?.label || code || '';

// ========================= Mock 数据 =========================

let SEQ = 100;
const nextId = () => ++SEQ;

const MOCK_DATA: SkuRecord[] = [
  { Id: 1, Sku: 'SKU-A1001', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '卓运康', CreateDate: '2026-07-01 09:12:33', UpdateBy: '卓运康', UpdateDate: '2026-07-01 09:12:33', Remark: '常规普货，走纽约仓' },
  { Id: 2, Sku: 'SKU-A1002', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'DE', CountryName: '德国', CreateBy: '陈小丽', CreateDate: '2026-07-01 10:05:21', UpdateBy: '陈小丽', UpdateDate: '2026-07-02 11:30:00', Remark: '' },
  { Id: 3, Sku: 'SKU-B2001', ProductCode: 'US-AIR-STD', ProductName: '美国空派(标快普货)', CustomerCode: 'F00ITDDT08', CountryCode: 'GB', CountryName: '英国', CreateBy: '马武林', CreateDate: '2026-07-01 14:22:10', UpdateBy: '马武林', UpdateDate: '2026-07-01 14:22:10', Remark: '加急' },
  { Id: 4, Sku: 'SKU-C3001', ProductCode: 'US-MS', ProductName: '美森云速达', CustomerCode: 'BCNHC21498', CountryCode: 'US', CountryName: '美国', CreateBy: '韩利兵', CreateDate: '2026-07-02 08:40:00', UpdateBy: '韩利兵', UpdateDate: '2026-07-03 09:00:00', Remark: '美森快船' },
  { Id: 5, Sku: 'SKU-C3002', ProductCode: 'US-HP-CLX', ProductName: '美国海派(特快)-CLX', CustomerCode: 'BCN0C03286', CountryCode: 'CA', CountryName: '加拿大', CreateBy: '龚晓辉', CreateDate: '2026-07-02 13:15:44', UpdateBy: '龚晓辉', UpdateDate: '2026-07-02 13:15:44', Remark: '' },
  { Id: 6, Sku: 'SKU-D4001', ProductCode: 'US-HK-LA', ProductName: '美国海卡(经济)-洛杉矶', CustomerCode: 'BCNHC40325', CountryCode: 'JP', CountryName: '日本', CreateBy: '卓运康', CreateDate: '2026-07-02 16:08:55', UpdateBy: '卓运康', UpdateDate: '2026-07-04 10:20:00', Remark: '走洛杉矶港' },
  { Id: 7, Sku: 'SKU-D4002', ProductCode: 'B2B-AIR', ProductName: 'B2B-TEST-空运', CustomerCode: 'BCN0C09842', CountryCode: 'FR', CountryName: '法国', CreateBy: '徐铭辛', CreateDate: '2026-07-03 09:00:11', UpdateBy: '徐铭辛', UpdateDate: '2026-07-03 09:00:11', Remark: '测试用' },
  { Id: 8, Sku: 'SKU-A1003', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC21498', CountryCode: 'US', CountryName: '美国', CreateBy: '韩利兵', CreateDate: '2026-07-03 11:30:00', UpdateBy: '韩利兵', UpdateDate: '2026-07-03 11:30:00', Remark: '' },
  { Id: 9, Sku: 'SKU-B2002', ProductCode: 'US-AIR-STD', ProductName: '美国空派(标快普货)', CustomerCode: 'F00ITDDT08', CountryCode: 'DE', CountryName: '德国', CreateBy: '马武林', CreateDate: '2026-07-04 08:20:30', UpdateBy: '陈小丽', UpdateDate: '2026-07-05 14:10:00', Remark: '需配合清关资料' },
  { Id: 10, Sku: 'SKU-E5001', ProductCode: 'US-HP-CLX', ProductName: '美国海派(特快)-CLX', CustomerCode: 'BCN0C03286', CountryCode: 'GB', CountryName: '英国', CreateBy: '龚晓辉', CreateDate: '2026-07-04 15:45:09', UpdateBy: '龚晓辉', UpdateDate: '2026-07-04 15:45:09', Remark: '' },
  { Id: 11, Sku: 'SKU-F6001', ProductCode: 'US-MS', ProductName: '美森云速达', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '卓运康', CreateDate: '2026-07-05 10:00:00', UpdateBy: '卓运康', UpdateDate: '2026-07-05 10:00:00', Remark: '大客户专属' },
  { Id: 12, Sku: 'SKU-F6002', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'JP', CountryName: '日本', CreateBy: '徐铭辛', CreateDate: '2026-07-05 17:30:22', UpdateBy: '徐铭辛', UpdateDate: '2026-07-06 09:15:00', Remark: '' },
];

const MOCK_LOG: SkuLog[] = [
  { key: '1', time: '2026-07-06 09:15:00', operator: '徐铭辛', action: '编辑', content: 'SKU-F6002 修改目的国家为 JP' },
  { key: '2', time: '2026-07-05 10:00:00', operator: '卓运康', action: '新增', content: 'SKU-F6001 新增成功（客户 BCNHC40325）' },
  { key: '3', time: '2026-07-04 15:45:09', operator: '龚晓辉', action: '新增', content: 'SKU-E5001 新增成功（客户 BCN0C03286）' },
  { key: '4', time: '2026-07-03 11:30:00', operator: '韩利兵', action: '新增', content: 'SKU-A1003 新增成功（客户 BCNHC21498）' },
  { key: '5', time: '2026-07-02 13:15:44', operator: '龚晓辉', action: '删除', content: '删除 SKU-C9999（客户反馈配置错误）' },
];

// ========================= 新增/编辑表单子组件 =========================

const EditForm = forwardRef<EditFormHandle, { record: SkuRecord | null }>(({ record }, ref) => {
  const [form] = Form.useForm();

  useImperativeHandle(ref, () => ({
    validateFields: () => form.validateFields(),
  }));

  useEffect(() => {
    if (record) {
      form.setFieldsValue({
        Sku: record.Sku,
        ProductCode: record.ProductCode,
        CustomerCode: record.CustomerCode,
        CountryCode: record.CountryCode,
        Remark: record.Remark,
      });
    } else {
      form.resetFields();
    }
  }, [record, form]);

  return (
    <Form form={form} layout="vertical" className="sku-edit-form">
      <Row gutter={20}>
        <Col span={12}>
          <Form.Item name="Sku" label="SKU" rules={[{ required: true, message: '请输入 SKU' }]}>
            <Input maxLength={50} showCount allowClear placeholder="请输入 SKU" disabled={!!record} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="ProductCode" label="销售产品" rules={[{ required: true, message: '请选择销售产品' }]}>
            <Select placeholder="请选择销售产品" showSearch options={PRODUCT_OPTIONS} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="CustomerCode" label="客户代码" rules={[{ required: true, message: '请选择客户代码' }]}>
            <Select placeholder="请选择客户代码" showSearch options={CUSTOMER_OPTIONS} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="CountryCode" label="目的国家" rules={[{ required: true, message: '请选择目的国家' }]}>
            <Select placeholder="请选择目的国家" showSearch options={COUNTRY_OPTIONS} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="Remark" label="备注">
            <Input.TextArea rows={4} maxLength={200} showCount placeholder="请输入备注" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
});
EditForm.displayName = 'EditForm';

// ========================= 主组件 =========================

const SkuManage = () => {
  // ---------- 列表数据 ----------
  const [data, setData] = useState<SkuRecord[]>(MOCK_DATA);

  // ---------- 搜索 ----------
  const [searchForm] = Form.useForm();
  const [filters, setFilters] = useState({
    skus: '' as string,
    productCode: undefined as string | undefined,
    customerCode: undefined as string | undefined,
    countryCode: undefined as string | undefined,
    dateRange: undefined as [string, string] | undefined,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // ---------- 新增/编辑 ----------
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<SkuRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editFormRef = useRef<EditFormHandle | null>(null);

  // ---------- 日志 ----------
  const [logOpen, setLogOpen] = useState(false);

  // ---------- 批量导入 ----------
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<SkuRecord[]>([]);
  const [previewDone, setPreviewDone] = useState(false);

  // ---------- 搜索提交 ----------
  const handleSearch = useCallback((values: any) => {
    const skus = (values.skus || '')
      .split(/[\s,，]+/).map((s: string) => s.trim()).filter(Boolean);
    setFilters({
      skus: skus.join(','),
      productCode: values.productCode,
      customerCode: values.customerCode,
      countryCode: values.countryCode,
      dateRange: values.dateRange
        ? [values.dateRange[0]?.format('YYYY-MM-DD HH:mm:ss'), values.dateRange[1]?.format('YYYY-MM-DD HH:mm:ss')]
        : undefined,
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ skus: '', productCode: undefined, customerCode: undefined, countryCode: undefined, dateRange: undefined });
    searchForm.resetFields();
  }, [searchForm]);

  const filteredData = useMemo(() => data.filter((r) => {
    if (filters.skus) {
      const list = filters.skus.split(',');
      if (!list.some((s) => r.Sku.toLowerCase().includes(s.toLowerCase()))) return false;
    }
    if (filters.productCode && r.ProductCode !== filters.productCode) return false;
    if (filters.customerCode && r.CustomerCode !== filters.customerCode) return false;
    if (filters.countryCode && r.CountryCode !== filters.countryCode) return false;
    if (filters.dateRange) {
      const t = r.CreateDate;
      if (t < filters.dateRange[0] || t > filters.dateRange[1]) return false;
    }
    return true;
  }), [data, filters]);

  // ---------- 新增/编辑 ----------
  const openAdd = useCallback(() => {
    setEditRecord(null);
    setEditOpen(true);
  }, []);

  const openEdit = useCallback((record: SkuRecord) => {
    setEditRecord(record);
    setEditOpen(true);
  }, []);

  const handleEditOk = useCallback(() => {
    const formEl = editFormRef.current;
    if (!formEl) return;
    formEl.validateFields().then((vals: any) => {
      setSubmitting(true);
      setTimeout(() => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        if (editRecord) {
          setData((prev) => prev.map((d) => (d.Id === editRecord.Id ? {
            ...d,
            Sku: vals.Sku,
            ProductCode: vals.ProductCode,
            ProductName: productNameOf(vals.ProductCode),
            CustomerCode: vals.CustomerCode,
            CountryCode: vals.CountryCode,
            CountryName: countryNameOf(vals.CountryCode),
            Remark: vals.Remark || '',
            UpdateBy: '当前用户',
            UpdateDate: now,
          } : d)));
          message.success('SKU 修改成功（模拟）');
        } else {
          const rec: SkuRecord = {
            Id: nextId(),
            Sku: vals.Sku,
            ProductCode: vals.ProductCode,
            ProductName: productNameOf(vals.ProductCode),
            CustomerCode: vals.CustomerCode,
            CountryCode: vals.CountryCode,
            CountryName: countryNameOf(vals.CountryCode),
            Remark: vals.Remark || '',
            CreateBy: '当前用户',
            CreateDate: now,
            UpdateBy: '当前用户',
            UpdateDate: now,
          };
          setData((prev) => [rec, ...prev]);
          message.success('SKU 新增成功（模拟）');
        }
        setSubmitting(false);
        setEditOpen(false);
      }, 400);
    }).catch(() => { /* 校验失败 */ });
  }, [editRecord]);

  // ---------- 删除 ----------
  const handleDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要删除的 SKU'); return; }
    Modal.confirm({
      title: '确认删除',
      content: `确定删除勾选的 ${selectedRowKeys.length} 个 SKU 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        setData((prev) => prev.filter((d) => !selectedRowKeys.includes(d.Id)));
        message.success(`已删除 ${selectedRowKeys.length} 个 SKU（模拟）`);
        setSelectedRowKeys([]);
      },
    });
  }, [selectedRowKeys]);

  // ---------- 批量导入 ----------
  const openImport = useCallback(() => {
    setImportFile(null);
    setPreviewRows([]);
    setPreviewDone(false);
    setImportOpen(true);
  }, []);

  const handlePreview = useCallback(() => {
    if (!importFile) { message.warning('请先选择导入文件'); return; }
    setPreviewDone(false);
    setTimeout(() => {
      const mock: SkuRecord[] = [
        { Id: nextId(), Sku: 'SKU-IMP01', ProductCode: 'US-HK-NY', ProductName: '美国海卡(经济)-纽约', CustomerCode: 'BCNHC40325', CountryCode: 'US', CountryName: '美国', CreateBy: '导入', CreateDate: '', UpdateBy: '', UpdateDate: '', Remark: '来自文件' },
        { Id: nextId(), Sku: 'SKU-IMP02', ProductCode: 'US-AIR-X', ProductName: '美国空派(特惠普货)-X', CustomerCode: 'BCN0C09842', CountryCode: 'DE', CountryName: '德国', CreateBy: '导入', CreateDate: '', UpdateBy: '', UpdateDate: '', Remark: '来自文件' },
      ];
      setPreviewRows(mock);
      setPreviewDone(true);
      message.success('预览完成（模拟）');
    }, 400);
  }, [importFile]);

  const handleImportConfirm = useCallback(() => {
    if (!previewDone) { message.warning('请先进行预览'); return; }
    setTimeout(() => {
      setData((prev) => [...previewRows, ...prev]);
      message.success(`已导入 ${previewRows.length} 条 SKU 配置（模拟）`);
      setImportOpen(false);
    }, 300);
  }, [previewDone, previewRows]);

  // ---------- 表格列 ----------
  const columns: ColumnsType<SkuRecord> = [
    { title: '序号', width: 60, align: 'center', fixed: 'left', render: (_: any, __: SkuRecord, idx: number) => idx + 1 },
    { title: 'SKU', dataIndex: 'Sku', key: 'Sku', width: 120, sorter: (a, b) => a.Sku.localeCompare(b.Sku), render: (v) => <span className="sku-mono">{v}</span> },
    { title: '销售产品代码', dataIndex: 'ProductCode', key: 'ProductCode', width: 140, sorter: (a, b) => a.ProductCode.localeCompare(b.ProductCode) },
    { title: '销售产品名称', dataIndex: 'ProductName', key: 'ProductName', width: 180, ellipsis: true, sorter: (a, b) => a.ProductName.localeCompare(b.ProductName) },
    { title: '客户代码', dataIndex: 'CustomerCode', key: 'CustomerCode', width: 140, sorter: (a, b) => a.CustomerCode.localeCompare(b.CustomerCode), render: (v) => <span className="sku-mono">{v}</span> },
    { title: '目的国家简码', dataIndex: 'CountryCode', key: 'CountryCode', width: 120, sorter: (a, b) => a.CountryCode.localeCompare(b.CountryCode) },
    { title: '目的国家名称', dataIndex: 'CountryName', key: 'CountryName', width: 130, sorter: (a, b) => a.CountryName.localeCompare(b.CountryName) },
    { title: '创建人', dataIndex: 'CreateBy', key: 'CreateBy', width: 100, sorter: (a, b) => a.CreateBy.localeCompare(b.CreateBy) },
    { title: '创建时间', dataIndex: 'CreateDate', key: 'CreateDate', width: 170, sorter: (a, b) => a.CreateDate.localeCompare(b.CreateDate) },
    { title: '修改人', dataIndex: 'UpdateBy', key: 'UpdateBy', width: 100, sorter: (a, b) => a.UpdateBy.localeCompare(b.UpdateBy) },
    { title: '修改时间', dataIndex: 'UpdateDate', key: 'UpdateDate', width: 170, sorter: (a, b) => a.UpdateDate.localeCompare(b.UpdateDate) },
    { title: '备注', dataIndex: 'Remark', key: 'Remark', width: 180, ellipsis: true },
    {
      title: '操作', key: 'Operation', width: 120, fixed: 'right',
      render: (_: any, record: SkuRecord) => (
        <Space size={0} split={<span className="sku-action-divider">|</span>}>
          {skumgEdit && <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>}
          {!skumgEdit && <span className="sku-disabled">编辑</span>}
        </Space>
      ),
    },
  ];

  if (!canList) {
    return <div className="sku-page"><div className="sku-empty">无 SKU 管理查看权限（oms-skumgtlist）</div></div>;
  }

  return (
    <div className="sku-page">
      <div className="sku-header">
        <h2 className="sku-title">SKU管理</h2>
      </div>

      {/* 搜索区 */}
      <div className="sku-search-card">
        <Form form={searchForm} onFinish={handleSearch} layout="inline" className="sku-search-form">
          <Row gutter={[8, 8]} style={{ width: '100%' }}>
            <Col span={8}>
              <Form.Item name="skus" label="SKU" className="sku-form-item">
                <Input.TextArea
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  placeholder="支持多个 SKU，以空格或英文逗号分隔"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="productCode" label="销售产品" className="sku-form-item">
                <Select placeholder="请选择销售产品" allowClear showSearch options={PRODUCT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="customerCode" label="客户代码" className="sku-form-item">
                <Select placeholder="请选择客户代码" allowClear showSearch options={CUSTOMER_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="countryCode" label="目的国家" className="sku-form-item">
                <Select placeholder="请选择目的国家" allowClear showSearch options={COUNTRY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dateRange" label="创建时间" className="sku-form-item">
                <RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <div className="sku-search-actions">
            <Space size={8}>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">查询</Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
            </Space>
          </div>
        </Form>
      </div>

      {/* 工具栏 */}
      <div className="sku-toolbar">
        <Space size={8} wrap>
          {skumgEdit && <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增</Button>}
          {skumgEdit && (
            <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0} onClick={handleDelete}>
              删除{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
            </Button>
          )}
          {skumgEdit && <Button type="primary" icon={<ImportOutlined />} onClick={openImport}>批量导入SKU配置</Button>}
          <Button icon={<FileTextOutlined />} onClick={() => setLogOpen(true)}>查看日志</Button>
        </Space>
        <span className="sku-total-count">共 <b>{filteredData.length}</b> 条</span>
      </div>

      {/* 表格 */}
      <div className="sku-table-wrap">
        <Table
          rowKey="Id"
          columns={columns}
          dataSource={filteredData}
          scroll={{ x: 1680 }}
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t: number) => `共 ${t} 条`,
            defaultPageSize: 20,
            pageSizeOptions: ['20', '50', '100'],
          }}
        />
      </div>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editRecord ? '编辑 SKU' : '新增 SKU'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        width={700}
        confirmLoading={submitting}
        onOk={handleEditOk}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <EditForm ref={editFormRef} record={editRecord} />
      </Modal>

      {/* 日志弹窗 */}
      <Modal
        title="SKU 操作日志"
        open={logOpen}
        onCancel={() => setLogOpen(false)}
        width={720}
        footer={<Button onClick={() => setLogOpen(false)}>关闭</Button>}
      >
        <Timeline
          items={MOCK_LOG.map((l) => ({
            color: l.action === '删除' ? 'red' : l.action === '编辑' ? 'blue' : 'green',
            children: (
              <div className="sku-timeline-item">
                <div className="sku-timeline-header">
                  <span className="sku-timeline-time">{l.time}</span>
                  <Tag color={l.action === '删除' ? 'red' : l.action === '编辑' ? 'blue' : 'green'} style={{ marginLeft: 8 }}>{l.action}</Tag>
                  <Tag style={{ marginLeft: 4 }}>{l.operator}</Tag>
                </div>
                <div className="sku-timeline-content">{l.content}</div>
              </div>
            ),
          }))}
        />
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入SKU配置"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        width={760}
        footer={[
          <Button key="cancel" onClick={() => setImportOpen(false)}>取消</Button>,
          <Button key="preview" type="primary" ghost onClick={handlePreview}>预览</Button>,
          <Button key="ok" type="primary" disabled={!previewDone} onClick={handleImportConfirm}>确认导入</Button>,
        ]}
      >
        <div className="sku-import-tip">
          <DownloadOutlined /> 导入模板：
          <a onClick={() => message.info('下载模板「导入SKU配置模板.xls」（模拟）')}>导入SKU配置模板.xls</a>
        </div>
        <Dragger
          accept=".xls,.xlsx"
          multiple={false}
          beforeUpload={(file) => { setImportFile(file as any); message.success(`已选择文件：${file.name}`); return false; }}
          onRemove={() => { setImportFile(null); setPreviewRows([]); setPreviewDone(false); }}
          fileList={importFile ? [{ uid: '-1', name: importFile.name } as any] : []}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽 Excel 文件到此处上传</p>
          <p className="ant-upload-hint">仅支持 .xls / .xlsx，导入类型 19</p>
        </Dragger>

        {previewDone && (
          <div className="sku-import-preview">
            <div className="sku-import-preview-title">预览（共 {previewRows.length} 条）</div>
            <Table
              rowKey="Id"
              size="small"
              pagination={false}
              dataSource={previewRows}
              columns={[
                { title: 'SKU', dataIndex: 'Sku', key: 'Sku', width: 120 },
                { title: '客户代码', dataIndex: 'CustomerCode', key: 'CustomerCode', width: 120 },
                { title: '销售产品代码', dataIndex: 'ProductCode', key: 'ProductCode', width: 140 },
                { title: '目的国家简码', dataIndex: 'CountryCode', key: 'CountryCode', width: 120 },
                { title: '备注', dataIndex: 'Remark', key: 'Remark', ellipsis: true },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkuManage;
