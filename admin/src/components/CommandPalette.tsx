import { useEffect, useMemo, useRef, useState } from 'react';
import { AppstoreOutlined, DatabaseOutlined, FileTextOutlined, SearchOutlined, SkinOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { EntryItem, EntryType } from '../types';

const TYPE_ICON: Record<EntryType, React.ReactNode> = {
  prototype: <AppstoreOutlined />,
  component: <AppstoreOutlined />,
  doc: <FileTextOutlined />,
  theme: <SkinOutlined />,
  table: <DatabaseOutlined />,
};

const TYPE_LABEL: Record<EntryType, string> = {
  prototype: '原型',
  component: '组件',
  doc: '文档',
  theme: '主题',
  table: '数据表',
};

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  entries: EntryItem[];
  onSelectEntry: (item: EntryItem) => void;
  actions: CommandAction[];
}

/** 简单模糊匹配：子序列匹配 + 连续命中加权，返回分数（越大越好），不匹配返回 -1 */
function fuzzyScore(text: string, kw: string): number {
  const t = text.toLowerCase();
  const k = kw.toLowerCase();
  if (!k) return 0;
  if (t.includes(k)) return 100 - t.indexOf(k);
  let ti = 0;
  let score = 0;
  for (let ki = 0; ki < k.length; ki++) {
    const found = t.indexOf(k[ki], ti);
    if (found < 0) return -1;
    score += found === ti ? 5 : 1;
    ti = found + 1;
  }
  return score;
}

export default function CommandPalette({ open, onClose, entries, onSelectEntry, actions }: Props) {
  const [kw, setKw] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setKw('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filteredEntries = useMemo(() => {
    if (!kw.trim()) return entries.slice(0, 6);
    return entries
      .map((e) => ({ e, s: Math.max(fuzzyScore(e.title, kw), fuzzyScore(e.name, kw)) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.e);
  }, [entries, kw]);

  const filteredActions = useMemo(() => {
    if (!kw.trim()) return actions;
    return actions
      .map((a) => ({ a, s: fuzzyScore(`${a.label} ${a.keywords ?? ''}`, kw) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.a);
  }, [actions, kw]);

  // 扁平化可选项：动作在前，条目在后
  const flat = useMemo(
    () => [
      ...filteredActions.map((a) => ({ kind: 'action' as const, action: a })),
      ...filteredEntries.map((e) => ({ kind: 'entry' as const, entry: e })),
    ],
    [filteredActions, filteredEntries],
  );

  useEffect(() => setActiveIdx(0), [kw]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const runItem = (idx: number) => {
    const item = flat[idx];
    if (!item) return;
    onClose();
    if (item.kind === 'action') item.action.run();
    else onSelectEntry(item.entry);
  };

  if (!open) return null;

  let renderIdx = -1;

  return (
    <div className="ph-cmdk-mask" onClick={onClose}>
      <div className="ph-cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="ph-cmdk-input-wrap">
          <SearchOutlined />
          <input
            ref={inputRef}
            className="ph-cmdk-input"
            placeholder="搜索原型 / 文档，或输入命令…"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                runItem(activeIdx);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
        </div>
        <div className="ph-cmdk-list" ref={listRef}>
          {flat.length === 0 && <div className="ph-cmdk-empty">没有匹配的结果</div>}
          {filteredActions.length > 0 && (
            <>
              <div className="ph-cmdk-group">
                <ThunderboltOutlined /> 操作
              </div>
              {filteredActions.map((a) => {
                renderIdx++;
                const idx = renderIdx;
                return (
                  <div
                    key={a.id}
                    data-idx={idx}
                    className={`ph-cmdk-item${idx === activeIdx ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => runItem(idx)}
                  >
                    {a.icon}
                    {a.label}
                    {a.hint && <span className="ph-cmdk-item-hint">{a.hint}</span>}
                  </div>
                );
              })}
            </>
          )}
          {filteredEntries.length > 0 && (
            <>
              <div className="ph-cmdk-group">跳转</div>
              {filteredEntries.map((e) => {
                renderIdx++;
                const idx = renderIdx;
                return (
                  <div
                    key={`${e.type}-${e.name}`}
                    data-idx={idx}
                    className={`ph-cmdk-item${idx === activeIdx ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => runItem(idx)}
                  >
                    {TYPE_ICON[e.type]}
                    {e.title}
                    <span className="ph-cmdk-item-hint">{TYPE_LABEL[e.type]}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="ph-cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 移动</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
