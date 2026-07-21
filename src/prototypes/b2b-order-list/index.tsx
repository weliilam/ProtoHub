/**
 * @name B2B订单列表
 * @mode axure
 */

import './style.css';

import React, { useState, useCallback } from 'react';
import {
  Input, Select, Button, Table, Tag, Modal, Space, DatePicker, message, Form,
  Row, Col, Dropdown, Checkbox, Tooltip, Cascader, Popconfirm, Timeline,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, ExportOutlined, DownOutlined,
  SettingOutlined, FilterOutlined, DeleteOutlined, StopOutlined,
  CheckCircleOutlined, CopyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
const { RangePicker } = DatePicker;

// ========================= 类型 =========================

interface OrderRecord {
  key: string;
  ytOrderNo: string;
  orderStatus: string;
  b2bOrderNo: string;
  customerOrderNo: string;
  createTime: string;
  orderType: string;
  orderSource: string;
  customerCode: string;
  isFirstBatch: boolean;
  signInTime: string;
  salesman: string;
  salesAssistant: string;
  auditTime: string;
  claimedTime: string;
  csRep: string;
  salesProduct: string;
  serviceChannel: string;
  follower: string;
  latestFollowUp: string;
}

interface FilterState {
  orderNo: string;
  b2bOrderNo: string;
  createTimeRange: [string, string] | undefined;
  orderType: string | undefined;
  orderStatus: string[] | undefined;
  auditStatus: string | undefined;
  salesProduct: string[] | null;
  destCountry: string | undefined;
  channelCode: string | undefined;
  salesman: string | undefined;
  customerCode: string | undefined;
  isCustoms: string | undefined;
  isSigned: string | undefined;
  addressType: string | undefined;
  isDetained: string | undefined;
  detentionReason: string[] | undefined;
  followerFilter: string;
  isValueAddedDone: string | undefined;
  isLoadable: string | undefined;
  addressAuditStatus: string | undefined;
  isIntercepted: string | undefined;
  billingResult: string | undefined;
  isFirstBatch: string | undefined;
  latestFollowUp: string;
}

// Mock 扣件详情
const MOCK_DETENTION: Record<string, { code: string; reason: string; createTime: string; finishTime: string }[]> = {
  '2607AA0142': [
    { code: 'KC-20260701-001', reason: '货物申报重量与实际重量偏差超10%，需重新核实', createTime: '2026-07-01 12:30:00', finishTime: '' },
  ],
  '2607AA0138': [
    { code: 'KC-20260630-015', reason: '收货地址存在合规风险，触发风控拦截', createTime: '2026-06-30 18:00:00', finishTime: '2026-07-01 09:00:00' },
  ],
  '2607AA0136': [
    { code: 'KC-20260629-008', reason: '报关资料不全，缺少原产地证明', createTime: '2026-06-29 14:20:00', finishTime: '2026-06-30 16:45:00' },
    { code: 'KC-20260630-022', reason: '收货人信息不一致，需客户补充', createTime: '2026-06-30 10:15:00', finishTime: '' },
  ],
};

// ========================= Mock 数据 =========================

const ORDER_STATUS_OPTIONS = ['已预报', '已审核', '已签入', '已配载', '已出库', '运输中', '已完成', '已取消'].map(v => ({ value: v, label: v }));
const ORDER_TYPE_OPTIONS = ['B2B', 'B2C'].map(v => ({ value: v, label: v }));
const AUDIT_STATUS_OPTIONS = ['待审核', '已通过', '已驳回'].map(v => ({ value: v, label: v }));
const YES_NO_OPTIONS = [{ value: 'true', label: '是' }, { value: 'false', label: '否' }];
const SALES_PRODUCT_OPTIONS: any[] = [
  { value: 'A', label: '美国海卡(经济)-纽约', children: [{ value: 'A1', label: '整柜' }, { value: 'A2', label: '拼柜' }] },
  { value: 'B', label: '美国空派(特惠普货)-X' },
  { value: 'C', label: '美国空派(标快普货)' },
  { value: 'D', label: '美森云速达' },
  { value: 'E', label: '美国海派(特快)-CLX' },
  { value: 'F', label: '美国海卡(经济)-洛杉矶' },
  { value: 'G', label: 'B2B-TEST-空运' },
];

const MOCK_DATA: OrderRecord[] = [
  { key: '1', ytOrderNo: '2607AA0142', orderStatus: '已预报', b2bOrderNo: '2607AA0142', customerOrderNo: 'FBA19H5TZF4M', createTime: '2026-07-01 11:16:31', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', salesAssistant: '陈小丽', auditTime: '', csRep: '汪劭宇', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '', follower: '卓运康', latestFollowUp: '已与客户确认收货地址，等待配载' },
  { key: '2', ytOrderNo: '2607AA0141', orderStatus: '已预报', b2bOrderNo: '2607AA0141', customerOrderNo: 'NHUS606222231502', createTime: '2026-07-01 11:14:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC94062', isFirstBatch: false, signInTime: '', salesman: '傅势力', salesAssistant: '', auditTime: '', csRep: '温艳琪', salesProduct: '美国空派(特惠普货)-X', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '3', ytOrderNo: '2607AA0140', orderStatus: '已预报', b2bOrderNo: '2607AA0140', customerOrderNo: 'CST2618209100300281', createTime: '2026-07-01 11:14:10', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '', salesman: '徐铭辛', salesAssistant: '刘佳', auditTime: '', csRep: '张嘉琪', salesProduct: '美国空派(标快普货)', serviceChannel: '', follower: '卓运康', latestFollowUp: '客户要求加急处理，已通知操作部优先安排' },
  { key: '4', ytOrderNo: '2607AA0139', orderStatus: '已预报', b2bOrderNo: '2607AA0139', customerOrderNo: 'CST2618209100100251', createTime: '2026-07-01 11:13:50', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'F00ITDDT08', isFirstBatch: false, signInTime: '', salesman: '袁韵璇', salesAssistant: '', auditTime: '', csRep: '彭军', salesProduct: 'B2B-TEST-空运', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '5', ytOrderNo: '2607AA0138', orderStatus: '已预报', b2bOrderNo: '2607AA0138', customerOrderNo: 'CST2618209300300503', createTime: '2026-07-01 11:11:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C95318', isFirstBatch: false, signInTime: '', salesman: '张威', salesAssistant: '王芳', auditTime: '', csRep: '姚婉清', salesProduct: '美森云速达', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '6', ytOrderNo: '2607AA0137', orderStatus: '已预报', b2bOrderNo: '2607AA0137', customerOrderNo: 'FBA19H5W72GC', createTime: '2026-07-01 11:10:33', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', salesAssistant: '陈小丽', auditTime: '', csRep: '汪劭宇', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '', follower: '卓运康', latestFollowUp: '货量较大需拆单，已联系客户确认分箱方案' },
  { key: '7', ytOrderNo: '2607AA0136', orderStatus: '已预报', b2bOrderNo: '2607AA0136', customerOrderNo: 'CST2618209100100244', createTime: '2026-07-01 11:06:59', orderType: 'B2B', orderSource: '', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '', salesman: '徐铭辛', salesAssistant: '刘佳', auditTime: '', csRep: '张嘉琪', salesProduct: '美国空派(标快普货)', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '8', ytOrderNo: '2607AA0135', orderStatus: '已预报', b2bOrderNo: '2607AA0135', customerOrderNo: 'FBA19H5T1DWV', createTime: '2026-07-01 11:06:39', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', salesAssistant: '陈小丽', auditTime: '', csRep: '汪劭宇', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '9', ytOrderNo: '2607AA0134', orderStatus: '已预报', b2bOrderNo: '2607AA0134', customerOrderNo: 'CST2618209300100580', createTime: '2026-07-01 11:06:09', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '', salesman: '龚晓辉', salesAssistant: '赵敏', auditTime: '', csRep: '张振星', salesProduct: '美森云速达', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '10', ytOrderNo: '2607AA0133', orderStatus: '已预报', b2bOrderNo: '2607AA0133', customerOrderNo: 'CST2618209300100572', createTime: '2026-07-01 11:04:41', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '', salesman: '龚晓辉', salesAssistant: '赵敏', auditTime: '', csRep: '张振星', salesProduct: '美森云速达', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '11', ytOrderNo: '2607AA0132', orderStatus: '已预报', b2bOrderNo: '2607AA0132', customerOrderNo: 'FBA19H5VQ30N', createTime: '2026-07-01 11:04:16', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', salesAssistant: '陈小丽', auditTime: '', csRep: '汪劭宇', salesProduct: '美国海卡(经济)-洛杉矶', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '12', ytOrderNo: '2607AA0131', orderStatus: '已预报', b2bOrderNo: '2607AA0131', customerOrderNo: 'FBA19H5ZFNZX', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', salesAssistant: '', auditTime: '', csRep: '叶佳佳', salesProduct: '美国海派(特快)-CLX', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '13', ytOrderNo: '2607AA0130', orderStatus: '已预报', b2bOrderNo: '2607AA0130', customerOrderNo: 'FBA19H60CGMJ', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', salesAssistant: '', auditTime: '', csRep: '叶佳佳', salesProduct: '美国海派(特快)-CLX', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '14', ytOrderNo: '2607AA0129', orderStatus: '已预报', b2bOrderNo: '2607AA0129', customerOrderNo: 'FBA19H5ZS4SY', createTime: '2026-07-01 11:03:55', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', salesAssistant: '', auditTime: '', csRep: '叶佳佳', salesProduct: '美国海派(特快)-CLX', serviceChannel: '', follower: '', latestFollowUp: '' },
  { key: '15', ytOrderNo: '2607AA0128', orderStatus: '已预报', b2bOrderNo: '2607AA0128', customerOrderNo: 'FBA19H5ZPLMR', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', salesAssistant: '', auditTime: '', csRep: '叶佳佳', salesProduct: '美国海派(特快)-CLX', serviceChannel: '', follower: '', latestFollowUp: '' },
];

// Mock 跟进历史
const MOCK_FOLLOW_UP_HISTORY: Record<string, { time: string; operator: string; content: string }[]> = {
  '2607AA0142': [
    { time: '2026-07-01 09:30:00', operator: '卓运康', content: '已与客户确认收货地址，等待配载' },
    { time: '2026-06-30 16:20:00', operator: '卓运康', content: '联系客户确认最终收货仓库地址，客户反馈需等海外仓确认' },
    { time: '2026-06-29 14:10:00', operator: '卓运康', content: '首次跟进：获客后建单，确认货物类型为普货，预计100箱' },
  ],
  '2607AA0140': [
    { time: '2026-07-01 10:00:00', operator: '卓运康', content: '客户要求加急处理，已通知操作部优先安排' },
    { time: '2026-06-30 11:00:00', operator: '卓运康', content: '确认货物已到仓，等待排舱' },
  ],
  '2607AA0137': [
    { time: '2026-07-01 08:45:00', operator: '卓运康', content: '货量较大需拆单，已联系客户确认分箱方案' },
    { time: '2026-06-30 15:00:00', operator: '卓运康', content: '发现货量超出预估，初步判断需要拆成2-3个主箱' },
    { time: '2026-06-29 10:30:00', operator: '卓运康', content: '客户下单美国海卡(经济)-纽约，货品为家居用品' },
  ],
};

// ========================= 组件 =========================

const B2BOrderList = () => {
  // ---------- 搜索 ----------
  const [expandSearch, setExpandSearch] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    orderNo: '', b2bOrderNo: '', createTimeRange: undefined,
    orderType: undefined, orderStatus: undefined, auditStatus: undefined,
    salesProduct: null, destCountry: undefined, channelCode: undefined,
    salesman: undefined, customerCode: undefined, isCustoms: undefined,
    isSigned: undefined, addressType: undefined, isDetained: undefined,
    isValueAddedDone: undefined, isLoadable: undefined, addressAuditStatus: undefined,
    isIntercepted: undefined, billingResult: undefined, isFirstBatch: undefined, latestFollowUp: '', detentionReason: undefined, followerFilter: '',
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // ---------- 跟进 ----------
  const [followUpHistory, setFollowUpHistory] = useState<Record<string, { time: string; operator: string; content: string; hidden?: boolean }[]>>(MOCK_FOLLOW_UP_HISTORY);
  const [detentionModalOpen, setDetentionModalOpen] = useState(false);
  const [detentionRecord, setDetentionRecord] = useState<OrderRecord | null>(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpRecord, setFollowUpRecord] = useState<OrderRecord | null>(null);
  const [followUpContent, setFollowUpContent] = useState('');
  // 拦截
  const [interceptModalOpen, setInterceptModalOpen] = useState(false);
  const [interceptReason, setInterceptReason] = useState<string | undefined>(undefined);
  const [interceptRemark, setInterceptRemark] = useState('');

  // ---------- 表格 ----------
  const [form] = Form.useForm();



  const handleSearch = useCallback((values: Record<string, any>) => {
    setFilters({
      orderNo: values.orderNo || '',
      b2bOrderNo: values.b2bOrderNo || '',
      createTimeRange: values.createTimeRange?.[0] && values.createTimeRange?.[1]
        ? [values.createTimeRange[0], values.createTimeRange[1]] : undefined,
      orderType: values.orderType,
      orderStatus: values.orderStatus,
      auditStatus: values.auditStatus,
      salesProduct: values.salesProduct,
      destCountry: values.destCountry,
      channelCode: values.channelCode,
      salesman: values.salesman,
      customerCode: values.customerCode,
      isCustoms: values.isCustoms,
      isSigned: values.isSigned,
      addressType: values.addressType,
      isDetained: values.isDetained,
      detentionReason: values.detentionReason,
      followerFilter: values.followerFilter || '',
      isValueAddedDone: values.isValueAddedDone,
      isLoadable: values.isLoadable,
      addressAuditStatus: values.addressAuditStatus,
      isIntercepted: values.isIntercepted,
      billingResult: values.billingResult,
      isFirstBatch: values.isFirstBatch,
      latestFollowUp: values.latestFollowUp || '',
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      orderNo: '', b2bOrderNo: '', createTimeRange: undefined,
      orderType: undefined, orderStatus: undefined, auditStatus: undefined,
      salesProduct: null, destCountry: undefined, channelCode: undefined,
      salesman: undefined, customerCode: undefined, isCustoms: undefined,
      isSigned: undefined, addressType: undefined, isDetained: undefined,
      isValueAddedDone: undefined, isLoadable: undefined, addressAuditStatus: undefined,
      isIntercepted: undefined, billingResult: undefined, isFirstBatch: undefined, latestFollowUp: '', detentionReason: undefined, followerFilter: '',
    });
    form.resetFields();
  }, [form]);

  const filteredData = MOCK_DATA.filter((r) => {
    if (filters.orderNo && !r.ytOrderNo.toLowerCase().includes(filters.orderNo.toLowerCase())) return false;
    if (filters.b2bOrderNo && !r.b2bOrderNo.toLowerCase().includes(filters.b2bOrderNo.toLowerCase())) return false;
    if (filters.orderType && r.orderType !== filters.orderType) return false;
    if (filters.orderStatus && filters.orderStatus.length > 0 && !filters.orderStatus.includes(r.orderStatus)) return false;
    if (filters.auditStatus && r.auditStatus !== filters.auditStatus) return false;
    if (filters.customerCode && !r.customerCode.toLowerCase().includes(filters.customerCode.toLowerCase())) return false;
    if (filters.salesman && !r.salesman.includes(filters.salesman)) return false;
    if (filters.isFirstBatch !== undefined) {
      if (filters.isFirstBatch === 'true' && !r.isFirstBatch) return false;
      if (filters.isFirstBatch === 'false' && r.isFirstBatch) return false;
    }
    if (filters.latestFollowUp && !r.latestFollowUp.includes(filters.latestFollowUp)) return false;
    if (filters.followerFilter && !r.follower.includes(filters.followerFilter)) return false;
    if (filters.detentionReason && filters.detentionReason.length > 0) {
      const reasons = MOCK_DETENTION[r.ytOrderNo];
      if (!reasons || !reasons.some(d => filters.detentionReason!.includes(d.reason))) return false;
    }
    return true;
  });

  // ---------- 表格列 ----------
  const columns: ColumnsType<OrderRecord> = [
    { title: '序号', width: 50, align: 'center', render: (_: any, __: OrderRecord, idx: number) => idx + 1 },
    { title: '运单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 160, fixed: 'left', sorter: (a: OrderRecord, b: OrderRecord) => a.ytOrderNo.localeCompare(b.ytOrderNo), render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 110, render: (v: string) => <Tag color="processing">{v}</Tag> },
    { title: 'B2B单号', dataIndex: 'b2bOrderNo', key: 'b2bOrderNo', width: 130, sorter: true, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '客户单号', dataIndex: 'customerOrderNo', key: 'customerOrderNo', width: 200, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 155, sorter: true },
    { title: '订单类型', dataIndex: 'orderType', key: 'orderType', width: 90, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '订单来源', dataIndex: 'orderSource', key: 'orderSource', width: 140, ellipsis: true },
    { title: '客户代码', dataIndex: 'customerCode', key: 'customerCode', width: 130, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '是否首批', dataIndex: 'isFirstBatch', key: 'isFirstBatch', width: 90, align: 'center', render: (v: boolean) => v ? <Tag color="green">是</Tag> : '否' },
    { title: '扣件原因', key: 'detention', width: 100, align: 'center', render: (_: any, record: OrderRecord) => {
      const reasons = MOCK_DETENTION[record.ytOrderNo];
      if (!reasons?.length) return '-';
      return (
        <Button type="link" size="small" onClick={() => { setDetentionRecord(record); setDetentionModalOpen(true); }}>查看</Button>
      );
    }},
    { title: '扣件生成时间', key: 'detentionCreateTime', width: 155, render: (_: any, record: OrderRecord) => {
      const reasons = MOCK_DETENTION[record.ytOrderNo];
      if (!reasons?.length) return '-';
      const earliest = reasons.reduce((min, r) => r.createTime < min.createTime ? r : min, reasons[0]);
      return <span className="bol-mono">{earliest.createTime}</span>;
    }},
    { title: '扣件完成时间', key: 'detentionFinishTime', width: 155, render: (_: any, record: OrderRecord) => {
      const reasons = MOCK_DETENTION[record.ytOrderNo];
      if (!reasons?.length) return '-';
      if (reasons.some(r => !r.finishTime)) return '-';
      const latest = reasons.reduce((max, r) => r.finishTime > max.finishTime ? r : max, reasons[0]);
      return <span className="bol-mono">{latest.finishTime}</span>;
    }},
    { title: '签入时间', dataIndex: 'signInTime', key: 'signInTime', width: 155, render: (v: string) => v || '-' },
    { title: '业务员', dataIndex: 'salesman', key: 'salesman', width: 90 },
    { title: '销售助理', dataIndex: 'salesAssistant', key: 'salesAssistant', width: 90, sorter: (a: OrderRecord, b: OrderRecord) => a.salesAssistant.localeCompare(b.salesAssistant), render: (v: string) => v || '' },
    { title: '跟进人', dataIndex: 'follower', key: 'follower', width: 90, render: (v: string) => v || '-' },
    { title: '最新跟进内容', dataIndex: 'latestFollowUp', key: 'latestFollowUp', width: 220, ellipsis: true, render: (_v: string, record: OrderRecord) => {
      const history = followUpHistory[record.ytOrderNo] || [];
      const latestVisible = history.find(h => !h.hidden);
      return latestVisible ? latestVisible.content : (record.latestFollowUp || '-');
    }},
    { title: '认领时间', dataIndex: 'claimedTime', key: 'claimedTime', width: 155, render: (v: string) => v || '-' },
    { title: '客服员', dataIndex: 'csRep', key: 'csRep', width: 90 },
    { title: '销售产品', dataIndex: 'salesProduct', key: 'salesProduct', width: 200, ellipsis: true },
    { title: '服务渠道名称', dataIndex: 'serviceChannel', key: 'serviceChannel', width: 200, render: (v: string) => v || '—' },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_: any, record: OrderRecord) => (
        <Space size={0} split={<span className="bol-action-divider">|</span>}>
          <Button type="link" size="small" onClick={() => message.info(`查看详情: ${record.ytOrderNo}`)}>详情</Button>
          <Button type="link" size="small" onClick={() => message.info(`审核: ${record.ytOrderNo}`)}>审核</Button>
          <Button type="link" size="small" onClick={() => handleFollowUp(record)}>跟进备注</Button>
        </Space>
      ),
    },
  ];

  // ---------- 批量操作 ----------
  const handleBatchAudit = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要批量审核的订单'); return; }
    message.success(`已批量审核 ${selectedRowKeys.length} 个订单（模拟）`);
  }, [selectedRowKeys]);

  const handleBatchEditFee = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要批量修改费用的订单'); return; }
    message.success(`已批量修改 ${selectedRowKeys.length} 个订单费用（模拟）`);
  }, [selectedRowKeys]);

  const handleRefresh = useCallback(() => message.success('列表已刷新（模拟）'), []);

  const handleFollowUp = useCallback((record: OrderRecord) => {
    setFollowUpRecord(record);
    setFollowUpContent('');
    setFollowUpModalOpen(true);
  }, []);

  const handleFollowUpSubmit = useCallback(() => {
    if (!followUpContent.trim()) { message.warning('请填写跟进内容'); return; }
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    const yt = followUpRecord?.ytOrderNo;
    if (yt) {
      setFollowUpHistory(prev => ({
        ...prev,
        [yt]: [{ time: now, operator: '卓运康', content: followUpContent }, ...(prev[yt] || [])],
      }));
    }
    message.success(`已为 ${followUpRecord?.ytOrderNo ?? ''} 添加跟进备注`);
    setFollowUpModalOpen(false);
  }, [followUpContent, followUpRecord]);

  // ==================== 导出 ====================
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const BOM = '\uFEFF';
    const csv = BOM + headers.join(',') + '\n' + rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFollowUp = useCallback(() => {
    const headers = ['YT单号', '跟进人', '跟进备注', '跟进时间'];
    const rows: string[][] = [];
    MOCK_DATA.forEach((r) => {
      const history = followUpHistory[r.ytOrderNo] || [];
      if (r.follower) {
        history.filter(h => !h.hidden).forEach(h => rows.push([r.ytOrderNo, r.follower, h.content, h.time]));
      }
    });
    if (rows.length === 0) { message.warning('没有跟进记录可导出'); return; }
    downloadCSV(`跟进记录导出_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    message.success(`已导出 ${rows.length} 条跟进记录`);
  }, [followUpHistory]);

  const handleExportDetention = useCallback(() => {
    const headers = ['YT单号', '扣件原因', '扣件生成时间', '扣件完成时间'];
    const rows: string[][] = [];
    MOCK_DATA.forEach((r) => {
      const reasons = MOCK_DETENTION[r.ytOrderNo];
      if (reasons?.length) {
        reasons.forEach(d => rows.push([r.ytOrderNo, d.reason, d.createTime, d.finishTime || '未完成']));
      }
    });
    if (rows.length === 0) { message.warning('没有扣件记录可导出'); return; }
    downloadCSV(`扣件原因导出_${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    message.success(`已导出 ${rows.length} 条扣件记录`);
  }, []);

  const handleMoreMenu = useCallback(({ key }: { key: string }) => {
    if (key === 'export-followup') handleExportFollowUp();
    else if (key === 'export-detention') handleExportDetention();
    else message.info(`功能 "${key}" 待接入后台（原型演示）`);
  }, [handleExportFollowUp, handleExportDetention]);

  // ==================== 拦截 ====================
  const handleIntercept = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要拦截的订单'); return; }
    setInterceptReason(undefined);
    setInterceptRemark('');
    setInterceptModalOpen(true);
  }, [selectedRowKeys]);

  const handleInterceptSubmit = useCallback(() => {
    if (!interceptReason) { message.warning('请选择拦截原因'); return; }
    if (interceptReason === '客户要求暂扣' && !interceptRemark.trim()) {
      message.warning('拦截原因选择"客户要求暂扣"时，拦截备注为必填项');
      return;
    }
    message.success(`已拦截 ${selectedRowKeys.length} 条订单（原因：${interceptReason}）`);
    setInterceptModalOpen(false);
    setSelectedRowKeys([]);
  }, [interceptReason, interceptRemark, selectedRowKeys]);

  const interceptReasonOptions = [
    { value: '客户要求暂扣', label: '客户要求暂扣' },
    { value: '地址异常', label: '地址异常' },
    { value: '货品异常', label: '货品异常' },
    { value: '费用异常', label: '费用异常' },
    { value: '其他', label: '其他' },
  ];

  const handleClaim = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要认领的订单'); return; }
    Modal.confirm({
      title: '确认认领',
      content: `确定认领勾选的 ${selectedRowKeys.length} 条订单吗？认领后跟进人将变更为当前登录人（卓运康）。`,
      okText: '确定认领',
      cancelText: '取消',
      onOk: () => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        setFollowUpHistory(prev => {
          const next = { ...prev };
          selectedRowKeys.forEach(key => {
            const record = MOCK_DATA.find(r => r.key === key);
            if (record) {
              const yt = record.ytOrderNo;
              const claimEntry = { time: now, operator: '卓运康', content: `【认领】认领该订单，跟进人变更为卓运康`, hidden: true };
              next[yt] = [claimEntry, ...(next[yt] || [])];
            }
          });
          return next;
        });
        message.success(`已成功认领 ${selectedRowKeys.length} 条订单，跟进人已变更为卓运康`);
        setSelectedRowKeys([]);
      },
    });
  }, [selectedRowKeys]);

  const moreMenuItems = [
    { key: 'export-followup', label: '跟进记录导出' },
    { key: 'export-detention', label: '扣件原因导出' },
    { type: 'divider' as const },
    { key: '1', label: '导出全部' },
    { key: '2', label: '打印运单' },
    { key: '3', label: '列配置' },
  ];

  return (
    <div className="bol-page">
      {/* 标题 */}
      <div className="bol-header">
        <h2 className="bol-title">B2B订单列表</h2>
      </div>

      {/* 搜索区域 */}
      <div className="bol-search-card">
        <Form form={form} onFinish={handleSearch} layout="inline" className="bol-search-form">
          <Row gutter={[8, 8]} style={{ width: '100%' }}>
            {/* 基础搜索 */}
            <Col span={6}>
              <Form.Item name="orderNo" label="单号" className="bol-form-item">
                <Input placeholder="请输入单号，多单号以空格或英文逗号分隔" prefix={<SearchOutlined />} allowClear />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="b2bOrderNo" label="B2B单号" className="bol-form-item">
                <Input placeholder="请输入单号，多单号以空格或英文逗号分隔" prefix={<SearchOutlined />} allowClear />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="createTimeRange" label="创建时间" className="bol-form-item">
                <RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="orderType" label="订单类型" className="bol-form-item">
                <Select placeholder="请选择" allowClear options={ORDER_TYPE_OPTIONS} showSearch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="orderStatus" label="订单状态" className="bol-form-item">
                <Select placeholder="请选择" mode="multiple" maxTagCount={2} options={ORDER_STATUS_OPTIONS} showSearch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="auditStatus" label="审核状态" className="bol-form-item">
                <Select placeholder="请选择" allowClear options={AUDIT_STATUS_OPTIONS} showSearch />
              </Form.Item>
            </Col>

            {/* 高级搜索 */}
            {expandSearch && (
              <>
                <Col span={6}>
                  <Form.Item name="salesProduct" label="销售产品" className="bol-form-item">
                    <Cascader placeholder="请选择" options={SALES_PRODUCT_OPTIONS} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="destCountry" label="目的国家" className="bol-form-item">
                    <Select placeholder="输入国家二字码/名称/英文搜索" allowClear showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="channelCode" label="渠道代码" className="bol-form-item">
                    <Select placeholder="输入渠道代码/中英文名、服务商代码搜索" allowClear showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="salesman" label="业务员" className="bol-form-item">
                    <Select placeholder="输入工号/姓名搜索" allowClear showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="followerFilter" label="跟进人" className="bol-form-item">
                    <Input placeholder="输入跟进人搜索" prefix={<SearchOutlined />} allowClear />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="customerCode" label="客户代码" className="bol-form-item">
                    <Select placeholder="输入客户代码搜索" allowClear showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isCustoms" label="是否报关件" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isSigned" label="是否签名" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="addressType" label="地址类型" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isDetained" label="是否扣件" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="addressAuditStatus" label="地址审核状态" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="detentionReason" label="扣件原因" className="bol-form-item">
                    <Select placeholder="请选择扣件原因" mode="multiple" maxTagCount={2} allowClear showSearch style={{ width: '100%' }}
                      options={Object.values(MOCK_DETENTION).flat().map(d => ({ value: d.reason, label: d.reason }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isValueAddedDone" label="是否完成增值服务" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isLoadable" label="是否可配载" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isIntercepted" label="是否拦截" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="billingResult" label="计费结果" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isFirstBatch" label="是否首批" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="latestFollowUp" label="跟进内容" className="bol-form-item">
                    <Input placeholder="输入跟进内容关键词搜索" prefix={<SearchOutlined />} allowClear />
                  </Form.Item>
                </Col>
              </>
            )}
          </Row>

          {/* 操作按钮 */}
          <div className="bol-search-actions">
            <Space size={8}>
              <Button type="primary" icon={<SearchOutlined />} htmlType="submit">查询</Button>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
              <Button type="link" icon={<DownOutlined rotate={expandSearch ? 180 : 0} />}
                onClick={() => setExpandSearch(!expandSearch)}>
                {expandSearch ? '收起高级查询' : '展开高级查询'}
              </Button>
            </Space>
          </div>
        </Form>
      </div>

      {/* 批量操作栏 */}
      <div className="bol-toolbar">
        <Space size={8} wrap>
          <Button type="primary" onClick={handleBatchAudit} disabled={selectedRowKeys.length === 0}>
            批量审核{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
          </Button>
          <Button disabled={selectedRowKeys.length === 0}>撤销审核</Button>
          <Button disabled={selectedRowKeys.length === 0}>批量修改额外服务</Button>
          <Button type="primary" onClick={handleBatchEditFee} disabled={selectedRowKeys.length === 0}>批量修改费用</Button>
          <Button disabled={selectedRowKeys.length === 0}>确认费用</Button>
          <Button danger onClick={handleIntercept} disabled={selectedRowKeys.length === 0}>拦截</Button>
          <Button disabled={selectedRowKeys.length === 0}>取消拦截</Button>
          <Button type="primary" onClick={handleClaim} disabled={selectedRowKeys.length === 0}>
            认领{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
          </Button>
          <Button danger disabled={selectedRowKeys.length === 0} icon={<DeleteOutlined />}>删除</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          <Button icon={<CopyOutlined />}>复制显示列</Button>
          <Dropdown menu={{ items: moreMenuItems, onClick: handleMoreMenu }}>
            <Button>导出 <DownOutlined /></Button>
          </Dropdown>
          <Tooltip title="自定义列展示">
            <Button icon={<SettingOutlined />} />
          </Tooltip>
        </Space>
        <span className="bol-total-count">
          共 <b>{filteredData.length}</b> 条
        </span>
      </div>

      {/* 表格 */}
      <div className="bol-table-wrap">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
          }}
          scroll={{ x: 3190 }}
          size="middle"
          pagination={{
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number) => `共 ${total} 条`,
            defaultPageSize: 20,
            pageSizeOptions: ['20', '50', '100'],
          }}
        />
      </div>
      {/* 跟进备注弹窗 */}
      <Modal
        title="跟进备注"
        open={followUpModalOpen}
        onCancel={() => setFollowUpModalOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setFollowUpModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleFollowUpSubmit}>提交</Button>,
        ]}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: '#6b7280' }}>YT单号：</span>
          <b>{followUpRecord?.ytOrderNo}</b>
          <span style={{ marginLeft: 24, color: '#6b7280' }}>跟进人：</span>
          <Tag color="blue">{followUpRecord?.follower || '未分配'}</Tag>
        </div>

        {/* 左右排版：输入框（左） + 历史记录（右） */}
        <div className="bol-followup-layout">
          {/* 左侧：新增跟进 */}
          <div className="bol-followup-left">
            <div className="bol-followup-section-title">新增跟进</div>
            <Input.TextArea
              placeholder="请输入跟进内容"
              rows={5}
              value={followUpContent}
              onChange={(e) => setFollowUpContent(e.target.value)}
            />
          </div>

          {/* 右侧：跟进历史 */}
          <div className="bol-followup-right">
            {followUpRecord && (followUpHistory[followUpRecord.ytOrderNo]?.length ?? 0) > 0 ? (
              <div className="bol-followup-history">
                <div className="bol-followup-section-title">📋 历史跟进记录 ({(followUpHistory[followUpRecord.ytOrderNo] || []).length})</div>
                <div className="bol-followup-timeline-wrap">
                  <Timeline
                    items={(followUpHistory[followUpRecord.ytOrderNo] || []).map((item, idx) => ({
                      color: idx === 0 && !item.hidden ? 'blue' : 'gray',
                      children: (
                        <div className="bol-timeline-item">
                          <div className="bol-timeline-header">
                            <span className="bol-timeline-time">{item.time}</span>
                            <Tag color={idx === 0 && !item.hidden ? 'blue' : 'default'} style={{ marginLeft: 8 }}>{item.operator}</Tag>
                            {item.hidden && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>系统</Tag>}
                          </div>
                          <div className="bol-timeline-content">{item.content}</div>
                        </div>
                      ),
                    }))}
                  />
                </div>
              </div>
            ) : (
              <div className="bol-followup-empty">暂无跟进记录</div>
            )}
          </div>
        </div>
      </Modal>

      {/* 扣件原因弹窗 */}
      <Modal
        title={`扣件原因 — ${detentionRecord?.ytOrderNo ?? ''}`}
        open={detentionModalOpen}
        onCancel={() => setDetentionModalOpen(false)}
        width={720}
        footer={<Button onClick={() => setDetentionModalOpen(false)}>关闭</Button>}
      >
        {detentionRecord && MOCK_DETENTION[detentionRecord.ytOrderNo] && (
          <Table
            dataSource={MOCK_DETENTION[detentionRecord.ytOrderNo].map((d, i) => ({ ...d, key: i }))}
            columns={[
              { title: '异常编码', dataIndex: 'code', key: 'code', width: 180, render: (v: string) => <span className="bol-mono">{v}</span> },
              { title: '异常说明', dataIndex: 'reason', key: 'reason', ellipsis: true },
              { title: '生成时间', dataIndex: 'createTime', key: 'createTime', width: 160 },
              { title: '完结时间', dataIndex: 'finishTime', key: 'finishTime', width: 160, render: (v: string) => v || '' },
            ]}
            pagination={false}
            size="small"
          />
        )}
      </Modal>

      {/* 拦截弹窗 */}
      <Modal
        title="批量拦截"
        open={interceptModalOpen}
        onCancel={() => setInterceptModalOpen(false)}
        width={480}
        footer={[
          <Button key="cancel" onClick={() => setInterceptModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" danger onClick={handleInterceptSubmit}>确认拦截</Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            已选择 <b>{selectedRowKeys.length}</b> 条订单进行拦截
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 13 }}>拦截原因 <span style={{ color: 'red' }}>*</span></div>
            <Select
              placeholder="请选择拦截原因"
              style={{ width: '100%' }}
              value={interceptReason}
              onChange={(v) => { setInterceptReason(v); if (v !== '客户要求暂扣') setInterceptRemark(''); }}
              options={interceptReasonOptions}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 13 }}>
              拦截备注
              {interceptReason === '客户要求暂扣' && <span style={{ color: 'red' }}> *必填</span>}
            </div>
            <Input.TextArea
              placeholder={interceptReason === '客户要求暂扣' ? '拦截原因为"客户要求暂扣"时，拦截备注为必填项' : '请输入拦截备注（选填）'}
              rows={4}
              value={interceptRemark}
              onChange={(e) => setInterceptRemark(e.target.value)}
              status={interceptReason === '客户要求暂扣' && !interceptRemark.trim() ? 'warning' : undefined}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default B2BOrderList;
