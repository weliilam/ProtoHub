import './style.css';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
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
  CopyOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;

// 复制文本：优先用 navigator.clipboard，非安全上下文（HTTP/局域网IP）下回退到 execCommand
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到下面的兜底方案 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

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

// IOSS 号脱敏展示（密文）：基于输入生成确定性的加密串，无 * 掩码
const CIPHER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const maskIoss = (no: string) => {
  if (!no) return '';
  let h = 0x811c9dc5; // FNV-1a 种子
  const out: string[] = [];
  for (let i = 0; i < no.length; i++) {
    h ^= no.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
    out.push(CIPHER_CHARS[h % CIPHER_CHARS.length]);
  }
  return out.join('');
};

// 可复制单元格：文本可手动选中，悬浮出现复制图标
const CopyableCell = ({ text, copyText }: { text: React.ReactNode; copyText?: string }) => {
  const value = copyText ?? (typeof text === 'string' ? text : '');
  return (
    <span className="copyable-cell">
      <span className="copyable-text">{text || <Text type="secondary">-</Text>}</span>
      {value && (
        <CopyOutlined
          className="copy-icon"
          title="复制"
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(value).then((ok) => (ok ? message.success('已复制') : message.error('复制失败')));
          }}
        />
      )}
    </span>
  );
};

// 可复制列元数据（顺序即列顺序，用于多选复制时还原表格结构）
const SELECTABLE_COLS = [
  { key: 'customer_code', title: '客户代码', width: 120, getValue: (r: any) => r.customer_code },
  { key: 'customer_type', title: '类型', width: 70, getValue: (r: any) => (r.customer_type === 'personal' ? '个人' : '平台') },
  { key: 'platform_name', title: '平台名称', width: 100, getValue: (r: any) => r.platform_name || '-' },
  { key: 'ioss_no', title: 'IOSS识别码', width: 200, getValue: (r: any) => r.ioss_no },
  { key: 'ioss_cipher', title: 'IOSS密文', width: 180, getValue: (r: any) => maskIoss(r.ioss_no) },
  { key: 'audit_type', title: '审核类型', width: 90, getValue: (r: any) => (r.audit_type === 'standard' ? '常规审核' : '特殊审核') },
  { key: 'audit_status', title: '状态', width: 90, getValue: (r: any) => AUDIT_STATUS_OPTIONS.find((o) => o.value === r.audit_status)?.label || r.audit_status },
  { key: 'reject_remark', title: '审核不通过备注', width: 180, getValue: (r: any) => r.reject_remark || '-' },
  { key: 'file_name', title: '注册文件', width: 120, getValue: (r: any) => r.file_name || '-' },
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
  const [searchCreateTime, setSearchCreateTime] = useState<[Dayjs, Dayjs] | null>(null);
  // 单元格框选复制
  const [cellSelection, setCellSelection] = useState<Set<string>>(new Set());
  const selectingRef = useRef(false);
  const anchorRef = useRef<{ row: number; col: number } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [dataSource, setDataSource] = useState(MOCK_DATA);

  // ---------- 过滤 ----------
  const filteredData = useMemo(() => {
    return dataSource.filter((item) => {
      if (searchCustomerCode && !item.customer_code.includes(searchCustomerCode)) return false;
      if (searchIossNo.length > 0 && !searchIossNo.some((v) => item.ioss_no.includes(v))) return false;
      if (searchAuditType && item.audit_type !== searchAuditType) return false;
      if (searchAuditStatus && item.audit_status !== searchAuditStatus) return false;
      if (searchCreateTime) {
        const ct = dayjs(item.create_time, 'YYYY-MM-DD HH:mm:ss');
        if (ct.isBefore(searchCreateTime[0].startOf('day')) || ct.isAfter(searchCreateTime[1].endOf('day'))) return false;
      }
      return true;
    });
  }, [dataSource, searchCustomerCode, searchIossNo, searchAuditType, searchAuditStatus, searchCreateTime]);

  // ---------- 重置 ----------
  const handleReset = () => {
    setSearchCustomerCode('');
    setSearchIossNo([]);
    setIossInput('');
    setSearchAuditType(undefined);
    setSearchAuditStatus(undefined);
    setSearchCreateTime(null);
    setCellSelection(new Set());
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
    const headers = ['客户代码', '类型', '平台名称', 'IOSS识别码', 'IOSS密文', '审核类型', '状态', '审核不通过备注', '注册文件', '创建时间'];
    const rows = filteredData.map((item) => [
      item.customer_code,
      item.customer_type === 'personal' ? '个人' : '平台',
      item.platform_name || '-',
      item.ioss_no,
      maskIoss(item.ioss_no),
      item.audit_type === 'standard' ? '常规审核' : '特殊审核',
      AUDIT_STATUS_OPTIONS.find((o) => o.value === item.audit_status)?.label || item.audit_status,
      item.reject_remark,
      item.file_name,
      item.create_time,
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

  // ---------- 单元格多选复制 ----------
  const applySelection = (r1: number, c1: number, r2: number, c2: number) => {
    const rMin = Math.min(r1, r2), rMax = Math.max(r1, r2);
    const cMin = Math.min(c1, c2), cMax = Math.max(c1, c2);
    const next = new Set<string>();
    for (let r = rMin; r <= rMax; r++) {
      const rec = filteredData[r];
      if (!rec) continue;
      for (let c = cMin; c <= cMax; c++) next.add(`${r}|${c}`);
    }
    setCellSelection(next);
  };

  const makeCellProps = (record: any, rowIndex: number, colIdx: number) => {
    const selKey = `${rowIndex}|${colIdx}`;
    return {
      className: cellSelection.has(selKey) ? 'cell-selected' : undefined,
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        selectingRef.current = true;
        anchorRef.current = { row: rowIndex, col: colIdx };
        applySelection(rowIndex, colIdx, rowIndex, colIdx);
      },
      onMouseEnter: () => {
        if (selectingRef.current && anchorRef.current) {
          applySelection(anchorRef.current.row, anchorRef.current.col, rowIndex, colIdx);
        }
      },
    };
  };

  const copySelection = async () => {
    if (cellSelection.size === 0) return message.warning('请先选中单元格');
    let rMin = Infinity, rMax = -1, cMin = Infinity, cMax = -1;
    cellSelection.forEach((k) => {
      const [r, c] = k.split('|').map(Number);
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r);
      cMin = Math.min(cMin, c); cMax = Math.max(cMax, c);
    });
    const lines: string[] = [];
    const header: string[] = [];
    for (let c = cMin; c <= cMax; c++) header.push(SELECTABLE_COLS[c].title);
    lines.push(header.join('\t'));
    for (let r = rMin; r <= rMax; r++) {
      const rec = filteredData[r];
      const row: string[] = [];
      for (let c = cMin; c <= cMax; c++) row.push(SELECTABLE_COLS[c].getValue(rec));
      lines.push(row.join('\t'));
    }
    const text = lines.join('\n');
    const ok = await copyToClipboard(text);
    if (!ok) {
      Modal.error({
        title: '复制失败',
        width: 560,
        content: (
          <div>
            <div style={{ marginBottom: 8 }}>浏览器拒绝了剪贴板访问，你可以手动复制下面的内容：</div>
            <Input.TextArea readOnly value={text} autoSize={{ minRows: 4, maxRows: 10 }} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </div>
        ),
        okText: '复制内容',
        onOk: () => {
          copyToClipboard(text).then((ok2) => (ok2 ? message.success('已复制') : message.error('仍无法复制，请全选文本手动复制')));
        },
      });
      return;
    }
    message.success(`已复制 ${cellSelection.size} 个单元格`);
    setCellSelection(new Set());
  };

  useEffect(() => {
    const onUp = () => { selectingRef.current = false; };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && cellSelection.size > 0) {
        e.preventDefault();
        copySelection();
      }
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [cellSelection, filteredData, copySelection]);

  // ---------- 表格列 ----------
  const renderCell = (key: string) => {
    switch (key) {
      case 'customer_code': return (v: any) => <CopyableCell text={v} />;
      case 'customer_type': return (v: any) => (v === 'personal' ? '个人' : '平台');
      case 'platform_name': return (v: any) => <CopyableCell text={v || <Text type="secondary">-</Text>} />;
      case 'ioss_no': return (v: any) => <CopyableCell text={v} />;
      case 'ioss_cipher': return (_v: any, record: any) => <CopyableCell text={maskIoss(record.ioss_no)} />;
      case 'audit_type': return (v: any) => <CopyableCell text={v === 'standard' ? '常规审核' : '特殊审核'} />;
      case 'audit_status': return (v: any) => <CopyableCell text={renderStatus(v)} copyText={AUDIT_STATUS_OPTIONS.find((o) => o.value === v)?.label || v} />;
      case 'reject_remark': return (v: any) => (v ? <CopyableCell text={<Tooltip title={v}><span>{v}</span></Tooltip>} copyText={v} /> : <Text type="secondary">-</Text>);
      case 'file_name': return (v: any) => (v ? <a>{v}</a> : <Text type="secondary">-</Text>);
      default: return (v: any) => v;
    }
  };

  const actionRender = (_: any, record: any) => (
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
  );

  const columns = [
    { title: '序号', key: 'index', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    ...SELECTABLE_COLS.map((col, idx) => ({
      title: col.title,
      dataIndex: col.key,
      key: col.key,
      width: col.width,
      ellipsis: col.key === 'ioss_no' || col.key === 'ioss_cipher' || col.key === 'reject_remark',
      onCell: (record: any, rowIndex: number) => makeCellProps(record, rowIndex, idx),
      render: renderCell(col.key),
    })),
    { title: '操作', key: 'action', width: 70, fixed: 'right' as const, render: actionRender },
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
          <div className="ioss-search-item">
            <span className="ioss-search-label">创建时间</span>
            <DatePicker.RangePicker
              value={searchCreateTime}
              onChange={(v) => setSearchCreateTime(v as [Dayjs, Dayjs] | null)}
              className="ioss-select"
            />
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
