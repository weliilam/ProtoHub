import type { Annotation, CliStatus, EntryItem, GitLogItem, GroupConfig, PrdDoc, PrototypeInfo } from './types';

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

export const api = {
  // 条目
  listEntries: () => request<EntryItem[]>('/api/entries'),
  createEntry: (type: string, name: string, title: string) =>
    request('/api/entries', { method: 'POST', body: JSON.stringify({ type, name, title }) }),
  renameEntry: (type: string, name: string, newName: string) =>
    request('/api/entries/rename', { method: 'POST', body: JSON.stringify({ type, name, newName }) }),
  deleteEntry: (type: string, name: string) =>
    request(`/api/entries?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // 文档
  readDoc: (name: string) => request<{ name: string; content: string }>(`/api/docs/${encodeURIComponent(name)}`),
  saveDoc: (name: string, content: string) =>
    request(`/api/docs/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  createDoc: (name: string, content: string) =>
    request(`/api/docs/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteDoc: (name: string) => request(`/api/docs/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // 主题
  readTheme: (name: string) => request<any>(`/api/themes/${encodeURIComponent(name)}`),
  saveTheme: (name: string, config: any) =>
    request(`/api/themes/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(config) }),
  deleteTheme: (name: string) => request(`/api/themes/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // 原型基本信息（用了哪些组件等）
  prototypeInfo: (name: string) =>
    request<PrototypeInfo>(`/api/prototype/info?name=${encodeURIComponent(name)}`),

  // 数据表
  listTables: () => request<{ name: string; count: number }[]>('/api/data/tables'),
  createTable: (name: string) => request('/api/data/tables', { method: 'POST', body: JSON.stringify({ name }) }),
  readTable: (name: string) => request<any[]>(`/api/data/tables/${encodeURIComponent(name)}`),
  saveTable: (name: string, rows: any[]) =>
    request(`/api/data/tables/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ rows }) }),
  deleteTable: (name: string) => request(`/api/data/tables/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // Git
  gitStatus: (scope?: string) =>
    request<{ branch?: string; changed?: number; initialized: boolean }>(
      `/api/git/status${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`,
    ),
  gitLog: (scope?: string) =>
    request<GitLogItem[]>(`/api/git/log${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`),
  gitSnapshot: (message: string, scope?: string) =>
    request<{ hash: string }>('/api/git/snapshot', { method: 'POST', body: JSON.stringify({ message, scope }) }),
  gitRestore: (hash: string, scope?: string) =>
    request('/api/git/restore', { method: 'POST', body: JSON.stringify({ hash, scope }) }),
  gitDiff: (scope?: string) =>
    request<{ diff: string }>(`/api/git/diff${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`),
  gitShow: (hash: string, scope?: string) =>
    request<{ diff: string }>(
      `/api/git/show?hash=${encodeURIComponent(hash)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`,
    ),

  // AI CLI
  aiStatus: () => request<Record<string, CliStatus>>('/api/ai/status'),
  /**
   * 执行 AI CLI（流式）。
   * onChunk 回调会实时收到 AI 输出片段；最终返回完整结果。
   */
  aiExecute: (
    cli: string,
    prompt: string,
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<{ output: string; timedOut: boolean }> =>
    new Promise((resolve, reject) => {
      fetch('/api/ai/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cli, prompt }),
        signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            throw new Error(json.error || `请求失败（${res.status}）`);
          }
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let final: { output: string; timedOut: boolean } | null = null;
          while (true) {
            const { done, value } = await reader.read();
            if (value) {
              buffer += decoder.decode(value, { stream: !done });
              let idx: number;
              while ((idx = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line) continue;
                try {
                  const msg = JSON.parse(line);
                  if (msg.type === 'chunk') onChunk?.(msg.data);
                  else if (msg.type === 'done') final = { output: msg.output, timedOut: msg.timedOut };
                  else if (msg.type === 'error') throw new Error(msg.error);
                } catch (e: any) {
                  throw new Error(e.message || '解析执行结果失败');
                }
              }
            }
            if (done) break;
          }
          if (!final) throw new Error('未收到执行结果');
          resolve(final);
        })
        .catch(reject);
    }),

  // 批注
  listAnnotations: (target: string) => request<Annotation[]>(`/api/annotations?target=${encodeURIComponent(target)}`),
  createAnnotation: (data: Partial<Annotation>) =>
    request<Annotation>('/api/annotations', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnotation: (id: string, patch: Partial<Annotation>) =>
    request<Annotation>(`/api/annotations/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteAnnotation: (id: string) => request(`/api/annotations/${id}`, { method: 'DELETE' }),

  // ── 分组管理 ──
  fetchGroups: () => request<GroupConfig[]>('/api/groups'),
  createGroup: (id: string, name: string) =>
    request('/api/groups', { method: 'POST', body: JSON.stringify({ id, name }) }),
  updateGroup: (id: string, name: string, prototypes: string[]) =>
    request('/api/groups', { method: 'PUT', body: JSON.stringify({ id, name, prototypes }) }),
  deleteGroup: (id: string) =>
    request(`/api/groups?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  moveToGroup: (prototype: string, groupId?: string) =>
    request('/api/groups/move', { method: 'POST', body: JSON.stringify({ prototype, groupId }) }),

  // ── 版本对比 ──
  /** 准备对比：提取两个版本的原型文件到临时目录，返回两个 iframe URL */
  comparePrepare: (hashA: string, hashB: string, prototype: string) =>
    request<{ urlA: string; urlB: string; slotA: string; slotB: string }>('/api/compare/prepare', {
      method: 'POST',
      body: JSON.stringify({ hashA, hashB, prototype }),
    }),
  /** 两个版本间的 diff 概要（文件级统计 + 提交说明） */
  compareDiff: (from: string, to: string, scope?: string) =>
    request<{ stat: string; diff: string; messages: string[] }>(
      `/api/compare/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${scope ? `&scope=${encodeURIComponent(scope)}` : ''}`,
    ),
  /** 清理对比临时文件 */
  compareCleanup: () => request('/api/compare/cleanup', { method: 'POST' }),

  // ── PRD 飞书链接（支持关联多个 PRD 文档，含标题/摘要元数据）──
  /** 读取原型关联的所有飞书 PRD 链接（含标题、摘要） */
  prdGetLink: (name: string) =>
    request<{ docs: PrdDoc[] }>(`/api/prd/link?name=${encodeURIComponent(name)}`),
  /** 追加关联一个飞书 PRD 链接（去重），返回最新文档列表 */
  prdAddLink: (name: string, link: string) =>
    request<{ docs: PrdDoc[] }>(`/api/prd/link?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      body: JSON.stringify({ link }),
    }),
  /** 移除一个已关联的飞书 PRD 链接，返回最新文档列表 */
  prdRemoveLink: (name: string, link: string) =>
    request<{ docs: PrdDoc[] }>(`/api/prd/link?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      body: JSON.stringify({ link }),
    }),
  /** 同步飞书文档标题和摘要（从飞书拉取并存到 prd.link） */
  prdSync: (name: string, url: string) =>
    request<{ docs: PrdDoc[] }>('/api/prd/sync', {
      method: 'POST',
      body: JSON.stringify({ name, url }),
    }),
  /** 汇总所有原型关联的飞书 PRD 文档（侧边栏「文档」Tab 展示用） */
  prdGetAll: () => request<{ items: { name: string; docs: PrdDoc[] }[] }>('/api/prd/all'),

  // 网络信息
  networkIps: () => request<{ ips: { name: string; address: string; family: string }[]; hostname: string }>('/api/network/ips'),
};
