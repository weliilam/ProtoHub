import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Space, Spin, Tooltip, message } from 'antd';
import { SaveOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { marked } from 'marked';
import { api } from '../api';
import { useTheme } from '../theme';

export default function DocEditor({ name }: { name: string }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { themeMode, setThemeMode } = useTheme();

  useEffect(() => {
    setLoading(true);
    api
      .readDoc(name)
      .then((d) => setContent(d.content))
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [name]);

  const html = useMemo(() => ({ __html: marked.parse(content) as string }), [content]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.saveDoc(name, content);
      message.success('已保存');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }, [name, content]);

  // Ctrl/Cmd+S 快捷保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  if (loading) return <Spin style={{ margin: '80px auto' }} />;

  return (
    <>
      <div className="ph-toolbar">
        <span className="ph-toolbar-title">{name}.md</span>
        <Space>
          <Tooltip title={themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>
            <Button
              size="small"
              icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            />
          </Tooltip>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
            保存
          </Button>
        </Space>
      </div>
      <div className="ph-editor-wrap">
        <div className="ph-editor-pane">
          <textarea className="ph-editor-textarea" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="ph-doc-preview" dangerouslySetInnerHTML={html} />
      </div>
    </>
  );
}
