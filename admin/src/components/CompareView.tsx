import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Modal, Space, Spin, Tag, message } from 'antd';
import {
  CloseOutlined,
  CopyOutlined,
  LeftOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { api } from '../api';
import type { GitLogItem } from '../types';

interface Props {
  open: boolean;
  snapshots: GitLogItem[];
  selected: string[];
  prototype: string;
  scope: string;
  onClose: () => void;
}

/** 友好文件名映射 */
function friendlyName(file: string): string {
  const base = file.split('/').pop() || file;
  const map: Record<string, string> = {
    'index.tsx': '主页面代码',
    'spec.md': '需求/规格文档',
    'style.css': '样式文件',
    'README.md': '说明文档',
  };
  if (map[base]) return map[base];
  if (base.endsWith('.tsx') || base.endsWith('.ts')) return base.replace(/\\.\\w+$/, '') + '（代码）';
  if (base.endsWith('.css')) return base + '（样式）';
  if (base.endsWith('.md')) return base + '（文档）';
  if (base.endsWith('.json')) return base + '（数据）';
  return base;
}

interface FileChange {
  file: string;
  friendly: string;
  added: number;
  removed: number;
  status: '新增' | '修改' | '删除' | '重命名';
}

function parseCompareDiff(diff: string): { files: FileChange[]; added: number; removed: number } {
  const files: FileChange[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  const blocks = diff.split(/^diff --git /m).slice(1);
  for (const block of blocks) {
    const headerLine = block.split('\n', 1)[0];
    const m = headerLine.match(/b\/(.+)$/);
    const file = m ? m[1] : headerLine;
    let status: FileChange['status'] = '修改';
    if (/^new file mode/m.test(block)) status = '新增';
    else if (/^deleted file mode/m.test(block)) status = '删除';
    else if (/^rename from /m.test(block)) status = '重命名';
    let added = 0;
    let removed = 0;
    for (const ln of block.split('\n')) {
      if (ln.startsWith('+') && !ln.startsWith('+++')) added++;
      else if (ln.startsWith('-') && !ln.startsWith('---')) removed++;
    }
    totalAdded += added;
    totalRemoved += removed;
    files.push({ file, friendly: friendlyName(file), added, removed, status });
  }
  return { files, added: totalAdded, removed: totalRemoved };
}

/** 构建复制用的结构化文本 */
function buildCopyText(
  snapshotA: GitLogItem,
  snapshotB: GitLogItem,
  summary: ReturnType<typeof parseCompareDiff>,
  messages: string[],
) {
  const lines = [
    `=== 原型版本对比 ===`,
    `原型：${snapshotA.message || '（无说明）'}`,
    ``,
    `【左 · 旧版本】${snapshotA.hash} - ${snapshotA.date}`,
    `  说明：${snapshotA.message || '（无说明）'}`,
    ``,
    `【右 · 新版本】${snapshotB.hash} - ${snapshotB.date}`,
    `  说明：${snapshotB.message || '（无说明）'}`,
    ``,
    `【改动概要】`,
    `共改动 ${summary.files.length} 个文件（新增约 ${summary.added} 处、删减约 ${summary.removed} 处）`,
    ``,
    ...(messages.length > 0 ? [`【中间提交说明】`, ...messages.map((m, i) => `  ${i + 1}. ${m}`), ``] : []),
    `【文件清单】`,
    ...summary.files.map((f) => `  ${f.friendly}（${f.status}，+${f.added}/-${f.removed})`),
  ];
  return lines.join('\n');
}

/** 提取行中可用于相似度比较的 token（中文词 + 英文单词 + 数字） */
function tokensOf(body: string): string[] {
  const tk = body.match(/[\u4e00-\u9fff]{2,}|[a-zA-Z_][\w]*|\d+/g) || [];
  return [...new Set(tk)];
}

/** 两行相似度 0~1（共享 token 占比），用于判定是否修改对 */
function similarity(a: string, b: string): number {
  const ta = tokensOf(a);
  const tb = tokensOf(b);
  if (ta.length === 0 && tb.length === 0) return 0;
  const setA = new Set(ta);
  const shared = tb.filter((t) => setA.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 ? shared / union : 0;
}

/** 从 diff 中提取可能出现在页面 DOM 中的文字片段，按 hunk 内文字相似度配对 */
function extractPageTexts(diff: string): {
  added: string[];        // 纯新增 → 右侧绿
  modifiedOld: string[];  // 修改的旧值 → 左侧橙
  modifiedNew: string[];  // 修改的新值 → 右侧橙
  removed: string[];      // 纯删除 → 左侧红
} {
  const added: string[] = [];
  const modifiedOld: string[] = [];
  const modifiedNew: string[] = [];
  const removed: string[] = [];
  const codeKeywords = /^(import|export|const|let|var|function|return|if|else|for|while|class|interface|type|enum)\b/;

  const hunks = diff.split(/^@@[^@]*@@/m);
  for (const hunk of hunks) {
    const lines = hunk.trim().split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const addBodies = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim()).filter(Boolean);
    const delBodies = lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1).trim()).filter(Boolean);

    // 贪心配对：计算所有 + 和 - 的 token 相似度，从高到低配对
    const pairedAdd = new Set<number>();
    const pairedDel = new Set<number>();

    interface Pair { ai: number; di: number; sim: number }
    const pairs: Pair[] = [];
    for (let ai = 0; ai < addBodies.length; ai++) {
      for (let di = 0; di < delBodies.length; di++) {
        const s = similarity(addBodies[ai], delBodies[di]);
        if (s >= 0.3) pairs.push({ ai, di, sim: s });
      }
    }
    pairs.sort((a, b) => b.sim - a.sim); // 高相似度优先
    for (const p of pairs) {
      if (pairedAdd.has(p.ai) || pairedDel.has(p.di)) continue;
      pairedAdd.add(p.ai);
      pairedDel.add(p.di);
    }

    // 输出文字片段
    const emit = (body: string, target: string[]) => {
      if (!body || codeKeywords.test(body)) return;
      const chinese = body.match(/[\u4e00-\u9fff]{2,}/g) || [];
      const quoted = body.match(/["'>]([^"'<>]{2,})["'<]/g) || [];
      const quotedClean = quoted.map((s: string) => s.replace(/^["'>]/, '').replace(/["'<]$/, ''));
      const texts = [...chinese, ...quotedClean].filter((s) => s.length >= 2 && !/^[\s{}();,.[\]]+$/.test(s));
      target.push(...texts);
    };

    for (let ai = 0; ai < addBodies.length; ai++) {
      emit(addBodies[ai], pairedAdd.has(ai) ? modifiedNew : added);
    }
    for (let di = 0; di < delBodies.length; di++) {
      emit(delBodies[di], pairedDel.has(di) ? modifiedOld : removed);
    }
  }
  return {
    added: [...new Set(added)],
    modifiedOld: [...new Set(modifiedOld)],
    modifiedNew: [...new Set(modifiedNew)],
    removed: [...new Set(removed)],
  };
}

/** 生成注入 iframe 的 JS 脚本字符串：在页面 DOM 中找到文字并高亮 */
function buildHighlightScript(texts: string[], type: 'added' | 'modified' | 'removed'): string {
  const escaped = JSON.stringify(texts);
  const m: Record<string, { bg: string; border: string; label: string; labelBg: string }> = {
    added:    { bg: 'rgba(22,163,74,0.12)', border: '#16a34a', label: '新增', labelBg: '#16a34a' },
    modified: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', label: '修改', labelBg: '#f59e0b' },
    removed:  { bg: 'rgba(220,38,38,0.12)', border: '#dc2626', label: '删除', labelBg: '#dc2626' },
  };
  const c = m[type];
  return `(function(){
  var texts = ${escaped};
  if (!texts.length) return;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var text = node.textContent || '';
    for (var j = 0; j < texts.length; j++) {
      var t = texts[j];
      var idx = text.indexOf(t);
      if (idx === -1) continue;
      var span = document.createElement('span');
      span.style.cssText = 'background:${c.bg};outline:2px solid ${c.border};outline-offset:-1px;border-radius:2px;position:relative;';
      span.title = '${c.label}：' + t;
      span.textContent = t;
      // split and wrap
      var before = document.createTextNode(text.slice(0, idx));
      var after = document.createTextNode(text.slice(idx + t.length));
      var parent = node.parentNode;
      if (parent) {
        parent.insertBefore(before, node);
        parent.insertBefore(span, node);
        parent.insertBefore(after, node);
        parent.removeChild(node);
        // add label badge
        var badge = document.createElement('span');
        badge.style.cssText = 'position:absolute;top:-10px;left:2px;font-size:10px;line-height:1;padding:1px 5px;border-radius:3px;color:#fff;background:${c.labelBg};z-index:9999;white-space:nowrap;';
        badge.textContent = '${c.label}';
        span.appendChild(badge);
        nodes.splice(i, 0, before, span.firstChild, after);
        i += 2;
        break;
      }
    }
  }
})();`;
}

export function CompareView({ open, snapshots, selected, prototype, scope, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [diffData, setDiffData] = useState<{
    diff: string;
    stat: string;
    messages: string[];
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [highlightReady, setHighlightReady] = useState(false);
  const iframeARef = useRef<HTMLIFrameElement>(null);
  const iframeBRef = useRef<HTMLIFrameElement>(null);

  const snapshotA = snapshots.find((s) => s.hash === selected[0]);
  const snapshotB = snapshots.find((s) => s.hash === selected[1]);

  const summary = useMemo(
    () => (diffData?.diff ? parseCompareDiff(diffData.diff) : null),
    [diffData],
  );

  // 准备对比 + 拉取 diff
  useEffect(() => {
    if (!open || selected.length < 2) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setUrlA('');
      setUrlB('');
      setDiffData(null);
      try {
        const [prep, diffRes] = await Promise.all([
          api.comparePrepare(selected[0], selected[1], prototype),
          api.compareDiff(selected[0], selected[1], scope),
        ]);
        if (cancelled) return;
        // 给 URL 加时间戳避免缓存
        const ts = Date.now();
        setUrlA(`${prep.urlA}?t=${ts}`);
        setUrlB(`${prep.urlB}?t=${ts}`);
        setDiffData({ diff: diffRes.diff, stat: diffRes.stat, messages: diffRes.messages });
      } catch (e: any) {
        if (!cancelled) message.error(e.message || '版本对比失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selected[0], selected[1]]);

  // 关闭后延迟清理临时目录，避免 Vite HMR 导致白屏
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) {
      cleanupTimerRef.current = setTimeout(() => {
        api.compareCleanup().catch(() => {});
      }, 600);
    }
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, [open]);

  // 两个 iframe 都加载完成后，等待 React 渲染完毕再注入高亮脚本
  const highlightInjectedRef = useRef(false);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    highlightInjectedRef.current = false;
    setHighlightReady(false);
    if (highlightTimerRef.current) { clearTimeout(highlightTimerRef.current); highlightTimerRef.current = null; }
  }, [urlA, urlB]);

  // 轮询等待 iframe 内 React 渲染完成，然后注入高亮
  const tryInjectHighlights = (retryCount: number = 0) => {
    if (highlightInjectedRef.current) return;
    if (!diffData) return;
    const iframeA = iframeARef.current;
    const iframeB = iframeBRef.current;
    if (!iframeA || !iframeB) return;

    if (retryCount >= 30) return; // 最多等 15s

    let docA: Document | null = null;
    let docB: Document | null = null;
    try { docA = iframeA.contentDocument; } catch { /* cross-origin */ }
    try { docB = iframeB.contentDocument; } catch { /* cross-origin */ }

    // 任一 iframe 还没就绪，继续等
    if (!docA || !docB || docA.readyState !== 'complete' || docB.readyState !== 'complete') {
      highlightTimerRef.current = setTimeout(() => tryInjectHighlights(retryCount + 1), 500);
      return;
    }

    // 检查 React 是否已渲染（#root 下有子节点）
    const rootA = docA.querySelector('#root');
    const rootB = docB.querySelector('#root');
    const rendered = rootA && rootB && rootA.children.length > 0 && rootB.children.length > 0;

    if (!rendered) {
      highlightTimerRef.current = setTimeout(() => tryInjectHighlights(retryCount + 1), 500);
      return;
    }

    // 文本高亮：
    // 左侧旧版本：纯删除（红）+ 修改的旧值（橙）
    // 右侧新版本：纯新增（绿）+ 修改的新值（橙）
    const { added, modifiedOld, modifiedNew, removed } = extractPageTexts(diffData.diff);

    if (docA.body && (removed.length > 0 || modifiedOld.length > 0)) {
      if (removed.length > 0) {
        const sr = docA.createElement('script');
        sr.textContent = buildHighlightScript(removed, 'removed');
        docA.body.appendChild(sr);
      }
      if (modifiedOld.length > 0) {
        const smo = docA.createElement('script');
        smo.textContent = buildHighlightScript(modifiedOld, 'modified');
        docA.body.appendChild(smo);
      }
    }
    if (docB.body && (added.length > 0 || modifiedNew.length > 0)) {
      if (added.length > 0) {
        const sa = docB.createElement('script');
        sa.textContent = buildHighlightScript(added, 'added');
        docB.body.appendChild(sa);
      }
      if (modifiedNew.length > 0) {
        const smn = docB.createElement('script');
        smn.textContent = buildHighlightScript(modifiedNew, 'modified');
        docB.body.appendChild(smn);
      }
    }
    highlightInjectedRef.current = true;
    setHighlightReady(true);
  };

  const onIframeLoad = () => {
    // 任一 iframe 加载完成就尝试注入（内部会轮询等待两个都就绪）
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => tryInjectHighlights(), 500);
  };

  const handleCopy = async () => {
    if (!summary) return;
    const text = buildCopyText(snapshotA, snapshotB, summary, diffData?.messages || []);
    try {
      await navigator.clipboard.writeText(text);
      message.success('对比摘要已复制');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <Modal
      title={null}
      open={open}
      closable={false}
      onCancel={onClose}
      width="96vw"
      footer={null}
      centered
      style={{ top: 20 }}
      styles={{ body: { padding: 0, height: 'calc(96vh - 100px)' } }}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--ph-diff-header-border)',
          background: 'var(--ph-diff-header-bg)',
        }}
      >
        <Space size={8}>
          <Tag color="default" style={{ fontSize: 12 }}>
            {snapshotA?.hash || '旧版本'}
          </Tag>
          <LeftOutlined style={{ color: 'var(--ph-text-tertiary)', fontSize: 12 }} />
          <RightOutlined style={{ color: 'var(--ph-git-link)', fontSize: 12 }} />
          <Tag color="blue" style={{ fontSize: 12 }}>
            {snapshotB?.hash || '新版本'}
          </Tag>
          <span style={{ fontSize: 13, color: 'var(--ph-text-secondary)', marginLeft: 4 }}>{prototype}</span>
        </Space>
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={!summary}>
            复制对比摘要
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} disabled={!urlA}>
            刷新
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </Space>
      </div>

      {/* 内容区 */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 42px)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip="正在提取历史版本文件…">
              <div style={{ width: 240, padding: 24 }} />
            </Spin>
          </div>
        ) : !urlA || !snapshotA || !snapshotB ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="对比加载失败" />
          </div>
        ) : (
          <>
            {/* 分屏预览 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                minHeight: 0,
                borderBottom: '1px solid var(--ph-diff-pane-border)',
              }}
            >
              {/* 左：旧版本 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid var(--ph-diff-pane-border)' }}>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    color: 'var(--ph-text-secondary)',
                    background: 'var(--ph-anno-warn-bg)',
                    borderBottom: '1px solid var(--ph-diff-pane-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <Tag color="default" style={{ marginRight: 4 }}>
                      旧版本
                    </Tag>
                    {snapshotA?.hash} · {snapshotA?.date}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${urlA.split('?')[0]}`,
                        );
                        message.success('旧版本链接已复制');
                      } catch {
                        message.error('复制失败');
                      }
                    }}
                  />
                </div>
                <iframe
                  ref={iframeARef}
                  key={`cmp-a-${refreshKey}-${urlA}`}
                  src={urlA}
                  style={{ flex: 1, width: '100%', border: 'none' }}
                  title="旧版本预览"
                  onLoad={() => onIframeLoad('old')}
                />
              </div>

              {/* 右：新版本 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    color: 'var(--ph-text-secondary)',
                    background: 'var(--ph-compare-new-pane-bg)',
                    borderBottom: '1px solid var(--ph-diff-pane-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    <Tag color="blue" style={{ marginRight: 4 }}>
                      新版本
                    </Tag>
                    {snapshotB?.hash} · {snapshotB?.date}
                  </span>
                  <Button
                    size="small"
                    type="text"
                    icon={<LinkOutlined />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          `${window.location.origin}${urlB.split('?')[0]}`,
                        );
                        message.success('新版本链接已复制');
                      } catch {
                        message.error('复制失败');
                      }
                    }}
                  />
                </div>
                <iframe
                  ref={iframeBRef}
                  key={`cmp-b-${refreshKey}-${snapshotB?.hash ?? ''}`}
                  src={urlB}
                  style={{ flex: 1, width: '100%', border: 'none' }}
                  title="新版本预览"
                  onLoad={() => onIframeLoad('new')}
                />
              </div>
            </div>

            {/* 底部：改动摘要 + 图例 */}
            {diffData && summary && (
              <div
                style={{
                  padding: '6px 16px',
                  background: 'var(--ph-diff-header-bg)',
                  borderTop: '2px solid var(--ph-diff-pane-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  fontSize: 13,
                  minHeight: 36,
                }}
              >
                <b style={{ color: 'var(--ph-diff-section-title)' }}>改动内容</b>
                <span style={{ color: 'var(--ph-diff-meta)' }}>
                  {summary.files.length} 个文件 · <span style={{ color: 'var(--ph-diff-added-label)' }}>+{summary.added}</span> / <span style={{ color: 'var(--ph-diff-removed-label)' }}>-{summary.removed}</span>
                </span>
                {diffData.messages?.length > 0 && (
                  <Space size={4}>
                    {diffData.messages.map((msg, i) => (
                      <Tag key={i} style={{ fontSize: 11 }}>{msg}</Tag>
                    ))}
                  </Space>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ph-text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ph-diff-added-bg)', border: '2px solid var(--ph-diff-added-border)', display: 'inline-block' }} />
                    新增
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ph-text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ph-diff-modified-bg)', border: '2px solid var(--ph-diff-modified-border)', display: 'inline-block' }} />
                    修改
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ph-text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ph-diff-removed-bg)', border: '2px solid var(--ph-diff-removed-border)', display: 'inline-block' }} />
                    删除
                  </span>
                  {!highlightReady && <Spin size="small" />}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
