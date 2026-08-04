import { ConfigProvider, Tabs, Card, Table, Tag, Typography, Descriptions, Alert, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApiOutlined,
  SwapOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  FieldBinaryOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/* ───────────── 视觉精修样式（仅样式，不影响功能与结构） ───────────── */
const SEU_STYLE = `
  .seu-page {
    background: linear-gradient(180deg, #f8fafc 0%, #f5f7fa 180px);
  }
  .seu-header {
    position: relative;
    padding-left: 14px;
    margin-bottom: 20px;
  }
  .seu-header::before {
    content: '';
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 4px;
    border-radius: 2px;
    background: linear-gradient(180deg, #1677ff 0%, #69b1ff 100%);
  }
  .seu-title {
    margin: 0 !important;
    font-size: 22px !important;
    font-weight: 700 !important;
    color: #111827 !important;
    letter-spacing: 0.4px;
  }
  .seu-sub {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    color: #6b7280 !important;
    line-height: 1.6;
  }
  .seu-card {
    border: 1px solid #e7ebf1 !important;
    border-radius: 10px !important;
    box-shadow: 0 2px 12px rgba(31, 41, 55, 0.05) !important;
  }
  .seu-alert {
    border-radius: 8px !important;
  }
  .seu-tabs .ant-tabs-nav {
    margin-bottom: 16px !important;
  }
  .seu-section-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 10px;
  }
  .seu-section-title {
    position: relative;
    padding-left: 11px;
    font-size: 15px !important;
    font-weight: 600 !important;
    color: #1f2937 !important;
    line-height: 1.4;
  }
  .seu-section-title::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3px;
    bottom: 3px;
    width: 3px;
    border-radius: 1.5px;
    background: linear-gradient(180deg, #1677ff, #69b1ff);
  }
  .seu-section-desc {
    font-size: 12px !important;
    color: #98a2b3 !important;
  }
  .seu-page code {
    padding: 1px 6px;
    background: #f1f4f9;
    border: 1px solid #e4e9f1;
    border-radius: 4px;
    color: #334155;
    font-size: 12.5px;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }
  .seu-req-point {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 10px !important;
    color: #374151;
    font-size: 13px;
    line-height: 1.7;
  }
  .seu-req-point .ant-tag {
    flex-shrink: 0;
    margin-top: 2px;
    margin-inline-end: 0;
    border-radius: 4px;
  }
  .seu-desc-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }
  .seu-map-table .ant-table-content::-webkit-scrollbar {
    height: 8px;
  }
  .seu-map-table .ant-table-content::-webkit-scrollbar-thumb {
    background: #cfd6df;
    border-radius: 4px;
  }
  .seu-map-table .ant-table-content::-webkit-scrollbar-thumb:hover {
    background: #b8c0cb;
  }
  .seu-map-table .ant-table-content::-webkit-scrollbar-track {
    background: transparent;
  }
`;

/* ───────────── 类型定义 ───────────── */
type MapStatus = 'ok' | 'no' | 'partial';

interface MappingRow {
  key: string;
  ytField: string; // 云途字段
  required: boolean | string; // 是否必填
  status: MapStatus; // ✅ / ❌ / ⚠️
  sheinField: string; // 货代字段
  note: string; // 说明
}

interface MappingSection {
  title: string;
  desc?: string;
  rows: MappingRow[];
}

const STATUS_META: Record<MapStatus, { color: string; label: string }> = {
  ok: { color: 'green', label: '✅ 可映射' },
  no: { color: 'red', label: '❌ 无对应字段' },
  partial: { color: 'gold', label: '⚠️ 部分映射' },
};

/* ───────────── 字段映射数据（源自 prd.link） ───────────── */
const MAPPING_SECTIONS: MappingSection[] = [
  {
    title: '1. 订单主体',
    desc: '云途基础字段 → 货代订单级字段',
    rows: [
      { key: '1', ytField: 'sorting_code', required: true, status: 'ok', sheinField: 'sortingCode', note: '分拣码' },
      { key: '2', ytField: '客户代码', required: true, status: 'ok', sheinField: 'supplierId', note: '根据SHEIN供应商ID对应的映射关系，映射对应客户代码' },
      { key: '3', ytField: 'customer_order_number', required: false, status: 'ok', sheinField: 'businessOrderNo', note: '客户订单号 → 发货单号' },
      { key: '4', ytField: 'product_code', required: true, status: 'ok', sheinField: 'productChannel', note: '云途产品代码 → 货代渠道（需货代确认映射关系）' },
      { key: '5', ytField: 'country_code', required: true, status: 'ok', sheinField: 'receiverAddress.countryCode', note: '目的国二字简码' },
      { key: '6', ytField: 'ein_number', required: false, status: 'no', sheinField: '—', note: '增值税号，货代无此字段' },
      { key: '7', ytField: 'import_company', required: false, status: 'no', sheinField: '—', note: '进口商公司名，货代无此字段' },
      { key: '8', ytField: 'bond_expire_time', required: false, status: 'no', sheinField: '—', note: 'BOND 有效期，货代无此字段' },
      { key: '9', ytField: 'goods_type', required: false, status: 'no', sheinField: '—', note: '货物类型，货代无此字段' },
      { key: '10', ytField: 'currency', required: true, status: 'ok', sheinField: 'boxDetailList.currency', note: '币种（云途支持多币种，货代价格由渠道固定），留空，待SHEIN提供' },
      { key: '11', ytField: 'coupon_code', required: false, status: 'no', sheinField: '—', note: '优惠券，货代无此字段' },
      { key: '12', ytField: 'source_code', required: false, status: 'no', sheinField: '—', note: '订单来源代码，货代无此字段' },
      { key: '13', ytField: 'eori_number', required: false, status: 'no', sheinField: '—', note: 'EORI 号，货代无此字段' },
      { key: '14', ytField: 'importer_address', required: false, status: 'no', sheinField: '—', note: '进口商地址，货代无此字段' },
    ],
  },
  {
    title: '2. 附加服务 extra_services',
    desc: '云途订单附加服务 → 货代',
    rows: [
      { key: '1', ytField: 'extra_services（整对象）', required: false, status: 'no', sheinField: '—', note: '货代无"订单附加服务"概念' },
      { key: '2', ytField: 'extra_code', required: false, status: 'no', sheinField: '—', note: '附加服务代码' },
      { key: '3', ytField: 'extra_note', required: false, status: 'no', sheinField: '—', note: '附加服务备注' },
      { key: '4', ytField: 'extra_value', required: false, status: 'no', sheinField: '—', note: '附加服务值' },
    ],
  },
  {
    title: '3. 收件人 receiver',
    desc: '云途收件人 → 货代 receiverAddress',
    rows: [
      { key: '1', ytField: 'receiver（整对象）', required: true, status: 'ok', sheinField: 'receiverAddress', note: '' },
      { key: '2', ytField: 'city', required: true, status: 'ok', sheinField: 'receiverAddress.cityName', note: '城市' },
      { key: '3', ytField: 'company', required: false, status: 'no', sheinField: '—', note: '公司名，货代 receiverAddress 无公司字段' },
      { key: '4', ytField: 'email', required: false, status: 'no', sheinField: '—', note: '邮箱，货代 receiverAddress 无邮箱字段' },
      { key: '5', ytField: 'address_type', required: true, status: 'no', sheinField: '—', note: '地址类型（1 亚马逊 / 2 私人 / 3 海外仓），货代无此字段，默认为=3，是否需要给SHEIN建个仓库' },
      { key: '6', ytField: 'name', required: true, status: 'ok', sheinField: 'receiverAddress.contact', note: '收件人姓名 → 联系人' },
      { key: '7', ytField: 'postal_code', required: false, status: 'no', sheinField: '—', note: '邮编，货代 receiverAddress 无邮编字段' },
      { key: '8', ytField: 'province', required: false, status: 'ok', sheinField: 'receiverAddress.stateName', note: '省' },
      { key: '9', ytField: 'street', required: true, status: 'ok', sheinField: 'receiverAddress.address', note: '详细地址' },
      { key: '10', ytField: 'street2', required: false, status: 'no', sheinField: '—', note: '详细地址2，货代无此字段' },
      { key: '11', ytField: 'phone_number', required: false, status: 'ok', sheinField: 'receiverAddress.phone', note: '电话' },
      { key: '12', ytField: 'address_code', required: false, status: 'no', sheinField: '—', note: '仓库代码，货代无此字段' },
      { key: '13', ytField: 'secondary_address_type', required: false, status: 'no', sheinField: '—', note: '二级地址类型，货代无此字段' },
      { key: '14', ytField: 'appointment_link', required: false, status: 'no', sheinField: '—', note: '预约链接，货代无此字段' },
      { key: '15', ytField: 'appointment_code', required: false, status: 'no', sheinField: '—', note: '预约码，货代无此字段' },
    ],
  },
  {
    title: '4. 包裹 packages',
    desc: '云途包裹信息 → 货代 boxList',
    rows: [
      { key: '1', ytField: 'packages（整对象）', required: true, status: 'ok', sheinField: 'boxList', note: '' },
      { key: '2', ytField: 'box_number', required: true, status: 'ok', sheinField: 'boxList.boxNo', note: '箱号' },
      { key: '3', ytField: 'height', required: true, status: 'ok', sheinField: 'boxList.height', note: '高 (cm)' },
      { key: '4', ytField: 'length', required: true, status: 'ok', sheinField: 'boxList.length', note: '长 (cm)' },
      { key: '5', ytField: 'weight', required: true, status: 'ok', sheinField: 'boxList.weight', note: '包裹重量 (KG)' },
      { key: '6', ytField: 'width', required: true, status: 'ok', sheinField: 'boxList.width', note: '宽 (cm)' },
      { key: '7', ytField: 'reference_id', required: false, status: 'no', sheinField: '—', note: 'ReferenceID，货代无此字段' },
      { key: '8', ytField: 'delivery_start_window', required: false, status: 'no', sheinField: '—', note: '亚马逊送达时段起始，货代无此场景' },
      { key: '9', ytField: 'delivery_end_window', required: false, status: 'no', sheinField: '—', note: '亚马逊送达时段结束，货代无此场景' },
    ],
  },
  {
    title: '4.1 申报信息 declaration_info',
    desc: '云途申报信息 → 货代 boxDetailList',
    rows: [
      { key: '1', ytField: 'declaration_info（整数组）', required: true, status: 'ok', sheinField: 'boxDetailList', note: '' },
      { key: '2', ytField: 'hs_code', required: true, status: 'ok', sheinField: 'boxDetailList.hsCode', note: 'HS 海关编码，货代 boxDetailList 无此字段，待SHEIN提供' },
      { key: '3', ytField: 'goods_url', required: true, status: 'ok', sheinField: 'boxDetailList.goodsThumb', note: '销售链接 → 商品主图 URL（语义不同）' },
      { key: '4', ytField: 'name_cn', required: true, status: 'ok', sheinField: 'boxDetailList.productNameCn', note: '申报中文名' },
      { key: '5', ytField: 'name_en', required: true, status: 'ok', sheinField: 'boxDetailList.productNameEn', note: '申报英文名' },
      { key: '6', ytField: 'remark', required: false, status: 'no', sheinField: '—', note: '备注，货代无此字段' },
      { key: '7', ytField: 'quantity', required: true, status: 'ok', sheinField: 'boxDetailList.qty', note: '数量' },
      { key: '8', ytField: 'unit_price', required: true, status: 'no', sheinField: '—', note: '申报价格，货代无此字段，待SHEIN提供' },
      { key: '9', ytField: 'unit_weight', required: true, status: 'ok', sheinField: 'boxDetailList.unitWeight', note: '单重 (KG)' },
      { key: '10', ytField: 'purpose', required: false, status: 'no', sheinField: '—', note: '用途说明，货代无此字段' },
      { key: '11', ytField: 'material', required: true, status: 'ok', sheinField: 'boxDetailList.materialList', note: '材质（云途单值 vs 货代多材质+百分比），货代是object，有中文和英文和百分比，需要确定组合形式' },
      { key: '12', ytField: 'brand', required: false, status: 'no', sheinField: '—', note: '品牌，货代无此字段' },
      { key: '13', ytField: 'model', required: false, status: 'no', sheinField: '—', note: '型号，货代无此字段' },
      { key: '14', ytField: 'quantity_unit', required: false, status: 'no', sheinField: '—', note: '数量单位，货代无此字段' },
      { key: '15', ytField: 'gross_weight', required: false, status: 'ok', sheinField: 'boxDetailList.unitWeight', note: '毛重，货代 boxDetailList 无此字段' },
      { key: '16', ytField: 'image_url', required: true, status: 'ok', sheinField: 'boxDetailList.goodsThumb', note: '图片链接 → 商品主图' },
    ],
  },
  {
    title: '5. 交货信息 delivery_info',
    desc: '云途交货信息 → 货代（货代无独立 delivery_info 对象）',
    rows: [
      { key: '1', ytField: 'delivery_info（整对象）', required: true, status: 'partial', sheinField: '分散在货代下单字段', note: '货代无 delivery_info 独立对象' },
      { key: '2', ytField: 'delivery_type', required: true, status: 'no', sheinField: '-', note: '1 揽收/2 自送 → 1 直送/2 集货（语义不完全对等），默认为：默认1云途揽收' },
      { key: '3', ytField: 'collect_address', required: false, status: 'ok', sheinField: 'senderAddress.address', note: '揽收地址 → 提货地址' },
      { key: '4', ytField: 'collect_starttime', required: false, status: 'ok', sheinField: 'appointmentPickupTime', note: '揽收时间 → 预计提货/送仓时间' },
      { key: '5', ytField: 'collect_warehouse', required: false, status: 'ok', sheinField: 'pickupSubWarehouseId', note: '交货仓库 → 提货仓库 id（一个仓库名，一个 id）' },
      { key: '6', ytField: 'warehouse_time', required: false, status: 'no', sheinField: '—', note: '入仓时间 UTC，货代无此字段' },
      { key: '7', ytField: 'collect_address_code', required: false, status: 'no', sheinField: '—', note: '揽收地址代码，货代无此字段' },
      { key: '8', ytField: 'collect_warehouse_code', required: false, status: 'no', sheinField: '—', note: '交货仓库代码，货代无此字段' },
      { key: '9', ytField: 'collect_date', required: false, status: 'ok', sheinField: 'appointmentPickupTime', note: '揽收日期 → 与 collect_starttime 合并' },
    ],
  },
  {
    title: '6. 发件人 sender',
    desc: '云途发件人 → 货代 senderAddress',
    rows: [
      { key: '1', ytField: 'sender（整对象）', required: '⚠️ 文档标题标必须 / 汇总标非必须', status: 'ok', sheinField: 'senderAddress', note: '见下方差异' },
      { key: '2', ytField: 'company_cn', required: false, status: 'no', sheinField: '—', note: '发件人公司中文名，货代 senderAddress 无公司字段' },
      { key: '3', ytField: 'company_en', required: false, status: 'no', sheinField: '—', note: '发件人公司英文名，货代 senderAddress 无公司字段' },
      { key: '4', ytField: 'name', required: false, status: 'ok', sheinField: 'senderAddress.contact', note: '发件人姓名 → 联系人' },
      { key: '5', ytField: 'phone_number', required: false, status: 'ok', sheinField: 'senderAddress.phone', note: '发件人电话' },
      { key: '6', ytField: 'street', required: false, status: 'ok', sheinField: 'senderAddress.address', note: '发件人地址' },
      { key: '7', ytField: 'country_code', required: true, status: 'ok', sheinField: 'senderAddress.countryCode', note: '发件人国家代码' },
      { key: '8', ytField: 'province', required: false, status: 'ok', sheinField: 'senderAddress.stateName', note: '发件人省' },
      { key: '9', ytField: 'city', required: true, status: 'ok', sheinField: 'senderAddress.cityName', note: '发件人城市' },
      { key: '10', ytField: 'post_code', required: false, status: 'no', sheinField: '—', note: '发件人邮编，货代 senderAddress 无邮编字段' },
      { key: '11', ytField: 'email', required: false, status: 'no', sheinField: '—', note: '发件人邮箱，货代 senderAddress 无邮箱字段' },
    ],
  },
];

/* ───────────── 列定义 ───────────── */
const MAPPING_COLUMNS: ColumnsType<MappingRow> = [
  {
    title: '云途字段',
    dataIndex: 'ytField',
    width: 220,
    render: (v: string) => <Text code>{v}</Text>,
  },
  {
    title: '必填',
    dataIndex: 'required',
    width: 80,
    render: (v: boolean | string) =>
      v === true ? <Tag color="red">必须</Tag> : v === false ? <Text type="secondary">非必须</Text> : <Text>{v}</Text>,
  },
  {
    title: '映射',
    dataIndex: 'status',
    width: 130,
    render: (v: MapStatus) => <Tag color={STATUS_META[v].color}>{STATUS_META[v].label}</Tag>,
  },
  {
    title: '货代字段',
    dataIndex: 'sheinField',
    width: 240,
    render: (v: string) => (v === '—' ? <Text type="secondary">—</Text> : <Text code>{v}</Text>),
  },
  { title: '说明', dataIndex: 'note', render: (v: string) => <Text type="secondary">{v || '—'}</Text> },
];

function MappingTable({ section }: { section: MappingSection }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="seu-section-head">
        <Text className="seu-section-title">{section.title}</Text>
        {section.desc && <Text type="secondary" className="seu-section-desc">{section.desc}</Text>}
      </div>
      <Table<MappingRow>
        className="seu-map-table"
        size="small"
        bordered
        rowKey="key"
        columns={MAPPING_COLUMNS}
        dataSource={section.rows}
        pagination={false}
        scroll={{ x: 900 }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorText: '#1f2937',
          colorTextSecondary: '#6b7280',
          colorBorder: '#e5e7eb',
          colorBorderSecondary: '#eef1f5',
          colorBgLayout: '#f5f7fa',
        },
        components: {
          Table: {
            headerBg: '#f7f8fa',
            headerColor: '#4b5563',
            headerSplitColor: 'transparent',
            headerBorderRadius: 6,
            cellPaddingBlockSM: 8,
            cellPaddingInlineSM: 12,
            borderColor: '#eceff3',
            rowHoverBg: '#f5f8ff',
            fontWeightStrong: 600,
          },
          Card: { borderRadiusLG: 10 },
          Tabs: {
            itemColor: '#6b7280',
            itemHoverColor: '#111827',
            itemSelectedColor: '#1677ff',
            inkBarColor: '#1677ff',
          },
          Descriptions: {
            labelBg: '#fafbfc',
            labelColor: '#6b7280',
            titleMarginBottom: 16,
          },
        },
      }}
    >
      <style>{SEU_STYLE}</style>
      <div className="seu-page" style={{ padding: 24, minHeight: '100vh' }}>
        {/* 标题区 */}
        <div className="seu-header">
          <Title level={4} className="seu-title">SHEIN欧线SPP对接</Title>
          <Text type="secondary" className="seu-sub">云途 B2B 下单接口与 SHEIN 货代接口（欧线 SPP）的对接字段映射与 OMS 改造说明</Text>
        </div>

        <Tabs
          className="seu-tabs"
          defaultActiveKey="mapping"
          items={[
            {
              key: 'mapping',
              label: <span><SwapOutlined /> 下单字段映射</span>,
              children: (
                <Card variant="borderless" className="seu-card">
                  <Alert
                    type="info"
                    showIcon
                    className="seu-alert"
                    style={{ marginBottom: 20, border: '1px solid #d6e4ff', background: '#f5f8ff' }}
                    message={<Text strong>POMS下单接口字段映射逻辑</Text>}
                    description={
                      <Space direction="vertical" size={4}>
                        <Text>左表：云途 B2B 下单（open.yunexpress.cn，POST /v1/order/b2b/create）</Text>
                        <Text>右表：SHEIN 货代下单接口（商家ID查询货代账号 + 下单接口）</Text>
                        <Text>✅ = 货代有可映射字段　❌ = 货代无对应字段　⚠️ = 语义相近但不完全等价</Text>
                      </Space>
                    }
                  />
                  {MAPPING_SECTIONS.map((s) => (
                    <MappingTable key={s.title} section={s} />
                  ))}
                </Card>
              ),
            },
            {
              key: 'oms',
              label: <span><ToolOutlined /> OMS接口改造</span>,
              children: (
                <Card variant="borderless" className="seu-card">
                  <Alert
                    type="warning"
                    showIcon
                    className="seu-alert"
                    style={{ marginBottom: 16, border: '1px solid #fce3c2', background: '#fffaf3' }}
                    message={<Text strong style={{ color: '#b45309' }}>下单接口增加「拣货码」字段 sorting_code</Text>}
                    description="支持 POMS 下单时能传入拣货码"
                  />
                  {[
                    '下单接口：增加"拣货码"，字段：sorting_code，支持POMS下单时能传入拣货码；',
                    '数据库在订单维度新增一个字段，拣货码用于存储；该字段接口非必填，若接收到该字段则落库；',
                    '原B2B订单列表/B2B看板，若对应的订单的拣货码字段不为空，则展示该字段的值，若不是则保持原有的逻辑；',
                    'B2B订单的导出若有该字段则逻辑保持跟上述逻辑一致；',
                  ].map((t, i) => (
                    <Paragraph key={i} className="seu-req-point">
                      <Tag color="blue">改造点 {i + 1}</Tag>
                      <span>{t}</span>
                    </Paragraph>
                  ))}
                  <Table
                    className="seu-map-table"
                    size="small"
                    bordered
                    rowKey="key"
                    style={{ marginTop: 16 }}
                    pagination={false}
                    columns={[
                      { title: '展示场景', dataIndex: 'scene', width: 160 },
                      { title: '逻辑', dataIndex: 'logic' },
                    ]}
                    dataSource={[
                      { key: '1', scene: 'B2B订单列表', logic: '拣货码字段不为空则展示该字段值，否则保持原有逻辑' },
                      { key: '2', scene: 'B2B看板', logic: '拣货码字段不为空则展示该字段值，否则保持原有逻辑' },
                      { key: '3', scene: 'B2B订单导出', logic: '若有该字段则逻辑与列表保持一致' },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'config',
              label: <span><ApiOutlined /> 接口配置</span>,
              children: (
                <Card variant="borderless" className="seu-card">
                  <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Descriptions
                      title={<span className="seu-desc-title"><SafetyCertificateOutlined style={{ marginRight: 8, color: '#1677ff' }} /> 测试环境配置</span>}
                      bordered
                      size="small"
                      column={1}
                      items={[
                        { key: '1', label: 'appid', children: <Text code>15EE39D2A6002A30B4BCBAB908BEA</Text> },
                        { key: '2', label: 'APP_Secretkey', children: <Text code>9E1C852B344347C38640FA906878F406</Text> },
                        { key: '3', label: '域名', children: <Text code>https://openapi-test01.sheincorp.cn</Text> },
                        {
                          key: '4',
                          label: 'SHEIN开放平台',
                          children: <Text code>https://open.sheincorp.com/documents/apidoc/detail/3001520</Text>,
                        },
                      ]}
                    />
                    <Descriptions
                      title={<span className="seu-desc-title"><GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} /> 对接接口范围</span>}
                      bordered
                      size="small"
                      column={1}
                      items={[
                        { key: '1', label: '下单接口', children: '商家ID查询货代账号 + 下单接口（字段映射见「下单字段映射」Tab）' },
                        { key: '2', label: '取消接口', children: '详见SHEIN接口文档' },
                        { key: '3', label: '查询轨迹', children: '详见SHEIN接口文档' },
                        { key: '4', label: '轨迹回传', children: '详见SHEIN接口文档' },
                      ]}
                    />
                    <Descriptions
                      title={<span className="seu-desc-title"><FieldBinaryOutlined style={{ marginRight: 8, color: '#1677ff' }} /> 接口文档</span>}
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: '1',
                          label: 'SHEIN接口文档（原文档）',
                          children: 'https://doc.weixin.qq.com/doc/w3_APEA_gZyACsY7CtS2ZPQOOjEY4lJn（企微文档）',
                        },
                        {
                          key: '2',
                          label: 'SHEIN接口文档（原文档）',
                          children: 'https://doc.weixin.qq.com/doc/w3_ARMAzAZ3AK4qv1tP1n8SS0bmT36A0（企微文档）',
                        },
                      ]}
                    />
                  </Space>
                </Card>
              ),
            },
          ]}
        />
      </div>
    </ConfigProvider>
  );
}
