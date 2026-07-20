import { useEffect, useState } from 'react';
import { Button, Card, Col, Input, Row, Space, Statistic, Table, Tag, message } from 'antd';

interface OrderRow {
  key: string;
  id: string;
  customer: string;
  channel: string;
  status: string;
  amount: number;
}

const STATUS_COLOR: Record<string, string> = {
  已预报: 'blue',
  已发货: 'green',
  待确认: 'orange',
  异常: 'red',
};

export default function App() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetch('/api/data/tables/sample-orders')
      .then((r) => r.json())
      .then((res) => setRows(res.data || []))
      .catch(() => message.warning('示例数据加载失败'));
  }, []);

  const filtered = rows.filter(
    (r) => !keyword || r.id.includes(keyword) || r.customer.includes(keyword),
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={6}><Card><Statistic title="订单总数" value={rows.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="已发货" value={rows.filter((r) => r.status === '已发货').length} /></Card></Col>
          <Col span={6}><Card><Statistic title="待确认" value={rows.filter((r) => r.status === '待确认').length} /></Card></Col>
          <Col span={6}><Card><Statistic title="异常" value={rows.filter((r) => r.status === '异常').length} /></Card></Col>
        </Row>
        <Card
          title="订单列表"
          extra={
            <Space>
              <Input.Search
                placeholder="搜索单号 / 客户"
                allowClear
                style={{ width: 240 }}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Button type="primary">新建订单</Button>
            </Space>
          }
        >
          <Table
            size="middle"
            dataSource={filtered}
            columns={[
              { title: 'YT单号', dataIndex: 'id' },
              { title: '客户', dataIndex: 'customer' },
              { title: '渠道', dataIndex: 'channel' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
              },
              { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v.toFixed(2)}` },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
}
