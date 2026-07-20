import type { Annotation, CliStatus, EntryItem, GitLogItem } from './types';

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

  // 数据表
  listTables: () => request<{ name: string; count: number }[]>('/api/data/tables'),
  createTable: (name: string) => request('/api/data/tables', { method: 'POST', body: JSON.stringify({ name }) }),
  readTable: (name: string) => request<any[]>(`/api/data/tables/${encodeURIComponent(name)}`),
  saveTable: (name: string, rows: any[]) =>
    request(`/api/data/tables/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ rows }) }),
  deleteTable: (name: string) => request(`/api/data/tables/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  // Git
  gitStatus: () => request<{ branch?: string; changed?: number; initialized: boolean }>('/api/git/status'),
  gitLog: () => request<GitLogItem[]>('/api/git/log'),
  gitSnapshot: (message: string) =>
    request<{ hash: string }>('/api/git/snapshot', { method: 'POST', body: JSON.stringify({ message }) }),
  gitRestore: (hash: string) => request('/api/git/restore', { method: 'POST', body: JSON.stringify({ hash }) }),

  // AI CLI
  aiStatus: () => request<Record<string, CliStatus>>('/api/ai/status'),
  aiExecute: (cli: string, prompt: string) =>
    request<{ output: string; timedOut: boolean }>('/api/ai/execute', {
      method: 'POST',
      body: JSON.stringify({ cli, prompt }),
    }),

  // 批注
  listAnnotations: (target: string) => request<Annotation[]>(`/api/annotations?target=${encodeURIComponent(target)}`),
  createAnnotation: (data: Omit<Annotation, 'id' | 'status' | 'createdAt'>) =>
    request<Annotation>('/api/annotations', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnotation: (id: string, patch: Partial<Annotation>) =>
    request<Annotation>(`/api/annotations/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteAnnotation: (id: string) => request(`/api/annotations/${id}`, { method: 'DELETE' }),
};
