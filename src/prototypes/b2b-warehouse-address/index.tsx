import { useState, useMemo } from 'react';
import {
  Button,
  Input,
  Space,
  Table,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Upload,
  Radio,
  Tag,
  Typography,
  Card,
  message,
} from 'antd';
import { UploadOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Key } from 'react';

const { Title, Text } = Typography;

/* ───────────── 下拉选项 ───────────── */
const ADDRESS_TYPE_OPTIONS = [
  { value: 1, label: 'Amazon地址' },
  { value: 3, label: '海外仓地址' },
];
const COUNTRY_OPTIONS = [
  { value: 'US', label: '美国' },
  { value: 'DE', label: '德国' },
  { value: 'GB', label: '英国' },
  { value: 'FR', label: '法国' },
  { value: 'JP', label: '日本' },
];
const TWO_ADDRESS_TYPE_LIST = [
  { Id: 1, CnName: '海外仓(美西)', EnName: 'US-WEST' },
  { Id: 2, CnName: '海外仓(美东)', EnName: 'US-EAST' },
  { Id: 3, CnName: '海外仓(德国)', EnName: 'DE-WAREHOUSE' },
  { Id: 4, CnName: '海外仓(英国)', EnName: 'GB-WAREHOUSE' },
];
const CHECK_RULE_OPTIONS = [
  { value: true, label: '跳过校验' },
  { value: false, label: '不跳过' },
];

/* ───────────── 数据类型 ───────────── */
interface WarehouseItem {
  AddressId: number;
  AddressType: number;
  TwoAddressTypeName?: string;
  WarehouseCode: string;
  CountryCode: string;
  Province: string;
  City: string;
  Street1: string;
  PostalCode: string;
  YTWarehouseCode: string;
  IsEnabled: 'Y' | 'N';
}

const MOCK_DATA: WarehouseItem[] = [
  { AddressId: 1, AddressType: 1, WarehouseCode: 'AMZ-US-01', CountryCode: 'US', Province: 'CA', City: 'Los Angeles', Street1: '123 Main St', PostalCode: '90001', YTWarehouseCode: 'YTUS01', IsEnabled: 'Y' },
  { AddressId: 2, AddressType: 3, TwoAddressTypeName: '海外仓(美西)', WarehouseCode: 'OW-US-W', CountryCode: 'US', Province: 'CA', City: 'Ontario', Street1: '456 Industry Ave', PostalCode: '91761', YTWarehouseCode: 'YTUS02', IsEnabled: 'Y' },
  { AddressId: 3, AddressType: 3, TwoAddressTypeName: '海外仓(德国)', WarehouseCode: 'OW-DE', CountryCode: 'DE', Province: 'Berlin', City: 'Berlin', Street1: '789 Hafen Str', PostalCode: '10115', YTWarehouseCode: 'YTDE01', IsEnabled: 'N' },
  { AddressId: 4, AddressType: 1, WarehouseCode: 'AMZ-JP-01', CountryCode: 'JP', Province: 'Tokyo', City: 'Shibuya', Street1: '1-2-3 Shibuya', PostalCode: '150-0002', YTWarehouseCode: 'YTJP01', IsEnabled: 'Y' },
];

export default function App() {
  const [keyWord, setKeyWord] = useState('');
  const [data, setData] = useState<WarehouseItem[]>(MOCK_DATA);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<WarehouseItem | null>(null);
  const [addForm] = Form.useForm();
  const addressType = Form.useWatch('AddressType', addForm);

  const [secOpen, setSecOpen] = useState(false);
  const [secForm] = Form.useForm();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportAll, setExportAll] = useState<boolean>(true);

  const filtered = useMemo(() => {
    const k = keyWord.trim().toLowerCase();
    if (!k) return data;
    return data.filter(
      (d) =>
        d.WarehouseCode.toLowerCase().includes(k) ||
        d.Street1.toLowerCase().includes(k) ||
        d.Province.toLowerCase().includes(k) ||
        d.City.toLowerCase().includes(k) ||
        d.PostalCode.toLowerCase().includes(k),
    );
  }, [keyWord, data]);

  const { canDisable, canEnable } = useMemo(() => {
    const rows = data.filter((d) => selectedKeys.includes(d.AddressId));
    return {
      canDisable: rows.length > 0 && rows.some((r) => r.IsEnabled === 'Y'),
      canEnable: rows.length > 0 && rows.some((r) => r.IsEnabled === 'N'),
    };
  }, [data, selectedKeys]);

  const handleReset = () => setKeyWord('');

  const openAdd = () => {
    setEditRow(null);
    setAddOpen(true);
  };
  const openEdit = (row: WarehouseItem) => {
    setEditRow(row);
    setAddOpen(true);
  };

  const handleEnableDisable = (enabled: boolean) => {
    if (selectedKeys.length === 0) {
      message.warning('请先勾选要操作的仓库');
      return;
    }
    Modal.confirm({
      title: enabled ? '启用' : '禁用',
      content: `已勾选 ${selectedKeys.length} 条仓库地址，确定要${enabled ? '启用' : '禁用'}吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setData((prev) =>
          prev.map((d) => (selectedKeys.includes(d.AddressId) ? { ...d, IsEnabled: enabled ? 'Y' : 'N' } : d)),
        );
        message.success(`${enabled ? '启用' : '禁用'}成功`);
      },
    });
  };

  const handleExportOk = () => {
    const count = exportAll ? data.length : selectedKeys.length;
    message.success(`已开始导出 ${count} 条仓库地址`);
    setExportOpen(false);
  };

  const strSorter = (field: keyof WarehouseItem) => (a: WarehouseItem, b: WarehouseItem) =>
    String(a[field]).localeCompare(String(b[field]), 'zh-CN');

  const columns: ColumnsType<WarehouseItem> = [
    {
      title: '序号',
      dataIndex: 'index',
      width: 60,
      fixed: 'left',
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '仓库类型',
      dataIndex: 'AddressType',
      width: 130,
      sorter: strSorter('AddressType'),
      render: (v: number) =>
        v === 1 ? <Tag color="blue">Amazon地址</Tag> : v === 3 ? <Tag color="geekblue">海外仓地址</Tag> : null,
    },
    { title: '二级地址类型', dataIndex: 'TwoAddressTypeName', width: 140, sorter: strSorter('TwoAddressTypeName') },
    { title: '仓库代码', dataIndex: 'WarehouseCode', width: 130, sorter: strSorter('WarehouseCode') },
    {
      title: '国家',
      dataIndex: 'CountryCode',
      width: 90,
      sorter: strSorter('CountryCode'),
      render: (v: string) => COUNTRY_OPTIONS.find((o) => o.value === v)?.label ?? v,
    },
    { title: '省/州', dataIndex: 'Province', width: 100, sorter: strSorter('Province') },
    { title: '城市', dataIndex: 'City', width: 100, sorter: strSorter('City') },
    { title: '地址', dataIndex: 'Street1', width: 220, ellipsis: true, sorter: strSorter('Street1') },
    { title: '邮编', dataIndex: 'PostalCode', width: 120, sorter: strSorter('PostalCode') },
    { title: '云途仓库代码', dataIndex: 'YTWarehouseCode', width: 180, sorter: strSorter('YTWarehouseCode') },
    {
      title: '状态',
      dataIndex: 'IsEnabled',
      width: 100,
      sorter: strSorter('IsEnabled'),
      render: (v: string) =>
        v === 'Y' ? <Tag color="success">启用</Tag> : v === 'N' ? <Tag color="error">禁用</Tag> : null,
    },
    {
      title: '操作',
      dataIndex: 'Operation',
      width: 90,
      fixed: 'right',
      render: (_: any, row: WarehouseItem) => (
        <Button type="link" size="small" onClick={() => openEdit(row)}>
          修改
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 标题区 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>B2B仓库地址管理</Title>
        <Text type="secondary">管理 Amazon 与海外仓的收货地址及二级地址类型</Text>
      </div>

      <Card styles={{ body: { padding: 16 } }} variant="borderless" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* 查询区 */}
        <Form layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item label="关键字">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="输入仓库代码/地址/州省/城市/邮编查询"
              style={{ width: 380 }}
              value={keyWord}
              onChange={(e) => setKeyWord(e.target.value)}
              onPressEnter={handleReset}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleReset}>查询</Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增</Button>
            <Button onClick={() => setSecOpen(true)}>二级地址配置</Button>
            <Button onClick={() => setImportOpen(true)}>批量导入</Button>
            <Button onClick={() => setExportOpen(true)}>批量导出</Button>
            <Button disabled={!canDisable} onClick={() => handleEnableDisable(false)}>禁用</Button>
            <Button disabled={!canEnable} onClick={() => handleEnableDisable(true)}>启用</Button>
          </Space>
          {selectedKeys.length > 0 && <Text type="secondary">已选 {selectedKeys.length} 项</Text>}
        </div>

        <Table<WarehouseItem>
          rowKey="AddressId"
          size="small"
          bordered
          dataSource={filtered}
          columns={columns}
          scroll={{ x: 1400 }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys: Key[]) => setSelectedKeys(keys),
            getCheckboxProps: (record: WarehouseItem) => ({ disabled: record.AddressType === 3 }),
          }}
          pagination={{
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            defaultPageSize: 20,
            pageSizeOptions: ['20', '30', '50', '70', '100'],
          }}
        />
      </Card>

      {/* 新增 / 编辑（两列栅格布局） */}
      <Modal
        title={editRow ? '修改仓库地址' : '新增仓库地址'}
        open={addOpen}
        width={680}
        style={{ top: '2vh' }}
        maskClosable={false}
        destroyOnClose
        onCancel={() => setAddOpen(false)}
        onOk={() => {
          message.success(editRow ? '保存成功' : '新增成功');
          setAddOpen(false);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={addForm}
          layout="vertical"
          preserve={false}
          initialValues={editRow ?? { AddressType: 1 }}
          style={{ marginTop: 12 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="仓库代码" name="WarehouseCode" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="仓库类型" name="AddressType" rules={[{ required: true, message: '请选择' }]}>
                <Select options={ADDRESS_TYPE_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
          </Row>

          {addressType === 3 && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="二级地址类型" name="TwoAddressType" rules={[{ required: true, message: '请选择' }]}>
                  <Select
                    placeholder="请选择"
                    options={TWO_ADDRESS_TYPE_LIST.map((o) => ({
                      value: o.Id,
                      label: (
                        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{o.CnName}</span>
                          <span style={{ color: '#999', fontSize: 12 }}>{o.EnName}</span>
                        </span>
                      ),
                    }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="国家" name="CountryCode" rules={[{ required: true, message: '请选择' }]}>
                  <Select options={COUNTRY_OPTIONS} placeholder="请选择" allowClear />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="省/州" name="Province" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="城市" name="City" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="地址"
            name="Street"
            rules={[
              { required: true, message: '请输入' },
              { max: 35, message: '地址限制35字符，超过部分请填写到地址2一栏' },
            ]}
          >
            <Input.TextArea rows={2} showCount placeholder="请输入" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="地址2" name="HouseNumber">
                <Input allowClear maxLength={30} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="邮编" name="PostalCode" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="云途仓库代码" name="YTWarehouseCode" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="Telephone" rules={[{ required: true, message: '请输入' }]}>
                <Input allowClear maxLength={50} showCount placeholder="请输入" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="联系人" name="ContactPerson" rules={[{ required: true, message: '请输入' }]}>
            <Input allowClear maxLength={100} showCount placeholder="请输入" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 二级地址配置（卡片式行 + 虚线添加） */}
      <Modal
        title="二级地址配置"
        open={secOpen}
        width={1000}
        style={{ top: '3vh' }}
        maskClosable={false}
        destroyOnClose
        onCancel={() => setSecOpen(false)}
        onOk={async () => {
          const rows = secForm.getFieldValue('WarehouseList') || [];
          if (rows.length < 1) {
            Modal.info({ title: '至少添加一个二级地址' });
            return Promise.reject();
          }
          await secForm.validateFields();
          message.success('保存成功');
          setSecOpen(false);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={secForm}
          preserve={false}
          initialValues={{ WarehouseList: [{ CnName: '', EnName: '', IsSkipVerify: false }] }}
          style={{ marginTop: 12 }}
        >
          <Form.List name="WarehouseList">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {fields.map((field) => (
                  <div key={field.key} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', background: '#fafafa' }}>
                    <Row gutter={16} align="bottom">
                      <Col span={7}>
                        <Form.Item label="中文名称" name={[field.name, 'CnName']} rules={[{ required: true, message: '请输入' }]} style={{ marginBottom: 0 }}>
                          <Input allowClear placeholder="请输入" />
                        </Form.Item>
                      </Col>
                      <Col span={7}>
                        <Form.Item label="英文名称" name={[field.name, 'EnName']} rules={[{ required: true, message: '请输入' }]} style={{ marginBottom: 0 }}>
                          <Input allowClear placeholder="请输入" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item label="校验规则 Reference ID" name={[field.name, 'IsSkipVerify']} rules={[{ required: true, message: '请选择' }]} style={{ marginBottom: 0 }}>
                          <Select options={CHECK_RULE_OPTIONS} placeholder="请选择" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} style={{ paddingLeft: 0 }}>
                          删除
                        </Button>
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                  添加二级地址类型
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 批量导入 */}
      <Modal
        title="批量导入"
        open={importOpen}
        maskClosable={false}
        destroyOnClose
        onCancel={() => setImportOpen(false)}
        onOk={() => {
          message.success('导入成功');
          setImportOpen(false);
        }}
        okText="确定"
        cancelText="取消"
      >
        <Upload.Dragger beforeUpload={() => false} multiple={false}>
          <p className="ant-upload-drag-icon"><UploadOutlined /></p>
          <p className="ant-upload-text">将文件拖拽到此处，或点击上传</p>
          <p className="ant-upload-hint">支持 .xlsx / .csv 格式</p>
        </Upload.Dragger>
        <Button type="link" icon={<DownloadOutlined />} style={{ paddingLeft: 0, marginTop: 8 }}>
          下载导入模版
        </Button>
      </Modal>

      {/* 批量导出 */}
      <Modal
        title="批量导出"
        open={exportOpen}
        maskClosable={false}
        destroyOnClose
        onCancel={() => setExportOpen(false)}
        onOk={handleExportOk}
        okText="确定"
        cancelText="取消"
      >
        <Radio.Group value={exportAll} onChange={(e) => setExportAll(e.target.value)}>
          <Space direction="vertical">
            <Radio value={true}>导出全部（{data.length} 条）</Radio>
            <Radio value={false} disabled={selectedKeys.length === 0}>导出已选（{selectedKeys.length} 条）</Radio>
          </Space>
        </Radio.Group>
      </Modal>
    </div>
  );
}
