import { Button, Empty, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { CheckOutlined, CopyOutlined, DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import type { Annotation } from '../types';

interface Props {
  target: string;
  annotations: Annotation[];
  onToggleStatus: (a: Annotation) => Promise<void>;
  onDelete: (a: Annotation) => Promise<void>;
}

/** 把未完成的批注整理成给 AI 的修改指令 */
export function buildAiPrompt(target: string, annotations: Annotation[]): string {
  const open = annotations.filter((a) => a.status === 'open');
  const lines = open.map((a, i) => `${i + 1}. 元素 \`${a.selector}\`：${a.text}`);
  return `请修改原型 src/prototypes/${target}/index.tsx（及其相关文件），按以下批注意见调整：\n${lines.join('\n')}\n\n修改完成后请自查页面效果。`;
}

export default function AnnotationPanel({ target, annotations, onToggleStatus, onDelete }: Props) {
  const openCount = annotations.filter((a) => a.status === 'open').length;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildAiPrompt(target, annotations));
      message.success('已复制 AI 修改指令，粘贴给 AI 即可');
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <>
      <div className="ph-right-panel-header">
        <span>批注（{openCount} 待处理）</span>
        <Button size="small" icon={<CopyOutlined />} disabled={openCount === 0} onClick={copyPrompt}>
          复制为 AI 指令
        </Button>
      </div>
      <div className="ph-right-panel-body">
        {annotations.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="在工具栏开启批注后，点击原型页面元素即可添加" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {annotations.map((a, idx) => (
              <div key={a.id} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}>
                <Space style={{ marginBottom: 6 }}>
                  <Tag color={a.status === 'open' ? 'blue' : 'green'}>#{idx + 1}</Tag>
                  <Tag>{a.status === 'open' ? '待处理' : '已完成'}</Tag>
                </Space>
                <Typography.Paragraph style={{ marginBottom: 6, fontSize: 13 }}>{a.text}</Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {a.selector}
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={4}>
                    <Button
                      size="small"
                      type="text"
                      icon={a.status === 'open' ? <CheckOutlined /> : <UndoOutlined />}
                      onClick={() => onToggleStatus(a)}
                    >
                      {a.status === 'open' ? '完成' : '重开'}
                    </Button>
                    <Popconfirm title="删除该批注？" okText="删除" cancelText="取消" onConfirm={() => onDelete(a)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </Space>
        )}
      </div>
    </>
  );
}
