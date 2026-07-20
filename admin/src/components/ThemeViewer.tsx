import { useEffect, useState } from 'react';
import { Button, Space, Spin, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { api } from '../api';

export default function ThemeViewer({ name }: { name: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .readTheme(name)
      .then((d) => setText(JSON.stringify(d, null, 2)))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [name]);

  const save = async () => {
    try {
      JSON.parse(text);
    } catch {
      message.error('JSON 格式错误，请检查');
      return;
    }
    setSaving(true);
    try {
      await api.saveTheme(name, JSON.parse(text));
      message.success('已保存');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ margin: '80px auto' }} />;

  return (
    <>
      <div className="ph-toolbar">
        <span className="ph-toolbar-title">主题：{name}（theme.json）</span>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
            保存
          </Button>
        </Space>
      </div>
      <div className="ph-editor-wrap">
        <div className="ph-editor-pane" style={{ borderRight: 'none' }}>
          <textarea className="ph-editor-textarea" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>
    </>
  );
}
