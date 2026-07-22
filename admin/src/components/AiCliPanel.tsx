import { useEffect, useState } from 'react';
import { Button, Empty, Input, Select, Space, Spin, Tag, message } from 'antd';
import { CopyOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { CliStatus, EntryItem } from '../types';

export default function AiCliPanel({ selected }: { selected: EntryItem | null }) {
  const [status, setStatus] = useState<Record<string, CliStatus>>({});
  const [cli, setCli] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api
      .aiStatus()
      .then((s) => {
        setStatus(s);
        const firstAvailable = Object.entries(s).find(([, v]) => v.available)?.[0];
        if (firstAvailable) setCli(firstAvailable);
      })
      .catch((e) => message.error(e.message));
  }, []);

  const insertContext = () => {
    if (!selected) return;
    const dir =
      selected.type === 'prototype'
        ? `src/prototypes/${selected.name}/`
        : selected.type === 'component'
          ? `src/components/${selected.name}/`
          : selected.type === 'doc'
            ? `src/docs/${selected.name}.md`
            : selected.type === 'theme'
              ? `src/themes/${selected.name}/`
              : `src/database/${selected.name}.json`;
    setPrompt((p) => `${p}${p ? '\n' : ''}请参考 ${dir} `.trimStart());
  };

  const run = async () => {
    if (!cli || !prompt.trim()) {
      message.warning('请选择 CLI 并输入指令');
      return;
    }
    setRunning(true);
    setOutput('');
    try {
      const { output: out, timedOut } = await api.aiExecute(cli, prompt.trim());
      setOutput(out + (timedOut ? '\n\n[已超时（180s），进程被终止]' : ''));
    } catch (e: any) {
      setOutput(`执行失败：${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const options = Object.entries(status).map(([key, v]) => ({
    value: key,
    label: `${v.label}${v.available ? '' : '（未安装）'}`,
    disabled: !v.available,
  }));

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          <RobotOutlined /> AI CLI
        </span>
      </div>
      <div className="ph-right-panel-body">
        {options.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="检测中..." />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* CLI 状态指示：仅作状态显示，非按钮 */}
            <div className="ph-cli-status">
              <span style={{ fontSize: 12, color: '#888' }}>已检测：</span>
              <Space size={4} wrap>
                {Object.entries(status).map(([key, v]) => (
                  <Tag
                    key={key}
                    color={v.available ? 'success' : 'default'}
                    style={{ marginInlineEnd: 0, fontSize: 11, padding: '0 6px', lineHeight: '18px' }}
                  >
                    {v.available ? '●' : '○'} {key}
                  </Tag>
                ))}
              </Space>
            </div>
            <Select
              style={{ width: '100%' }}
              value={cli || undefined}
              options={options}
              onChange={setCli}
              placeholder="选择 AI CLI"
            />
            <Input.TextArea
              rows={6}
              placeholder="输入给 AI 的指令，例如：给当前原型增加一个导出按钮"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="ph-action-bar">
              <Button size="small" disabled={!selected} onClick={insertContext}>
                插入当前条目路径
              </Button>
              <div className="ph-action-bar-right">
                <Button size="small" type="primary" icon={<SendOutlined />} loading={running} onClick={run}>
                  执行
                </Button>
              </div>
            </div>
            {running && <Spin tip="AI 执行中（最长 180s）..." />}
            {output && (
              <div style={{ position: 'relative' }}>
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  style={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(output);
                      message.success('已复制输出内容');
                    } catch {
                      message.error('复制失败，请手动复制');
                    }
                  }}
                >
                  复制
                </Button>
                <pre className="ph-ai-output">{output}</pre>
              </div>
            )}
          </Space>
        )}
      </div>
    </>
  );
}
