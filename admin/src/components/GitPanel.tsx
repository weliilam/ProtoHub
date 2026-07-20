import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, List, Popconfirm, Space, Tag, message } from 'antd';
import { CameraOutlined, HistoryOutlined, RollbackOutlined } from '@ant-design/icons';
import { api } from '../api';
import type { EntryItem, GitLogItem } from '../types';

/** 计算条目对应的仓库内路径（快照粒度） */
export function scopeOf(item: EntryItem | null): string | null {
  if (!item) return null;
  switch (item.type) {
    case 'prototype':
      return `src/prototypes/${item.name}`;
    case 'component':
      return `src/components/${item.name}`;
    case 'doc':
      return `src/docs/${item.name}.md`;
    case 'theme':
      return `src/themes/${item.name}`;
    case 'table':
      return `src/database/${item.name}.json`;
    default:
      return null;
  }
}

interface Props {
  selected: EntryItem | null;
  onRestored: () => void;
}

export default function GitPanel({ selected, onRestored }: Props) {
  const scope = scopeOf(selected);
  const scopeLabel = selected ? selected.title : null;

  const [initialized, setInitialized] = useState(true);
  const [branch, setBranch] = useState('');
  const [changed, setChanged] = useState(0);
  const [logs, setLogs] = useState<GitLogItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await api.gitStatus(scope ?? undefined);
      setInitialized(status.initialized);
      setBranch(status.branch || '');
      setChanged(status.changed || 0);
      if (status.initialized) {
        setLogs(await api.gitLog(scope ?? undefined));
      }
    } catch (e: any) {
      message.error(e.message);
    }
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const takeSnapshot = async () => {
    setLoading(true);
    try {
      const prefix = scopeLabel ? `[${scopeLabel}] ` : '';
      const { hash } = await api.gitSnapshot(prefix + messageText.trim(), scope ?? undefined);
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
      await api.gitRestore(hash, scope ?? undefined);
      message.success(scope ? `已回滚「${scopeLabel}」到该快照` : '已回滚到该快照');
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
        {branch && <Tag>{branch}</Tag>}
      </div>
      <div className="ph-right-panel-body">
        {!initialized ? (
          <Alert type="warning" showIcon message="当前目录尚未初始化 Git" description="在终端执行 git init 后即可使用快照功能。" />
        ) : !scope ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="先在左侧选中一个原型，快照将只针对它" />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <span style={{ fontSize: 12 }}>
                  当前范围：<b>{scopeLabel}</b>（{scope}）{changed > 0 ? `，${changed} 个未保存变更` : '，无变更'}
                </span>
              }
            />
            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Input
                placeholder={`给「${scopeLabel}」留个快照说明（可选）`}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onPressEnter={takeSnapshot}
              />
              <Button type="primary" icon={<CameraOutlined />} loading={loading} onClick={takeSnapshot}>
                保存
              </Button>
            </Space.Compact>
            {logs.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该原型还没有快照" />
            ) : (
              <List
                size="small"
                dataSource={logs}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Popconfirm
                        key="restore"
                        title={`回滚「${scopeLabel}」到该快照？`}
                        description="只恢复该原型的文件，不影响其他内容；未保存的当前改动会丢失"
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
