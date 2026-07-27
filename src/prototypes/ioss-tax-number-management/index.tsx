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
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PlusOutlined,
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

// ========================= 枚举 / 选项（对齐真实业务 ioss-manage） =========================

// 搜索时 IOSS 识别码匹配方式：0=IOSS识别码，1=IOSS密文（新功能）
const CODE_TYPE_OPTIONS = [
  { value: 0, label: 'IOSS识别码' },
  { value: 1, label: 'IOSS密文' },
];

// 审核类型：K=全部，C=证书审核，R=常规审核
const AUDIT_TYPE_SEARCH_OPTIONS = [
  { value: 'K', label: '全部' },
  { value: 'C', label: '证书审核' },
  { value: 'R', label: '常规审核' },
];

// 状态搜索：4=全部，1=备案通过，2=备案不通过，3=待备案，0=作废
const STATUS_SEARCH_OPTIONS = [
  { value: 4, label: '全部' },
  { value: 3, label: '待备案' },
  { value: 1, label: '备案通过' },
  { value: 2, label: '备案不通过' },
  { value: 0, label: '作废' },
];

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '作废', color: 'default' },
  1: { label: '备案通过', color: 'green' },
  2: { label: '备案不通过', color: 'red' },
  3: { label: '待备案', color: 'orange' },
};

const AUDIT_TYPE_MAP: Record<string, string> = {
  C: '证书审核',
  R: '常规审核',
};

const IOSS_TYPE_MAP: Record<number, string> = {
  0: '个人',
  1: '平台',
};

// 权限（原型演示默认拥有）
const canList = true;   // oms-iossnumberlist
const canAudit = true;  // oms-iossnumberlist:oms-iossnumber-audit
const canExport = true; // oms-iossnumberlist:oms-iossnumber-exportdata

// ========================= IOSS 密文（新功能，保留） =========================
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

// 可复制列元数据（顺序即列顺序，用于多选复制 / 导出时还原表格结构）
const SELECTABLE_COLS = [
  { key: 'customer_code', title: '客户代码', width: 120, getValue: (r: any) => r.customer_code },
  { key: 'ioss_type', title: '类型', width: 80, getValue: (r: any) => (r.ioss_type === 0 ? '个人' : '平台') },
  { key: 'platform_name', title: '平台名称', width: 100, getValue: (r: any) => r.platform_name || '-' },
  { key: 'ioss_code', title: 'IOSS识别码', width: 200, getValue: (r: any) => r.ioss_code },
  { key: 'ioss_cipher', title: 'IOSS密文', width: 180, getValue: (r: any) => maskIoss(r.ioss_code) },
  { key: 'audit_type', title: '审核类型', width: 120, getValue: (r: any) => AUDIT_TYPE_MAP[r.audit_type as 'C' | 'R'] || '-' },
  { key: 'status', title: '状态', width: 100, getValue: (r: any) => STATUS_MAP[r.status]?.label || r.status },
  { key: 'remark', title: '审核不通过备注', width: 200, getValue: (r: any) => r.remark || '-' },
  { key: 'create_time', title: '创建时间', width: 180, getValue: (r: any) => r.create_time || '-' },
  { key: 'salesman', title: '业务员', width: 100, getValue: (r: any) => r.salesman || '-' },
  { key: 'audit_name', title: '审核人', width: 100, getValue: (r: any) => r.audit_name || '-' },
  { key: 'audit_time', title: '审核时间', width: 180, getValue: (r: any) => r.audit_time || '-' },
];

// ========================= 模拟数据（字段对齐真实业务） =========================

const MOCK_DATA = [
  { ioss_id: 1, customer_code: 'CN0C427089', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26199132842172712763', ioss_name: '深圳王小姐', audit_type: 'R', status: 2, remark: '经欧盟海关验证，备案信息不完整', file_url: '', create_time: '2026-07-18 09:30:00', salesman: '张三', audit_name: '李四', audit_time: '2026-07-18 10:00:00' },
  { ioss_id: 2, customer_code: 'CN0C709682', ioss_type: 1, platform_name: 'Temu', ioss_code: 'IOSS26197153103093419470', ioss_name: 'Temu主账号', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-18 10:15:00', salesman: '张三', audit_name: '李四', audit_time: '2026-07-18 11:00:00' },
  { ioss_id: 3, customer_code: 'CN0C937165', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26196231037056487125', ioss_name: '广州李总', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-17 14:22:00', salesman: '王五', audit_name: '李四', audit_time: '2026-07-17 15:00:00' },
  { ioss_id: 4, customer_code: 'CN0564293', ioss_type: 1, platform_name: 'eBay', ioss_code: 'IOSS26192162819097857388', ioss_name: 'eBay欧洲站', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-17 16:40:00', salesman: '王五', audit_name: '赵六', audit_time: '2026-07-17 17:00:00' },
  { ioss_id: 5, customer_code: 'CN0593140', ioss_type: 1, platform_name: 'Amazon', ioss_code: 'IOSS26191225817084860532', ioss_name: '亚马逊欧洲主号', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-16 11:05:00', salesman: '张三', audit_name: '赵六', audit_time: '2026-07-16 12:00:00' },
  { ioss_id: 6, customer_code: 'CN0593140', ioss_type: 1, platform_name: 'Amazon', ioss_code: 'IOSS26191225357029659987', ioss_name: '亚马逊欧洲备用', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-16 11:30:00', salesman: '张三', audit_name: '赵六', audit_time: '2026-07-16 12:30:00' },
  { ioss_id: 7, customer_code: 'CN0593140', ioss_type: 1, platform_name: 'Amazon', ioss_code: 'IOSS26191225244081771546', ioss_name: '亚马逊英国站', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-16 12:00:00', salesman: '张三', audit_name: '赵六', audit_time: '2026-07-16 13:00:00' },
  { ioss_id: 8, customer_code: 'CN12332', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26182154935001369452', ioss_name: '上海张工', audit_type: 'R', status: 2, remark: '该IOSS号已在黑名单库中，无法备案通过', file_url: '', create_time: '2026-07-15 08:50:00', salesman: '王五', audit_name: '李四', audit_time: '2026-07-15 09:00:00' },
  { ioss_id: 9, customer_code: 'CN0C897615', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26181102900107079815', ioss_name: '北京陈先生', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-15 09:20:00', salesman: '王五', audit_name: '李四', audit_time: '2026-07-15 10:00:00' },
  { ioss_id: 10, customer_code: 'CN3979906', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26180175502201997631', ioss_name: '杭州刘女士', audit_type: 'R', status: 2, remark: '', file_url: '', create_time: '2026-07-15 10:10:00', salesman: '张三', audit_name: '李四', audit_time: '2026-07-15 11:00:00' },
  { ioss_id: 11, customer_code: 'CN0C123456', ioss_type: 1, platform_name: 'Shopify', ioss_code: 'IOSS26193112200345678901', ioss_name: 'Shopify独立站', audit_type: 'C', status: 1, remark: '', file_url: 'shopify_registration.pdf', create_time: '2026-07-14 15:30:00', salesman: '王五', audit_name: '赵六', audit_time: '2026-07-14 16:00:00' },
  { ioss_id: 12, customer_code: 'CN0C654321', ioss_type: 1, platform_name: 'AliExpress', ioss_code: 'IOSS26190223344556677889', ioss_name: '速卖通官方', audit_type: 'R', status: 3, remark: '', file_url: '', create_time: '2026-07-14 16:00:00', salesman: '张三', audit_name: '-', audit_time: '-' },
  { ioss_id: 13, customer_code: 'CN0C111222', ioss_type: 0, platform_name: '', ioss_code: 'IOSS26193334445556667778', ioss_name: '深圳赵总', audit_type: 'R', status: 0, remark: '涉嫌多账号滥用IOSS号', file_url: '', create_time: '2026-07-13 13:00:00', salesman: '王五', audit_name: '赵六', audit_time: '2026-07-13 14:00:00' },
];

// 客户代码下拉（从模拟数据派生去重后的客户代码，供搜索栏下拉选择）
const CUSTOMER_CODE_OPTIONS = Array.from(new Set(MOCK_DATA.map((d) => d.customer_code)))
  .sort()
  .map((c) => ({ value: c, label: c }));

// ========================= 组件 =========================

const Component = () => {
  const [searchCustomerCode, setSearchCustomerCode] = useState('');
  const [searchIoss, setSearchIoss] = useState<string[]>([]);
  const [iossInput, setIossInput] = useState('');
  const [codeType, setCodeType] = useState<number>(0); // 0=IOSS识别码，1=IOSS密文（新功能）
  const [searchAuditType, setSearchAuditType] = useState<string>('K');
  const [searchStatus, setSearchStatus] = useState<number>(4);
  const [searchCreateTime, setSearchCreateTime] = useState<[Dayjs, Dayjs] | null>(null);

  // 已应用的筛选条件：仅在点击「查询」后生效
  const [appliedFilter, setAppliedFilter] = useState<{
    customerCode: string;
    ioss: string[];
    codeType: number;
    auditType: string;
    status: number;
    createTime: [Dayjs, Dayjs] | null;
  }>({
    customerCode: '',
    ioss: [],
    codeType: 0,
    auditType: 'K',
    status: 4,
    createTime: null,
  });

  // 单元格框选复制（新功能，保留）
  const [cellSelection, setCellSelection] = useState<Set<string>>(new Set());
  const selectingRef = useRef(false);
  const anchorRef = useRef<{ row: number; col: number } | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [dataSource, setDataSource] = useState(MOCK_DATA);
  const [logVisible, setLogVisible] = useState(false);
  const [logRecord, setLogRecord] = useState<any>(null);

  // ---------- 过滤（仅对已应用的筛选条件生效） ----------
  const filteredData = useMemo(() => {
    return dataSource.filter((item) => {
      if (appliedFilter.customerCode && !item.customer_code.includes(appliedFilter.customerCode)) return false;
      if (appliedFilter.ioss.length > 0) {
        const hit = appliedFilter.ioss.some((v) =>
          appliedFilter.codeType === 1
            ? maskIoss(item.ioss_code).includes(v)
            : item.ioss_code.includes(v),
        );
        if (!hit) return false;
      }
      if (appliedFilter.auditType !== 'K' && item.audit_type !== appliedFilter.auditType) return false;
      if (appliedFilter.status !== 4 && item.status !== appliedFilter.status) return false;
      if (appliedFilter.createTime) {
        const ct = dayjs(item.create_time, 'YYYY-MM-DD HH:mm:ss');
        if (ct.isBefore(appliedFilter.createTime[0].startOf('day')) || ct.isAfter(appliedFilter.createTime[1].endOf('day'))) return false;
      }
      return true;
    });
  }, [dataSource, appliedFilter]);

  // ---------- 查询 ----------
  const handleSearch = () => {
    setAppliedFilter({
      customerCode: searchCustomerCode,
      ioss: searchIoss,
      codeType,
      auditType: searchAuditType,
      status: searchStatus,
      createTime: searchCreateTime,
    });
  };

  // ---------- 重置 ----------
  const handleReset = () => {
    setSearchCustomerCode('');
    setSearchIoss([]);
    setIossInput('');
    setCodeType(0);
    setSearchAuditType('K');
    setSearchStatus(4);
    setSearchCreateTime(null);
    setAppliedFilter({ customerCode: '', ioss: [], codeType: 0, auditType: 'K', status: 4, createTime: null });
    setCellSelection(new Set());
  };

  // ---------- 审核操作 ----------
  const handleApprove = () => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择记录');
    setDataSource((prev) => prev.map((item) => (selectedRowKeys.includes(item.ioss_id) ? { ...item, status: 1, remark: '', audit_name: '当前用户', audit_time: dayjs().format('YYYY-MM-DD HH:mm:ss') } : item)));
    setSelectedRowKeys([]);
    message.success(`已审核通过 ${selectedRowKeys.length} 条`);
  };

  const handleReject = () => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择记录');
    let remark = '';
    Modal.confirm({
      title: '批量审核不通过',
      content: (
        <div style={{ marginTop: 8 }}>
          <Input.TextArea rows={3} placeholder="请输入不通过备注（可选）" onChange={(e) => (remark = e.target.value)} />
        </div>
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setDataSource((prev) => prev.map((item) => (selectedRowKeys.includes(item.ioss_id) ? { ...item, status: 2, remark, audit_name: '当前用户', audit_time: dayjs().format('YYYY-MM-DD HH:mm:ss') } : item)));
        setSelectedRowKeys([]);
        message.success(`已标记 ${selectedRowKeys.length} 条为审核不通过`);
      },
    });
  };

  const handleExport = () => {
    if (!canExport) return message.warning('无导出权限');
    if (filteredData.length === 0) return message.warning('没有可导出的数据');
    const headers = SELECTABLE_COLS.map((c) => c.title);
    const rows = filteredData.map((item) => SELECTABLE_COLS.map((c) => c.getValue(item)));
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
  const renderStatus = useCallback((status: number) => {
    const m = STATUS_MAP[status] || { label: `${status}`, color: 'default' };
    return <Tag color={m.color as any} bordered={false}>{m.label}</Tag>;
  }, []);

  // ---------- 单元格多选复制（新功能，保留） ----------
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

  // ---------- 表格列渲染 ----------
  const renderCell = (key: string) => {
    switch (key) {
      case 'customer_code': return (v: any) => <CopyableCell text={v} />;
      case 'ioss_type': return (v: any) => IOSS_TYPE_MAP[v] ?? v;
      case 'platform_name': return (v: any) => <CopyableCell text={v || <Text type="secondary">-</Text>} />;
      case 'ioss_code': return (v: any) => <CopyableCell text={v} />;
      case 'ioss_cipher': return (_v: any, record: any) => (
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(maskIoss(record.ioss_code)).then((ok) => (ok ? message.success('已复制密文') : message.error('复制失败')));
          }}
        >
          复制
        </Button>
      );
      case 'audit_type': return (v: any) => <CopyableCell text={AUDIT_TYPE_MAP[v] ?? v} />;
      case 'status': return (v: any) => <CopyableCell text={renderStatus(v)} />;
      case 'remark': return (v: any) => (v ? <CopyableCell text={<Tooltip title={v}><span>{v}</span></Tooltip>} copyText={v} /> : <Text type="secondary">-</Text>);
      case 'file_url': return (v: any) => (v ? <a href="#" onClick={(e) => { e.preventDefault(); message.info(`下载 ${v}（模拟）`); }}>{v}</a> : <Text type="secondary">-</Text>);
      case 'create_time': return (v: any) => <CopyableCell text={v} />;
      case 'salesman': return (v: any) => <CopyableCell text={v || <Text type="secondary">-</Text>} />;
      case 'audit_name': return (v: any) => <CopyableCell text={v || <Text type="secondary">-</Text>} />;
      case 'audit_time': return (v: any) => <CopyableCell text={v || <Text type="secondary">-</Text>} />;
      default: return (v: any) => v;
    }
  };

  const actionRender = (_: any, record: any) => (
    <Button type="link" size="small" onClick={() => {
      setLogRecord(record);
      setLogVisible(true);
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
      ellipsis: col.key === 'ioss_code' || col.key === 'ioss_cipher' || col.key === 'remark' || col.key === 'file_url',
      onCell: (record: any, rowIndex: number) => makeCellProps(record, rowIndex, idx),
      render: renderCell(col.key),
    })),
    { title: '操作', key: 'action', width: 80, fixed: 'right' as const, render: actionRender },
  ];

  if (!canList) {
    return <div className="ioss-layout"><div className="ioss-empty">无 IOSS 税号管理查看权限（oms-iossnumberlist）</div></div>;
  }

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
            <Select
              placeholder="请选择客户代码"
              showSearch
              allowClear
              value={searchCustomerCode || undefined}
              onChange={(v) => setSearchCustomerCode(v ?? '')}
              options={CUSTOMER_CODE_OPTIONS}
              className="ioss-select"
              optionFilterProp="label"
            />
          </div>
          <div className="ioss-search-item ioss-search-item-grow">
            <span className="ioss-search-label">
              <Select
                size="small"
                value={codeType}
                onChange={setCodeType}
                options={CODE_TYPE_OPTIONS}
                className="ioss-codetype-select"
              />
            </span>
            <Input
              placeholder={codeType === 1 ? '请输入IOSS密文（支持多个）' : '请输入单个或多个IOSS识别码'}
              value={iossInput}
              onChange={(e) => setIossInput(e.target.value)}
              onPressEnter={() => {
                if (iossInput.trim() && !searchIoss.includes(iossInput.trim())) {
                  setSearchIoss([...searchIoss, iossInput.trim()]);
                  setIossInput('');
                }
              }}
              suffix={<Button type="text" size="small" icon={<PlusOutlined />} onClick={() => {
                if (iossInput.trim() && !searchIoss.includes(iossInput.trim())) {
                  setSearchIoss([...searchIoss, iossInput.trim()]);
                  setIossInput('');
                }
              }} />}
              className="ioss-input"
            />
            {searchIoss.length > 0 && (
              <div className="ioss-tag-list">
                {searchIoss.map((v) => (
                  <Tag key={v} closable onClose={() => setSearchIoss(searchIoss.filter((x) => x !== v))}>{v}</Tag>
                ))}
              </div>
            )}
          </div>
          <div className="ioss-search-item">
            <span className="ioss-search-label">审核类型</span>
            <Select placeholder="全部" allowClear value={searchAuditType} onChange={setSearchAuditType} options={AUDIT_TYPE_SEARCH_OPTIONS} className="ioss-select" />
          </div>
          <div className="ioss-search-item">
            <span className="ioss-search-label">状态</span>
            <Select placeholder="全部" allowClear value={searchStatus} onChange={setSearchStatus} options={STATUS_SEARCH_OPTIONS} className="ioss-select" />
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
          {canAudit && <Button type="primary" onClick={handleApprove} disabled={selectedRowKeys.length === 0}>审核通过</Button>}
          {canAudit && <Button danger onClick={handleReject} disabled={selectedRowKeys.length === 0}>审核不通过</Button>}
          {canExport && <Button onClick={handleExport} disabled={filteredData.length === 0} icon={<DownloadOutlined />}>导出</Button>}
        </Space>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      {/* 表格 */}
      <div className="ioss-table-wrapper">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="ioss_id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            // 作废状态（0）不可勾选审核
            getCheckboxProps: (record: any) => ({ disabled: record.status === 0 }),
          }}
          scroll={{ x: 1900 }}
          size="middle"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number, range: any) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          className="ioss-table"
        />
      </div>

      {/* 操作日志弹窗 */}
      <Modal
        title="操作日志"
        open={logVisible}
        onCancel={() => setLogVisible(false)}
        width={560}
        footer={<Button onClick={() => setLogVisible(false)}>关闭</Button>}
      >
        {logRecord && (
          <Table
            size="small"
            pagination={false}
            dataSource={[
              { key: '1', time: logRecord.create_time, operator: '系统', action: '创建', detail: `新增IOSS税号 ${logRecord.ioss_code}` },
              ...(logRecord.audit_time && logRecord.audit_time !== '-'
                ? [{ key: '2', time: logRecord.audit_time, operator: logRecord.audit_name, action: logRecord.status === 1 ? '审核通过' : logRecord.status === 2 ? '审核不通过' : '审核', detail: logRecord.remark || '-' }]
                : []),
            ]}
            columns={[
              { title: '时间', dataIndex: 'time', width: 180 },
              { title: '操作人', dataIndex: 'operator', width: 100 },
              { title: '操作', dataIndex: 'action', width: 100 },
              { title: '详情', dataIndex: 'detail' },
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default Component;
