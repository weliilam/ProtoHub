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
  /** true = 多模态（支持图片输入）。非多模态模型必须禁用图片粘贴/上传 */
  vision: boolean;
}

export interface AiStatus {
  clis: Record<string, CliStatus>;
  models: AiModelOption[];
}

/** 排队中的 AI 任务（服务端 FIFO 队列里的一个等待项） */
export interface AiQueueItem {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  /** 操作目标（如 src/prototypes/xxx/） */
  target: string;
  /** 指令摘要（prompt 前 60 字） */
  summary: string;
  enqueuedAt: number;
  waitedSec: number;
  /** 1 = 队首（下一个执行） */
  position: number;
  /** 该任务对应的批注 id（批注发布任务才有）：用于前端标出"这批批注正在发布中" */
  annotationIds?: string[];
}

/** 正在执行的 AI 任务 */
export interface AiRunningTask {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  target: string;
  summary: string;
  startedAt: number;
  elapsedSec: number;
  /** 按历史中位数预估的总耗时（秒） */
  etaSec: number;
  /** 预计剩余秒数；0 = 已超出预估（任务仍在跑） */
  remainSec: number;
  /** 距上次输出多少秒，超过 60 可提示"可能卡住" */
  idleSec: number;
  /** 该任务对应的批注 id（批注发布任务才有）：用于前端标出"这批批注正在发布中" */
  annotationIds?: string[];
}

/** 全局 AI 任务状态（GET /api/ai/task） */
export interface AiTaskSnapshot {
  running: boolean;
  task: AiRunningTask | null;
  queue: AiQueueItem[];
  /** 队首任务预计总耗时（秒） */
  etaSec: number;
}

/** aiExecute 的排队事件：排队期间每 5s 回调一次，携带最新排队位置 */
export interface AiQueueEvent {
  taskId: string;
  /** 当前排队位置（1 = 下一个执行） */
  position: number;
  /** 预计还需等待秒数 */
  waitEtaSec: number;
  queue: AiQueueItem[];
  /** 当前正在执行的任务（用于展示"前面那个人在改什么"） */
  running: AiRunningTask | null;
}

/** 新建原型时的技术栈：engine 决定入口文件（vue → index.vue），ui 决定组件库/主题 */
export interface CreateEntryOptions {
  engine?: 'react' | 'vue';
  /** vue：ant-design-vue / element-plus；react：client（WinForms 客户端主题） */
  ui?: string;
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

// ── 批量任务：一条指令 → 多个原型页面各跑一遍 AI（服务端串行执行）──

export type BatchItemStatus = 'pending' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'cancelling';

/** 批量任务中的单个子任务（对应一个原型页面） */
export interface BatchItem {
  id: string;
  /** 原型目录名 */
  name: string;
  title: string;
  /** 操作目标（src/prototypes/<name>/） */
  target: string;
  status: BatchItemStatus;
  /** 执行前的基线快照 hash；null = 无快照，不可回滚 */
  baselineHash: string | null;
  /** 相对基线改动的文件清单 */
  changedFiles: string[];
  /** AI 输出（只保留末尾若干字符） */
  output: string;
  /** 失败原因 / 停止说明 */
  error: string;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedSec: number;
  /** 排队位置（1 = 队首） */
  position: number;
  /** 排队预计等待秒数 */
  waitSec: number;
  stopRequested: boolean;
  /** 是否已回滚 */
  rolledBack: boolean;
}

/** 整批任务结束后的汇总 */
export interface BatchSummary {
  total: number;
  done: number;
  failed: number;
  cancelled: number;
  /** 本次批量共改动的文件数（去重） */
  files: number;
  elapsedSec: number;
}

/** 一个批量任务（1 条指令 + N 个目标页面） */
export interface BatchJob {
  id: string;
  cli: string;
  label: string;
  model: string | null;
  instruction: string;
  status: 'queued' | 'running' | 'done';
  /** 在批量任务队列中的位置（1 = 下一个执行） */
  queuePosition: number;
  createdAt: number;
  finishedAt: number | null;
  cancelRequested: boolean;
  items: BatchItem[];
  /** 全部结束后的汇总报告 */
  summary: BatchSummary | null;
}
