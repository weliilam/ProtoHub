import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Space, Tooltip, message } from 'antd';
import { ClearOutlined, CopyOutlined, RobotOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { api } from '../api';
import { aiRunStore } from '../aiRunStore';
import type { CliStatus, EntryItem } from '../types';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  cli?: string;
  time: number;
}

/** 会话持久化：按当前条目隔离，保留最近 30 条 */
function loadHistory(key: string): ChatMsg[] {
  try {
    return JSON.parse(localStorage.getItem(`ph-ai-chat-${key}`) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(key: string, msgs: ChatMsg[]) {
  try {
    localStorage.setItem(`ph-ai-chat-${key}`, JSON.stringify(msgs.slice(-30)));
  } catch {
    /* ignore */
  }
}

function entryDir(selected: EntryItem | null): string {
  if (!selected) return '';
  return selected.type === 'prototype'
    ? `src/prototypes/${selected.name}/`
    : selected.type === 'component'
      ? `src/components/${selected.name}/`
      : selected.type === 'doc'
        ? `src/docs/${selected.name}.md`
        : selected.type === 'theme'
          ? `src/themes/${selected.name}/`
          : `src/database/${selected.name}.json`;
}

export default function AiCliPanel({ selected }: { selected: EntryItem | null }) {
  const [status, setStatus] = useState<Record<string, CliStatus>>({});
  const [cli, setCli] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [running, setRunning] = useState(false);
  const historyKey = selected?.name ?? '__global__';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** 追踪当前选中条目，用于竞态检测：切换条目后旧 AI 结果不再更新 UI */
  const selectedNameRef = useRef(selected?.name);
  useEffect(() => {
    selectedNameRef.current = selected?.name;
  }, [selected]);
  /** 用于取消正在执行的 AI 调用，关闭 HTTP 连接后服务端会杀子进程 */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .aiStatus()
      .then((s) => {
        setStatus(s);
        const firstAvailable = Object.entries(s).find(([, v]) => v.available)?.[0];
        if (firstAvailable) setCli((cur) => cur || firstAvailable);
      })
      .catch((e) => message.error(e.message));
  }, []);

  // 切换条目时加载对应会话
  useEffect(() => {
    setMessages(loadHistory(historyKey));
    setStreaming('');
  }, [historyKey]);

  // 新消息/流式输出时滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const run = async (text?: string) => {
    const content = (text ?? prompt).trim();
    if (!cli || !content) {
      message.warning('请选择 CLI 并输入指令');
      return;
    }
    const entryName = selected?.name; // 捕获调用时刻的条目名，用于竞态检测
    const entryKey = entryName ?? '__global__';
    const userMsg: ChatMsg = { role: 'user', content, time: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveHistory(entryKey, next);
    setPrompt('');
    setRunning(true);
    aiRunStore.set(true);
    setStreaming('');
    let acc = '';
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { output, timedOut } = await api.aiExecute(cli, content, (chunk) => {
        if (selectedNameRef.current !== entryName) return; // 已切走，丢弃流式输出
        acc += chunk;
        setStreaming(acc);
      }, controller.signal);
      if (selectedNameRef.current !== entryName) return; // 已切走，不更新 UI
      const finalText = output + (timedOut ? '\n\n[已超时，进程被终止]' : '');
      const done = [...next, { role: 'assistant' as const, content: finalText, cli, time: Date.now() }];
      setMessages(done);
      saveHistory(entryKey, done);
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // 用户手动取消，静默返回
      if (selectedNameRef.current !== entryName) return;
      const done = [...next, { role: 'assistant' as const, content: `执行失败：${e.message}`, cli, time: Date.now() }];
      setMessages(done);
      saveHistory(entryKey, done);
    } finally {
      if (selectedNameRef.current === entryName) {
        setStreaming('');
        setRunning(false);
        aiRunStore.set(false);
      }
    }
  };

  const insertContext = () => {
    const dir = entryDir(selected);
    if (!dir) return;
    setPrompt((p) => `${p}${p ? '\n' : ''}请参考 ${dir} `.trimStart());
  };

  const clearChat = () => {
    setMessages([]);
    saveHistory(historyKey, []);
  };

  const quickActions = [
    {
      label: '插入当前路径',
      run: insertContext,
      disabled: !selected,
    },
    {
      label: '优化当前页面样式',
      run: () => selected && run(`请参考 ${entryDir(selected)} ，在不改变功能和布局结构的前提下，优化这个页面的视觉样式（间距、层级、配色细节），让它更精致。`),
      disabled: !selected,
    },
    {
      label: '检查代码问题',
      run: () => selected && run(`请审查 ${entryDir(selected)} 的代码，找出潜在 bug、可访问性问题和可以简化的地方，逐条列出并说明修改建议。`),
      disabled: !selected,
    },
  ];

  const options = Object.entries(status).map(([key, v]) => ({
    value: key,
    label: `${v.label}${v.available ? '' : '（未安装）'}`,
    disabled: !v.available,
  }));

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          <RobotOutlined style={{ color: 'var(--ph-accent)' }} /> AI 助手
        </span>
        <Space size={4}>
          {messages.length > 0 && (
            <Tooltip title="清空当前会话">
              <Button size="small" type="text" icon={<ClearOutlined />} onClick={clearChat} />
            </Tooltip>
          )}
        </Space>
      </div>
      <div className="ph-ai-chat">
        <div className="ph-ai-messages">
          {messages.length === 0 && !streaming ? (
            <div className="ph-ai-welcome">
              <div className="ph-ai-welcome-icon">
                <RobotOutlined />
              </div>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--ph-text)' }}>
                我是你的原型开发助手
              </div>
              <div style={{ fontSize: 12 }}>
                选择左侧条目后，试试让我「优化样式」「检查问题」，
                <br />
                或直接描述你想做的修改。
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`ph-ai-msg ${m.role}`}>
                {m.role === 'assistant' && m.cli && (
                  <div className="ph-ai-msg-meta">
                    <RobotOutlined /> {m.cli}
                  </div>
                )}
                {m.content}
              </div>
            ))
          )}
          {streaming && <div className="ph-ai-msg assistant streaming">{streaming}</div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="ph-ai-input-area">
          <div className="ph-ai-quick-actions">
            {quickActions.map((q) => (
              <button key={q.label} className="ph-ai-chip" disabled={q.disabled || running} onClick={q.run}>
                {q.label}
              </button>
            ))}
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Select
              style={{ width: 110 }}
              size="small"
              value={cli || undefined}
              options={options}
              onChange={setCli}
              placeholder="CLI"
            />
            <Input
              size="small"
              placeholder="输入指令，Enter 发送…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPressEnter={() => !running && run()}
              disabled={running}
            />
            <Button size="small" type="primary" icon={<SendOutlined />} disabled={running} onClick={() => run()} />
            {running && (
              <Tooltip title="停止执行">
                <Button size="small" danger icon={<StopOutlined />} onClick={() => abortRef.current?.abort()} />
              </Tooltip>
            )}
          </Space.Compact>
        </div>
      </div>
    </>
  );
}
