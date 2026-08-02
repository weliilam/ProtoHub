import { useEffect, useState } from 'react';
import { Button, Modal, Space, Typography, message } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';

interface ErrorInfo {
  message: string;
  stack?: string;
  frame?: string;
  id?: string;
  loc?: { line?: number; column?: number };
  source: 'vite' | 'runtime';
  time: string;
}

/** Vite import / HMR 错误浮层（替代 Vite 自带 hmrOverlay，带「复制错误信息」按钮） */
export function ViteErrorOverlay() {
  const [err, setErr] = useState<ErrorInfo | null>(null);

  useEffect(() => {
    /** Vite 通过 HMR 推送的编译/解析错误 */
    const onViteError = (data: any) => {
      const e = data?.err || data;
      if (!e) return;
      setErr({
        message: typeof e.message === 'string' ? e.message : typeof e === 'string' ? e : '编译错误',
        stack: e.stack,
        frame: e.frame,
        id: e.id || e.loc?.file,
        loc: e.loc,
        source: 'vite',
        time: new Date().toLocaleString('zh-CN'),
      });
    };

    /** 页面运行时未捕获错误（兜底） */
    const onWindowError = (ev: ErrorEvent) => {
      // 忽略 Vite 已上报的脚本错误，避免重复弹出
      if ((ev.message || '').includes('[vite]')) return;
      setErr({
        message: ev.message || '脚本运行错误',
        stack: ev.error?.stack,
        source: 'runtime',
        time: new Date().toLocaleString('zh-CN'),
      });
    };
    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      const reason: any = ev.reason;
      setErr({
        message: reason?.message || String(reason) || '未捕获的异步错误',
        stack: reason?.stack,
        source: 'runtime',
        time: new Date().toLocaleString('zh-CN'),
      });
    };

    // 仅 dev 环境下监听 vite:error；prod 下 import.meta.hot 不存在
    if (import.meta.hot && typeof import.meta.hot.on === 'function') {
      import.meta.hot.on('vite:error', onViteError);
    }
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      if (import.meta.hot && typeof import.meta.hot.off === 'function') {
        import.meta.hot.off('vite:error', onViteError);
      }
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const buildCopyText = (e: ErrorInfo): string => {
    const lines: string[] = [];
    lines.push(`【时间】${e.time}`);
    lines.push(`【类型】${e.source === 'vite' ? 'Vite 编译/解析错误' : '页面运行时错误'}`);
    lines.push(`【错误信息】${e.message}`);
    if (e.id) {
      const pos = e.loc?.line ? `:${e.loc.line}:${e.loc.column ?? ''}` : '';
      lines.push(`【位置】${e.id}${pos}`);
    }
    if (e.frame) lines.push(`【代码帧】\n${e.frame}`);
    if (e.stack) {
      lines.push(`【调用栈】`);
      lines.push(e.stack.split('\n').slice(0, 25).join('\n'));
    }
    return lines.join('\n\n');
  };

  const handleCopy = async () => {
    if (!err) return;
    const text = buildCopyText(err);
    try {
      await navigator.clipboard.writeText(text);
      message.success('错误信息已复制，可粘贴发给开发同学排查');
    } catch {
      // 兜底：选中文本提示手动复制
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        message.success('错误信息已复制，可粘贴发给开发同学排查');
      } catch {
        message.error('复制失败，请手动选择下方文本复制');
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <Modal
      open={!!err}
      title="页面出错了"
      width={680}
      footer={null}
      keyboard
      maskClosable={false}
      onCancel={() => setErr(null)}
    >
      {err && (
        <div>
          <Typography.Paragraph type="danger" style={{ marginBottom: 6, fontSize: 14 }}>
            {err.message}
          </Typography.Paragraph>
          {err.id && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              位置：
              {err.id}
              {err.loc?.line ? `:${err.loc.line}:${err.loc.column ?? ''}` : ''}
              （{err.source === 'vite' ? 'Vite 编译/解析' : '页面运行时'}）
            </Typography.Text>
          )}
          {(err.frame || err.stack) && (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                maxHeight: 280,
                overflow: 'auto',
                background: 'var(--ph-terminal-bg)',
                color: 'var(--ph-terminal-color)',
                padding: 10,
                borderRadius: 6,
                fontSize: 12,
                margin: '12px 0',
                fontFamily: 'monospace',
              }}
            >
              {err.frame || err.stack}
            </pre>
          )}
          <Space wrap>
            <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
              复制错误信息
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => location.reload()}>
              刷新页面重试
            </Button>
            <Button onClick={() => setErr(null)}>关闭</Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}
