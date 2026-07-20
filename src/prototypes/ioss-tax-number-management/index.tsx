import './style.css';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Typography,
  message,
  Tooltip,
  Upload,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ========================= 模拟数据 =========================

const AUDIT_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '审核通过' },
  { value: 'rejected', label: '备案不通过' },
  { value: 'blacklisted', label: '已拉黑' },
];

const AUDIT_TYPE_OPTIONS = [
  { value: 'standard', label: '常规审核' },
  { value: 'special', label: '特殊审核' },
];

const CUSTOMER_TYPE_OPTIONS = [
  { value: 'personal', label: '个人' },
  { value: 'platform', label: '平台' },
];

const PLATFORM_OPTIONS = [
  { value: 'Amazon', label: 'Amazon' },
  { value: 'eBay', label: 'eBay' },
  { value: 'Temu', label: 'Temu' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'AliExpress', label: 'AliExpress' },
];

const MOCK_DATA = [
  { key: '1', customer_code: 'CN0C427089', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26199132842172712763', recognized_name: '深圳王小姐', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-18 09:30:00' },
  { key: '2', customer_code: 'CN0C709682', customer_type: 'platform', platform_name: 'Temu', ioss_no: 'IOSS26197153103093419470', recognized_name: 'Temu主账号', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-18 10:15:00' },
  { key: '3', customer_code: 'CN0C937165', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26196231037056487125', recognized_name: '广州李总', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-17 14:22:00' },
  { key: '4', customer_code: 'CN0564293', customer_type: 'platform', platform_name: 'eBay', ioss_no: 'IOSS26192162819097857388', recognized_name: 'eBay欧洲站', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-17 16:40:00' },
  { key: '5', customer_code: 'CN0593140', customer_type: 'platform', platform_name: 'Amazon', ioss_no: 'IOSS26191225817084860532', recognized_name: '亚马逊欧洲主号', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-16 11:05:00' },
  { key: '6', customer_code: 'CN0593140', customer_type: 'platform', platform_name: 'Amazon', ioss_no: 'IOSS26191225357029659987', recognized_name: '亚马逊欧洲备用', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-16 11:30:00' },
  { key: '7', customer_code: 'CN0593140', customer_type: 'platform', platform_name: 'Amazon', ioss_no: 'IOSS26191225244081771546', recognized_name: '亚马逊英国站', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-16 12:00:00' },
  { key: '8', customer_code: 'CN12332', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26182154935001369452', recognized_name: '上海张工', audit_type: 'standard', audit_status: 'rejected', reject_remark: '经欧盟海关验证，该IOSS号已在黑名单库中，无法备案通过', file_name: '', create_time: '2026-07-15 08:50:00' },
  { key: '9', customer_code: 'CN0C897615', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26181102900107079815', recognized_name: '北京陈先生', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-15 09:20:00' },
  { key: '10', customer_code: 'CN3979906', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26180175502201997631', recognized_name: '杭州刘女士', audit_type: 'standard', audit_status: 'rejected', reject_remark: '', file_name: '', create_time: '2026-07-15 10:10:00' },
  { key: '11', customer_code: 'CN0C123456', customer_type: 'platform', platform_name: 'Shopify', ioss_no: 'IOSS26193112200345678901', recognized_name: 'Shopify独立站', audit_type: 'special', audit_status: 'approved', reject_remark: '', file_name: 'shopify_registration.pdf', create_time: '2026-07-14 15:30:00' },
  { key: '12', customer_code: 'CN0C654321', customer_type: 'platform', platform_name: 'AliExpress', ioss_no: 'IOSS26190223344556677889', recognized_name: '速卖通官方', audit_type: 'standard', audit_status: 'pending', reject_remark: '', file_name: '', create_time: '2026-07-14 16:00:00' },
  { key: '13', customer_code: 'CN0C111222', customer_type: 'personal', platform_name: '', ioss_no: 'IOSS26193334445556667778', recognized_name: '深圳赵总', audit_type: 'standard', audit_status: 'blacklisted', reject_remark: '涉嫌多账号滥用IOSS号', file_name: '', create_time: '2026-07-13 13:00:00' },
];

// ========================= 组件 =========================

const Component = () => {
  const [searchCustomerCode, setSearchCustomerCode] = useState('');
  const [searchIossNo, setSearchIossNo] = useState<string[]>([]);
  const [iossInput, setIossInput] = useState('');
  const [searchAuditType, setSearchAuditType] = useState<string | undefined>(undefined);
  const [searchAuditStatus, setSearchAuditStatus] = useState<string | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [dataSource, setDataSource] = useState(MOCK_DATA);

  // ---------- 过滤 ----------
  const filteredData = useMemo(() => {
    return dataSource.filter((item) => {
      if (searchCustomerCode && !item.customer_code.includes(searchCustomerCode)) return false;
      if (searchIossNo.length > 0 && !searchIossNo.some((v) => item.ioss_no.includes(v))) return false;
      if (searchAuditType && item.audit_type !== searchAuditType) return false;
      if (searchAuditStatus && item.audit_status !== searchAuditStatus) return false;
      return true;
    });
  }, [dataSource, searchCustomerCode, searchIossNo, searchAuditType, searchAuditStatus]);

  // ---------- 重置 ----------
  const handleReset = () => {
    setSearchCustomerCode('');
    setSearchIossNo([]);
    setIossInput('');
    setSearchAuditType(undefined);
    setSearchAuditStatus(undefined);
  };

  // ---------- 审核操作 ----------
  const handleApprove = () => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择记录');
    setDataSource((prev) => prev.map((item) => (selectedRowKeys.includes(item.key) ? { ...item, audit_status: 'approved', reject_remark: '' } : item)));
    setSelectedRowKeys([]);
    message.success(`已审核通过 ${selectedRowKeys.length} 条`);
  };

  const handleReject = () => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择记录');
    let remark = '';
    Modal.confirm({
      title: '批量备案不通过',
      content: (
        <div style={{ marginTop: 8 }}>
          <Input.TextArea rows={3} placeholder="请输入不通过原因（可选）" onChange={(e) => (remark = e.target.value)} />
        </div>
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setDataSource((prev) => prev.map((item) => (selectedRowKeys.includes(item.key) ? { ...item, audit_status: 'rejected', reject_remark: remark } : item)));
        setSelectedRowKeys([]);
        message.success(`已标记 ${selectedRowKeys.length} 条为备案不通过`);
      },
    });
  };

  const handleExport = () => {
    if (filteredData.length === 0) return message.warning('没有可导出的数据');
    const headers = ['客户代码', '类型', '平台名称', 'IOSS识别码', 'IOSS识别名', '审核类型', '状态', '审核不通过备注', '注册文件'];
    const rows = filteredData.map((item) => [
      item.customer_code,
      item.customer_type === 'personal' ? '个人' : '平台',
      item.platform_name || '-',
      item.ioss_no,
      item.recognized_name,
      item.audit_type === 'standard' ? '常规审核' : '特殊审核',
      AUDIT_STATUS_OPTIONS.find((o) => o.value === item.audit_status)?.label || item.audit_status,
      item.reject_remark,
      item.file_name,
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ioss_tax_numbers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已导出');
  };

  // ---------- 状态标签 ----------
  const renderStatus = useCallback((status: string) => {
    switch (status) {
      case 'approved': return <Tag color="green" bordered={false}>审核通过</Tag>;
      case 'rejected': return <Tag color="red" bordered={false}>备案不通过</Tag>;
      case 'pending': return <Tag color="orange" bordered={false}>待审核</Tag>;
      case 'blacklisted': return <Tag color="default" bordered={false}>已拉黑</Tag>;
      default: return <Tag bordered={false}>{status}</Tag>;
    }
  }, []);

  // ---------- 表格列 ----------
  const columns = [
    { title: '序号', key: 'index', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: '客户代码', dataIndex: 'customer_code', key: 'customer_code', width: 120 },
    {
      title: '类型', dataIndex: 'customer_type', key: 'customer_type', width: 70,
      render: (v: string) => (v === 'personal' ? '个人' : '平台'),
    },
    {
      title: '平台名称', dataIndex: 'platform_name', key: 'platform_name', width: 100,
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    { title: 'IOSS识别码', dataIndex: 'ioss_no', key: 'ioss_no', width: 200, ellipsis: true },
    { title: 'IOSS识别名', dataIndex: 'recognized_name', key: 'recognized_name', width: 130, ellipsis: true },
    {
      title: '审核类型', dataIndex: 'audit_type', key: 'audit_type', width: 90,
      render: (v: string) => (v === 'standard' ? '常规审核' : '特殊审核'),
    },
    { title: '状态', dataIndex: 'audit_status', key: 'audit_status', width: 90, render: renderStatus },
    {
      title: '审核不通过备注', dataIndex: 'reject_remark', key: 'reject_remark', width: 180, ellipsis: true,
      render: (v: string) => (v ? <Tooltip title={v}><span>{v}</span></Tooltip> : <Text type="secondary">-</Text>),
    },
    {
      title: '注册文件', dataIndex: 'file_name', key: 'file_name', width: 120,
      render: (v: string) => (v ? <a>{v}</a> : <Text type="secondary">-</Text>),
    },
    {
      title: '操作', key: 'action', width: 70, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => {
          Modal.info({
            title: '操作日志',
            content: (
              <Table
                size="small"
                pagination={false}
                dataSource={[
                  { key: '1', time: record.create_time, operator: '系统', action: '创建', detail: '新增IOSS税号记录' },
                ]}
                columns={[
                  { title: '时间', dataIndex: 'time' },
                  { title: '操作人', dataIndex: 'operator' },
                  { title: '操作', dataIndex: 'action' },
                  { title: '详情', dataIndex: 'detail' },
                ]}
              />
            ),
            width: 560,
          });
        }}>
          日志
        </Button>
      ),
    },
  ];

  return (
    <div className="ioss-layout">
      <div className="ioss-page-header">
        <div className="ioss-page-title-area">
          <Title level={4} className="ioss-page-title">IOSS税号管理</Title>
          <Text type="secondary" className="ioss-page-desc">管理客户IOSS税号备案审核及状态</Text>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="ioss-search-bar">
        <div className="ioss-search-row">
          <div className="ioss-search-item">
            <span className="ioss-search-label">客户代码</span>
            <Input placeholder="请输入" value={searchCustomerCode} onChange={(e) => setSearchCustomerCode(e.target.value)} className="ioss-input" />
          </div>
          <div className="ioss-search-item ioss-search-item-grow">
            <span className="ioss-search-label">IOSS识别码</span>
            <Input
              placeholder="请输入单个或多个"
              value={iossInput}
              onChange={(e) => setIossInput(e.target.value)}
              onPressEnter={() => {
                if (iossInput.trim() && !searchIossNo.includes(iossInput.trim())) {
                  setSearchIossNo([...searchIossNo, iossInput.trim()]);
                  setIossInput('');
                }
              }}
              suffix={<Button type="text" size="small" icon={<PlusOutlined />} onClick={() => {
                if (iossInput.trim() && !searchIossNo.includes(iossInput.trim())) {
                  setSearchIossNo([...searchIossNo, iossInput.trim()]);
                  setIossInput('');
                }
              }} />}
              className="ioss-input"
            />
            {searchIossNo.length > 0 && (
              <div className="ioss-tag-list">
                {searchIossNo.map((v) => (
                  <Tag key={v} closable onClose={() => setSearchIossNo(searchIossNo.filter((x) => x !== v))}>{v}</Tag>
                ))}
              </div>
            )}
          </div>
          <div className="ioss-search-item">
            <span className="ioss-search-label">审核类型</span>
            <Select placeholder="全部" allowClear value={searchAuditType} onChange={setSearchAuditType} options={AUDIT_TYPE_OPTIONS} className="ioss-select" />
          </div>
          <div className="ioss-search-item">
            <span className="ioss-search-label">状态</span>
            <Select placeholder="全部" allowClear value={searchAuditStatus} onChange={setSearchAuditStatus} options={AUDIT_STATUS_OPTIONS} className="ioss-select" />
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="ioss-action-bar">
        <Space>
          <Button icon={<CheckOutlined />} onClick={handleApprove} disabled={selectedRowKeys.length === 0}>审核通过</Button>
          <Button icon={<CloseOutlined />} onClick={handleReject} disabled={selectedRowKeys.length === 0}>审核不通过</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
        </Space>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => message.info('查询完成')}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      {/* 表格 */}
      <div className="ioss-table-wrapper">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 1600 }}
          size="middle"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          className="ioss-table"
        />
      </div>
    </div>
  );
};

export default Component;
