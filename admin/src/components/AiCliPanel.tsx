import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Space, Spin, Tooltip, message } from 'antd';
import { ClearOutlined, CopyOutlined, RobotOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { api } from '../api';
import { aiRunStore } from '../aiRunStore';
import { aiTaskStore } from '../aiCliTask';
import { getAiModel, setAiModel, useAiModel } from '../aiModelStore';
import type { AiModelOption, CliStatus, EntryItem } from '../types';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  cli?: string;
  time: number;
}



/** 渲染 AI 输出（支持 Markdown 列表） */
function RenderOutput({ text }: { text: string }) {
  if (!text) return <span className="text-gray-400">（等待 AI 开始输出…）</span>;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    const Tag = listType === 'ul' ? 'ul' : 'ol';
    elements.push(
      <Tag key={`list-${elements.length}`} className={listType === 'ul' ? 'list-disc pl-5' : 'list-decimal pl-5'}>
        {listItems}
      </Tag>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (/^#{1,6}\s/.test(trimmed)) {
      flushList();
      const level = trimmed.match(/^#{1,6}/)![0].length;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(<Tag key={`h-${i}`} className="font-bold mt-2">{trimmed.replace(/^#{1,6}\s/, '')}</Tag>);
      return;
    }
    if (/^[-*]\s/.test(trimmed)) {
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(<li key={`li-${i}`}>{trimmed.replace(/^[-*]\s/, '')}</li>);
      return;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(<li key={`li-${i}`}>{trimmed.replace(/^\d+\.\s/, '')}</li>);
      return;
    }
    if (trimmed.startsWith('```')) {
      flushList();
      return;
    }
    if (!trimmed) return;
    flushList();
    elements.push(<p key={`p-${i}`}>{line}</p>);
  });
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

/** 长内容自动收起：超过阈值折叠显示前 12 行，可点击展开/收起 */
function CollapsibleBody({ text, onToggle }: { text: string; onToggle?: (open: boolean) => void }) {
  const lines = text.split('\n');
  const tooLong = lines.length > 12 || text.length > 800;
  const [open, setOpen] = useState(!tooLong);
  if (!tooLong) return <RenderOutput text={text} />;
  const preview = open ? text : `${lines.slice(0, 12).join('\n')}…`;
  return (
    <div className="ph-ai-collapse">
      <div className="ph-ai-collapse-body"><RenderOutput text={preview} /></div>
      <button
        className="ph-ai-collapse-btn"
        onClick={() => {
          const next = !open;
          setOpen(next);
          onToggle?.(next);
        }}
      >
        {open ? '收起' : `展开全文（共 ${lines.length} 行）`}
      </button>
    </div>
  );
}

/** 会话持久化：按当前条目隔离，保留最近 30 条 */
function loadHistory(key: string): ChatMsg[] {
  try {
    const msgs = JSON.parse(localStorage.getItem(`ph-ai-chat-${key}`) || '[]') as ChatMsg[];
    // 过滤历史遗留的"执行失败"系统消息：失败原因仅当前会话可见，不应污染下次打开的历史
    return msgs.filter((m) => !(m.role === 'assistant' && m.content.startsWith('执行失败：')));
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

/** 当前选中条目的上下文描述：让 AI 明确本次操作目标，避免改错原型/无关文件 */
function entryContext(selected: EntryItem | null): string {
  if (!selected) return '';
  const typeLabel: Record<EntryType, string> = {
    prototype: '原型页面',
    component: '公共组件',
    doc: '文档',
    theme: '主题',
    table: '数据表',
  };
  return (
    `当前项目为原型开发项目。本次任务的操作目标是${typeLabel[selected.type]}「${selected.title || selected.name}」` +
    `（${entryDir(selected)}）。请仅针对该目标进行修改/处理，不要修改其它原型或无关文件（除非确有必要并说明理由）。`
  );
}

export default function AiCliPanel({ selected }: { selected: EntryItem | null }) {
  const [status, setStatus] = useState<Record<string, CliStatus>>({});
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [cli, setCli] = useState<string>('');
  const model = useAiModel();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [streaming, setStreaming] = useState('');
  /** 思考过程增量（灰字展示，让用户看到 AI 正在思考而不是卡死） */
  const [streamThinking, setStreamThinking] = useState('');
  const [running, setRunning] = useState(false);
  /** 已运行秒数：本地每秒 +1，服务端心跳每 5s 校准一次 */
  const [elapsed, setElapsed] = useState(0);
  /** 当前运行/最近一次运行的操作目标路径（如 src/prototypes/xxx/），让用户确认 AI 改的是当前原型 */
  const [runTarget, setRunTarget] = useState('');
  const historyKey = selected?.name ?? '__global__';
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  /** 是否贴底自动滚动：用户手动上翻后停止跟随，回到底部后恢复 */
  const stickToBottom = useRef(true);
  /** 最近一次用户主动滚动的时间戳（程序滚动不算），用于输出期间自动恢复贴底 */
  const lastUserScrollRef = useRef(0);
  /** 标记当前滚动是由程序触发（scrollTop 赋值），onScroll 中跳过，避免误判为用户操作 */
  const programScrollingRef = useRef(false);
  /** 追踪当前选中条目，用于竞态检测：切换条目后旧 AI 结果不再更新 UI */
  const selectedNameRef = useRef(selected?.name);
  useEffect(() => {
    selectedNameRef.current = selected?.name;
  }, [selected]);
  /** 组件是否仍挂载 */
  const mountedRef = useRef(true);

  useEffect(() => {
    api
      .aiStatus()
      .then((s) => {
        setStatus(s.clis);
        setModels(s.models);
        const firstAvailable = Object.entries(s.clis).find(([, v]) => v.available)?.[0];
        if (firstAvailable) setCli((cur) => cur || firstAvailable);
      })
      .catch((e) => message.error(e.message));
  }, []);

  // 切换条目时加载对应会话
  useEffect(() => {
    setMessages(loadHistory(historyKey));
    setStreaming('');
    setRunTarget('');
    stickToBottom.current = true;
    lastUserScrollRef.current = 0;
    programScrollingRef.current = false;
  }, [historyKey]);

  // 订阅全局任务状态：关闭面板后任务继续在后台执行并保存结果，
  // 重开面板（或切回当前条目）时恢复运行状态与已累积的流式输出
  useEffect(() => {
    mountedRef.current = true;
    const s = aiTaskStore.get();
    if (s.running && s.entryKey === historyKey) {
      setRunning(true);
      setStreaming(s.streaming);
      setStreamThinking(s.thinking);
      setRunTarget(s.target);
      setElapsed(s.elapsed);
      setCli((cur) => cur || s.cli);
    }
    const unsub = aiTaskStore.subscribe((t) => {
      if (!t.running) {
        // 任务已结束（无论属于哪个条目）：清除本面板残留的执行状态
        setRunning(false);
        setStreaming('');
        setStreamThinking('');
        return;
      }
      if (t.entryKey !== historyKey) return; // 任务属于其他条目，不展示其内容
      setRunning(true);
      setStreaming(t.streaming);
      setStreamThinking(t.thinking);
      setRunTarget(t.target);
      setElapsed(t.elapsed);
      setCli((cur) => cur || t.cli);
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [historyKey]);

  // 新消息/流式输出时自动滚到底部（用户向上翻阅时暂停跟随；
  // 但持续输出期间若用户已停止滚动 2.5s，自动恢复贴底，保证能看到最新内容）
  useEffect(() => {
    const el = messagesBoxRef.current;
    if (!el) return;
    if (!stickToBottom.current) {
      if (running && Date.now() - lastUserScrollRef.current > 2500) {
        stickToBottom.current = true;
      } else {
        return;
      }
    }
    programScrollingRef.current = true;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming, streamThinking, running]);

  // 运行计时：running 期间每秒 +1，停止后归零
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  /** 格式化已运行时长：<60s 显示秒，否则 分:秒 */
  const fmtElapsed = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`);

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
    setStreamThinking('');
    // 记录操作目标，让用户确认 AI 正在改的是当前选中的原型
    const target = entryDir(selected);
    setRunTarget(target);
    // 新任务开始：重置贴底跟随（此前若用户上翻过历史，stickToBottom 可能为 false），
    // 并强制滚到底部，确保实时输出从一开始就可见
    stickToBottom.current = true;
    programScrollingRef.current = false;
    requestAnimationFrame(() => {
      const el = messagesBoxRef.current;
      if (el) {
        programScrollingRef.current = true;
        el.scrollTop = el.scrollHeight;
      }
    });
    // 注入"当前选中目标"上下文：即使只输入"把按钮改大点"，AI 也知道改的是哪个原型
    const ctx = entryContext(selected);
    const finalPrompt = ctx ? `${ctx}\n\n用户指令：\n${content}` : content;
    // 启动全局任务：任务生命周期独立于本组件，关闭面板后继续在后台执行
    aiTaskStore.start({ entryKey, cli, target });
    const controller = new AbortController();
    aiTaskStore.setController(controller);
    try {
      const { output, timedOut } = await api.aiExecute(
        cli,
        finalPrompt,
        (chunk) => {
          if (selectedNameRef.current !== entryName) return; // 已切走，丢弃流式输出
          aiTaskStore.appendStream(chunk); // 全局累积：卸载后仍继续，重开面板可恢复
        },
        controller.signal,
        getAiModel(), // 固定模型（仅 codebuddy 生效）
        undefined,
        (pingElapsed) => {
          // 服务端心跳：校准已运行时长，同时证明进程仍然存活
          if (selectedNameRef.current === entryName) aiTaskStore.setElapsed(pingElapsed);
        },
        (chunk) => {
          // 思考过程增量：实时展示 AI 正在思考的内容
          if (selectedNameRef.current !== entryName) return;
          aiTaskStore.appendThinking(chunk);
        },
      );
      if (selectedNameRef.current !== entryName) return; // 已切走，不更新 UI
      const finalText = output + (timedOut ? '\n\n[已超时，进程被终止]' : '');
      const done = [...next, { role: 'assistant' as const, content: finalText, cli, time: Date.now() }];
      // 无论组件是否卸载都写入历史：关闭面板后任务完成，重开面板即可看到完整回答
      saveHistory(entryKey, done);
      if (mountedRef.current && selectedNameRef.current === entryName) setMessages(done);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        // 用户手动停止：给出明确反馈
        const stopped = [...next, { role: 'assistant' as const, content: '⏹ 已停止执行', cli, time: Date.now() }];
        saveHistory(entryKey, stopped);
        if (mountedRef.current && selectedNameRef.current === entryName) setMessages(stopped);
        return;
      }
      if (!mountedRef.current || selectedNameRef.current !== entryName) return;
      const done = [...next, { role: 'assistant' as const, content: `执行失败：${e.message}`, cli, time: Date.now() }];
      // 失败信息仅在当前会话展示，不写入 localStorage（避免关闭面板/刷新后残留"执行失败"）
      setMessages(done);
    } finally {
      // 全局清理（组件卸载后也会执行）：任务已结束，重开面板时不再恢复运行状态
      aiTaskStore.stop();
      aiRunStore.set(false);
      if (mountedRef.current && selectedNameRef.current === entryName) {
        setStreaming('');
        setStreamThinking('');
        setRunning(false);
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
    saveHistory(historyKey, []);
  };

  // 快捷操作不再自带路径：操作目标由 run() 统一注入，避免路径重复、漏传
  const quickActions = [
    {
      label: '优化当前页面样式',
      run: () => selected && run('在不改变功能和布局结构的前提下，优化当前页面的视觉样式（间距、层级、配色细节），让它更精致。'),
      disabled: !selected,
    },
    {
      label: '检查代码问题',
      run: () => selected && run('审查当前选中目标的代码，找出潜在 bug、可访问性问题和可以简化的地方，逐条列出并说明修改建议。'),
      disabled: !selected,
    },
    {
      label: '新增功能模块',
      run: () => selected && run('在当前页面上新增一个实用的功能/模块，要求与现有页面设计语言保持一致。'),
      disabled: !selected,
    },
  ];

  /** 各 CLI 的安装指引（未安装时显示） */
  const INSTALL_GUIDES: Record<string, string> = {
    codebuddy: `请帮我安装 CodeBuddy CLI：
1. 安装：npm install -g @tencent-ai/codebuddy-code（请勿中断，否则会留下损坏的包文件）
2. 验证：codebuddy --version
3. 安装完成后回复我"CodeBuddy 已安装"`,
    workbuddy: `请帮我安装 WorkBuddy CLI（底层与 CodeBuddy 共用）：
1. 安装：npm install -g @tencent-ai/codebuddy-code（请勿中断）
2. 验证：codebuddy --version
3. 安装完成后回复我"WorkBuddy CLI 已安装"`,
  };

  /** 各 CLI 的授权指引（已安装但未授权时显示） */
  const AUTH_GUIDES: Record<string, string> = {
    codebuddy: `请帮我完成 CodeBuddy CLI 授权：
运行 codebuddy，按提示选择站点（国内站 / International Site），
浏览器会自动打开，扫码或账号登录即可完成授权，无需任何凭据。
授权完成后回复我"CodeBuddy 已授权"。`,
    workbuddy: `请帮我完成 WorkBuddy CLI 授权：
运行 codebuddy，按提示选择站点，浏览器自动打开后扫码或账号登录即可完成授权。
授权完成后回复我"WorkBuddy CLI 已授权"。`,
  };

  /** 复制指引文本到剪贴板 */
  const copyGuide = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    message.success('指引已复制，粘贴给 AI 助手即可自动执行');
  };

  const options = Object.entries(status).map(([key, v]) => ({
    value: key,
    label: !v.available
      ? `${v.label}（未安装）`
      : !v.authorized
        ? `${v.label}（需授权）`
        : v.label,
    disabled: !v.available,
  }));

  return (
    <>
      <div className="ph-right-panel-header">
        <span>
          <RobotOutlined style={{ color: 'var(--ph-accent)' }} /> AI 助手
          {running && (
            <span className="ph-ai-running-badge">
              <span className="ph-ai-running-dot" />
              {fmtElapsed(elapsed)}
            </span>
          )}
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
        <div
          className="ph-ai-messages"
          ref={messagesBoxRef}
          onScroll={() => {
            const el = messagesBoxRef.current;
            if (!el) return;
            if (programScrollingRef.current) {
              programScrollingRef.current = false;
              return;
            }
            lastUserScrollRef.current = Date.now();
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {messages.length === 0 && !streaming && !streamThinking ? (
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
                {m.role === 'assistant' ? (
                  <CollapsibleBody
                    text={m.content}
                    onToggle={(open) => {
                      if (open && messagesBoxRef.current) {
                        stickToBottom.current = true;
                        requestAnimationFrame(() => {
                          if (messagesBoxRef.current) messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
                        });
                      }
                    }}
                  />
                ) : (
                  m.content
                )}
              </div>
            ))
          )}
          {running && !streaming && !streamThinking && (
            <div className="ph-ai-msg assistant running">
              <div className="ph-ai-msg-meta">
                <RobotOutlined /> {cli}
                {cli === 'codebuddy' && model && ` · ${models.find((m) => m.id === model)?.label ?? model}`}
                {runTarget && <span className="ph-ai-target-tag">目标 {runTarget}</span>}
              </div>
              <div className="ph-ai-running-row">
                <Spin size="small" />
                <span>AI 正在执行中… 已运行 {fmtElapsed(elapsed)}</span>
              </div>
            </div>
          )}
          {(streaming || streamThinking) && (
            <div className="ph-ai-msg assistant streaming">
              {(cli || (cli === 'codebuddy' && model)) && (
                <div className="ph-ai-msg-meta">
                  <RobotOutlined /> {cli}
                  {cli === 'codebuddy' && model && ` · ${models.find((m) => m.id === model)?.label ?? model}`}
                  {runTarget && <span className="ph-ai-target-tag">目标 {runTarget}</span>}
                </div>
              )}
              {streamThinking && (
                <div className="ph-ai-thinking">
                  <span className="ph-ai-thinking-label">思考中…</span>
                  {streamThinking}
                </div>
              )}
              <RenderOutput text={streaming} />
            </div>
          )}
        </div>
        <div className="ph-ai-input-area">
          <div className="ph-ai-quick-actions">
            {quickActions.map((q) => (
              <button key={q.label} className="ph-ai-chip" disabled={q.disabled || running} onClick={q.run}>
                {q.label}
              </button>
            ))}
          </div>
          <div className="ph-ai-control-row">
            <Select
              style={{ width: 120 }}
              size="small"
              value={cli || undefined}
              options={options}
              onChange={setCli}
              placeholder="CLI"
            />
            {(cli === 'codebuddy' || cli === 'workbuddy') && (
              <Select
                style={{ flex: 1, minWidth: 180 }}
                size="small"
                value={model || undefined}
                options={[
                  { value: '', label: '自动（跟随 CLI 默认）' },
                  ...models.map((m) => ({ value: m.id, label: m.label })),
                ]}
                onChange={(v) => setAiModel(v ?? '')}
                placeholder="选择模型（选后全局固定）"
                showSearch
                optionFilterProp="label"
              />
            )}
          </div>
          {!cli ? (
            <div className="ph-ai-input-row">
              <Input.TextArea
                className="ph-ai-input"
                placeholder="请先选择 CLI…"
                value={prompt}
                disabled
                autoSize={{ minRows: 2, maxRows: 5 }}
              />
            </div>
          ) : !status[cli]?.available ? (
            <div className="ph-ai-guide">
              <div className="ph-ai-guide-text">
                {status[cli]?.label} 尚未安装，无法使用 AI 助手。点击下方按钮复制安装指引，粘贴给 AI 助手即可自动安装。
              </div>
              <Button block type="primary" icon={<CopyOutlined />}
                onClick={() => copyGuide(INSTALL_GUIDES[cli] || `请帮我安装 ${status[cli]?.label} CLI。`)}>
                复制安装指引
              </Button>
            </div>
          ) : !status[cli]?.authorized ? (
            <div className="ph-ai-guide">
              <div className="ph-ai-guide-text">
                {status[cli]?.label} 已安装但尚未授权，无法执行 AI 任务。点击下方按钮复制授权指引，粘贴给 AI 助手即可完成授权。
              </div>
              <Button block type="primary" icon={<CopyOutlined />}
                onClick={() => copyGuide(AUTH_GUIDES[cli] || `请帮我完成 ${status[cli]?.label} CLI 的登录授权。`)}>
                复制授权指引
              </Button>
            </div>
          ) : (
            <div className="ph-ai-input-row">
              <Input.TextArea
                className="ph-ai-input"
                placeholder="输入指令，Enter 发送，Shift+Enter 换行…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey && !running) {
                    e.preventDefault();
                    run();
                  }
                }}
                disabled={running}
                autoSize={{ minRows: 2, maxRows: 5 }}
              />
              {running ? (
                <Tooltip title="停止执行">
                  <Button
                    className="ph-ai-send"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => aiTaskStore.get().controller?.abort()}
                  />
                </Tooltip>
              ) : (
                <Button
                  className="ph-ai-send"
                  type="primary"
                  icon={<SendOutlined />}
                  disabled={running}
                  onClick={() => run()}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
