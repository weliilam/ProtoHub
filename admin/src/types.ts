export type EntryType = 'prototype' | 'component' | 'doc' | 'theme' | 'table';

export interface EntryItem {
  name: string;
  title: string;
  type: EntryType;
  url?: string;
  mtime: number;
  groupId?: string;
  groupName?: string;
}

export interface GroupConfig {
  id: string;
  name: string;
  prototypes: string[];
}

export interface Annotation {
  id: string;
  target: string;
  selector: string;
  x: number;
  y: number;
  text: string;
  status: 'open' | 'done' | 'resolved';
  createdAt: string;
}

export interface GitLogItem {
  hash: string;
  date: string;
  message: string;
}

export interface CliStatus {
  label: string;
  available: boolean;
}

/** 原型基本信息：由 /api/prototype/info 返回 */
export interface PrototypeInfo {
  name: string;
  title: string;
  mode: string;
  type: 'prototype';
  path: string;
  mtime: string;
  annotationCount: number;
  components: {
    antd: { name: string; zh: string }[];
    icons: string[];
    local: string[];
    libs: string[];
  };
}

/** 飞书 PRD 文档元数据 */
export interface PrdDoc {
  url: string;
  title?: string;
  summary?: string;
  syncedAt?: string;
}
