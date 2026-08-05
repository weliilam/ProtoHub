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
  /** 被标注元素上的可见文字，用于 CSS 选择器漂移时的文字兜底匹配 */
  elementText?: string;
  /**
   * 元素的富上下文描述，供 AI 精准定位源码。
   * 如 "表格「操作」列（第2列，"ID"左侧，"状态"右侧）"
   */
  elementDescription?: string;
  /** 标记完成时使用的 AI 模型名称，用于追溯该批注由哪个模型修改 */
  resolvedBy?: string;
}

export interface GitLogItem {
  hash: string;
  date: string;
  message: string;
}

export interface CliStatus {
  label: string;
  available: boolean;
  authorized: boolean;
}

export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiStatus {
  clis: Record<string, CliStatus>;
  models: AiModelOption[];
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
