/**
 * @name LBU-B2B客户单票特价申请
 *
 * 参考资料：
 * - /rules/development-guide.md
 * - spec.md / api.md（同目录文档）
 */

import React, { useState, useCallback } from 'react';

import {
  Layout,
  Card,
  Form,
  Input,
  Select,
  Radio,
  Button,
  Space,
  Divider,
  Row,
  Col,
  Flex,
  Typography,
  Segmented,
  Alert,
  Modal,
  message
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const EVENT_LIST: EventItem[] = [
  { name: 'onSubmit', desc: '提交申请时触发' },
  { name: 'onSaveDraft', desc: '暂存草稿时触发' }
];

const ACTION_LIST: Action[] = [
  { name: 'reset', desc: '重置表单' }
];

const VAR_LIST: KeyDesc[] = [
  { name: 'applyNo', desc: '申请单号' },
  { name: 'customerCode', desc: '客户代码' }
];

const CONFIG_LIST: ConfigItem[] = [
  {
    type: 'input',
    attributeId: 'title',
    displayName: '页面标题',
    info: '顶部主题区显示标题',
    initialValue: 'OA申请'
  }
];

const DATA_LIST: DataDesc[] = [];

const COUNTRY_OPTIONS = ['美国', '德国', '英国', '法国', '日本', '加拿大', '澳大利亚'].map((c) => ({ label: c, value: c }));
const PRODUCT_OPTIONS = ['Amazon 标准', 'Amazon 优先', '海外仓专享', 'FBA 头程'].map((c) => ({ label: c, value: c }));
const PACKAGE_OPTIONS = ['纸箱', '编织袋', '木箱', '托盘'].map((c) => ({ label: c, value: c }));
const CARGO_OPTIONS = ['普货', '带电', '液体', '粉末', '仿牌'].map((c) => ({ label: c, value: c }));
const DECLARE_OPTIONS = ['正式报关', '简易报关', '快件报关'].map((c) => ({ label: c, value: c }));
const TRADE_OPTIONS = ['FOB', 'CIF', 'DDP', 'DDU'].map((c) => ({ label: c, value: c }));
const CURRENCY_OPTIONS = ['RMB', 'USD', 'EUR', 'HKD', 'GBP'].map((c) => ({ label: c, value: c }));
const EMPLOYEE_OPTIONS = [
  { label: 'zt19777 孙晓雨', value: 'zt19777' },
  { label: 'zt20001 张伟', value: 'zt20001' },
  { label: 'zt20002 李娜', value: 'zt20002' },
  { label: 'zt20003 王强', value: 'zt20003' },
  { label: 'zt20004 刘洋', value: 'zt20004' }
];

const genApplyNo = () => `LBU${Date.now().toString().slice(-10)}`;

const Component = function LbuB2bSpecialPrice() {
  const innerProps: any = {};
  const onEventHandler = typeof innerProps.onEvent === 'function' ? innerProps.onEvent : function () { return undefined; };

  const [form] = Form.useForm();
  const [applyNo, setApplyNo] = useState<string | null>(null);
  const [submitVisible, setSubmitVisible] = useState(false);

  const emitEvent = useCallback(function (eventName: string, payload?: string) {
    try { onEventHandler(eventName, payload); } catch (e) { console.warn(e); }
  }, [onEventHandler]);

  const resetForm = useCallback(function () {
    form.resetFields();
    setApplyNo(null);
  }, [form]);



  const handleSubmit = useCallback(function () {
    form.validateFields()
      .then(() => {
        const no = genApplyNo();
        setApplyNo(no);
        setSubmitVisible(true);
        message.success('申请提交成功');
        emitEvent('onSubmit', JSON.stringify({ applyNo: no }));
      })
      .catch(() => {
        message.error('请检查必填项');
      });
  }, [form, emitEvent]);

  const handleSaveDraft = useCallback(function () {
    const no = applyNo || genApplyNo();
    setApplyNo(no);
    message.success('已暂存草稿');
    emitEvent('onSaveDraft', JSON.stringify({ applyNo: no }));
  }, [applyNo, emitEvent]);

  return (
    <Layout style={{ minHeight: '100vh', padding: 24, background: '#f5f7fa' }}>
      <Card style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>OA申请</Title>
          <Space>
            <Text type="secondary">允许协同</Text>
            <Form.Item name="collab" initialValue={true} noStyle>
              <Segmented options={[{ label: '开', value: true }, { label: '关', value: false }]} />
            </Form.Item>
          </Space>
        </Flex>

        <Form form={form} layout="vertical" requiredMark>
          {/* 基本信息 */}
          <Divider orientation="left">基本信息</Divider>
          <Row gutter={[24, 0]}>
            <Col span={12}>
              <Form.Item label="申请人" name="applicant" rules={[{ required: true }]}>
                <Input placeholder="请输入申请人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="员工工号" name="employeeNo" rules={[{ required: true }]}>
                <Select placeholder="输入员工工号搜索" showSearch optionFilterProp="label" options={EMPLOYEE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="申请日期" name="applyDate">
                <Input placeholder="YYYY-MM-DD（默认当天）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="申请单号" name="applyNo">
                <Input placeholder="提交后自动生成" disabled value={applyNo || undefined} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="部门" name="dept" rules={[{ required: true }]}>
                <Input placeholder="请输入部门" />
              </Form.Item>
            </Col>
          </Row>

          {/* 一、客户信息 */}
          <Divider orientation="left">一、客户信息</Divider>
          <Row gutter={[24, 0]}>
            <Col span={12}>
              <Form.Item label="客户代码" name="customerCode" rules={[{ required: true }]}>
                <Input placeholder="请输入客户代码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="销售是否可以填写计费信息项" name="salesFillBilling" rules={[{ required: true }]}>
                <Radio.Group options={[{ label: '是', value: 'yes' }, { label: '否', value: 'no' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(p, c) => p.salesFillBilling !== c.salesFillBilling}>
            {({ getFieldValue }) =>
              getFieldValue('salesFillBilling') === 'no' ? (
                <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                  message="当前选择「否」，计费信息项由报价部门填写，销售不可编辑。" />
              ) : null
            }
          </Form.Item>

          {/* 二、报价信息 */}
          <Divider orientation="left">二、报价信息</Divider>
          <Row gutter={[24, 0]}>
            <Col span={8}>
              <Form.Item label="国家" name="country" rules={[{ required: true }]}>
                <Select options={COUNTRY_OPTIONS} placeholder="请选择" showSearch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="产品目录" name="productCatalog" rules={[{ required: true }]}>
                <Select options={PRODUCT_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="包装规格" name="packageSpec" rules={[{ required: true }]}>
                <Select options={PACKAGE_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="件数" name="pieceCount" rules={[{ required: true }]}>
                <Input placeholder="请输入件数" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="品名" name="productName" rules={[{ required: true }]}>
                <Input placeholder="请输入品名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="HS CODE" name="hsCode" rules={[{ required: true }]}>
                <Input placeholder="请输入 HS CODE" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="货物类型" name="cargoType" rules={[{ required: true }]}>
                <Select options={CARGO_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="报关方式" name="declareType" rules={[{ required: true }]}>
                <Select options={DECLARE_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="贸易方式" name="tradeType" rules={[{ required: true }]}>
                <Select options={TRADE_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="是否含锂电池" name="hasBattery" rules={[{ required: true }]}>
                <Radio.Group options={[{ label: '是', value: 'yes' }, { label: '否', value: 'no' }]} />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="单箱尺寸" style={{ marginBottom: 16 }}>
            <Form.List name="boxSizes">
              {(fields, { add, remove, move }) => (
                <>
                  {fields.map((field, index) => (
                    <Flex key={field.key} align="baseline" gap={8} wrap style={{ marginBottom: 8 }}>
                      <Form.Item {...field} name={[field.name, 'length']} rules={[{ required: true, message: '长' }]} noStyle>
                        <Input placeholder="长(cm)" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'width']} rules={[{ required: true, message: '宽' }]} noStyle>
                        <Input placeholder="宽(cm)" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'height']} rules={[{ required: true, message: '高' }]} noStyle>
                        <Input placeholder="高(cm)" style={{ width: 120 }} />
                      </Form.Item>
                      <Button type="text" icon={<ArrowUpOutlined />} onClick={() => move(index, index - 1)} disabled={index === 0} />
                      <Button type="text" icon={<ArrowDownOutlined />} onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} />
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Flex>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加单箱尺寸</Button>
                </>
              )}
            </Form.List>
          </Card>

          <Card size="small" title="发货地址" style={{ marginBottom: 16 }}>
            <Form.List name="shipAddresses">
              {(fields, { add, remove, move }) => (
                <>
                  {fields.map((field, index) => (
                    <Flex key={field.key} align="baseline" gap={8} wrap style={{ marginBottom: 8 }}>
                      <Form.Item {...field} name={[field.name, 'country']} rules={[{ required: true, message: '国家/地区' }]} noStyle>
                        <Input placeholder="国家/地区" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'detail']} rules={[{ required: true, message: '详细地址' }]} noStyle>
                        <Input placeholder="详细地址" style={{ width: 320 }} />
                      </Form.Item>
                      <Button type="text" icon={<ArrowUpOutlined />} onClick={() => move(index, index - 1)} disabled={index === 0} />
                      <Button type="text" icon={<ArrowDownOutlined />} onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} />
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Flex>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加发货地址</Button>
                </>
              )}
            </Form.List>
          </Card>

          {/* 三、计费信息项 */}
          <Divider orientation="left">三、计费信息项</Divider>
          <Card size="small" title="单票改价信息" style={{ marginBottom: 16 }}>
            <Form.List name="priceChanges">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Flex key={field.key} align="baseline" gap={8} wrap style={{ marginBottom: 8 }}>
                      <Form.Item {...field} name={[field.name, 'feeItem']} rules={[{ required: true, message: '费用项' }]} noStyle>
                        <Input placeholder="费用项" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'original']} rules={[{ required: true, message: '原价' }]} noStyle>
                        <Input placeholder="原价" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'changed']} rules={[{ required: true, message: '改价后' }]} noStyle>
                        <Input placeholder="改价后" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'currency']} rules={[{ required: true, message: '币种' }]} noStyle>
                        <Select options={CURRENCY_OPTIONS} placeholder="币种" style={{ width: 100 }} />
                      </Form.Item>
                      <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Flex>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加改价信息</Button>
                </>
              )}
            </Form.List>
          </Card>

          <Row gutter={[24, 0]}>
            <Col span={12}>
              <Form.Item label="是否存在附加费减免" name="hasDiscount" rules={[{ required: true }]}>
                <Radio.Group options={[{ label: '是', value: 'yes' }, { label: '否', value: 'no' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(p, c) => p.hasDiscount !== c.hasDiscount}>
                {({ getFieldValue }) =>
                  getFieldValue('hasDiscount') === 'yes' ? (
                    <Form.Item label="扣件减免" name="discountDetail" rules={[{ required: true }]}>
                      <Input.TextArea rows={2} placeholder="请填写扣件减免说明" />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="价格有效期" name="priceValid" rules={[{ required: true }]}>
            <Input placeholder="如：2025-01-01 至 2025-03-31" />
          </Form.Item>

          {/* 流程处理 */}
          <Divider orientation="left">流程处理</Divider>
          <Row gutter={[24, 0]}>
            <Col span={8}>
              <Form.Item label="提交身份" name="submitRole" rules={[{ required: true }]}>
                <Select placeholder="请选择" options={[{ label: '销售', value: 'sales' }, { label: '报价', value: 'quote' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="回签方向" name="signDirection" rules={[{ required: true }]}>
                <Select placeholder="请选择" options={[{ label: '给客户', value: 'toCustomer' }, { label: '给内部', value: 'toInner' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="紧急程度" name="urgency" rules={[{ required: true }]}>
                <Radio.Group options={[{ label: '普通', value: 'normal' }, { label: '紧急', value: 'urgent' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="处理意见" name="opinion">
            <Input.TextArea rows={2} placeholder="请输入处理意见" />
          </Form.Item>
          <Form.Item label="通知选项" name="notify">
            <Select mode="multiple" placeholder="请选择通知人" options={[{ label: '销售', value: 'sales' }, { label: '主管', value: 'manager' }, { label: '财务', value: 'finance' }]} />
          </Form.Item>

          <Divider style={{ margin: '24px 0' }} />

          <Flex justify="center" style={{ padding: '0 0 8px' }}>
            <Space size="large">
              <Button type="primary" onClick={handleSubmit}>提交</Button>
              <Button onClick={handleSaveDraft}>暂存</Button>
              <Button onClick={resetForm}>重置</Button>
            </Space>
          </Flex>
        </Form>
      </Card>

      <Modal
        open={submitVisible}
        title="提交成功"
        onOk={() => setSubmitVisible(false)}
        onCancel={() => setSubmitVisible(false)}
        okText="知道了"
      >
        <p>申请单号：<Text strong copyable>{applyNo}</Text></p>
        <p>该申请已进入审批流程，可在「我的申请」中查看进度。</p>
      </Modal>
    </Layout>
  );
};

export default Component;
