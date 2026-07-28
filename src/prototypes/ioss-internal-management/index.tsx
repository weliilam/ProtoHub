/**
 * @name 内部IOSS号管理
 * @mode axure
 *
 * 参考资料：
 * - /rules/development-guide.md
 * - /rules/design-guide.md
 */

import './style.css';

import React, { useState, useCallback } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Modal,
  Form,
  Typography,
  message,
  Tooltip,
  Tabs
} from 'antd';
import {
  SearchOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  EditOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ========================= IOSS号脱敏 =========================

function maskIossNo(iossNo: string): string {
  if (!iossNo || iossNo.length <= 4) return iossNo;
  const head = iossNo.slice(0, 2);
  const tail = iossNo.slice(-2);
  const maskedCount = iossNo.length - 4;
  return head + '*'.repeat(maskedCount) + tail;
}

// ========================= Axure API 定义 =========================

const EVENT_LIST: EventItem[] = [
  { name: 'onAdd', desc: '新增IOSS号时触发' },
  { name: 'onEdit', desc: '修改IOSS号时触发' },
  { name: 'onSearch', desc: '查询时触发' },
  { name: 'onViewLog', desc: '查看操作日志时触发' },
  { name: 'onToggleStatus', desc: '启用/禁用IOSS号时触发' }
];

const ACTION_LIST: Action[] = [
  { name: 'openAddModal', desc: '打开新增弹框' },
  { name: 'refreshList', desc: '刷新列表' }
];

const VAR_LIST: KeyDesc[] = [
  { name: 'selected_row', desc: '当前选中的IOSS记录' },
  { name: 'total_count', desc: 'IOSS号总数' }
];

const CONFIG_LIST: ConfigItem[] = [
  {
    type: 'input',
    attributeId: 'title',
    displayName: '页面标题',
    info: '页面顶部显示的标题',
    initialValue: '内部IOSS号管理'
  }
];

const DATA_LIST: DataDesc[] = [
  {
    name: 'ioss_list',
    desc: 'IOSS号数据列表',
    keys: [
      { name: 'ioss_no', desc: 'IOSS号' },
      { name: 'platform_name', desc: '平台名称' },
      { name: 'products', desc: '销售产品（数组）' },
      { name: 'status', desc: '状态' },
      { name: 'creator', desc: '创建人' },
      { name: 'create_time', desc: '创建时间' },
      { name: 'modifier', desc: '修改人' },
      { name: 'modify_time', desc: '修改时间' }
    ]
  }
];

// ========================= 模拟数据 =========================

const MOCK_IOSS_DATA = [
  { key: '1', ioss_no: 'IM5280000001', platform_name: 'Amazon', products: ['标准普货-A', '标准普货-B', '电子产品-C'], status: 'active', creator: '卓运康', create_time: '2026-05-12 10:30:00', modifier: '卓运康', modify_time: '2026-06-10 14:22:00' },
  { key: '2', ioss_no: 'IM5280000002', platform_name: 'Amazon', products: ['家居用品-D'], status: 'active', creator: '李明', create_time: '2026-05-15 09:15:00', modifier: '李明', modify_time: '2026-06-08 11:30:00' },
  { key: '3', ioss_no: 'IM5280000003', platform_name: 'eBay', products: ['服装鞋帽-E', '美妆个护-F'], status: 'active', creator: '王芳', create_time: '2026-05-18 16:45:00', modifier: '王芳', modify_time: '2026-06-05 08:10:00' },
  { key: '4', ioss_no: 'IM5280000004', platform_name: 'Shopify', products: ['食品饮料-G', '玩具-H', '文具-I'], status: 'inactive', creator: '赵强', create_time: '2026-05-20 13:20:00', modifier: '赵强', modify_time: '2026-06-01 17:55:00' },
  { key: '5', ioss_no: 'IM5280000005', platform_name: 'Amazon', products: ['3C数码-J'], status: 'active', creator: '刘洋', create_time: '2026-05-22 11:00:00', modifier: '刘洋', modify_time: '2026-06-12 09:30:00' },
  { key: '6', ioss_no: 'IM5280000006', platform_name: 'Wish', products: ['运动户外-K', '汽配-L', '宠物用品-M', '园艺-N'], status: 'active', creator: '陈静', create_time: '2026-05-25 08:30:00', modifier: '陈静', modify_time: '2026-06-11 15:20:00' },
  { key: '7', ioss_no: 'IM5280000007', platform_name: 'Amazon', products: ['母婴-O'], status: 'blacklisted', creator: '孙鹏', create_time: '2026-05-28 14:10:00', modifier: '孙鹏', modify_time: '2026-06-09 10:00:00' },
  { key: '8', ioss_no: 'IM5280000008', platform_name: 'eBay', products: ['图书音像-P', '办公用品-Q'], status: 'active', creator: '周婷', create_time: '2026-06-01 10:00:00', modifier: '周婷', modify_time: '2026-06-13 12:45:00' }
];

const PLATFORM_OPTIONS = [
  { value: 'Amazon', label: 'Amazon' },
  { value: 'eBay', label: 'eBay' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'Wish', label: 'Wish' },
  { value: 'AliExpress', label: 'AliExpress' }
];

const PRODUCT_OPTIONS = [
  { value: '标准普货-A', label: '标准普货-A' },
  { value: '标准普货-B', label: '标准普货-B' },
  { value: '电子产品-C', label: '电子产品-C' },
  { value: '家居用品-D', label: '家居用品-D' },
  { value: '服装鞋帽-E', label: '服装鞋帽-E' },
  { value: '美妆个护-F', label: '美妆个护-F' },
  { value: '食品饮料-G', label: '食品饮料-G' },
  { value: '玩具-H', label: '玩具-H' },
  { value: '文具-I', label: '文具-I' },
  { value: '3C数码-J', label: '3C数码-J' },
  { value: '运动户外-K', label: '运动户外-K' },
  { value: '汽配-L', label: '汽配-L' },
  { value: '宠物用品-M', label: '宠物用品-M' },
  { value: '园艺-N', label: '园艺-N' },
  { value: '母婴-O', label: '母婴-O' },
  { value: '图书音像-P', label: '图书音像-P' },
  { value: '办公用品-Q', label: '办公用品-Q' }
];

// ========================= 组件 =========================

const Component = function IossInternalManagement() {
  const innerProps: any = {};
  const dataSource = innerProps && innerProps.data ? innerProps.data : {};
  const configSource = innerProps && innerProps.config ? innerProps.config : {};
  const onEventHandler = typeof innerProps.onEvent === 'function' ? innerProps.onEvent : function () { return undefined; };

  const title = typeof configSource.title === 'string' && configSource.title ? configSource.title : '内部IOSS号管理';

  // ---------- State ----------
  const [activeTab, setActiveTab] = useState<string>('ioss');
  const [searchIossNo, setSearchIossNo] = useState('');
  const [searchPlatform, setSearchPlatform] = useState<string | undefined>(undefined);
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logRecord, setLogRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const [dataSourceState, setDataSourceState] = useState(MOCK_IOSS_DATA);

  // ---------- 事件 ----------
  const emitEvent = useCallback(function (eventName: string, payload?: string) {
    try {
      onEventHandler(eventName, payload);
    } catch (error) {
      console.warn('onEvent 调用失败:', error);
    }
  }, [onEventHandler]);

  // ---------- 过滤数据 ----------
  const filteredData = dataSourceState.filter(function (item) {
    const matchNo = !searchIossNo || item.ioss_no.includes(searchIossNo);
    const matchPlatform = !searchPlatform || item.platform_name === searchPlatform;
    const matchStatus = !searchStatus || item.status === searchStatus;
    return matchNo && matchPlatform && matchStatus;
  });

  // ---------- 黑名单过滤 ----------
  const blacklistedData = dataSourceState.filter(function (item) { return item.status === 'blacklisted'; });

  // ---------- 状态 Tag ----------
  const getStatusTag = useCallback(function (status: string) {
    switch (status) {
      case 'active':
        return <Tag color="green" bordered={false}>启用</Tag>;
      case 'inactive':
        return <Tag color="default" bordered={false}>停用</Tag>;
      case 'blacklisted':
        return <Tag color="red" bordered={false}>黑名单</Tag>;
      default:
        return <Tag bordered={false}>未知</Tag>;
    }
  }, []);

  // ---------- 销售产品渲染 ----------
  const renderProducts = useCallback(function (products: string[]) {
    if (!products || products.length === 0) return <Text type="secondary">-</Text>;
    const text = products.join('、');
    return (
      <Tooltip title={text} placement="topLeft" overlayStyle={{ maxWidth: 360 }}>
        <span className="ioss-products-text">{text}</span>
      </Tooltip>
    );
  }, []);

  // ---------- 表格列（平台IOSS号列表）----------
  const iossColumns = [
    { title: '序号', key: 'index', width: 60, render: function (_: any, __: any, index: number) { return index + 1; } },
    {
      title: 'IOSS号', dataIndex: 'ioss_no', key: 'ioss_no', width: 180,
      render: function (text: string) {
        return <span className="ioss-masked-text">{maskIossNo(text)}</span>;
      }
    },
    { title: '平台名称', dataIndex: 'platform_name', key: 'platform_name', width: 120 },
    {
      title: '销售产品', dataIndex: 'products', key: 'products', width: 220,
      render: function (products: string[]) { return renderProducts(products); }
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: function (s: string) { return getStatusTag(s); } },
    { title: '创建人', dataIndex: 'creator', key: 'creator', width: 100 },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
    { title: '修改人', dataIndex: 'modifier', key: 'modifier', width: 100 },
    { title: '修改时间', dataIndex: 'modify_time', key: 'modify_time', width: 170 },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right' as const,
      render: function (_: any, record: any) {
        return (
          <Space size={0}>
            <Tooltip title="操作日志">
              <Button type="text" size="small" icon={<FileTextOutlined />}
                onClick={function () { setLogRecord(record); setLogModalOpen(true); }} />
            </Tooltip>
            <Tooltip title="修改">
              <Button type="text" size="small" icon={<EditOutlined />}
                onClick={function () { setEditingRecord(record); form.setFieldsValue({ ioss_no: maskIossNo(record.ioss_no), platform_name: record.platform_name, products: record.products }); setAddModalOpen(true); }} />
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  // ---------- 表格列（黑名单）----------
  const blacklistColumns = [
    { title: '序号', key: 'index', width: 60, render: function (_: any, __: any, index: number) { return index + 1; } },
    {
      title: 'IOSS号', dataIndex: 'ioss_no', key: 'ioss_no', width: 180,
      render: function (text: string) {
        return <span className="ioss-masked-text">{maskIossNo(text)}</span>;
      }
    },
    { title: '平台名称', dataIndex: 'platform_name', key: 'platform_name', width: 120 },
    {
      title: '销售产品', dataIndex: 'products', key: 'products', width: 220,
      render: function (products: string[]) { return renderProducts(products); }
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: function (s: string) { return getStatusTag(s); } },
    { title: '创建人', dataIndex: 'creator', key: 'creator', width: 100 },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time', width: 170 },
    { title: '修改人', dataIndex: 'modifier', key: 'modifier', width: 100 },
    { title: '修改时间', dataIndex: 'modify_time', key: 'modify_time', width: 170 },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: function (_: any, record: any) {
        return (
          <Space size={0}>
            <Tooltip title="操作日志">
              <Button type="text" size="small" icon={<FileTextOutlined />}
                onClick={function () { setLogRecord(record); setLogModalOpen(true); }} />
            </Tooltip>
            <Tooltip title="修改">
              <Button type="text" size="small" icon={<EditOutlined />} />
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  // ---------- 新增/编辑弹框 ----------
  const handleSave = useCallback(function () {
    form.validateFields().then(function (values) {
      if (editingRecord) {
        message.success('修改成功');
        emitEvent('onEdit', JSON.stringify(values));
      } else {
        message.success('新增成功');
        emitEvent('onAdd', JSON.stringify(values));
      }
      setAddModalOpen(false);
      setEditingRecord(null);
      form.resetFields();
    }).catch(function () {
      message.warning('请完善必填信息');
    });
  }, [form, editingRecord, emitEvent]);

  const renderAddModal = function () {
    const isEdit = !!editingRecord;

    return (
      <Modal
        title={isEdit ? '修改IOSS号' : '新增IOSS号'}
        open={addModalOpen}
        onCancel={function () { setAddModalOpen(false); setEditingRecord(null); form.resetFields(); }}
        width={520}
        destroyOnClose
        className="ioss-dialog"
        footer={[
          <Button key="cancel" onClick={function () { setAddModalOpen(false); setEditingRecord(null); form.resetFields(); }}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleSave}>确定</Button>
        ]}
      >
        <Form form={form} layout="horizontal" labelCol={{ style: { width: 96 } }} size="middle" style={{ padding: '8px 0' }}>
          <Form.Item label="IOSS号" name="ioss_no"
            rules={[{ required: true, message: '请输入IOSS号' }]}>
            <Input placeholder="请输入IOSS号" disabled={isEdit} />
          </Form.Item>
          <Form.Item label="平台名称" name="platform_name"
            rules={[{ required: true, message: '请选择平台' }]}>
            <Select placeholder="请选择平台" options={PLATFORM_OPTIONS} />
          </Form.Item>
          <Form.Item label="销售产品" name="products"
            rules={[{ required: true, message: '请选择销售产品' }]}>
            <Select
              mode="multiple"
              placeholder="请选择销售产品"
              options={PRODUCT_OPTIONS}
              maxTagCount={3}
              showSearch
              filterOption={function (input: string, option: any) {
                return option.label.toLowerCase().includes(input.toLowerCase());
              }}
            />
          </Form.Item>

        </Form>
      </Modal>
    );
  };

  // ---------- 操作日志弹框 ----------
  const renderLogModal = function () {
    const logData = [
      { time: '2026-06-13 12:45:00', operator: '周婷', action: '修改状态', detail: '启用 → 启用' },
      { time: '2026-06-10 14:22:00', operator: '卓运康', action: '修改信息', detail: '更新了销售产品' },
      { time: '2026-06-01 10:00:00', operator: '周婷', action: '新增', detail: '新增IOSS号记录' }
    ];

    return (
      <Modal
        title={logRecord ? `操作日志 - ${logRecord.ioss_no}` : '操作日志'}
        open={logModalOpen}
        onCancel={function () { setLogModalOpen(false); setLogRecord(null); }}
        width={640}
        destroyOnClose
        className="ioss-dialog"
        footer={null}
      >
        <Table
          dataSource={logData}
          columns={[
            { title: '操作时间', dataIndex: 'time', key: 'time', width: 170 },
            { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
            { title: '操作类型', dataIndex: 'action', key: 'action', width: 100 },
            { title: '操作详情', dataIndex: 'detail', key: 'detail' }
          ]}
          pagination={false}
          size="small"
          className="ioss-log-table"
        />
      </Modal>
    );
  };

  // ---------- 动作 ----------
  const fireActionHandler = useCallback(function (name: string, params?: string) {
    switch (name) {
      case 'openAddModal':
        setEditingRecord(null);
        form.resetFields();
        setAddModalOpen(true);
        break;
      case 'refreshList':
        message.info('列表已刷新');
        break;
      default:
        console.warn('未知的动作类型:', name);
    }
  }, [form]);



  // ---------- Tab 内容 ----------
  const tabItems = [
    {
      key: 'ioss',
      label: '平台IOSS号',
      children: (
        <>
          {/* 搜索栏 */}
          <div className="ioss-search-bar">
            <Space wrap size={[12, 12]}>
              <Input
                placeholder="IOSS号"
                prefix={<SearchOutlined />}
                allowClear
                value={searchIossNo}
                onChange={function (e) { setSearchIossNo(e.target.value); }}
                className="ioss-search-input"
              />
              <Select
                placeholder="平台名称"
                allowClear
                value={searchPlatform}
                onChange={function (val) { setSearchPlatform(val); }}
                className="ioss-select"
                options={PLATFORM_OPTIONS}
              />
              <Select
                placeholder="状态"
                allowClear
                value={searchStatus}
                onChange={function (val) { setSearchStatus(val); }}
                className="ioss-select"
                options={[
                  { value: 'active', label: '启用' },
                  { value: 'inactive', label: '停用' },
                  { value: 'blacklisted', label: '黑名单' }
                ]}
              />
            </Space>
          </div>

          {/* 操作栏 */}
          <div className="ioss-action-bar">
            <Space>
              <Button type="primary" icon={<PlusCircleOutlined />}
                onClick={function () { setEditingRecord(null); form.resetFields(); setAddModalOpen(true); }}>
                新增
              </Button>
              <Button
                icon={<span style={{ fontWeight: 700, fontSize: 12 }}>+</span>}
                onClick={function () { emitEvent('onToggleStatus', JSON.stringify({ action: 'enable' })); message.success('启用成功'); }}>
                启用
              </Button>
              <Button
                icon={<span style={{ fontWeight: 700, fontSize: 12 }}>−</span>}
                onClick={function () { emitEvent('onToggleStatus', JSON.stringify({ action: 'disable' })); message.success('禁用成功'); }}>
                禁用
              </Button>
            </Space>
            <Space>
              <Button type="primary" icon={<SearchOutlined />}
                onClick={function () { emitEvent('onSearch', JSON.stringify({ searchIossNo, searchPlatform, searchStatus })); }}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />}
                onClick={function () { setSearchIossNo(''); setSearchPlatform(undefined); setSearchStatus(undefined); }}>
                重置
              </Button>
            </Space>
          </div>

          {/* 表格 */}
          <div className="ioss-table-wrapper">
            <Table
              columns={iossColumns}
              dataSource={filteredData}
              scroll={{ x: 1450 }}
              size="middle"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: function (total, range) { return `第 ${range[0]}-${range[1]} 条，共 ${total} 条`; }
              }}
              className="ioss-table"
            />
          </div>
        </>
      )
    },
    {
      key: 'blacklist',
      label: 'IOSS黑名单',
      children: (
        <>
          <div className="ioss-search-bar">
            <Space wrap size={[12, 12]}>
              <Input
                placeholder="IOSS号"
                prefix={<SearchOutlined />}
                allowClear
                className="ioss-search-input"
              />
              <Select
                placeholder="平台名称"
                allowClear
                className="ioss-select"
                options={PLATFORM_OPTIONS}
              />
            </Space>
          </div>
          <div className="ioss-action-bar">
            <div />
            <Space>
              <Button type="primary" icon={<SearchOutlined />}>查询</Button>
              <Button icon={<ReloadOutlined />}>重置</Button>
            </Space>
          </div>
          <div className="ioss-table-wrapper">
            <Table
              columns={blacklistColumns}
              dataSource={blacklistedData}
              scroll={{ x: 1450 }}
              size="middle"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: function (total, range) { return `第 ${range[0]}-${range[1]} 条，共 ${total} 条`; }
              }}
              className="ioss-table"
            />
          </div>
        </>
      )
    }
  ];

  // ---------- 渲染 ----------
  return (
    <div className="ioss-layout">
      <div className="ioss-page-header">
        <div className="ioss-page-title-area">
          <Title level={4} className="ioss-page-title">{title}</Title>
          <Text type="secondary" className="ioss-page-desc">管理平台IOSS税号及黑名单配置</Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={function (key) { setActiveTab(key); }}
        items={tabItems}
        className="ioss-tabs"
        tabBarStyle={{ marginBottom: 0, paddingLeft: 24, background: '#fff', borderRadius: '8px 8px 0 0' }}
      />

      {renderAddModal()}
      {renderLogModal()}
    </div>
  );
};

export default Component;
