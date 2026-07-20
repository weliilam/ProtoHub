import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, List, Popconfirm, Space, Tag, message } from 'antd';
import { CameraOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { GitLogItem } from '../types';

export default function GitPanel({ onRestored }: { onRestored: () => void }) {
  const [initialized, setInitialized] = useState(true);
  const [branch, setBranch] = useState('');
  const [changed, setChanged] = useState(0);
  const [logs, setLogs] = useState<GitLogItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await api.gitStatus();
      setInitialized(status.initialized);
      setBranch(status.branch || '');
      setChanged(status.changed || 0);
      if (status.initialized) {
        setLogs(await api.gitLog());
      }
    } catch (e: any) {
      message.error(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const takeSnapshot = async () => {
    setLoading(true);
    try {
      const { hash } = await api.gitSnapshot(messageText.trim());
      message.success(`快照已保存（${hash}）`);
      setMessageText('');
      await refresh();
    } catch (e: any) {
      message.warning(e.message);
    } finally {
      setLoading(false);
    }
  };

  const restore = async (hash: string) => {
    try {
      await api.gitRestore(hash);
      message.success('已回滚到该快照，建议立即重新打开页面确认效果');
      await refresh();
      onRestored();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          <HistoryOutlined /> Git 快照
        </span>
        {branch && (
          <Space size={4}>
            <Tag>{branch}</Tag>
            <Tag color={changed > 0 ? 'orange' : 'green'}>{changed > 0 ? `${changed} 个变更` : '干净'}</Tag>
          </Space>
        )}
      </div>
      <div className="ph-right-panel-body">
        {!initialized ? (
          <Alert type="warning" showIcon message="当前目录尚未初始化 Git" description="在终端执行 git init 后即可使用快照功能。" />
        ) : (
          <>
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                placeholder="快照说明（可选）"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onPressEnter={takeSnapshot}
              />
              <Button type="primary" icon={<CameraOutlined />} loading={loading} onClick={takeSnapshot}>
                保存
              </Button>
            </Space.Compact>
            {logs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有快照" />
            ) : (
              <List
                size="small"
                dataSource={logs}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="restore"
                        title="回滚到该快照？"
                        description="工作区文件将恢复到该版本（未保存的当前改动会丢失）"
                        okText="回滚"
                        cancelText="取消"
                        onConfirm={() => restore(item.hash)}
                      >
                        <Button size="small" type="text" icon={<RollbackOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={6}>
                          <Tag color="blue">{item.hash}</Tag>
                          <span style={{ fontSize: 13 }}>{item.message}</span>
                        </Space>
                      }
                      description={item.date}
                    />
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
