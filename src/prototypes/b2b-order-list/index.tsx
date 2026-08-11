/**
 * @name B2B订单列表
 * @mode axure
 */

import './style.css';

import React, { useState, useCallback } from 'react';
import {
  Alert, Input, Select, Button, Table, Tag, Modal, Space, DatePicker, message, Form,
  Row, Col, Dropdown, Checkbox, Tooltip, Cascader, Popconfirm, Timeline, Radio,
  InputNumber, Divider, Descriptions, Card, Upload,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, DownOutlined,
  SettingOutlined, DeleteOutlined, CopyOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
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
  csRep: string;
  follower: string;
  latestFollowUp: string;
  claimedTime: string;
  salesProduct: string;
  serviceChannel: string;
  // 新增：对齐真实业务字段
  countryName: string;
  isClearance: string;       // Y/N 是否报关件
  addressReviewStatus: string; // 0 待审核 / 1 已审核 / 2 待确认
  auditStatus: string;       // 待审核 / 审核暂存 / 审核通过 / 审核不通过
  addressType?: number;      // 1 Amazon地址 / 3 海外仓地址 / 2 私人地址
  postCode: string;
  goodsAmount: number;
  estimateWeight: number;
  chargeWeight: number;
  customsMode: string;       // 报关方式
  taxMethod: string;         // 清关方案
  deliveryType: number;      // 1 云途 / 2 客户自送
  chargeStatus: string;      // Y 计费成功 / N 未计费 / F 计费失败 / M 人工计费
  interceptStatus: string;   // Y/N 是否拦截
  interceptReason: string;
  serverHawbCode: string;    // 服务商单号
  consignee: string;         // 收件人
  warehouseCode: string;     // 仓库代码
  sortingCode: string;       // 分拣码
  billStatus: string;        // 入账状态
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

// Mock 拦截原因（拦截类型 + 助记码 + 中文名称 + 问题内容）
interface InterceptReason {
  code: string;
  category: string;
  name: string;
  content: string;
}
const MOCK_INTERCEPT_REASONS: InterceptReason[] = [
  { code: 'A1', category: '客户原因', name: '客户要求暂扣', content: '您好!贵司要求暂扣此件,我司已按扣件处理。如需放行出货,请及时与我司客服联系,谢谢。' },
  { code: 'A10', category: '客户原因', name: '客户来货面单断针', content: '您好!贵司来货面单出现断针,我司已按扣件处理。' },
  { code: 'A11', category: '客户原因', name: 'FBA来货无云途面单', content: '您好!贵司来货FBA无云途面单,我司已按扣件处理。' },
  { code: 'A5', category: '客户原因', name: '空包裹', content: '您好!此票包裹内无实物,发现破损为空包裹。' },
  { code: 'A7', category: '客户原因', name: 'HK派送件超重超长', content: '您好!此票香港派送件,因为单件毛重超过限制,我司已按扣件处理。' },
  { code: 'A9', category: '客户原因', name: '已理赔订单(找实拍图)', content: '此订单在网上订单已经理赔,仓库扣件只做登记处理。' },
  { code: 'B1', category: '货物原因', name: '预报重量与实际重量不符', content: '您好!贵司提供参考重量为****KG,我司称重实重为****KG,差异较大,需核实后处理。' },
  { code: 'B7', category: '货物原因', name: '预报(申报)数量与实收不符', content: '您好!内件****票,司申报数量****个,我司实收数量****个,数量不符需核实。' },
  { code: 'B8', category: '货物原因', name: '包装简陋不合格/包装破损', content: '您好!此票包装简陋无防护不合格,在运输过程中可能损坏,我司已按扣件处理。' },
  { code: 'B9', category: '货物原因', name: '包装压坏', content: '您好!此票外箱有件压坏,现箱已压坏需换箱,我司已按扣件处理。' },
];
const INTERCEPT_CATEGORY_OPTIONS = ['全部', '客户原因', '货物原因'].map(v => ({ value: v, label: v }));

// 地址审核状态下拉
const ADDRESS_REVIEW_OPTIONS = [
  { value: '0', label: '待审核' },
  { value: '1', label: '已审核' },
  { value: '2', label: '待确认' },
];

// 报关方式 / 清关方案 选项
const CUSTOMS_CLEARANCE_OPTIONS = ['单独报关', '代理报关', '不报关'].map(v => ({ value: v, label: v }));
const CLEARANCE_PLAN_OPTIONS = ['DDU', 'DDP', 'PVA'].map(v => ({ value: v, label: v }));
// 地址类型（对齐星云 common-status：Amazon地址 / 海外仓地址 / 私人地址）
const ADDRESS_TYPE_OPTIONS = [
  { value: 1, label: 'Amazon地址' },
  { value: 3, label: '海外仓地址' },
  { value: 2, label: '私人地址' },
];
// 计费结果（对齐星云 common-status：未计费 / 无需计费 / 欠费 / 计费成功 / 计费失败）
const BILLING_RESULT_OPTIONS = [
  { value: 0, label: '未计费' },
  { value: 1, label: '无需计费' },
  { value: 2, label: '欠费' },
  { value: 10, label: '计费成功' },
  { value: 20, label: '计费失败' },
];

// 额外服务 / 费用项 选项（原型演示）
const EXTRA_SERVICE_OPTIONS = [
  { value: '10', label: '报关资料上传' },
  { value: 'VAS_IP', label: '保价服务' },
  { value: 'VAS_SIGN', label: '签单返回' },
  { value: 'VAS_INS', label: '保险' },
  { value: 'VAS_PICKUP', label: '上门提货' },
];
const FEE_OPTIONS = [
  { value: 'FREIGHT', label: '运费' },
  { value: 'FUEL', label: '燃油附加费' },
  { value: 'REMOTE', label: '偏远附加费' },
  { value: 'TARIFF', label: '关税' },
  { value: 'CLEAR', label: '清关费' },
];
// 撤销拦截：问题类型（助记码 / 中文名 / 问题内容）
const MOCK_CANCEL_INTERCEPT: { code: string; name: string; content: string }[] = [
  { code: 'A1', name: '客户要求暂扣', content: '客户主动要求暂扣，已与客户确认后放行' },
  { code: 'A5', name: '空包裹', content: '空包裹核实后确认为正常，允许放行' },
  { code: 'B1', name: '重量不符', content: '预报重量与实际重量差异已核实，允许放行' },
  { code: 'B8', name: '包装破损', content: '包装已重新加固，允许放行' },
];
// 日志（操作历史）Mock
const MOCK_LOG: Record<string, { time: string; operator: string; action: string }[]> = {
  '2607AA0142': [
    { time: '2026-07-01 11:20:00', operator: '汪劭宇', action: '新建订单（来源：新用户中心）' },
    { time: '2026-07-01 11:30:00', operator: '系统', action: '自动计费完成（计费成功）' },
    { time: '2026-07-01 13:10:00', operator: '汪劭宇', action: '提交审核（审核状态：待审核）' },
    { time: '2026-07-02 09:15:00', operator: '叶佳佳', action: '审核通过' },
  ],
  '2607AA0140': [
    { time: '2026-07-01 11:15:00', operator: '张嘉琪', action: '新建订单（来源：新用户中心）' },
    { time: '2026-07-01 14:00:00', operator: '叶佳佳', action: '审核通过' },
    { time: '2026-07-01 15:20:00', operator: '徐铭辛', action: '确认费用' },
  ],
};

// ========================= Mock 数据 =========================

const ORDER_STATUS_OPTIONS = ['草稿', '已预报', '已签入', '待客户确认', '客户已确认', '客户已驳回', '已签出'].map(v => ({ value: v, label: v }));
const ORDER_TYPE_OPTIONS = ['B2B', '整柜'].map(v => ({ value: v, label: v }));
const AUDIT_STATUS_OPTIONS = ['待审核', '审核暂存', '审核通过', '审核不通过'].map(v => ({ value: v, label: v }));
const YES_NO_OPTIONS = [{ value: 'Y', label: '是' }, { value: 'N', label: '否' }];
const SALES_PRODUCT_OPTIONS: any[] = [
  { value: 'A', label: '美国海卡(经济)-纽约', children: [{ value: 'A1', label: '整柜' }, { value: 'A2', label: '拼柜' }] },
  { value: 'B', label: '美国空派(特惠普货)-X' },
  { value: 'C', label: '美国空派(标快普货)' },
  { value: 'D', label: '美森云速达' },
  { value: 'E', label: '美国海派(特快)-CLX' },
  { value: 'F', label: '美国海卡(经济)-洛杉矶' },
  { value: 'G', label: 'B2B-TEST-空运' },
];
const SALES_PRODUCT_FLAT = SALES_PRODUCT_OPTIONS.map(o => ({ value: o.label, label: o.label }));

// 基础数据（核心字段），下方统一追加真实业务补齐字段
const MOCK_BASE: any[] = [
  { key: '1', ytOrderNo: '2607AA0142', orderStatus: '已预报', b2bOrderNo: '2607AA0142', customerOrderNo: 'FBA19H5TZF4M', createTime: '2026-07-01 11:16:31', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', csRep: '汪劭宇', follower: '卓运康', latestFollowUp: '已与客户确认收货地址，等待配载', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '' },
  { key: '2', ytOrderNo: '2607AA0141', orderStatus: '已预报', b2bOrderNo: '2607AA0141', customerOrderNo: 'NHUS606222231502', createTime: '2026-07-01 11:14:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC94062', isFirstBatch: false, signInTime: '', salesman: '傅势力', csRep: '温艳琪', follower: '', latestFollowUp: '', salesProduct: '美国空派(特惠普货)-X', serviceChannel: '' },
  { key: '3', ytOrderNo: '2607AA0140', orderStatus: '已签入', b2bOrderNo: '2607AA0140', customerOrderNo: 'CST2618209100300281', createTime: '2026-07-01 11:14:10', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '', salesman: '徐铭辛', csRep: '张嘉琪', follower: '卓运康', latestFollowUp: '客户要求加急处理，已通知操作部优先安排', salesProduct: '美国空派(标快普货)', serviceChannel: '' },
  { key: '4', ytOrderNo: '2607AA0139', orderStatus: '已签入', b2bOrderNo: '2607AA0139', customerOrderNo: 'CST2618209100100251', createTime: '2026-07-01 11:13:50', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'F00ITDDT08', isFirstBatch: false, signInTime: '2026-07-01 12:05:10', salesman: '袁韵璇', csRep: '彭军', follower: '', latestFollowUp: '', salesProduct: 'B2B-TEST-空运', serviceChannel: '' },
  { key: '5', ytOrderNo: '2607AA0138', orderStatus: '已预报', b2bOrderNo: '2607AA0138', customerOrderNo: 'CST2618209300300503', createTime: '2026-07-01 11:11:48', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C95318', isFirstBatch: false, signInTime: '', salesman: '张威', csRep: '姚婉清', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '6', ytOrderNo: '2607AA0137', orderStatus: '待客户确认', b2bOrderNo: '2607AA0137', customerOrderNo: 'FBA19H5W72GC', createTime: '2026-07-01 11:10:33', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '2026-07-01 12:00:00', salesman: '马武林', csRep: '汪劭宇', follower: '卓运康', latestFollowUp: '货量较大需拆单，已联系客户确认分箱方案', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '', auditStatus: '审核通过' },
  { key: '7', ytOrderNo: '2607AA0136', orderStatus: '已签出', b2bOrderNo: '2607AA0136', customerOrderNo: 'CST2618209100100244', createTime: '2026-07-01 11:06:59', orderType: 'B2B', orderSource: '', customerCode: 'BCN0C09842', isFirstBatch: false, signInTime: '2026-07-01 11:50:00', salesman: '徐铭辛', csRep: '张嘉琪', follower: '', latestFollowUp: '', salesProduct: '美国空派(标快普货)', serviceChannel: '' },
  { key: '8', ytOrderNo: '2607AA0135', orderStatus: '已签出', b2bOrderNo: '2607AA0135', customerOrderNo: 'FBA19H5T1DWV', createTime: '2026-07-01 11:06:39', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '2026-07-01 11:45:00', salesman: '马武林', csRep: '汪劭宇', follower: '', latestFollowUp: '', salesProduct: '美国海卡(经济)-纽约', serviceChannel: '' },
  { key: '9', ytOrderNo: '2607AA0134', orderStatus: '客户已确认', b2bOrderNo: '2607AA0134', customerOrderNo: 'CST2618209300100580', createTime: '2026-07-01 11:06:09', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '2026-07-01 11:40:00', salesman: '龚晓辉', csRep: '张振星', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '10', ytOrderNo: '2607AA0133', orderStatus: '客户已驳回', b2bOrderNo: '2607AA0133', customerOrderNo: 'CST2618209300100572', createTime: '2026-07-01 11:04:41', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCN0C03286', isFirstBatch: false, signInTime: '', salesman: '龚晓辉', csRep: '张振星', follower: '', latestFollowUp: '', salesProduct: '美森云速达', serviceChannel: '' },
  { key: '11', ytOrderNo: '2607AA0132', orderStatus: '已预报', b2bOrderNo: '2607AA0132', customerOrderNo: 'FBA19H5VQ30N', createTime: '2026-07-01 11:04:16', orderType: 'B2B', orderSource: '新用户中心', customerCode: 'BCNHC40325', isFirstBatch: false, signInTime: '', salesman: '马武林', csRep: '汪劭宇', follower: '', latestFollowUp: '', salesProduct: '美国海卡(经济)-洛杉矶', serviceChannel: '' },
  { key: '12', ytOrderNo: '2607AA0131', orderStatus: '已签入', b2bOrderNo: '2607AA0131', customerOrderNo: 'FBA19H5ZFNZX', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '13', ytOrderNo: '2607AA0130', orderStatus: '已签入', b2bOrderNo: '2607AA0130', customerOrderNo: 'FBA19H60CGMJ', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '14', ytOrderNo: '2607AA0129', orderStatus: '已签入', b2bOrderNo: '2607AA0129', customerOrderNo: 'FBA19H5ZS4SY', createTime: '2026-07-01 11:03:55', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '2026-07-01 12:02:00', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
  { key: '15', ytOrderNo: '2607AA0128', orderStatus: '草稿', b2bOrderNo: '2607AA0128', customerOrderNo: 'FBA19H5ZPLMR', createTime: '2026-07-01 11:03:56', orderType: 'B2B', orderSource: '新用户中心（批量）', customerCode: 'BCNHC21498', isFirstBatch: false, signInTime: '', salesman: '韩利兵', csRep: '叶佳佳', follower: '', latestFollowUp: '', salesProduct: '美国海派(特快)-CLX', serviceChannel: '' },
];

const MOCK_DATA: OrderRecord[] = MOCK_BASE.map((r, i) => ({
  ...r,
  countryName: r.countryName ?? '美国',
  isClearance: r.isClearance ?? (i % 2 ? 'Y' : 'N'),
  addressReviewStatus: r.addressReviewStatus ?? (i % 3 === 0 ? '1' : i % 3 === 1 ? '0' : '2'),
  auditStatus: r.auditStatus ?? (i % 4 === 0 ? '待审核' : i % 4 === 1 ? '审核暂存' : i % 4 === 2 ? '审核通过' : '审核不通过'),
  postCode: r.postCode ?? `9${(1000 + i * 37).toString().padStart(4, '0')}12`,
  goodsAmount: r.goodsAmount ?? 5 + i,
  estimateWeight: r.estimateWeight ?? 10 + i * 2,
  chargeWeight: r.chargeWeight ?? 10 + i * 2,
  customsMode: r.customsMode ?? (i % 2 ? '单独报关' : '代理报关'),
  taxMethod: r.taxMethod ?? (['DDU', 'DDP', 'PVA'][i % 3]),
  deliveryType: r.deliveryType ?? (i % 2 ? 2 : 1),
  chargeStatus: r.chargeStatus ?? ([0, 1, 2, 10, 20][i % 5]),
  addressType: r.addressType ?? ([1, 3, 2][i % 3]),
  interceptStatus: r.interceptStatus ?? (i === 1 ? 'Y' : 'N'),
  interceptReason: r.interceptReason ?? (i === 1 ? '客户要求暂扣' : ''),
  serverHawbCode: r.serverHawbCode ?? `SVR${r.ytOrderNo}`,
  consignee: r.consignee ?? 'John Smith',
  warehouseCode: r.warehouseCode ?? 'USLAX',
  sortingCode: r.sortingCode ?? `S${1000 + i}`,
  billStatus: r.billStatus ?? (i % 2 ? '已入账' : '未入账'),
}));

// 从 Mock 数据派生的筛选枚举
const SALESMAN_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.salesman).filter(Boolean))).map(v => ({ value: v, label: v }));
const CUSTOMER_CODE_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.customerCode).filter(Boolean))).map(v => ({ value: v, label: v }));
const COUNTRY_OPTIONS = Array.from(new Set(MOCK_DATA.map(d => d.countryName).filter(Boolean))).map(v => ({ value: v, label: v }));
const CHANNEL_OPTIONS = ['US-Line-A', 'US-Line-B', 'EU-Line-C', 'JP-Line-D'].map(v => ({ value: v, label: v }));

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

  // ---------- 拦截 ----------
  const [interceptModalOpen, setInterceptModalOpen] = useState(false);
  const [interceptCategory, setInterceptCategory] = useState<string>('全部');
  const [interceptSearch, setInterceptSearch] = useState('');
  const [interceptSelectedCode, setInterceptSelectedCode] = useState<string | null>(null);
  const [interceptRemark, setInterceptRemark] = useState('');

  // ---------- 跟进 ----------
  const [followUpHistory, setFollowUpHistory] = useState<Record<string, { time: string; operator: string; content: string; hidden?: boolean }[]>>(MOCK_FOLLOW_UP_HISTORY);
  const [detentionModalOpen, setDetentionModalOpen] = useState(false);
  const [detentionRecord, setDetentionRecord] = useState<OrderRecord | null>(null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpRecord, setFollowUpRecord] = useState<OrderRecord | null>(null);
  const [followUpContent, setFollowUpContent] = useState('');

  // ---------- 地址审核 ----------
  const [addressReviewOpen, setAddressReviewOpen] = useState(false);
  const [addressReviewStatus, setAddressReviewStatus] = useState<string | undefined>(undefined);

  // ---------- 详情 / 编辑 / 日志 ----------
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<OrderRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<OrderRecord | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logRecord, setLogRecord] = useState<OrderRecord | null>(null);

  // ---------- 审核 / 批量审核 ----------
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRecord, setAuditRecord] = useState<OrderRecord | null>(null);
  const [auditReason, setAuditReason] = useState('');
  const [batchReviewOpen, setBatchReviewOpen] = useState(false);
  const [batchReviewRadio, setBatchReviewRadio] = useState<string | undefined>(undefined);
  const [batchReviewReason, setBatchReviewReason] = useState('');

  // ---------- 批量修改额外服务 / 费用 ----------
  const [extraServiceOpen, setExtraServiceOpen] = useState(false);
  const [extraServiceList, setExtraServiceList] = useState<{ code: string | undefined; name: string }[]>([]);
  const [editFeeOpen, setEditFeeOpen] = useState(false);
  const [feeList, setFeeList] = useState<{ code: string | undefined; price: number | null }[]>([]);

  // ---------- 确认费用 / 撤销审核 / 取消拦截 ----------
  const [confirmFeeOpen, setConfirmFeeOpen] = useState(false);
  const [confirmFeeRadio, setConfirmFeeRadio] = useState<boolean>(true);
  const [confirmFeeMsg, setConfirmFeeMsg] = useState('');
  const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
  const [cancelReviewReason, setCancelReviewReason] = useState('');
  const [cancelInterceptOpen, setCancelInterceptOpen] = useState(false);
  const [cancelInterceptSelected, setCancelInterceptSelected] = useState<string[]>([]);
  const [cancelInterceptRemark, setCancelInterceptRemark] = useState('');

  // ---------- 打印运单 / 列配置 / 导出 ----------
  const [printOpen, setPrintOpen] = useState(false);
  const [printTemplate, setPrintTemplate] = useState<'label' | 'waybill'>('label');
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportKey, setExportKey] = useState<string>('');
  const [exportOption, setExportOption] = useState<string>('selected');

  // ---------- 地址审核状态导入 ----------
  const [addrImportOpen, setAddrImportOpen] = useState(false);
  const [addrImportLoading, setAddrImportLoading] = useState(false);
  const [addrImportFileList, setAddrImportFileList] = useState<any[]>([]);
  const [addrImportPreview, setAddrImportPreview] = useState<any[]>([]);
  const [addrImportInvalid, setAddrImportInvalid] = useState<any[]>([]);
  const [addrImportValidRows, setAddrImportValidRows] = useState<any[]>([]);
  const [addrImportFileName, setAddrImportFileName] = useState('');

  // ---------- 表格 ----------
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();



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
      if (filters.isFirstBatch === 'Y' && !r.isFirstBatch) return false;
      if (filters.isFirstBatch === 'N' && r.isFirstBatch) return false;
    }
    if (filters.latestFollowUp && !r.latestFollowUp.includes(filters.latestFollowUp)) return false;
    if (filters.followerFilter && !r.follower.includes(filters.followerFilter)) return false;
    if (filters.isCustoms !== undefined && r.isClearance !== filters.isCustoms) return false;
    if (filters.addressAuditStatus !== undefined && r.addressReviewStatus !== filters.addressAuditStatus) return false;
    if (filters.isIntercepted !== undefined && r.interceptStatus !== filters.isIntercepted) return false;
    if (filters.addressType !== undefined && r.addressType !== filters.addressType) return false;
    if (filters.billingResult !== undefined && Number(r.chargeStatus) !== Number(filters.billingResult)) return false;
    if (filters.detentionReason && filters.detentionReason.length > 0) {
      const reasons = MOCK_DETENTION[r.ytOrderNo];
      if (!reasons || !reasons.some(d => filters.detentionReason!.includes(d.reason))) return false;
    }
    return true;
  });

  // 渲染辅助
  const renderYesNo = (v: string) => (v === 'Y' ? <Tag color="green">是</Tag> : '否');
  const AUDIT_TAG: Record<string, string> = { 待审核: 'default', 审核暂存: 'processing', 审核通过: 'green', 审核不通过: 'red' };
  const CHARGE_TAG: Record<string, string> = { 0: 'default', 1: 'default', 2: 'red', 10: 'green', 20: 'red' };
  const CHARGE_LABEL: Record<string, string> = { 0: '未计费', 1: '无需计费', 2: '欠费', 10: '计费成功', 20: '计费失败' };
  const ADDRESS_REVIEW_LABEL: Record<string, string> = { '0': '待审核', '1': '已审核', '2': '待确认' };
  const ADDRESS_REVIEW_COLOR: Record<string, string> = { '0': 'default', '1': 'green', '2': 'orange' };

  // ---------- 表格列 ----------
  const columns: ColumnsType<OrderRecord> = [
    { title: '序号', width: 50, align: 'center', fixed: 'left', render: (_: any, __: OrderRecord, idx: number) => idx + 1 },
    { title: '运单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 160, fixed: 'left', sorter: (a: OrderRecord, b: OrderRecord) => a.ytOrderNo.localeCompare(b.ytOrderNo), render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '订单状态', dataIndex: 'orderStatus', key: 'orderStatus', width: 110, fixed: 'left', render: (v: string) => <Tag color="processing">{v}</Tag> },
    { title: 'B2B单号', dataIndex: 'b2bOrderNo', key: 'b2bOrderNo', width: 130, sorter: true, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '客户单号', dataIndex: 'customerOrderNo', key: 'customerOrderNo', width: 200, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 155, sorter: true },
    { title: '订单类型', dataIndex: 'orderType', key: 'orderType', width: 90, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '订单来源', dataIndex: 'orderSource', key: 'orderSource', width: 140, ellipsis: true },
    { title: '客户代码', dataIndex: 'customerCode', key: 'customerCode', width: 130, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '是否首批', dataIndex: 'isFirstBatch', key: 'isFirstBatch', width: 90, align: 'center', render: (v: boolean) => v ? <Tag color="green">是</Tag> : '否' },
    { title: '目的国家', dataIndex: 'countryName', key: 'countryName', width: 100 },
    { title: '是否报关件', dataIndex: 'isClearance', key: 'isClearance', width: 110, align: 'center', render: (v: string) => renderYesNo(v) },
    { title: '地址审核状态', dataIndex: 'addressReviewStatus', key: 'addressReviewStatus', width: 120, align: 'center', render: (v: string) => <Tag color={ADDRESS_REVIEW_COLOR[v]}>{ADDRESS_REVIEW_LABEL[v] ?? v}</Tag> },
    { title: '审核状态', dataIndex: 'auditStatus', key: 'auditStatus', width: 110, align: 'center', render: (v: string) => <Tag color={AUDIT_TAG[v]}>{v}</Tag> },
    { title: '业务员', dataIndex: 'salesman', key: 'salesman', width: 90 },
    { title: '客服员', dataIndex: 'csRep', key: 'csRep', width: 90 },
    { title: '跟进人', dataIndex: 'follower', key: 'follower', width: 90, render: (v: string) => v || '-' },
    { title: '最新跟进内容', dataIndex: 'latestFollowUp', key: 'latestFollowUp', width: 220, ellipsis: true, render: (_v: string, record: OrderRecord) => {
      const history = followUpHistory[record.ytOrderNo] || [];
      const latestVisible = history.find(h => !h.hidden);
      return latestVisible ? latestVisible.content : (record.latestFollowUp || '-');
    }},
    { title: '认领时间', dataIndex: 'claimedTime', key: 'claimedTime', width: 155, render: (v: string) => v || '-' },
    { title: '销售产品', dataIndex: 'salesProduct', key: 'salesProduct', width: 200, ellipsis: true },
    { title: '服务渠道名称', dataIndex: 'serviceChannel', key: 'serviceChannel', width: 200, render: (v: string) => v || '—' },
    { title: '报关方式', dataIndex: 'customsMode', key: 'customsMode', width: 120 },
    { title: '清关方案', dataIndex: 'taxMethod', key: 'taxMethod', width: 110 },
    { title: '配送方式', dataIndex: 'deliveryType', key: 'deliveryType', width: 120, render: (v: number) => v === 1 ? '云途' : v === 2 ? '客户自送' : '' },
    { title: '邮编', dataIndex: 'postCode', key: 'postCode', width: 110, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '件数', dataIndex: 'goodsAmount', key: 'goodsAmount', width: 80, align: 'right' },
    { title: '预估重量(kg)', dataIndex: 'estimateWeight', key: 'estimateWeight', width: 120, align: 'right' },
    { title: '计费重(kg)', dataIndex: 'chargeWeight', key: 'chargeWeight', width: 120, align: 'right' },
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
    { title: '计费状态', dataIndex: 'chargeStatus', key: 'chargeStatus', width: 120, align: 'center', render: (v: string) => <Tag color={CHARGE_TAG[v]}>{CHARGE_LABEL[v] ?? v}</Tag> },
    { title: '是否拦截', dataIndex: 'interceptStatus', key: 'interceptStatus', width: 100, align: 'center', render: (v: string) => v === 'Y' ? <Tag color="red">是</Tag> : '否' },
    { title: '拦截原因', dataIndex: 'interceptReason', key: 'interceptReason', width: 140, ellipsis: true, render: (v: string) => v || '-' },
    { title: '服务商单号', dataIndex: 'serverHawbCode', key: 'serverHawbCode', width: 150, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '收件人', dataIndex: 'consignee', key: 'consignee', width: 120 },
    { title: '仓库代码', dataIndex: 'warehouseCode', key: 'warehouseCode', width: 110, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '分拣码', dataIndex: 'sortingCode', key: 'sortingCode', width: 110, render: (v: string) => <span className="bol-mono">{v}</span> },
    { title: '入账状态', dataIndex: 'billStatus', key: 'billStatus', width: 100, align: 'center' },
  ];

  // ---------- 批量操作 ----------
  const requireSelected = (actionName: string) => {
    if (selectedRowKeys.length === 0) { message.warning(`请先勾选需要${actionName}的订单`); return false; }
    return true;
  };
  const selectedRecords = () => MOCK_DATA.filter(r => selectedRowKeys.includes(r.key));

  const handleBatchAudit = useCallback(() => {
    if (!requireSelected('批量审核')) return;
    setBatchReviewRadio(undefined);
    setBatchReviewReason('');
    setBatchReviewOpen(true);
  }, [selectedRowKeys]);

  const handleBatchExtraService = useCallback(() => {
    if (!requireSelected('批量修改额外服务')) return;
    setExtraServiceList([{ code: undefined, name: '' }]);
    setExtraServiceOpen(true);
  }, [selectedRowKeys]);

  const handleBatchEditFee = useCallback(() => {
    if (!requireSelected('批量修改费用')) return;
    setFeeList([{ code: undefined, price: null }]);
    setEditFeeOpen(true);
  }, [selectedRowKeys]);

  const handleConfirmFee = useCallback(() => {
    if (!requireSelected('确认费用')) return;
    const invalid = selectedRecords().filter(r => r.orderStatus !== '待客户确认');
    if (invalid.length > 0) {
      message.warning('仅「待客户确认」状态的订单可确认费用，请检查勾选数据');
      return;
    }
    setConfirmFeeRadio(true);
    setConfirmFeeMsg('');
    setConfirmFeeOpen(true);
  }, [selectedRowKeys]);

  const handleCancelReview = useCallback(() => {
    if (!requireSelected('撤销审核')) return;
    const valid = selectedRecords().every(
      r => r.orderStatus === '待客户确认' && r.auditStatus === '审核通过'
    );
    if (!valid) {
      message.warning('仅「待客户确认」且审核状态为「审核通过」的订单可撤销审核');
      return;
    }
    setCancelReviewReason('');
    setCancelReviewOpen(true);
  }, [selectedRowKeys]);

  const handleDelete = useCallback(() => {
    if (!requireSelected('删除')) return;
    const invalid = selectedRecords().filter(r => r.orderStatus !== '已预报');
    if (invalid.length > 0) {
      message.warning('仅「已预报」状态的订单可删除，请检查勾选数据');
      return;
    }
    Modal.confirm({
      title: '删除订单',
      content: `确定删除勾选的 ${selectedRowKeys.length} 条订单吗？此操作不可恢复。`,
      okText: '确定删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => { message.success(`已删除 ${selectedRowKeys.length} 条订单（模拟）`); setSelectedRowKeys([]); },
    });
  }, [selectedRowKeys]);

  const handleRefresh = useCallback(() => {
    if (!filters.orderNo && !filters.b2bOrderNo) {
      message.warning('请先输入单号或 B2B 单号后再刷新');
      return;
    }
    message.success('列表已刷新（模拟）');
  }, [filters.orderNo, filters.b2bOrderNo]);

  const handleAddressReview = useCallback(() => {
    if (!requireSelected('地址审核')) return;
    const notPredicted = selectedRecords().filter(r => r.orderStatus !== '已预报');
    if (notPredicted.length > 0) {
      message.warning('只有「已预报」的订单支持修改地址审核状态，请检查');
      return;
    }
    setAddressReviewStatus(undefined);
    setAddressReviewOpen(true);
  }, [selectedRowKeys]);

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

  const handleClaim = useCallback(() => {
    if (!requireSelected('认领')) return;
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

  // ==================== 拦截 ====================
  const handleIntercept = useCallback(() => {
    if (!requireSelected('拦截')) return;
    setInterceptCategory('全部');
    setInterceptSearch('');
    setInterceptSelectedCode(null);
    setInterceptRemark('');
    setInterceptModalOpen(true);
  }, [selectedRowKeys]);

  // 过滤后的拦截原因列表
  const filteredInterceptReasons = MOCK_INTERCEPT_REASONS.filter(r => {
    const catOk = interceptCategory === '全部' || r.category === interceptCategory;
    const search = interceptSearch.trim().toLowerCase();
    const searchOk = !search || r.code.toLowerCase().includes(search) || r.name.includes(interceptSearch) || r.content.includes(interceptSearch);
    return catOk && searchOk;
  });

  const handleSelectInterceptRow = (record: InterceptReason) => {
    setInterceptSelectedCode(record.code);
    // 选中后，备注默认填充为该原因的问题内容，用户可继续编辑
    setInterceptRemark(record.content);
  };

  const handleInterceptSubmit = useCallback(() => {
    if (!interceptSelectedCode) { message.warning('请先选择一条拦截原因'); return; }
    const selected = MOCK_INTERCEPT_REASONS.find(r => r.code === interceptSelectedCode);
    // 客户要求暂扣(A1)时，拦截备注必填
    if (selected?.name === '客户要求暂扣' && !interceptRemark.trim()) {
      message.warning('拦截原因选择"客户要求暂扣"时，拦截备注为必填项');
      return;
    }
    message.success(`已拦截 ${selectedRowKeys.length} 条订单（原因：${selected?.code} ${selected?.name}）`);
    setInterceptModalOpen(false);
    setSelectedRowKeys([]);
  }, [interceptSelectedCode, interceptRemark, selectedRowKeys]);

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

  // 真实业务 8 种导出
  const EXPORT_TYPES: { key: string; label: string; needSelect?: boolean; statusLimit?: string[] }[] = [
    { key: 'detail', label: '订单详情导出' },
    { key: 'declare', label: '申报信息导出' },
    { key: 'charge', label: '计费信息导出' },
    { key: 'express', label: '快递发票导出' },
    { key: 'hl', label: '欧洲HL发票导出' },
    { key: 'ship', label: '发货证明导出', needSelect: true, statusLimit: ['已签收'] },
    { key: 'sign', label: '签收证明导出', needSelect: true, statusLimit: ['已签出', '客户已确认'] },
    { key: 'board', label: '看板信息导出' },
  ];

  const handleExportType = useCallback((key: string) => {
    const t = EXPORT_TYPES.find(e => e.key === key);
    if (!t) return;
    // 发货/签收证明等需勾选且受状态限制的导出，打开配置弹框前先校验
    if (t.needSelect) {
      if (selectedRowKeys.length === 0) { message.warning('请先勾选数据再导出'); return; }
      if (t.statusLimit) {
        const invalid = selectedRecords().filter(r => !t.statusLimit!.includes(r.orderStatus));
        if (invalid.length > 0) { message.warning(`只支持导出${t.statusLimit.join('/')}状态订单`); return; }
      }
    }
    setExportKey(key);
    setExportOption(selectedRowKeys.length > 0 ? 'selected' : 'all');
    setExportOpen(true);
  }, [selectedRowKeys]);

  // ==================== 地址审核状态导入 ====================
  const ADDR_REVIEW_IMPORT_HEADER = ['运单号', '地址审核状态'];
  const ADDR_REVIEW_INPUT_OPTIONS = ['待审核', '已审核', '待确认'];

  const resetAddrImport = useCallback(() => {
    setAddrImportFileList([]);
    setAddrImportPreview([]);
    setAddrImportInvalid([]);
    setAddrImportValidRows([]);
    setAddrImportFileName('');
    setAddrImportLoading(false);
    setAddrImportOpen(true);
  }, []);

  // 解析上传的 xlsx：校验表头、逐行校验（运单号存在 + 地址审核状态合法）
  const buildAddrImportPreview = (rows: string[][]) => {
    const header = (rows[0] || []).map(h => String(h ?? '').trim());
    if (rows.length <= 1) { message.warning('文件中没有数据行，请填写后重新上传'); return; }
    const ytIdx = header.indexOf('运单号');
    if (ytIdx === -1) { message.warning('文件缺少「运单号」列，请下载模板后按表头填写'); return; }
    const stIdx = header.indexOf('地址审核状态');
    if (stIdx === -1) { message.warning('文件缺少「地址审核状态」列，请下载模板后按表头填写'); return; }

    const preview: any[] = [];
    const invalid: any[] = [];
    const validRows: any[] = [];
    rows.slice(1).forEach((r, i) => {
      const yt = String(r[ytIdx] ?? '').trim();
      const st = String(r[stIdx] ?? '').trim();
      if (!yt) {
        invalid.push({ ytOrderNo: '（空）', reviewStatus: st || '-', reason: '运单号为空' });
        return;
      }
      const exists = MOCK_DATA.some(d => d.ytOrderNo === yt);
      if (!exists) {
        invalid.push({ ytOrderNo: yt, reviewStatus: st || '-', reason: '运单号不存在' });
        return;
      }
      if (!ADDR_REVIEW_INPUT_OPTIONS.includes(st)) {
        invalid.push({ ytOrderNo: yt, reviewStatus: st || '-', reason: '地址审核状态不合法（仅支持：待审核/已审核/待确认）' });
        return;
      }
      const code = ADDRESS_REVIEW_OPTIONS.find(o => o.label === st)?.value ?? '';
      validRows.push({ ytOrderNo: yt, reviewStatus: st, code });
      preview.push({ key: i + 1, ytOrderNo: yt, reviewStatus: st, action: `更新为「${st}」` });
    });
    setAddrImportPreview(preview);
    setAddrImportInvalid(invalid);
    setAddrImportValidRows(validRows);
    if (preview.length) message.success(`已解析文件：共 ${preview.length} 条可导入数据`);
  };

  const onAddrImportBeforeUpload = useCallback(async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      message.error('仅支持 .xlsx 格式文件，请下载模板填写后另存为 .xlsx 再上传');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过 10MB');
      return false;
    }
    setAddrImportFileName(file.name);
    setAddrImportFileList([{ uid: '-1', name: file.name }]);
    setAddrImportLoading(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      buildAddrImportPreview(rows);
    } catch (e) {
      message.error('文件解析失败，请检查文件内容是否正确');
      setAddrImportFileList([]);
      setAddrImportPreview([]);
      setAddrImportInvalid([]);
      setAddrImportValidRows([]);
      setAddrImportFileName('');
    } finally {
      setAddrImportLoading(false);
    }
    return false;
  }, []);

  const downloadAddrImportTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ADDR_REVIEW_IMPORT_HEADER,
      ['2607AA0142', '已审核'],
      ['2607AA0141', '待审核'],
      ['2607AA0140', '待确认'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, '地址审核状态导入模板');
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '地址审核状态导入模板.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('已下载「地址审核状态导入模板.xlsx」，表头：运单号、地址审核状态');
  }, []);

  const handleAddrImport = useCallback(() => {
    if (!addrImportFileName) { message.warning('请先导入文件'); return; }
    if (!addrImportPreview.length) { message.warning('未解析到可导入的数据，请检查文件内容'); return; }
    const invalid = addrImportInvalid;
    if (invalid.length > 0) {
      Modal.confirm({
        title: '导入失败，存在错误数据',
        width: 640,
        okText: '我知道了',
        cancelText: '关闭',
        content: (
          <pre style={{ whiteSpace: 'pre-line', maxHeight: '50vh', overflow: 'auto', fontSize: 13 }}>
            {`共 ${invalid.length} 条记录存在错误，无法导入：\n`}
            {invalid.map(r => `运单号：${r.ytOrderNo}，地址审核状态：${r.reviewStatus}（原因：${r.reason}）`).join('\n')}
          </pre>
        ),
      });
      return;
    }
    setAddrImportLoading(true);
    setTimeout(() => {
      setAddrImportLoading(false);
      Modal.success({ title: '导入成功', content: '地址审核状态导入成功，请在【下载中心】查看导入结果！' });
      setAddrImportOpen(false);
      resetAddrImportState();
    }, 600);
  }, [addrImportFileName, addrImportPreview, addrImportInvalid, resetAddrImportState]);

  const resetAddrImportState = useCallback(() => {
    setAddrImportFileList([]);
    setAddrImportPreview([]);
    setAddrImportInvalid([]);
    setAddrImportValidRows([]);
    setAddrImportFileName('');
    setAddrImportLoading(false);
  }, []);

  const handleMoreMenu = useCallback(({ key }: { key: string }) => {
    if (key === 'import-addr-review') resetAddrImport();
    else if (key === 'export-followup') handleExportFollowUp();
    else if (key === 'export-detention') handleExportDetention();
    else if (key.startsWith('export-')) handleExportType(key.replace('export-', ''));
    else if (key === '1') { setPrintTemplate('label'); setPrintOpen(true); }
    else if (key === '2') setColumnConfigOpen(true);
    else message.info(`功能 "${key}" 待接入后台（原型演示）`);
  }, [handleExportFollowUp, handleExportDetention, handleExportType, resetAddrImport]);

  const selectedInterceptItem = MOCK_INTERCEPT_REASONS.find(r => r.code === interceptSelectedCode);

  const moreMenuItems = [
    { type: 'group' as const, label: '导出', children: EXPORT_TYPES.map(e => ({ key: `export-${e.key}`, label: e.label })) },
    { type: 'divider' as const },
    { key: 'export-followup', label: '跟进记录导出' },
    { key: 'export-detention', label: '扣件原因导出' },
    { type: 'divider' as const },
    { key: 'import-addr-review', label: '地址审核状态导入' },
    { key: '1', label: '打印运单' },
    { key: '2', label: '列配置' },
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
                    <Select placeholder="输入国家二字码/名称/英文搜索" allowClear showSearch options={COUNTRY_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="channelCode" label="渠道代码" className="bol-form-item">
                    <Select placeholder="输入渠道代码/中英文名、服务商代码搜索" allowClear showSearch options={CHANNEL_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="salesman" label="业务员" className="bol-form-item">
                    <Select placeholder="输入工号/姓名搜索" allowClear showSearch options={SALESMAN_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="followerFilter" label="跟进人" className="bol-form-item">
                    <Input placeholder="输入跟进人搜索" prefix={<SearchOutlined />} allowClear />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="customerCode" label="客户代码" className="bol-form-item">
                    <Select placeholder="输入客户代码搜索" allowClear showSearch options={CUSTOMER_CODE_OPTIONS} />
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
                    <Select placeholder="请选择" allowClear options={ADDRESS_TYPE_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="isDetained" label="是否扣件" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={YES_NO_OPTIONS} showSearch />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="addressAuditStatus" label="地址审核状态" className="bol-form-item">
                    <Select placeholder="请选择" allowClear options={ADDRESS_REVIEW_OPTIONS} showSearch />
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
                    <Select placeholder="请选择" allowClear options={BILLING_RESULT_OPTIONS} showSearch />
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
          <Button onClick={handleCancelReview} disabled={selectedRowKeys.length === 0}>撤销审核</Button>
          <Button onClick={handleBatchExtraService} disabled={selectedRowKeys.length === 0}>批量修改额外服务</Button>
          <Button type="primary" onClick={handleBatchEditFee} disabled={selectedRowKeys.length === 0}>批量修改费用</Button>
          <Button onClick={handleConfirmFee} disabled={selectedRowKeys.length === 0}>确认费用</Button>
          <Button danger onClick={handleIntercept} disabled={selectedRowKeys.length === 0}>拦截</Button>
          <Button onClick={() => { if (!requireSelected('取消拦截')) return; setCancelInterceptSelected([]); setCancelInterceptRemark(''); setCancelInterceptOpen(true); }} disabled={selectedRowKeys.length === 0}>取消拦截</Button>
          <Button type="primary" onClick={handleClaim} disabled={selectedRowKeys.length === 0}>
            认领{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
          </Button>
          <Button danger onClick={handleDelete} disabled={selectedRowKeys.length === 0} icon={<DeleteOutlined />}>删除</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          <Button onClick={handleAddressReview} disabled={selectedRowKeys.length === 0}>地址审核</Button>
          <Button icon={<CopyOutlined />} onClick={() => { setColumnConfigOpen(true); }}>复制显示列</Button>
          <Dropdown menu={{ items: moreMenuItems, onClick: handleMoreMenu }}>
            <Button>更多 <DownOutlined /></Button>
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
          scroll={{ x: 5200 }}
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

      {/* 地址审核弹窗 */}
      <Modal
        title="地址审核"
        open={addressReviewOpen}
        onCancel={() => setAddressReviewOpen(false)}
        width={480}
        footer={[
          <Button key="cancel" onClick={() => setAddressReviewOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" disabled={!addressReviewStatus}
            onClick={() => { message.success(`已更新 ${selectedRowKeys.length} 条订单的地址审核状态（模拟）`); setAddressReviewOpen(false); setSelectedRowKeys([]); }}>确定</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="地址审核状态" required>
            <Radio.Group value={addressReviewStatus} onChange={(e) => setAddressReviewStatus(e.target.value)}>
              {ADDRESS_REVIEW_OPTIONS.map(o => <Radio key={o.value} value={o.value}>{o.label}</Radio>)}
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* 拦截弹窗：拦截类型 + 搜索 + 列表 + 选择的拦截内容 + 备注 */}
      <Modal
        title="拦截"
        open={interceptModalOpen}
        onCancel={() => setInterceptModalOpen(false)}
        width={780}
        footer={[
          <Button key="cancel" onClick={() => setInterceptModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleInterceptSubmit}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 12 }}>
          <span style={{ marginRight: 16 }}>
            拦截类型：
            <Select
              value={interceptCategory}
              onChange={setInterceptCategory}
              options={INTERCEPT_CATEGORY_OPTIONS}
              style={{ width: 160 }}
            />
          </span>
          <span>
            搜索内容：
            <Input
              placeholder="请输入"
              value={interceptSearch}
              onChange={(e) => setInterceptSearch(e.target.value)}
              style={{ width: 240, marginLeft: 4 }}
              allowClear
            />
          </span>
        </div>

        <Table
          rowKey="code"
          size="small"
          dataSource={filteredInterceptReasons}
          pagination={false}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: interceptSelectedCode ? [interceptSelectedCode] : [],
            onChange: (keys) => {
              const code = keys[0] as string;
              const record = MOCK_INTERCEPT_REASONS.find(r => r.code === code);
              if (record) handleSelectInterceptRow(record);
              else setInterceptSelectedCode(null);
            },
          }}
          onRow={(record) => ({
            onClick: () => handleSelectInterceptRow(record),
          })}
          columns={[
            { title: '序号', key: 'idx', width: 60, render: (_: any, __: any, i: number) => i + 1 },
            { title: '助记码', dataIndex: 'code', key: 'code', width: 100 },
            { title: '中文名称', dataIndex: 'name', key: 'name', width: 200 },
            { title: '问题内容', dataIndex: 'content', key: 'content', ellipsis: true },
          ]}
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#333', marginBottom: 6 }}>
            选择的拦截内容：{selectedInterceptItem ? `${selectedInterceptItem.code} ${selectedInterceptItem.name}：${selectedInterceptItem.content}` : '未选择'}
          </div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            拦截备注
          </div>
          <Input.TextArea
            rows={4}
            value={interceptRemark}
            onChange={(e) => setInterceptRemark(e.target.value)}
            placeholder="请输入拦截备注"
          />
        </div>
      </Modal>

      {/* ============ 详情弹框 ============ */}
      <Modal
        title="订单详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        width={1200}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      >
        {detailRecord && (
          <>
            <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="YT单号">{detailRecord.ytOrderNo}</Descriptions.Item>
                <Descriptions.Item label="B2B单号">{detailRecord.b2bOrderNo}</Descriptions.Item>
                <Descriptions.Item label="客户单号">{detailRecord.customerOrderNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="服务商单号">{detailRecord.serverHawbCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="分拣码">{detailRecord.sortingCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="客户代码">{detailRecord.customerCode}</Descriptions.Item>
                <Descriptions.Item label="订单状态">{detailRecord.orderStatus}</Descriptions.Item>
                <Descriptions.Item label="审核状态"><Tag color={AUDIT_TAG[detailRecord.auditStatus]}>{detailRecord.auditStatus}</Tag></Descriptions.Item>
                <Descriptions.Item label="订单来源">{detailRecord.orderSource}</Descriptions.Item>
                <Descriptions.Item label="订单类型">{detailRecord.orderType}</Descriptions.Item>
                <Descriptions.Item label="销售产品">{detailRecord.salesProduct}</Descriptions.Item>
                <Descriptions.Item label="服务渠道">{detailRecord.serviceChannel || '-'}</Descriptions.Item>
                <Descriptions.Item label="目的国家">{detailRecord.countryName}</Descriptions.Item>
                <Descriptions.Item label="清关方案">{detailRecord.taxMethod}</Descriptions.Item>
                <Descriptions.Item label="是否报关件">{renderYesNo(detailRecord.isClearance)}</Descriptions.Item>
                <Descriptions.Item label="报关方式">{detailRecord.customsMode}</Descriptions.Item>
                <Descriptions.Item label="业务员">{detailRecord.salesman}</Descriptions.Item>
                <Descriptions.Item label="客服员">{detailRecord.csRep}</Descriptions.Item>
                <Descriptions.Item label="跟进人">{detailRecord.follower || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="收件人信息" style={{ marginBottom: 16 }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="地址类型">{ADDRESS_TYPE_OPTIONS.find(o => o.value === detailRecord.addressType)?.label ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="仓库代码">{detailRecord.warehouseCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="收件人">{detailRecord.consignee || '-'}</Descriptions.Item>
                <Descriptions.Item label="目的国家">{detailRecord.countryName}</Descriptions.Item>
                <Descriptions.Item label="邮编">{detailRecord.postCode}</Descriptions.Item>
                <Descriptions.Item label="地址审核状态">{(ADDRESS_REVIEW_LABEL[detailRecord.addressReviewStatus] ?? detailRecord.addressReviewStatus) || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="货物 / 清关信息" style={{ marginBottom: 16 }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="件数">{detailRecord.goodsAmount}</Descriptions.Item>
                <Descriptions.Item label="预估重量(kg)">{detailRecord.estimateWeight}</Descriptions.Item>
                <Descriptions.Item label="计费重(kg)">{detailRecord.chargeWeight}</Descriptions.Item>
                <Descriptions.Item label="报关方式">{detailRecord.customsMode}</Descriptions.Item>
                <Descriptions.Item label="清关方案">{detailRecord.taxMethod}</Descriptions.Item>
                <Descriptions.Item label="配送方式">{detailRecord.deliveryType === 1 ? '云途' : detailRecord.deliveryType === 2 ? '客户自送' : '-'}</Descriptions.Item>
                <Descriptions.Item label="服务商单号">{detailRecord.serverHawbCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="仓库代码">{detailRecord.warehouseCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="分拣码">{detailRecord.sortingCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="是否拦截">{detailRecord.interceptStatus === 'Y' ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="拦截原因">{detailRecord.interceptReason || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="费用信息">
              <Descriptions column={4} size="small">
                <Descriptions.Item label="计费状态"><Tag color={CHARGE_TAG[detailRecord.chargeStatus]}>{CHARGE_LABEL[detailRecord.chargeStatus] ?? detailRecord.chargeStatus}</Tag></Descriptions.Item>
                <Descriptions.Item label="入账状态">{detailRecord.billStatus}</Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        )}
      </Modal>

      {/* ============ 编辑弹框 ============ */}
      <Modal
        title={`编辑订单 — ${editRecord?.ytOrderNo ?? ''}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        width={760}
        footer={[
          <Button key="cancel" onClick={() => setEditOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              editForm.validateFields().then(() => {
                message.success(`已保存订单 ${editRecord?.ytOrderNo} 的编辑（模拟）`);
                setEditOpen(false);
              }).catch(() => {});
            }}>保存</Button>,
        ]}
      >
        {editRecord && (
          <Form form={editForm} layout="vertical" key={editRecord?.ytOrderNo ?? 'edit'} initialValues={{
            salesProduct: editRecord.salesProduct, serviceChannel: editRecord.serviceChannel,
            salesman: editRecord.salesman, customerService: editRecord.csRep,
            consignee: editRecord.consignee, countryName: editRecord.countryName,
            postCode: editRecord.postCode, goodsAmount: editRecord.goodsAmount,
            estimateWeight: editRecord.estimateWeight, customsMode: editRecord.customsMode,
            taxMethod: editRecord.taxMethod,
          }}>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="YT单号">{editRecord.ytOrderNo}</Descriptions.Item>
              <Descriptions.Item label="客户代码">{editRecord.customerCode}</Descriptions.Item>
              <Descriptions.Item label="订单类型">{editRecord.orderType}</Descriptions.Item>
              <Descriptions.Item label="订单状态">{editRecord.orderStatus}</Descriptions.Item>
            </Descriptions>
            <Row gutter={[16, 0]}>
              <Col span={12}>
                <Form.Item name="salesProduct" label="销售产品">
                  <Select options={SALES_PRODUCT_FLAT} showSearch placeholder="请选择" allowClear />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="serviceChannel" label="服务渠道">
                  <Input placeholder="请输入服务渠道代码" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="salesman" label="业务员">
                  <Input placeholder="请输入业务员" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="customerService" label="客服员">
                  <Input placeholder="请输入客服员" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="consignee" label="收件人">
                  <Input placeholder="请输入收件人" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="countryName" label="目的国家">
                  <Input placeholder="请输入目的国家" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="postCode" label="邮编">
                  <Input placeholder="请输入邮编" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="goodsAmount" label="件数（件）">
                  <InputNumber style={{ width: '100%' }} min={1} placeholder="请输入件数" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="estimateWeight" label="预估重量（kg）">
                  <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="请输入预估重量" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="customsMode" label="报关方式">
                  <Select options={CUSTOMS_CLEARANCE_OPTIONS} showSearch placeholder="请选择" allowClear />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="taxMethod" label="清关方案">
                  <Select options={CLEARANCE_PLAN_OPTIONS} showSearch placeholder="请选择" allowClear />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}
      </Modal>

      {/* ============ 日志弹框 ============ */}
      <Modal
        title="操作日志"
        open={logOpen}
        onCancel={() => setLogOpen(false)}
        width={560}
        footer={<Button onClick={() => setLogOpen(false)}>关闭</Button>}
      >
        {logRecord && (
          <Timeline
            items={(MOCK_LOG[logRecord.ytOrderNo] || [{ time: '-', operator: '系统', action: '暂无操作记录' }]).map(item => ({
              children: (
                <div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{item.time} · {item.operator}</div>
                  <div style={{ marginTop: 2 }}>{item.action}</div>
                </div>
              ),
            }))}
          />
        )}
      </Modal>

      {/* ============ 审核不通过弹框（对齐星云 review-nopass-dialog） ============ */}
      <Modal
        title="审核不通过"
        open={auditOpen}
        onCancel={() => { setAuditOpen(false); setAuditReason(''); }}
        width={700}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={() => { setAuditOpen(false); setAuditReason(''); }}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              if (!auditReason.trim()) { message.warning('请填写不通过原因'); return; }
              message.success(`已驳回审核 ${auditRecord?.ytOrderNo ?? ''}（模拟）`);
              setAuditOpen(false); setAuditReason('');
            }}>确定</Button>,
        ]}
      >
        {auditRecord && (
          <Form layout="vertical">
            <Form.Item label="不通过原因" required>
              <Input.TextArea
                rows={4}
                maxLength={200}
                showCount
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="请输入不通过原因（最多 200 字）"
              />
            </Form.Item>
            <div
              style={{
                fontSize: 12,
                color: '#fa8c16',
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              审核不通过后，系统会<b>自动通知客户</b>。
            </div>
          </Form>
        )}
      </Modal>

      {/* ============ 批量审核弹框 ============ */}
      <Modal
        title="批量审核"
        open={batchReviewOpen}
        onCancel={() => setBatchReviewOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setBatchReviewOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" disabled={!batchReviewRadio}
            onClick={() => {
              const pass = batchReviewRadio === '审核通过';
              if (!pass && !batchReviewReason.trim()) { message.warning('审核不通过时，审核说明为必填'); return; }
              message.success(`已批量${pass ? '通过' : '不通过'} ${selectedRowKeys.length} 个订单的审核（模拟）`);
              setBatchReviewOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>已勾选 <b>{selectedRowKeys.length}</b> 个订单。</div>
        <Form layout="vertical">
          <Form.Item label="审核结果" required>
            <Radio.Group value={batchReviewRadio} onChange={(e) => setBatchReviewRadio(e.target.value)}>
              <Radio value="审核通过">审核通过</Radio>
              <Radio value="审核不通过">审核不通过</Radio>
            </Radio.Group>
          </Form.Item>
          {batchReviewRadio === '审核不通过' && (
            <Form.Item label="审核说明" required>
              <Input.TextArea rows={4} maxLength={200} showCount value={batchReviewReason} onChange={(e) => setBatchReviewReason(e.target.value)} placeholder="请输入不通过原因（最多 200 字）" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ============ 批量修改额外服务弹框 ============ */}
      <Modal
        title="批量修改额外服务"
        open={extraServiceOpen}
        onCancel={() => setExtraServiceOpen(false)}
        width={620}
        footer={[
          <Button key="cancel" onClick={() => setExtraServiceOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              const filled = extraServiceList.filter(i => i.code);
              if (filled.length === 0) { message.warning('请至少添加一项额外服务'); return; }
              message.success(`已为 ${selectedRowKeys.length} 个订单修改额外服务（模拟）`);
              setExtraServiceOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>已勾选 <b>{selectedRowKeys.length}</b> 个订单，修改后将对所有勾选订单生效。</div>
        {extraServiceList.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select
              style={{ width: 360 }}
              placeholder="请选择额外服务"
              value={item.code}
              onChange={(v: string, opt: any) => setExtraServiceList(prev => prev.map((it, i) => i === idx ? { code: v, name: opt?.label || '' } : it))}
              options={EXTRA_SERVICE_OPTIONS}
              showSearch
            />
            <Button danger size="small" onClick={() => setExtraServiceList(prev => prev.filter((_, i) => i !== idx))}>删除</Button>
          </div>
        ))}
        <Button type="dashed" block onClick={() => setExtraServiceList(prev => [...prev, { code: undefined, name: '' }])}>新增一行</Button>
        <div style={{ marginTop: 12, fontSize: 12, color: '#fa8c16' }}>
          提示：批量修改额外服务会覆盖所选订单的现有服务项，请确认后提交。
        </div>
      </Modal>

      {/* ============ 批量修改费用弹框 ============ */}
      <Modal
        title="批量修改费用"
        open={editFeeOpen}
        onCancel={() => setEditFeeOpen(false)}
        width={620}
        footer={[
          <Button key="cancel" onClick={() => setEditFeeOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              const filled = feeList.filter(i => i.code);
              if (filled.length === 0) { message.warning('请至少添加一项费用'); return; }
              message.success(`已为 ${selectedRowKeys.length} 个订单修改费用（模拟）`);
              setEditFeeOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>已勾选 <b>{selectedRowKeys.length}</b> 个订单，修改后将对所有勾选订单生效。</div>
        {feeList.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <Select
              style={{ width: 280 }}
              placeholder="请选择费用项"
              value={item.code}
              onChange={(v: string) => setFeeList(prev => prev.map((it, i) => i === idx ? { ...it, code: v } : it))}
              options={FEE_OPTIONS}
              showSearch
            />
            <InputNumber
              style={{ width: 160 }}
              placeholder="金额"
              min={0}
              value={item.price}
              onChange={(v: number | null) => setFeeList(prev => prev.map((it, i) => i === idx ? { ...it, price: v } : it))}
            />
            <Button danger size="small" onClick={() => setFeeList(prev => prev.filter((_, i) => i !== idx))}>删除</Button>
          </div>
        ))}
        <Button type="dashed" block onClick={() => setFeeList(prev => [...prev, { code: undefined, price: null }])}>新增一行</Button>
        <div style={{ marginTop: 12, fontSize: 12, color: '#fa8c16' }}>
          提示：批量修改费用将同步更新计费，请确认金额无误后提交。
        </div>
      </Modal>

      {/* ============ 确认费用弹框 ============ */}
      <Modal
        title="确认费用"
        open={confirmFeeOpen}
        onCancel={() => setConfirmFeeOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setConfirmFeeOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              const confirm = confirmFeeRadio;
              if (!confirm && !confirmFeeMsg.trim()) { message.warning('不确认费用时，请填写说明'); return; }
              message.success(`${confirm ? '已确认' : '已标记不确认'} ${selectedRowKeys.length} 个订单的费用（模拟）`);
              setConfirmFeeOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>已勾选 <b>{selectedRowKeys.length}</b> 个「待客户确认」订单。</div>
        <Form layout="vertical">
          <Form.Item label="是否确认费用" required>
            <Radio.Group value={confirmFeeRadio} onChange={(e) => setConfirmFeeRadio(e.target.value)}>
              <Radio value={true}>确认费用</Radio>
              <Radio value={false}>不确认费用</Radio>
            </Radio.Group>
          </Form.Item>
          {!confirmFeeRadio && (
            <Form.Item label="不确认说明" required>
              <Input.TextArea rows={3} value={confirmFeeMsg} onChange={(e) => setConfirmFeeMsg(e.target.value)} placeholder="请填写不确认原因" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ============ 撤销审核弹框 ============ */}
      <Modal
        title="撤销审核"
        open={cancelReviewOpen}
        onCancel={() => setCancelReviewOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setCancelReviewOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              if (!cancelReviewReason.trim()) { message.warning('撤销审核说明为必填'); return; }
              message.success(`已撤销 ${selectedRowKeys.length} 条订单的审核（模拟）`);
              setCancelReviewOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>将撤销以下 <b>{selectedRowKeys.length}</b> 条「待客户确认」且审核状态为「审核通过」订单的审核结果。</div>
        <Form layout="vertical">
          <Form.Item label="撤销审核说明" required>
            <Input.TextArea rows={4} value={cancelReviewReason} onChange={(e) => setCancelReviewReason(e.target.value)} placeholder="请输入撤销原因" />
          </Form.Item>
        </Form>
        <div style={{ fontSize: 12, color: '#fa8c16' }}>提示：撤销审核后，订单将回到未审核状态，需重新提交审核。</div>
      </Modal>

      {/* ============ 取消拦截弹框 ============ */}
      <Modal
        title="取消拦截"
        open={cancelInterceptOpen}
        onCancel={() => setCancelInterceptOpen(false)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setCancelInterceptOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              if (cancelInterceptSelected.length === 0) { message.warning('请至少选择一个问题类型'); return; }
              message.success(`已取消 ${selectedRowKeys.length} 条订单的拦截（模拟）`);
              setCancelInterceptOpen(false); setSelectedRowKeys([]);
            }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>已勾选 <b>{selectedRowKeys.length}</b> 个订单，请选择需取消拦截的问题类型：</div>
        <Checkbox.Group value={cancelInterceptSelected} onChange={(v: any) => setCancelInterceptSelected(v)}>
          {MOCK_CANCEL_INTERCEPT.map(item => (
            <div key={item.code} style={{ marginBottom: 6 }}>
              <Checkbox value={item.code}>{`${item.code} ${item.name}`}</Checkbox>
              <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>{item.content}</span>
            </div>
          ))}
        </Checkbox.Group>
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="备注">
            <Input.TextArea rows={3} value={cancelInterceptRemark} onChange={(e) => setCancelInterceptRemark(e.target.value)} placeholder="请输入备注（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ============ 打印运单弹框 ============ */}
      <Modal
        title="打印运单"
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        width={480}
        footer={[
          <Button key="cancel" onClick={() => setPrintOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              message.success(`已发送「${printTemplate === 'label' ? '标签' : '面单'}」打印任务（模拟）`);
              setPrintOpen(false);
            }}>打印</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="打印模板" required>
            <Radio.Group value={printTemplate} onChange={(e) => setPrintTemplate(e.target.value)}>
              <Radio value="label">标签</Radio>
              <Radio value="waybill">面单</Radio>
            </Radio.Group>
          </Form.Item>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            将按所选模板批量打印当前{selectedRowKeys.length > 0 ? `勾选的 ${selectedRowKeys.length} 个` : '全部'}订单。
          </div>
        </Form>
      </Modal>

      {/* ============ 列配置 / 复制显示列 弹框 ============ */}
      <Modal
        title="列配置 / 复制显示列"
        open={columnConfigOpen}
        onCancel={() => setColumnConfigOpen(false)}
        width={560}
        footer={[
          <Button key="cancel" onClick={() => setColumnConfigOpen(false)}>取消</Button>,
          <Button key="copy" onClick={() => {
            const titles = columns.map(c => c.title as string).join('、');
            navigator.clipboard?.writeText(titles).then(() => message.success('已复制当前显示列标题')).catch(() => message.success(`显示列：${titles}`));
          }}>复制显示列</Button>,
          <Button key="submit" type="primary" onClick={() => { message.success('列配置已更新（模拟）'); setColumnConfigOpen(false); }}>确定</Button>,
        ]}
      >
        <div style={{ marginBottom: 8 }}>勾选需要显示的列（当前为演示，配置不持久化）：</div>
        <Checkbox.Group style={{ width: '100%' }}>
          <Row gutter={[8, 8]}>
            {columns.map(c => (
              <Col span={8} key={c.key as string}>
                <Checkbox value={c.key as string} checked>{c.title as string}</Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </Modal>

      {/* ============ 导出配置弹框 ============ */}
      <Modal
        title={`导出配置 — ${EXPORT_TYPES.find(e => e.key === exportKey)?.label ?? ''}`}
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setExportOpen(false)}>取消</Button>,
          <Button key="submit" type="primary"
            onClick={() => {
              const t = EXPORT_TYPES.find(e => e.key === exportKey);
              message.success(`已发起「${t?.label}」导出（范围：${exportOption === 'selected' ? '勾选数据' : '全部数据'}）（模拟）`);
              setExportOpen(false);
            }}>导出</Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="导出范围" required>
            <Radio.Group value={exportOption} onChange={(e) => setExportOption(e.target.value)}>
              <Radio value="selected" disabled={selectedRowKeys.length === 0}>导出勾选数据（{selectedRowKeys.length} 条）</Radio>
              <Radio value="all">导出全部数据</Radio>
            </Radio.Group>
          </Form.Item>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            导出文件将包含当前查询条件下对应字段，生成 CSV 文件下载。
          </div>
        </Form>
      </Modal>

      {/* ============ 地址审核状态导入弹框 ============ */}
      <Modal
        title="地址审核状态导入"
        open={addrImportOpen}
        onCancel={() => { setAddrImportOpen(false); resetAddrImportState(); }}
        width={960}
        maskClosable={false}
        footer={[
          <Button key="cancel" onClick={() => { setAddrImportOpen(false); resetAddrImportState(); }}>取消</Button>,
          <Button key="submit" type="primary" loading={addrImportLoading} onClick={handleAddrImport}>导入数据</Button>,
        ]}
      >
        <div className="bol-import-upload">
          <Upload
            accept=".xlsx"
            maxCount={1}
            beforeUpload={onAddrImportBeforeUpload}
            fileList={addrImportFileList}
            onRemove={() => resetAddrImportState()}
          >
            <Button icon={<UploadOutlined />} loading={addrImportLoading}>选择导入文件</Button>
          </Upload>
          {addrImportFileList.length === 0 && (
            <div className="bol-import-upload-tip">仅支持 .xlsx，表头：运单号、地址审核状态（待审核/已审核/待确认）</div>
          )}
        </div>

        {addrImportPreview.length > 0 && (
          <div className="bol-import-tips">
            <div className="bol-import-tips-title">数据预览</div>
            <Table
              rowKey="key"
              size="small"
              dataSource={addrImportPreview}
              columns={[
                { title: '序号', key: 'idx', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                { title: '运单号', dataIndex: 'ytOrderNo', key: 'ytOrderNo', width: 180 },
                { title: '地址审核状态', dataIndex: 'reviewStatus', key: 'reviewStatus', width: 160 },
                { title: '导入动作', dataIndex: 'action', key: 'action', ellipsis: true },
              ]}
              pagination={false}
              scroll={{ y: '50vh' }}
            />
          </div>
        )}

        <div className="bol-import-tips">
          <div className="bol-import-tips-title">温馨提示</div>
          <div className="bol-import-tips-text">
            模板下载：
            <a className="bol-import-link" onClick={downloadAddrImportTemplate}>地址审核状态导入模板.xlsx</a>
          </div>
          <div className="bol-import-tips-text">文件格式限制：仅支持 .xlsx，单文件不超过 10MB；</div>
          <div className="bol-import-tips-text">1. 运单号不能为空，且必须是列表中存在（本原型数据）的运单号；</div>
          <div className="bol-import-tips-text">2. 地址审核状态仅支持：待审核 / 已审核 / 待确认。</div>
        </div>
      </Modal>
    </div>
  );
};

export default B2BOrderList;
