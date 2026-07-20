/**
 * @name DW送达时段列表
 * @mode axure
 */

import './style.css';

import React, { useState, useCallback } from 'react';
import {
  Input, Select, Button, Table, Tag, Modal, Space, DatePicker, message,
  Form, Row, Col, Tooltip, Drawer, Progress, Badge,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, ExportOutlined, ScheduleOutlined,
  ExclamationCircleOutlined, CheckCircleFilled, CloseCircleFilled,
  ClockCircleFilled, LoadingOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;

// ========================= 类型 =========================

interface DwRecord {
  key: string;
  ytOrderNo: string;
  fbaShipmentId: string;
  customerCode: string;
  warehouse: string;
  regionDist: string;
  customerDwRange: string;
  latestDwRange: string;
  estimatedDwRange: string;
  remainingDays: number | null;
  sellerAuthorized: boolean;
  bookingTime: string;
  actualBookingDate: string;
  bookingEntryTime: string;
  createTime: string;
  updateTime: string;
}

// ========================= Mock =========================

// 送达时段：周日 ~ 周六，固定7天。Today: 2026-06-26
const MOCK_DW_DATA: DwRecord[] = [
  {
    key: '1', ytOrderNo: 'YT20260601001', fbaShipmentId: 'FBA12345678', customerCode: 'CUS001',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '2026-06-30', actualBookingDate: '2026-06-30', bookingEntryTime: '2026-06-25 14:30:00',
    createTime: '2026-06-20 08:00:00', updateTime: '2026-06-26 14:30:00',
  },
  {
    key: '2', ytOrderNo: 'YT20260602002', fbaShipmentId: 'FBA23456789', customerCode: 'CUS002',
    warehouse: '美东仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-21 10:00:00', updateTime: '2026-06-26 09:20:00',
  },
  {
    key: '3', ytOrderNo: 'YT20260603003', fbaShipmentId: 'FBA34567890', customerCode: 'CUS003',
    warehouse: '欧洲仓', regionDist: '欧洲',
    customerDwRange: '2026-06-21 ~ 2026-06-27', latestDwRange: '2026-06-21 ~ 2026-06-27',
    estimatedDwRange: '2026-06-21 ~ 2026-06-27', remainingDays: -5, sellerAuthorized: false,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-10 13:00:00', updateTime: '2026-06-18 16:00:00',
  },
  {
    key: '4', ytOrderNo: 'YT20260604004', fbaShipmentId: 'FBA45678901', customerCode: 'CUS004',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-05 ~ 2026-07-11', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '2026-07-08', actualBookingDate: '2026-07-08', bookingEntryTime: '2026-07-01 11:00:00',
    createTime: '2026-06-22 09:30:00', updateTime: '2026-06-28 11:00:00',
  },
  {
    key: '5', ytOrderNo: 'YT20260605005', fbaShipmentId: 'FBA56789012', customerCode: 'CUS005',
    warehouse: '日本仓', regionDist: '亚太',
    customerDwRange: '2026-07-12 ~ 2026-07-18', latestDwRange: '2026-07-12 ~ 2026-07-18',
    estimatedDwRange: '2026-07-12 ~ 2026-07-18', remainingDays: 16, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-24 14:00:00', updateTime: '2026-06-25 10:00:00',
  },
  {
    key: '6', ytOrderNo: 'YT20260606006', fbaShipmentId: 'FBA67890123', customerCode: 'CUS001',
    warehouse: '美东仓', regionDist: '北美',
    customerDwRange: '2026-06-21 ~ 2026-06-27', latestDwRange: '2026-06-21 ~ 2026-06-27',
    estimatedDwRange: '2026-06-21 ~ 2026-06-27', remainingDays: -5, sellerAuthorized: true,
    bookingTime: '2026-06-23', actualBookingDate: '2026-06-23', bookingEntryTime: '2026-06-18 15:00:00',
    createTime: '2026-06-07 15:00:00', updateTime: '2026-06-15 15:00:00',
  },
  {
    key: '7', ytOrderNo: 'YT20260607007', fbaShipmentId: 'FBA78901234', customerCode: 'CUS002',
    warehouse: '欧洲仓', regionDist: '欧洲',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-05 ~ 2026-07-11', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '2026-07-08', actualBookingDate: '2026-07-08', bookingEntryTime: '2026-07-03 08:00:00',
    createTime: '2026-06-22 08:00:00', updateTime: '2026-06-24 16:30:00',
  },
  {
    key: '8', ytOrderNo: 'YT20260608008', fbaShipmentId: 'FBA01234567', customerCode: 'CUS003',
    warehouse: '澳洲仓', regionDist: '亚太',
    customerDwRange: '2026-06-14 ~ 2026-06-20', latestDwRange: '-',
    estimatedDwRange: '-', remainingDays: null, sellerAuthorized: false,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-01 10:00:00', updateTime: '2026-06-01 10:00:00',
  },
  {
    key: '9', ytOrderNo: 'YT20260609009', fbaShipmentId: 'FBA54321098', customerCode: 'CUS004',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '2026-07-01', actualBookingDate: '2026-07-01', bookingEntryTime: '2026-06-26 12:00:00',
    createTime: '2026-06-14 12:00:00', updateTime: '2026-06-18 08:30:00',
  },
  {
    key: '10', ytOrderNo: 'YT20260610010', fbaShipmentId: 'FBA65432109', customerCode: 'CUS005',
    warehouse: '日本仓', regionDist: '亚太',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-05 ~ 2026-07-11', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '2026-07-07', actualBookingDate: '2026-07-07', bookingEntryTime: '2026-07-02 10:00:00',
    createTime: '2026-06-16 11:00:00', updateTime: '2026-06-25 08:00:00',
  },
  {
    key: '11', ytOrderNo: 'YT20260611011', fbaShipmentId: 'FBA76543210', customerCode: 'CUS006',
    warehouse: '美东仓', regionDist: '北美',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-12 ~ 2026-07-18', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-18 09:00:00', updateTime: '2026-06-26 14:00:00',
  },
  {
    key: '12', ytOrderNo: 'YT20260612012', fbaShipmentId: 'FBA87654321', customerCode: 'CUS007',
    warehouse: '欧洲仓', regionDist: '欧洲',
    customerDwRange: '2026-07-19 ~ 2026-07-25', latestDwRange: '2026-07-19 ~ 2026-07-25',
    estimatedDwRange: '2026-07-19 ~ 2026-07-25', remainingDays: 23, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-22 16:00:00', updateTime: '2026-06-22 16:00:00',
  },
  {
    key: '13', ytOrderNo: 'YT20260613013', fbaShipmentId: 'FBA98765432', customerCode: 'CUS008',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-14 ~ 2026-06-20', latestDwRange: '2026-06-14 ~ 2026-06-20',
    estimatedDwRange: '2026-06-14 ~ 2026-06-20', remainingDays: -12, sellerAuthorized: false,
    bookingTime: '2026-06-17', actualBookingDate: '2026-06-17', bookingEntryTime: '2026-06-13 17:00:00',
    createTime: '2026-06-06 11:00:00', updateTime: '2026-06-12 16:00:00',
  },
  {
    key: '14', ytOrderNo: 'YT20260614014', fbaShipmentId: 'FBA09876543', customerCode: 'CUS006',
    warehouse: '澳洲仓', regionDist: '亚太',
    customerDwRange: '-', latestDwRange: '-',
    estimatedDwRange: '-', remainingDays: null, sellerAuthorized: false,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-24 08:00:00', updateTime: '2026-06-24 08:00:00',
  },
  {
    key: '15', ytOrderNo: 'YT20260615015', fbaShipmentId: 'FBA10987654', customerCode: 'CUS009',
    warehouse: '美东仓', regionDist: '北美',
    customerDwRange: '2026-07-12 ~ 2026-07-18', latestDwRange: '2026-07-12 ~ 2026-07-18',
    estimatedDwRange: '2026-07-12 ~ 2026-07-18', remainingDays: 16, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-20 10:00:00', updateTime: '2026-06-26 09:00:00',
  },
  {
    key: '16', ytOrderNo: 'YT20260616016', fbaShipmentId: 'FBA21098765', customerCode: 'CUS010',
    warehouse: '日本仓', regionDist: '亚太',
    customerDwRange: '2026-06-14 ~ 2026-06-20', latestDwRange: '2026-06-14 ~ 2026-06-20',
    estimatedDwRange: '2026-06-14 ~ 2026-06-20', remainingDays: -12, sellerAuthorized: true,
    bookingTime: '2026-06-16', actualBookingDate: '2026-06-16', bookingEntryTime: '2026-06-11 15:00:00',
    createTime: '2026-06-03 15:00:00', updateTime: '2026-06-08 11:00:00',
  },
  {
    key: '17', ytOrderNo: 'YT20260617017', fbaShipmentId: 'FBA32109876', customerCode: 'CUS007',
    warehouse: '欧洲仓', regionDist: '欧洲',
    customerDwRange: '2026-07-19 ~ 2026-07-25', latestDwRange: '2026-07-19 ~ 2026-07-25',
    estimatedDwRange: '2026-07-19 ~ 2026-07-25', remainingDays: 23, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-25 13:00:00', updateTime: '2026-06-25 13:00:00',
  },
  {
    key: '18', ytOrderNo: 'YT20260618018', fbaShipmentId: 'FBA43210987', customerCode: 'CUS011',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '2026-06-30', actualBookingDate: '2026-06-30', bookingEntryTime: '2026-06-26 15:30:00',
    createTime: '2026-06-16 09:00:00', updateTime: '2026-06-23 15:00:00',
  },
  {
    key: '19', ytOrderNo: 'YT20260619019', fbaShipmentId: 'FBA54321098', customerCode: 'CUS009',
    warehouse: '澳洲仓', regionDist: '亚太',
    customerDwRange: '-', latestDwRange: '-',
    estimatedDwRange: '-', remainingDays: null, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-23 17:00:00', updateTime: '2026-06-23 17:00:00',
  },
  {
    key: '20', ytOrderNo: 'YT20260620020', fbaShipmentId: 'FBA65432109', customerCode: 'CUS012',
    warehouse: '美东仓', regionDist: '北美',
    customerDwRange: '2026-07-12 ~ 2026-07-18', latestDwRange: '2026-07-12 ~ 2026-07-18',
    estimatedDwRange: '2026-07-12 ~ 2026-07-18', remainingDays: 16, sellerAuthorized: false,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-24 10:00:00', updateTime: '2026-06-25 08:00:00',
  },
  // 多箱数据
  {
    key: '21', ytOrderNo: 'YT20260601001', fbaShipmentId: 'FBA12345679', customerCode: 'CUS001',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-20 08:00:00', updateTime: '2026-06-26 14:30:00',
  },
  {
    key: '22', ytOrderNo: 'YT20260607007', fbaShipmentId: 'FBA78901235', customerCode: 'CUS002',
    warehouse: '欧洲仓', regionDist: '欧洲',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-05 ~ 2026-07-11', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-22 08:00:00', updateTime: '2026-06-24 16:30:00',
  },
  {
    key: '23', ytOrderNo: 'YT20260610010', fbaShipmentId: 'FBA65432110', customerCode: 'CUS005',
    warehouse: '日本仓', regionDist: '亚太',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '2026-07-05 ~ 2026-07-11',
    estimatedDwRange: '2026-07-05 ~ 2026-07-11', remainingDays: 9, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-16 11:00:00', updateTime: '2026-06-25 08:00:00',
  },
  {
    key: '24', ytOrderNo: 'YT20260610010', fbaShipmentId: 'FBA65432111', customerCode: 'CUS005',
    warehouse: '日本仓', regionDist: '亚太',
    customerDwRange: '2026-07-05 ~ 2026-07-11', latestDwRange: '-',
    estimatedDwRange: '-', remainingDays: null, sellerAuthorized: true,
    bookingTime: '-', actualBookingDate: '-', bookingEntryTime: '-',
    createTime: '2026-06-16 11:00:00', updateTime: '2026-06-25 08:00:00',
  },
  {
    key: '25', ytOrderNo: 'YT20260618018', fbaShipmentId: 'FBA43210988', customerCode: 'CUS011',
    warehouse: '美西仓', regionDist: '北美',
    customerDwRange: '2026-06-28 ~ 2026-07-04', latestDwRange: '2026-06-28 ~ 2026-07-04',
    estimatedDwRange: '2026-06-28 ~ 2026-07-04', remainingDays: 2, sellerAuthorized: true,
    bookingTime: '2026-06-30', actualBookingDate: '2026-06-30', bookingEntryTime: '2026-06-26 16:00:00',
    createTime: '2026-06-16 09:00:00', updateTime: '2026-06-23 15:00:00',
  },
];

type TaskStatus = 'pending' | 'querying' | 'matching' | 'confirming' | 'success' | 'failed';
interface BookingTask {
  key: string;
  ytOrderNo: string;
  fbaShipmentId: string;
  status: TaskStatus;
  message: string;
  matchedWindow?: string;
  matchedStatus?: string; // AVAILABLE / CONGESTED / BLOCKED
  errorReason?: string;
  progress: number; // 0-100
}

// ========================= 组件 =========================

const DwDeliveryWindow = () => {
  const [form] = Form.useForm();

  // ---------- 搜索 ----------
  const [filters, setFilters] = useState({
    ytOrderNo: '',
    fbaShipmentId: '',
    sellerAuthorized: undefined as boolean | undefined,
    warehouse: '',
    regionDist: '',
    estimatedDwRange: '',
    actualBookingDate: undefined as [string, string] | undefined,
    dateRange: undefined as [string, string] | undefined,
    status: undefined as string | undefined,
    bookingTimeEmpty: undefined as boolean | undefined,
    bookingTimeRange: undefined as [string, string] | undefined,
  });

  // ---------- 弹窗 ----------
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [batchEditModalOpen, setBatchEditModalOpen] = useState(false);
  const [batchImportModalOpen, setBatchImportModalOpen] = useState(false);
  const [batchEditDwRange, setBatchEditDwRange] = useState<string | undefined>(undefined);
  const [batchImportFile, setBatchImportFile] = useState<string | undefined>(undefined);
  const [selectedRecord, setSelectedRecord] = useState<DwRecord | null>(null);
  const [selectedDwOption, setSelectedDwOption] = useState<string | undefined>(undefined);
  const [bookingTime, setBookingTime] = useState<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [tasks, setTasks] = useState<BookingTask[]>([]);

  const MOCK_DW_OPTIONS = [
    { value: '2026-06-28 ~ 2026-07-04', label: '2026-06-28 ~ 2026-07-04 (AVAILABLE)' },
    { value: '2026-07-05 ~ 2026-07-11', label: '2026-07-05 ~ 2026-07-11 (AVAILABLE)' },
    { value: '2026-07-12 ~ 2026-07-18', label: '2026-07-12 ~ 2026-07-18 (CONGESTED)' },
    { value: '2026-07-19 ~ 2026-07-25', label: '2026-07-19 ~ 2026-07-25 (AVAILABLE)' },
  ];

  // ---------- 筛选 ----------
  const filteredData = MOCK_DW_DATA.filter((r) => {
    if (filters.ytOrderNo && !r.ytOrderNo.toLowerCase().includes(filters.ytOrderNo.toLowerCase())) return false;
    if (filters.fbaShipmentId && !r.fbaShipmentId.toLowerCase().includes(filters.fbaShipmentId.toLowerCase())) return false;
    if (filters.sellerAuthorized !== undefined && r.sellerAuthorized !== filters.sellerAuthorized) return false;
    if (filters.warehouse && !r.warehouse.includes(filters.warehouse)) return false;
    if (filters.regionDist && !r.regionDist.includes(filters.regionDist)) return false;
    if (filters.estimatedDwRange && !r.estimatedDwRange.includes(filters.estimatedDwRange)) return false;
    if (filters.actualBookingDate) {
      if (r.actualBookingDate === '-') return false;
      if (r.actualBookingDate < filters.actualBookingDate[0] || r.actualBookingDate > filters.actualBookingDate[1]) return false;
    }
    if (filters.dateRange) {
      const t = r.createTime.substring(0, 10);
      if (t < filters.dateRange[0] || t > filters.dateRange[1]) return false;
    }
    // 状态筛选
    if (filters.status !== undefined) {
      if (filters.status === 'unknown') { if (r.latestDwRange !== '-') return false; }
      else {
        if (r.latestDwRange === '-') return false;
        if (r.bookingTime !== '-') return filters.status === 'not_editable';
        const editable = r.remainingDays !== null && r.remainingDays > 0 && r.sellerAuthorized;
        if (filters.status === 'editable' && !editable) return false;
        if (filters.status === 'not_editable' && editable) return false;
      }
    }
    // 约仓日期为空/不为空
    if (filters.bookingTimeEmpty !== undefined) {
      const isEmpty = r.bookingTime === '-';
      if (filters.bookingTimeEmpty && !isEmpty) return false;
      if (!filters.bookingTimeEmpty && isEmpty) return false;
    }
    // 约仓日期段
    if (filters.bookingTimeRange) {
      if (r.bookingTime === '-') return false;
      const t = r.bookingTime.substring(0, 10);
      if (t < filters.bookingTimeRange[0] || t > filters.bookingTimeRange[1]) return false;
    }
    return true;
  });

  // ---------- 操作 ----------
  const handleEditDw = useCallback((record: DwRecord) => {
    setSelectedRecord(record);
    setSelectedDwOption(undefined);
    setEditModalOpen(true);
  }, []);

  const handleFetchDw = useCallback((record: DwRecord) => {
    if (record.latestDwRange !== '-') {
      message.info('已存在送达时段，无需重新获取');
      return;
    }
    message.loading({ content: `正在获取 ${record.fbaShipmentId} 的送达时间...`, key: 'fetchDw', duration: 1.5 });
    setTimeout(() => {
      message.success({ content: `${record.fbaShipmentId} 送达时间已更新`, key: 'fetchDw' });
    }, 1500);
  }, []);

  const handleLog = useCallback((record: DwRecord) => {
    setSelectedRecord(record);
    setLogModalOpen(true);
  }, []);

  const handleBatchEdit = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要批量修改的记录'); return; }
    setBatchEditDwRange(undefined);
    setBatchEditModalOpen(true);
  }, [selectedRowKeys]);

  const handleBatchEditSubmit = useCallback(() => {
    if (!batchEditDwRange) { message.warning('请选择预计送达时段'); return; }
    message.success(`已批量修改 ${selectedRowKeys.length} 条记录的预计送达时段为 ${batchEditDwRange}`);
    setBatchEditModalOpen(false);
    setSelectedRowKeys([]);
  }, [selectedRowKeys, batchEditDwRange]);

  const handleBatchImport = useCallback(() => {
    setBatchImportFile(undefined);
    setBatchImportModalOpen(true);
  }, []);

  const handleBatchImportSubmit = useCallback(() => {
    if (!batchImportFile) { message.warning('请先选择导入文件'); return; }
    message.success(`已从 ${batchImportFile} 导入数据（模拟）`);
    setBatchImportModalOpen(false);
  }, [batchImportFile]);

  const handleEditSubmit = useCallback(() => {
    Modal.confirm({
      title: '确认修改送达时间',
      icon: <ExclamationCircleOutlined />,
      content: `确定要修改 ${selectedRecord?.fbaShipmentId} 的送达时段吗？修改后将向亚马逊确认。`,
      okText: '确认修改',
      cancelText: '取消',
      onOk: () => {
        message.success(`${selectedRecord?.fbaShipmentId} 送达时段已修改`);
        setEditModalOpen(false);
      },
    });
  }, [selectedRecord]);

  const handleBatchBooking = useCallback(() => {
    if (selectedRowKeys.length === 0) { message.warning('请先勾选需要录入约仓的YT单号'); return; }
    setBookingTime(null);
    setBookingModalOpen(true);
  }, [selectedRowKeys]);

  const handleBookingSubmit = useCallback(() => {
    if (!bookingTime) { message.warning('请选择约仓日期'); return; }
    const timeStr = bookingTime.format('YYYY-MM-DD');
    const records = MOCK_DW_DATA.filter((r) => selectedRowKeys.includes(r.key));

    // 初始化任务列表：全部 pending
    const initTasks: BookingTask[] = records.map((r) => ({
      key: r.key,
      ytOrderNo: r.ytOrderNo,
      fbaShipmentId: r.fbaShipmentId,
      status: 'pending',
      message: '等待处理',
      progress: 0,
    }));
    setTasks(initTasks);
    setBookingModalOpen(false);
    setDrawerOpen(true);

    // 逐个异步处理
    let completed = 0;
    const total = initTasks.length;

    const updateTask = (key: string, patch: Partial<BookingTask>) => {
      setTasks((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
    };

    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const parseDate = (s: string) => new Date(s).getTime();
    const inRange = (d: string, start: string, end: string) => parseDate(d) >= parseDate(start) && parseDate(d) <= parseDate(end);

    // 根据约仓日期生成候选窗口（模拟亚马逊返回的可用选项）
    type WinStatus = 'AVAILABLE' | 'CONGESTED' | 'BLOCKED';
    interface MockWindow { start: string; end: string; status: WinStatus }
    const getMockAvailableWindows = (baseDate: string): MockWindow[] => {
      const d = new Date(baseDate);
      const day = d.getDay();
      const sun = new Date(d); sun.setDate(d.getDate() - day);
      const windows: MockWindow[] = [];
      const statuses: WinStatus[] = ['AVAILABLE', 'AVAILABLE', 'CONGESTED', 'BLOCKED'];
      for (let i = -1; i <= 2; i++) {
        const ws = new Date(sun); ws.setDate(sun.getDate() + i * 7);
        const we = new Date(ws); we.setDate(ws.getDate() + 6);
        const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
        windows.push({ start: fmt(ws), end: fmt(we), status: statuses[i + 1] });
      }
      return windows;
    };

    const processOne = async (task: BookingTask, record: DwRecord, idx: number) => {
      await delay(400 * idx);
      updateTask(task.key, { status: 'querying', message: '查询亚马逊可用DW窗口...', progress: 10 });

      // 前置校验
      if (!record.sellerAuthorized) {
        updateTask(task.key, { status: 'failed', errorReason: '卖家未授权承运商更新DW', message: '失败', progress: 100 });
        completed++; return;
      }

      await delay(800 + Math.random() * 1200);
      // 模拟亚马逊返回可用窗口
      const windows = getMockAvailableWindows(timeStr);
      updateTask(task.key, { status: 'matching', message: `获取到 ${windows.length} 个可用窗口，匹配中...`, progress: 40 });

      // 自动匹配：找包含约仓日期的窗口
      const matched = windows.find((w) => inRange(timeStr, w.start, w.end));
      if (!matched) {
        const rangeStr = windows.map((w) => `${w.start}~${w.end}`).join(', ');
        updateTask(task.key, { status: 'failed', errorReason: `无可用窗口覆盖 ${timeStr}（可用: ${rangeStr}）`, message: '无匹配窗口', progress: 100 });
        completed++; return;
      }

      const windowStr = `${matched.start} ~ ${matched.end}`;
      const statusLabel = matched.status === 'AVAILABLE' ? '可用' : matched.status === 'CONGESTED' ? '拥挤' : '已阻止';
      updateTask(task.key, {
        status: matched.status === 'BLOCKED' ? 'failed' : 'confirming',
        message: matched.status === 'BLOCKED'
          ? `唯一匹配窗口 ${windowStr} 已被阻止，无法确认`
          : `匹配窗口: ${windowStr} (${statusLabel})，向亚马逊确认...`,
        matchedWindow: windowStr,
        matchedStatus: matched.status,
        progress: matched.status === 'BLOCKED' ? 100 : 65,
        errorReason: matched.status === 'BLOCKED' ? '该窗口被亚马逊标记为 BLOCKED，不可选择' : undefined,
      });
      if (matched.status === 'BLOCKED') { completed++; return; }

      await delay(600 + Math.random() * 800);
      const ok = Math.random() > 0.15;
      if (ok) {
        updateTask(task.key, { status: 'success', message: `已确认: ${windowStr}`, progress: 100 });
      } else {
        updateTask(task.key, { status: 'failed', errorReason: '亚马逊接口超时，请重试', message: '确认失败', progress: 100 });
      }
      completed++;
    };

    initTasks.forEach((task, idx) => {
      processOne(task, records[idx], idx);
    });
  }, [selectedRowKeys, bookingTime]);

  const getTaskStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending': return <ClockCircleFilled style={{ color: '#d9d9d9', fontSize: 18 }} />;
      case 'querying':
      case 'matching':
      case 'confirming': return <LoadingOutlined style={{ color: '#1677ff', fontSize: 18 }} />;
      case 'success': return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18 }} />;
      case 'failed': return <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 18 }} />;
    }
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'success': return '#52c41a';
      case 'failed': return '#ff4d4f';
      default: return '#1677ff';
    }
  };

  const handleExport = useCallback(() => {
    message.success(`正在导出 ${filteredData.length} 条DW送达时段数据`);
  }, [filteredData]);

  const resetFilters = useCallback(() => {
    setFilters({ ytOrderNo: '', fbaShipmentId: '', sellerAuthorized: undefined, warehouse: '', regionDist: '', estimatedDwRange: '', actualBookingDate: undefined, dateRange: undefined, status: undefined, bookingTimeEmpty: undefined, bookingTimeRange: undefined });
    form.resetFields();
  }, [form]);

  const handleSearch = useCallback((values: Record<string, any>) => {
    setFilters({
      ytOrderNo: values.ytOrderNo || '',
      fbaShipmentId: values.fbaShipmentId || '',
      sellerAuthorized: values.sellerAuthorized,
      warehouse: values.warehouse || '',
      regionDist: values.regionDist || '',
      estimatedDwRange: values.estimatedDwRange || '',
      actualBookingDate: values.actualBookingDate?.[0] && values.actualBookingDate?.[1]
        ? [values.actualBookingDate[0], values.actualBookingDate[1]] : undefined,
      dateRange: values.dateRange?.[0] && values.dateRange?.[1]
        ? [values.dateRange[0], values.dateRange[1]] : undefined,
      status: values.status,
      bookingTimeEmpty: values.bookingTimeEmpty,
      bookingTimeRange: values.bookingTimeRange?.[0] && values.bookingTimeRange?.[1]
        ? [values.bookingTimeRange[0], values.bookingTimeRange[1]] : undefined,
    });
  }, []);

  // ---------- 列定义 ----------
  const columns: ColumnsType<DwRecord> = [
    {
      title: 'YT单号',
      dataIndex: 'ytOrderNo',
      key: 'ytOrderNo',
      width: 140,
      fixed: 'left',
      sorter: (a, b) => a.ytOrderNo.localeCompare(b.ytOrderNo),
      render: (v: string) => <span className="dwd-mono">{v}</span>,
    },
    {
      title: '主箱号',
      dataIndex: 'fbaShipmentId',
      key: 'fbaShipmentId',
      width: 140,
      fixed: 'left',
      render: (v: string) => <span className="dwd-mono">{v}</span>,
    },
    {
      title: '客户代码',
      dataIndex: 'customerCode',
      key: 'customerCode',
      width: 170,
      render: (v: string, record: DwRecord) => (
        <Space size={6}>
          <span className="dwd-mono">{v}</span>
          {record.sellerAuthorized
            ? <Tag color="success" style={{ margin: 0 }}>已授权</Tag>
            : <Tag color="error" style={{ margin: 0 }}>未授权</Tag>
          }
        </Space>
      ),
    },
    {
      title: '仓点',
      dataIndex: 'warehouse',
      key: 'warehouse',
      width: 100,
    },
    {
      title: '区域分布',
      dataIndex: 'regionDist',
      key: 'regionDist',
      width: 90,
      align: 'center',
    },
    {
      title: '预计送达时段',
      dataIndex: 'estimatedDwRange',
      key: 'estimatedDwRange',
      width: 180,
      render: (v: string) => (
        v === '-' ? <span className="dwd-text-muted">-</span> : <span className="dwd-mono">{v}</span>
      ),
    },
    {
      title: (
        <Tooltip title="已存在约仓日期、已过宽限期限或当前日期已在最新送达时段内，则不可修改">
          <span>状态</span>
        </Tooltip>
      ),
      key: 'status',
      width: 85,
      align: 'center',
      render: (_: any, record: DwRecord) => {
        if (record.latestDwRange === '-') return <Tag color="default">未知</Tag>;
        if (record.bookingTime !== '-') return <Tag color="default">不可修改</Tag>;
        const editable = record.remainingDays !== null && record.remainingDays > 0 && record.sellerAuthorized;
        return editable
          ? <Tag color="success">可修改</Tag>
          : <Tag color="default">不可修改</Tag>;
      },
    },
    {
      title: '剩余天数',
      dataIndex: 'remainingDays',
      key: 'remainingDays',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.remainingDays ?? -999) - (b.remainingDays ?? -999),
      render: (v: number | null, record: DwRecord) => {
        if (v === null) return <span className="dwd-text-muted">-</span>;
        // 约仓日期命中最新送达时段区间 → 展示 -
        if (record.bookingTime !== '-' && record.latestDwRange !== '-') {
          const [dwStart, dwEnd] = record.latestDwRange.split(' ~ ');
          if (record.bookingTime >= dwStart && record.bookingTime <= dwEnd) {
            return <span className="dwd-text-muted">-</span>;
          }
        }
        if (v < 0) return <Tag color="error">已过期</Tag>;
        if (v === 0) return <Tag color="warning">最后一天</Tag>;
        if (v <= 3) return <Tag color="processing">{v} 天</Tag>;
        return <Tag color="green">{v} 天</Tag>;
      },
    },
    {
      title: (
        <Tooltip title="宽限期限 = 最新送达时段开始日期，此日期后不可再修改送达时段">
          <span>宽限期限</span>
        </Tooltip>
      ),
      key: 'graceDeadline',
      width: 105,
      align: 'center',
      render: (_: any, record: DwRecord) => {
        if (record.latestDwRange === '-') return <span className="dwd-text-muted">-</span>;
        return <span className="dwd-mono">{record.latestDwRange.split(' ~ ')[0]}</span>;
      },
    },
    {
      title: '客户送达时段',
      dataIndex: 'customerDwRange',
      key: 'customerDwRange',
      width: 180,
      render: (v: string) => (
        v === '-' ? <span className="dwd-text-muted">-</span> : <span className="dwd-text-sm">{v}</span>
      ),
    },
    {
      title: '最新送达时段',
      dataIndex: 'latestDwRange',
      key: 'latestDwRange',
      width: 180,
      render: (v: string) => (
        v === '-' ? <span className="dwd-text-muted">-</span> : <span className="dwd-latest">{v}</span>
      ),
    },
    {
      title: '实际约仓日期',
      dataIndex: 'actualBookingDate',
      key: 'actualBookingDate',
      width: 120,
      render: (v: string) => (v === '-' ? <span className="dwd-text-muted">-</span> : v),
    },
    {
      title: '预计约仓日期',
      dataIndex: 'bookingTime',
      key: 'bookingTime',
      width: 120,
      render: (v: string) => (v === '-' ? <span className="dwd-text-muted">-</span> : v),
    },
    {
      title: '约仓录入时间',
      dataIndex: 'bookingEntryTime',
      key: 'bookingEntryTime',
      width: 170,
      render: (v: string) => (v === '-' ? <span className="dwd-text-muted">-</span> : v),
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 155,
      sorter: (a, b) => a.createTime.localeCompare(b.createTime),
    },
    {
      title: '修改时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 155,
      sorter: (a, b) => a.updateTime.localeCompare(b.updateTime),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_: any, record: DwRecord) => (
        <Space size={0} split={<span className="dwd-action-divider">|</span>}>
          <Button type="link" size="small" onClick={() => handleEditDw(record)}>修改</Button>
          <Button type="link" size="small" onClick={() => handleFetchDw(record)}>重新获取</Button>
          <Button type="link" size="small" onClick={() => handleLog(record)}>日志</Button>
        </Space>
      ),
    },
  ];

  // ========================= 渲染 =========================
  return (
    <div className="dwd-page">
      <div className="dwd-container">
        {/* 头部 */}
        <div className="dwd-header">
          <div className="dwd-header-left">
            <h2 className="dwd-title">DW 送达时段列表</h2>
            <Tag color="blue">{filteredData.length} 条记录</Tag>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<ScheduleOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchBooking}
            >
              录入约仓{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
            </Button>
            <Button disabled={selectedRowKeys.length === 0} onClick={handleBatchEdit}>
              批量修改
            </Button>
            <Button onClick={handleBatchImport}>批量导入</Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置筛选</Button>
          </Space>
        </div>

        {/* 搜索 */}
        <div className="dwd-search-card">
          <Form form={form} layout="inline" onFinish={handleSearch} className="dwd-search-form">
            <Form.Item name="ytOrderNo" label="YT单号">
              <Input placeholder="输入YT单号" prefix={<SearchOutlined />} allowClear style={{ width: 170 }} />
            </Form.Item>
            <Form.Item name="fbaShipmentId" label="主箱号">
              <Input placeholder="输入主箱号" prefix={<SearchOutlined />} allowClear style={{ width: 170 }} />
            </Form.Item>
            <Form.Item name="sellerAuthorized" label="客户是否授权">
              <Select
                placeholder="全部"
                allowClear
                style={{ width: 130 }}
                options={[
                  { value: true, label: '已授权' },
                  { value: false, label: '未授权' },
                ]}
              />
            </Form.Item>
            <Form.Item name="warehouse" label="仓点">
              <Input placeholder="输入仓点" prefix={<SearchOutlined />} allowClear style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="regionDist" label="区域分布">
              <Input placeholder="输入区域" prefix={<SearchOutlined />} allowClear style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="estimatedDwRange" label="预计送达时段">
              <Input placeholder="输入送达时段" prefix={<SearchOutlined />} allowClear style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                placeholder="全部"
                allowClear
                style={{ width: 120 }}
                options={[
                  { value: 'editable', label: '可修改' },
                  { value: 'not_editable', label: '不可修改' },
                  { value: 'unknown', label: '未知' },
                ]}
              />
            </Form.Item>
            <Form.Item name="bookingTimeEmpty" label="约仓日期">
              <Select
                placeholder="全部"
                allowClear
                style={{ width: 120 }}
                options={[
                  { value: true, label: '为空' },
                  { value: false, label: '不为空' },
                ]}
              />
            </Form.Item>
            <Form.Item name="actualBookingDate" label="实际约仓日期">
              <RangePicker style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="bookingTimeRange" label="约仓日期段">
              <RangePicker style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="dateRange" label="创建时间">
              <RangePicker style={{ width: 240 }} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
                <Button onClick={resetFilters}>重置</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>

        {/* 表格 */}
        <div className="dwd-table-card">
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            columns={columns}
            dataSource={filteredData}
            pagination={{
              pageSize: 25,
              showTotal: (t) => `共 ${t} 条`,
              showSizeChanger: true,
              pageSizeOptions: ['10', '25', '50'],
            }}
            scroll={{ x: 2200 }}
            size="middle"
            className="dwd-table"
            rowKey="key"
          />
        </div>
      </div>

      {/* 修改送达时段弹窗 */}
      <Modal
        title="修改送达时段"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        width={500}
        footer={[
          <Button key="cancel" onClick={() => setEditModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" disabled={!selectedDwOption} onClick={handleEditSubmit}>确认修改</Button>,
        ]}
      >
        <div className="dwd-modal-body">
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">YT单号</span>
            <span className="dwd-modal-val">{selectedRecord?.ytOrderNo}</span>
          </div>
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">主箱号</span>
            <span className="dwd-modal-val">{selectedRecord?.fbaShipmentId}</span>
          </div>
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">当前送达时段</span>
            <span className="dwd-modal-val">{selectedRecord?.latestDwRange === '-' ? selectedRecord?.customerDwRange : selectedRecord?.latestDwRange}</span>
          </div>
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">新送达时段</span>
            <Select
              placeholder="请选择送达时段"
              value={selectedDwOption}
              onChange={(v) => setSelectedDwOption(v)}
              style={{ flex: 1 }}
              options={MOCK_DW_OPTIONS}
            />
          </div>
          <p className="dwd-modal-tip">
            选择新时段后将向亚马逊确认。请确保所选时段在可用窗口范围内。
          </p>
        </div>
      </Modal>

      {/* 录入约仓弹窗（选择日期） */}
      <Modal
        title={`录入约仓（${selectedRowKeys.length} 个YT单号）`}
        open={bookingModalOpen}
        onCancel={() => setBookingModalOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setBookingModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleBookingSubmit}>确认录入</Button>,
        ]}
      >
        <div className="dwd-modal-body">
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">YT单号</span>
            <span className="dwd-modal-val">
              {MOCK_DW_DATA.filter((r) => selectedRowKeys.includes(r.key)).map((r) => (
                <Tag key={r.key} color="blue" style={{ marginBottom: 4 }}>{r.ytOrderNo}</Tag>
              ))}
            </span>
          </div>
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">约仓日期</span>
            <DatePicker
              format="YYYY-MM-DD"
              placeholder="请选择约仓日期"
              value={bookingTime}
              onChange={(v) => setBookingTime(v)}
              style={{ flex: 1 }}
            />
          </div>
          <p className="dwd-modal-tip">
            将为以上 {selectedRowKeys.length} 个YT单号统一录入约仓日期，提交后将异步查询、匹配并确认送达窗口。
          </p>
        </div>
      </Modal>

      {/* 批量修改弹窗 */}
      <Modal
        title={`批量修改预计送达时段（${selectedRowKeys.length} 条记录）`}
        open={batchEditModalOpen}
        onCancel={() => setBatchEditModalOpen(false)}
        width={520}
        footer={[
          <Button key="cancel" onClick={() => setBatchEditModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleBatchEditSubmit}>确认修改</Button>,
        ]}
      >
        <div className="dwd-modal-body">
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">YT单号</span>
            <span className="dwd-modal-val">
              {MOCK_DW_DATA.filter((r) => selectedRowKeys.includes(r.key)).map((r) => (
                <Tag key={r.key} color="blue" style={{ marginBottom: 4 }}>{r.ytOrderNo}</Tag>
              ))}
            </span>
          </div>
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">预计送达时段</span>
            <Select
              placeholder="请选择预计送达时段"
              value={batchEditDwRange}
              onChange={(v) => setBatchEditDwRange(v)}
              style={{ flex: 1 }}
              options={MOCK_DW_OPTIONS}
            />
          </div>
          <p className="dwd-modal-tip">
            修改后校验逻辑由接口判断，提交后将向亚马逊确认。
          </p>
        </div>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入"
        open={batchImportModalOpen}
        onCancel={() => setBatchImportModalOpen(false)}
        width={450}
        footer={[
          <Button key="cancel" onClick={() => setBatchImportModalOpen(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleBatchImportSubmit}>确认导入</Button>,
        ]}
      >
        <div className="dwd-modal-body">
          <div className="dwd-modal-row">
            <span className="dwd-modal-label">导入文件</span>
            <Select
              placeholder="选择导入文件"
              value={batchImportFile}
              onChange={(v) => setBatchImportFile(v)}
              style={{ flex: 1 }}
              options={[
                { value: 'dw_batch_2026-07.xlsx', label: 'dw_batch_2026-07.xlsx' },
                { value: 'dw_import_20260712.csv', label: 'dw_import_20260712.csv' },
              ]}
            />
          </div>
          <p className="dwd-modal-tip">
            请选择需要导入的文件，系统将解析后批量入库。
          </p>
        </div>
      </Modal>

      {/* 批量任务进度面板 */}
      <Drawer
        title={`批量录入约仓（${selectedRowKeys.length} 项）`}
        open={drawerOpen}
        onClose={() => {
          const hasProcessing = tasks.some((t) => !['success', 'failed'].includes(t.status));
          if (hasProcessing) {
            Modal.confirm({
              title: '任务处理中',
              icon: <ExclamationCircleOutlined />,
              content: '仍有任务正在处理，关闭后将丢失进度。确定要关闭吗？',
              okText: '确定关闭',
              cancelText: '留在页面',
              onOk: () => { setDrawerOpen(false); setSelectedRowKeys([]); },
            });
          } else {
            setDrawerOpen(false);
            setSelectedRowKeys([]);
          }
        }}
        width={520}
        maskClosable={false}
        extra={
          <Space>
            {tasks.every((t) => t.status === 'success' || t.status === 'failed') && (
              <Button type="primary" size="small" onClick={() => { setDrawerOpen(false); setSelectedRowKeys([]); }}>
                完成
              </Button>
            )}
          </Space>
        }
      >
        {/* 进度概览 */}
        <div className="dwd-task-summary">
          <Row gutter={16}>
            <Col span={8}>
              <div className="dwd-stat-block">
                <div className="dwd-stat-num" style={{ color: '#52c41a' }}>
                  {tasks.filter((t) => t.status === 'success').length}
                </div>
                <div className="dwd-stat-label">成功</div>
              </div>
            </Col>
            <Col span={8}>
              <div className="dwd-stat-block">
                <div className="dwd-stat-num" style={{ color: '#ff4d4f' }}>
                  {tasks.filter((t) => t.status === 'failed').length}
                </div>
                <div className="dwd-stat-label">失败</div>
              </div>
            </Col>
            <Col span={8}>
              <div className="dwd-stat-block">
                <div className="dwd-stat-num" style={{ color: '#1677ff' }}>
                  {tasks.filter((t) => !['success', 'failed'].includes(t.status)).length}
                </div>
                <div className="dwd-stat-label">处理中</div>
              </div>
            </Col>
          </Row>
          <Progress
            percent={Math.round(
              (tasks.filter((t) => t.status === 'success' || t.status === 'failed').length / (tasks.length || 1)) * 100
            )}
            size="small"
            style={{ marginTop: 12 }}
          />
        </div>

        {/* 任务列表 */}
        <div className="dwd-task-list">
          {tasks.map((task) => (
            <div key={task.key} className="dwd-task-item">
              <div className="dwd-task-row1">
                {getTaskStatusIcon(task.status)}
                <div className="dwd-task-info">
                  <div className="dwd-task-yT">{task.ytOrderNo}</div>
                  <div className="dwd-task-fba">{task.fbaShipmentId}</div>
                </div>
                <Badge
                  status={task.status === 'success' ? 'success' : task.status === 'failed' ? 'error' : 'processing'}
                  text={
                    task.status === 'pending' ? '排队中' :
                    task.status === 'querying' ? '查询中' :
                    task.status === 'matching' ? '匹配中' :
                    task.status === 'confirming' ? '确认中' :
                    task.status === 'success' ? '已完成' : '失败'
                  }
                />
              </div>
              <Progress
                percent={task.progress}
                size="small"
                status={task.status === 'failed' ? 'exception' : task.status === 'success' ? 'success' : 'active'}
                strokeColor={getTaskStatusColor(task.status)}
                showInfo={false}
              />
              <div className="dwd-task-msg" style={{ color: task.status === 'failed' ? '#ff4d4f' : '#6b7280' }}>
                {task.message}
                {task.matchedStatus && (
                  <Tag
                    color={task.matchedStatus === 'AVAILABLE' ? 'success' : task.matchedStatus === 'CONGESTED' ? 'warning' : 'error'}
                    style={{ marginLeft: 8 }}
                  >
                    {task.matchedStatus}
                  </Tag>
                )}
              </div>
              {task.errorReason && (
                <div className="dwd-task-error">{task.errorReason}</div>
              )}
            </div>
          ))}
        </div>
      </Drawer>

      {/* 日志弹窗 */}
      <Modal
        title="操作日志"
        open={logModalOpen}
        onCancel={() => setLogModalOpen(false)}
        footer={[<Button key="close" onClick={() => setLogModalOpen(false)}>关闭</Button>]}
        width={660}
      >
        <div className="dwd-log-list">
          {[
            {
              time: '2026-06-10 14:30:00',
              op: '张伟(TMS)',
              action: '修改送达时间',
              before: `修改前: ${selectedRecord?.customerDwRange ?? '-'} → 修改后: 2026-06-10 ~ 2026-06-12`,
              result: '修改成功，已向亚马逊确认',
            },
            {
              time: '2026-06-10 14:28:00',
              op: '系统',
              action: '获取送达时间',
              before: `主箱号: ${selectedRecord?.fbaShipmentId ?? '-'}`,
              result: '获取成功: 2026-06-10 ~ 2026-06-12',
            },
            {
              time: '2026-06-05 08:00:00',
              op: '系统',
              action: 'DW送达时段初始化',
              before: `客户填写: ${selectedRecord?.customerDwRange ?? '-'}`,
              result: 'DW记录创建成功',
            },
          ].map((log, idx) => (
            <div key={idx} className="dwd-log-item">
              <div className="dwd-log-dot" />
              <div className="dwd-log-content">
                <div className="dwd-log-header">
                  <span className="dwd-log-time">{log.time}</span>
                  <Tag color="blue">{log.op}</Tag>
                  <span className="dwd-log-action">{log.action}</span>
                </div>
                <div className="dwd-log-row">
                  <span className="dwd-log-label">操作前数据：</span>
                  <span className="dwd-log-before">{log.before}</span>
                </div>
                <div className="dwd-log-row">
                  <span className="dwd-log-label">操作结果：</span>
                  <span className="dwd-log-result">{log.result}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default DwDeliveryWindow;
