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
  /**
   * 元素所属的标签页（Tab pane）标识，用于多 sheet 页面下隔离批注标记。
   * 同一页面存在多个同构 Tab（如 IOSS 号管理「平台IOSS号 / IOSS黑名单」）时，
   * 不同 sheet 的元素 selector 完全一致，仅靠 selector 无法区分归属，导致切换
   * 标签页后批注串台。记录元素所在 pane 标识后，渲染时只在命中的 pane 内定位。
   */
  elementPane?: string;
  /**
   * 元素到 body 的 DOM 结构路径（tag:index 序列）。
   * CSS 选择器漂移后，用结构相似度做二次比对，避免同名元素误匹配。
   */
  elementPath?: string;
  /** 元素所在 UI 容器标题（弹窗 / 抽屉 / 卡片），用于跨容器同名元素消歧 */
  elementContainer?: string;
  /** 相邻兄弟元素文字（格式 "前文||后文"），用于同名元素消歧 */
  elementSiblings?: string;
  /** 源码特征索引命中的精确位置：文件 + 行号 + 代码原文，供 AI 直接定位 */
  elementSource?: SourceMatch;
  /** 标记完成时使用的 AI 模型名称，用于追溯该批注由哪个模型修改 */
  resolvedBy?: string;
}

/** 源码特征索引匹配结果（批注点选时由 /api/prototype-index/match 返回） */
export interface SourceMatch {
  file: string;
  line: number;
  code: string;
  /** element = 由 React fiber 运行时溯源直接得到的元素位置（未经文字匹配） */
  kind: 'modal' | 'drawer' | 'card' | 'column' | 'button' | 'menu' | 'link' | 'field' | 'tab' | 'element';
  label: string;
  container: string;
  score: number;
  /** true = 来自运行时溯源（编译期注入的坐标），非文字匹配推断 */
  trace?: boolean;
  /**
   * true = 严格按容器约束无候选，是放宽容器后匹配到的。
   * 常见于 React 原型（Tabs items 与 columns 定义分离，静态扫描无法判定归属），
   * 此时该位置仅供参考，需人工核对。
   */
  loose?: boolean;
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
