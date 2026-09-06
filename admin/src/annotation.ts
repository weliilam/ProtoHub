import type { Annotation } from './types';

export interface PickedElement {
  selector: string;
  x: number;
  y: number;
  /** 元素的可见文本，用于 AI 修改 DOM 后 CSS 选择器漂移时的文字兜底匹配 */
  elementText?: string;
  /** 元素的富上下文描述，供 AI 精准定位源码 */
  elementDescription?: string;
  /** 元素所属标签页（Tab pane）标识，多 sheet 页面下隔离批注 */
  elementPane?: string;
  /** 元素到 body 的 DOM 结构路径，用于结构相似度比对 */
  elementPath?: string;
  /** 元素所在 UI 容器标题（弹窗 / 抽屉 / 卡片），跨容器同名元素消歧 */
  elementContainer?: string;
  /** 相邻兄弟元素文字（"前文||后文"），同名元素消歧 */
  elementSiblings?: string;
  /**
   * 运行时溯源得到的源码位置（React fiber 上编译期注入的坐标）。
   * 比事后在源码里按文字匹配可靠：不要求元素有文字，也不受动态渲染影响。
   */
  sourceFile?: string;
  sourceLine?: number;
}

/** 批注解析结果统计 */
export interface ResolveReport {
  /** 元素已不存在的批注 */
  missing: Annotation[];
  /** 元素仍在页面中但当前视图不可见（在其他页签 / 未打开的弹窗）的批注 */
  hidden: Annotation[];
}

const STYLE_ID = 'ph-annotation-style';
const LAYER_ID = 'ph-anno-layer';
const BADGE_CLASS = 'ph-anno-tab-badge';

const INJECTED_CSS = `
  .ph-anno-hover { outline: 2px solid #1677ff !important; outline-offset: 1px; cursor: crosshair !important; }
  #${LAYER_ID} { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; }
  .ph-anno-marker {
    position: fixed; z-index: 2147483000; width: 22px; height: 22px; border-radius: 50%;
    background: #1677ff; color: #fff; font-size: 12px; font-family: sans-serif; line-height: 22px;
    text-align: center; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.35); user-select: none;
    pointer-events: auto;
  }
  .ph-anno-marker.ph-anno-done { background: #52c41a; }
  .ph-anno-marker.ph-anno-merged { box-shadow: 0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,.45); font-weight: 700; }
  /* 低置信度：结构可能已变化，定位仅供参考，用橙色提示 */
  .ph-anno-marker.ph-anno-low {
    background: #faad14; box-shadow: 0 0 0 2px #fff, 0 0 0 3px #faad14, 0 1px 4px rgba(0,0,0,.35);
  }
  /* 取元素模式：批注层让出鼠标事件，避免挡住命中测试 */
  #${LAYER_ID}.ph-anno-picking, #${LAYER_ID}.ph-anno-picking .ph-anno-marker { pointer-events: none !important; }
  .${BADGE_CLASS} {
    position: absolute; top: -6px; right: -14px; min-width: 16px; height: 16px; padding: 0 4px;
    border-radius: 8px; background: #ff4d4f; color: #fff; font-size: 11px; line-height: 16px;
    text-align: center; font-family: sans-serif; z-index: 5; pointer-events: none;
    box-shadow: 0 0 0 1px #fff;
  }
`;

function ensureStyle(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = INJECTED_CSS;
  doc.head.appendChild(style);
}

/** 批注标记层：与原型内容解耦，MutationObserver 可据此过滤自身改动 */
function ensureLayer(doc: Document): HTMLElement {
  let layer = doc.getElementById(LAYER_ID) as HTMLElement | null;
  if (!layer) {
    layer = doc.createElement('div');
    layer.id = LAYER_ID;
    doc.body.appendChild(layer);
  }
  return layer;
}

// ────────────────────────────────────────────────────────────
// 基础判定
// ────────────────────────────────────────────────────────────

/**
 * 元素是否当前真正可见。
 * display:none 的 Tab pane、未打开的 Modal 都会被判为不可见，
 * 避免批注标记定位到 (0,0) 或串到隐藏的页签里。
 */
function isVisible(el: Element): boolean {
  if (el.getClientRects().length === 0) return false;
  const cv = (el as unknown as { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (typeof cv === 'function') {
    try {
      if (!cv.call(el, { visibilityProperty: true, contentVisibilityAuto: true })) return false;
    } catch {
      /* 不支持该参数时忽略，回退到 rect 判定 */
    }
  }
  return true;
}

function textOf(el: Element): string {
  return (el.textContent || '').trim();
}

// ────────────────────────────────────────────────────────────
// Tab pane 上下文（多 sheet 隔离的核心）
// ────────────────────────────────────────────────────────────

const PANE_SELECTOR = '[role="tabpanel"], .ant-tabs-tabpane, .ant-tabs-tab-pane, .el-tab-pane';
const TAB_SELECTOR = '.ant-tabs-tab, .el-tabs__item';

function nearestPane(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (cur.matches(PANE_SELECTOR)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function paneIndexOf(pane: Element): number {
  const tabsRoot = pane.closest('.ant-tabs, .el-tabs');
  if (!tabsRoot) return -1;
  return Array.from(tabsRoot.querySelectorAll(PANE_SELECTOR)).indexOf(pane);
}

/** pane 对应的页签按钮元素 */
function tabElOf(pane: Element): Element | null {
  const doc = pane.ownerDocument;
  const labelledBy = pane.getAttribute('aria-labelledby');
  if (labelledBy && doc) {
    const tab = doc.getElementById(labelledBy);
    if (tab) return tab;
  }
  // antd：pane id = rc-tabs-0-panel-1 → tab id = rc-tabs-0-tab-1
  if (pane.id && doc) {
    const tab = doc.getElementById(pane.id.replace(/-panel-/, '-tab-'));
    if (tab) return tab;
  }
  const tabsRoot = pane.closest('.ant-tabs, .el-tabs');
  if (tabsRoot) {
    const panes = Array.from(tabsRoot.querySelectorAll(PANE_SELECTOR));
    const idx = panes.indexOf(pane);
    const tabs = Array.from(tabsRoot.querySelectorAll(TAB_SELECTOR));
    if (idx >= 0 && tabs[idx]) return tabs[idx];
  }
  return null;
}

/** pane 的页签标题文字 */
function paneTabLabel(pane: Element): string {
  const tab = tabElOf(pane);
  if (tab) {
    const t = textOf(tab).slice(0, 30);
    if (t) return t;
  }
  const idx = paneIndexOf(pane);
  return idx >= 0 ? `#${idx}` : '';
}

/** paneKey 格式：标题|paneId|序号（三重冗余，任一可用即可定位） */
function buildPaneKey(pane: Element): string {
  return `${paneTabLabel(pane)}|${pane.id}|${paneIndexOf(pane)}`;
}

interface PaneKey {
  label: string;
  id: string;
  index: number;
}

function parsePaneKey(key: string): PaneKey {
  const [label = '', id = '', idx = ''] = key.split('|');
  return { label, id, index: Number(idx) };
}

/** 元素所在页签的标题（不在任何 pane 内则返回空串） */
function paneLabelOf(el: Element): string {
  const pane = nearestPane(el);
  return pane ? paneTabLabel(pane) : '';
}

function findPaneEl(doc: Document, key: string): Element | null {
  const { label, id, index } = parsePaneKey(key);
  if (id) {
    const byId = doc.getElementById(id);
    if (byId) return byId;
  }
  const panes = Array.from(doc.querySelectorAll(PANE_SELECTOR));
  if (label) {
    const byLabel = panes.find((p) => paneTabLabel(p) === label);
    if (byLabel) return byLabel;
  }
  if (index >= 0 && panes[index]) return panes[index];
  return null;
}

/** 供 UI 展示：批注归属的页签名 */
export function annotationPaneLabel(a: Annotation): string {
  return a.elementPane ? parsePaneKey(a.elementPane).label : '';
}

// ────────────────────────────────────────────────────────────
// 容器上下文（弹窗 / 抽屉 / 卡片 / 页签 / 页面）
// ────────────────────────────────────────────────────────────

type ContainerKind = 'modal' | 'drawer' | 'card' | 'tab' | 'page';
interface ContainerInfo {
  kind: ContainerKind;
  title: string;
}

function firstText(root: Element | null, selector: string): string {
  if (!root) return '';
  const el = root.querySelector(selector);
  return el ? textOf(el).slice(0, 30) : '';
}

function captureContainerInfo(el: Element): ContainerInfo | null {
  const modal = el.closest('.ant-modal, .el-dialog, .ant-modal-wrap, .el-overlay-dialog');
  if (modal) {
    const t = firstText(modal, '.ant-modal-title, .el-dialog__title');
    if (t) return { kind: 'modal', title: t };
  }
  const drawer = el.closest('.ant-drawer, .el-drawer');
  if (drawer) {
    const t = firstText(drawer, '.ant-drawer-title, .el-drawer__title');
    if (t) return { kind: 'drawer', title: t };
  }
  const card = el.closest('.ant-card, .el-card');
  if (card) {
    const t = firstText(card, '.ant-card-head-title, .el-card__header');
    if (t) return { kind: 'card', title: t };
  }
  const pane = nearestPane(el);
  if (pane) {
    const t = paneTabLabel(pane);
    if (t) return { kind: 'tab', title: t };
  }
  const doc = el.ownerDocument;
  const pageTitle = doc?.querySelector('h1, h2, .bol-title, .page-title');
  if (pageTitle) {
    const t = textOf(pageTitle).slice(0, 30);
    if (t) return { kind: 'page', title: t };
  }
  return null;
}

const CONTAINER_SUFFIX: Record<ContainerKind, string> = {
  modal: '弹窗中的',
  drawer: '抽屉中的',
  card: '卡片中的',
  tab: '标签页中的',
  page: '页面中的',
};

function captureContainerPrefix(el: Element): string {
  const c = captureContainerInfo(el);
  return c ? `「${c.title}」${CONTAINER_SUFFIX[c.kind]}` : '';
}

// ────────────────────────────────────────────────────────────
// 结构路径 / 兄弟文字（选择器漂移后的兜底特征）
// ────────────────────────────────────────────────────────────

function capturePath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML' && depth < 12) {
    const parent: Element | null = cur.parentElement;
    const idx = parent ? Array.from(parent.children).indexOf(cur) : 0;
    parts.unshift(`${cur.tagName.toLowerCase()}:${idx}`);
    cur = parent;
    depth += 1;
  }
  return parts.join('/');
}

/** 从叶子端（最具体）向根比对，返回 0~1 相似度 */
function pathSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const pa = a.split('/');
  const pb = b.split('/');
  let same = 0;
  const min = Math.min(pa.length, pb.length);
  for (let i = 0; i < min; i += 1) {
    if (pa[pa.length - 1 - i] === pb[pb.length - 1 - i]) same += 1;
    else break;
  }
  return same / Math.max(pa.length, pb.length, 1);
}

function captureSiblings(el: Element): string {
  const parent = el.parentElement;
  if (!parent) return '';
  const sib = Array.from(parent.children);
  const i = sib.indexOf(el);
  const prev = i > 0 ? textOf(sib[i - 1]).slice(0, 20) : '';
  const next = i >= 0 && i < sib.length - 1 ? textOf(sib[i + 1]).slice(0, 20) : '';
  return prev || next ? `${prev}||${next}` : '';
}

// ────────────────────────────────────────────────────────────
// 选择器生成
// ────────────────────────────────────────────────────────────

/** 会随交互变化的类名，不参与定位（一 hover / 一 loading 选择器就失效） */
const VOLATILE_CLASS =
  /(^|-)(hover|active|focus|focused|selected|checked|loading|disabled|open|opened|hidden|error|warning|danger|enter|leave|appear|animation|motion|ant-(?:[a-z]+-)?[0-9a-f]{6,})$/i;
/** 运行时自增 id（rc-tabs-0-panel-1 等），结构一变就失效，不参与定位 */
const RUNTIME_ID = /^(rc-|rc_tabs_|rc-tabs-)/i;

function classToken(el: Element): string {
  const list = Array.from(el.classList).filter((c) => !c.startsWith('ph-'));
  const picked: string[] = [];
  for (const c of list) {
    if (!c || VOLATILE_CLASS.test(c)) continue;
    picked.push(c);
    if (picked.length >= 2) break;
  }
  return picked.length ? `.${picked.join('.')}` : '';
}

/** 比 class 更稳定的语义属性 */
function stableAttr(el: Element): string | null {
  const rowKey = el.getAttribute('data-row-key');
  if (rowKey) return `[data-row-key="${CSS.escape(rowKey)}"]`;
  if (el.getAttribute('role') === 'tabpanel') {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return `[aria-labelledby="${CSS.escape(lb)}"]`;
  }
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
  return null;
}

function computeSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML' && depth < 8) {
    // 显式标注类型：cur 在循环尾部被赋值为 node.parentElement，不标注会触发循环推断
    const node: Element = cur;
    const stable = stableAttr(node);
    if (stable) {
      parts.unshift(`${node.tagName.toLowerCase()}${stable}`);
      break;
    }
    if (node.id && !RUNTIME_ID.test(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase() + classToken(node);
    const parent: Element | null = node.parentElement;
    if (parent) {
      const sib = Array.from(parent.children);
      if (sib.length > 1) {
        const sameTag = sib.filter((c) => c.tagName === node.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        else part += `:nth-child(${sib.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    cur = parent;
    depth += 1;
  }
  return parts.join(' > ');
}

// ────────────────────────────────────────────────────────────
// 元素描述（供 AI 定位源码）
// ────────────────────────────────────────────────────────────

export function captureElementContext(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const ownText = textOf(el).slice(0, 60);
  const doc = el.ownerDocument;

  if (tag === 'th' || tag === 'td') {
    const row = el.parentElement;
    if (!row) return _fallback(tag, ownText);
    const cells = Array.from(row.children).filter((c) => c.tagName === 'TH' || c.tagName === 'TD');
    const idx = cells.indexOf(el);
    if (idx < 0) return _fallback(tag, ownText);

    let headerText = '';
    const table = el.closest('table');
    if (table) {
      const theadRows = table.querySelectorAll('thead tr');
      const lastTheadRow = theadRows[theadRows.length - 1];
      if (lastTheadRow) {
        const headerCells = Array.from(lastTheadRow.children).filter(
          (c) => c.tagName === 'TH' || c.tagName === 'TD',
        );
        if (idx < headerCells.length) headerText = textOf(headerCells[idx]).slice(0, 30);
      }
      if (!headerText) {
        const allHeaders = table.querySelectorAll('thead th, thead td');
        if (idx < allHeaders.length) headerText = textOf(allHeaders[idx]).slice(0, 30);
      }
    }

    const prevCell = idx > 0 ? cells[idx - 1] : null;
    const nextCell = idx < cells.length - 1 ? cells[idx + 1] : null;
    const prevText = prevCell ? textOf(prevCell).slice(0, 20) : '';
    const nextText = nextCell ? textOf(nextCell).slice(0, 20) : '';

    const label = headerText || ownText || `第${idx + 1}列`;
    const prefix = captureContainerPrefix(el);
    let desc = `${prefix}表格「${label}」列`;
    if (tag !== 'th') desc = `${prefix}表格「${label}」列的单元格`;
    desc += `（第${idx + 1}列`;
    if (prevText) desc += `，"${prevText}"左侧`;
    if (nextText) desc += `，"${nextText}"右侧`;
    desc += '）';
    return desc;
  }

  const isButton =
    tag === 'button' ||
    (tag === 'a' && /ant-btn|btn/i.test(String(el.className))) ||
    el.getAttribute('role') === 'button';
  if (isButton) {
    const innerSpan = el.querySelector('span');
    const btnText =
      ownText ||
      (innerSpan ? textOf(innerSpan).slice(0, 30) : '') ||
      (el.getAttribute('aria-label') || '').slice(0, 30);
    const prefix = captureContainerPrefix(el);
    return btnText ? `${prefix}按钮「${btnText}」` : `${prefix}按钮`;
  }

  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const input = el as HTMLInputElement;
    const id = input.id;
    let labelText = '';
    if (id && doc) {
      const labelEl = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (labelEl) labelText = textOf(labelEl).slice(0, 30);
    }
    const desc =
      labelText || input.placeholder || input.name || input.getAttribute('aria-label') || ownText;
    const prefix = captureContainerPrefix(el);
    return desc ? `${prefix}表单字段「${desc}」` : `${prefix}表单输入框`;
  }

  if (ownText) {
    const cls = String(el.className).toLowerCase();
    const prefix = captureContainerPrefix(el);
    // 自身只是文字载体（如按钮内部的 <span>新增</span>），向上借用
    // 按钮 / 链接 / 菜单项的语义，否则描述会退化成「元素「新增」」而丢失类型
    const semantic = el.closest(
      'button, a[href], [role="button"], .ant-btn, .el-button, .ant-menu-item, .el-menu-item',
    );
    if (semantic && semantic !== el) {
      const typeLabel = semantic.matches('.ant-menu-item, .el-menu-item, [role="menuitem"]')
        ? '菜单项'
        : semantic.tagName.toLowerCase() === 'a'
          ? '链接'
          : '按钮';
      return `${prefix}${typeLabel}「${ownText}」`;
    }
    if (cls.includes('title') || /h[1-6]/i.test(tag)) return `${prefix}标题「${ownText}」`;
    if (cls.includes('label') || tag === 'label') return `${prefix}标签「${ownText}」`;
    if (cls.includes('tab')) return `${prefix}标签页「${ownText}」`;
    if (cls.includes('menu') || cls.includes('nav') || tag === 'a')
      return `${prefix}菜单项「${ownText}」`;
    return `${prefix}元素「${ownText}」`;
  }

  // 无文字元素：多半是图标按钮 / 图标链接内部的 <span class="anticon-*">。
  // 若直接退化成「元素 <span>」，批注里看不出点的是什么，源码索引也丢了类型线索。
  // 这里向上找最近的语义祖先，借用它的类型和文字 / aria-label / 图标名来描述。
  const semantic = el.closest(
    'button, a[href], [role="button"], .ant-btn, .el-button, .ant-menu-item, .el-menu-item, label',
  );
  if (semantic) {
    const prefix = captureContainerPrefix(el);
    const st = semantic.tagName.toLowerCase();
    const typeLabel = st === 'a' ? '链接' : st === 'label' ? '标签' : '按钮';
    const ancestorText = textOf(semantic).slice(0, 30);
    if (ancestorText) return `${prefix}${typeLabel}「${ancestorText}」`;

    const ariaLabel = semantic.getAttribute('aria-label');
    if (ariaLabel) return `${prefix}${typeLabel}「${ariaLabel}」`;

    // 图标类名（anticon-edit / el-icon-edit）作为最后的识别线索
    const iconName =
      Array.from(el.classList).find((c) => /^anticon-|^el-icon-/i.test(c)) ||
      Array.from(semantic.querySelectorAll('[class*="anticon"], [class*="el-icon"]'))
        .map((n) => Array.from(n.classList).find((c) => /^anticon-|^el-icon-/i.test(c)))
        .find(Boolean);
    if (iconName) {
      return `${prefix}${typeLabel}（图标：${iconName.replace(/^anticon-|^el-icon-/i, '')}）`;
    }
    return `${prefix}${typeLabel}（无文字）`;
  }

  return _fallback(tag, '');
}

function _fallback(tag: string, text: string): string {
  return text ? `元素「${text}」` : `元素 <${tag}>`;
}

// ────────────────────────────────────────────────────────────
// 运行时溯源（React fiber）
// ────────────────────────────────────────────────────────────

/** 向上追溯 fiber 的最大层数，超过则认为坐标已不可靠 */
const FIBER_MAX_HOP = 8;

/** 绝对路径 → 项目内相对路径（D:/x/src/prototypes/... → src/prototypes/...） */
function normalizeSourceFile(p: string): string {
  const s = String(p || '').replace(/\\/g, '/');
  const i = s.indexOf('/src/');
  return i >= 0 ? s.slice(i + 1) : s;
}

/**
 * 从 DOM 反查 React fiber，读取编译期注入的源码坐标（_debugSource）。
 *
 * 开发模式下 JSX 会被编译带上「文件 + 行号」，DOM 节点上的 __reactFiber$xxx
 * 可直接反查到它，因此不需要任何"按文字猜"的匹配。
 *
 * 局限：由 columns / items 这类配置数组渲染的元素（表头、单元格、页签）
 * 在源码里没有独立 JSX 节点，拿不到坐标，需回退到文字匹配。
 */
export function captureReactSource(el: Element): { file: string; line: number } | null {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return null;
  const fiber = (el as unknown as Record<string, unknown>)[key] as
    | { _debugSource?: { fileName?: string; lineNumber?: number }; return?: unknown }
    | undefined;
  if (!fiber) return null;

  let node: { _debugSource?: { fileName?: string; lineNumber?: number }; return?: unknown } | null =
    fiber;
  let hop = 0;
  while (node && hop <= FIBER_MAX_HOP) {
    const src = node._debugSource;
    if (src && src.fileName && src.lineNumber) {
      return { file: normalizeSourceFile(src.fileName), line: src.lineNumber };
    }
    node = (node.return as typeof node) ?? null;
    hop += 1;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// 取元素模式
// ────────────────────────────────────────────────────────────

const OVERLAY_ID = 'ph-anno-overlay';

function ensureOverlay(doc: Document): HTMLElement {
  let ov = doc.getElementById(OVERLAY_ID) as HTMLElement | null;
  if (!ov) {
    ov = doc.createElement('div');
    ov.id = OVERLAY_ID;
    ov.style.cssText =
      'position:fixed;inset:0;z-index:2147482999;cursor:crosshair;background:transparent;';
    doc.body.appendChild(ov);
  }
  return ov;
}

/**
 * 开启取元素模式：hover 高亮，点击后回调元素信息。
 * 返回清理函数。
 *
 * 关键点：禁用（disabled）的按钮/输入不会向自身调度鼠标事件，
 * 因此在 iframe 内铺一层透明覆盖层拦截事件，处理时临时隐藏覆盖层，
 * 用 elementFromPoint 取下方真实元素。
 */
export function enablePicking(doc: Document, onPick: (picked: PickedElement) => void): () => void {
  ensureStyle(doc);
  const overlay = ensureOverlay(doc);
  const layer = ensureLayer(doc);
  layer.classList.add('ph-anno-picking');
  let hovered: Element | null = null;

  const pickAt = (x: number, y: number): Element | null => {
    overlay.style.pointerEvents = 'none';
    const el = doc.elementFromPoint(x, y) as Element | null;
    overlay.style.pointerEvents = 'auto';
    if (el && !el.classList.contains('ph-anno-marker') && !el.classList.contains(BADGE_CLASS)) {
      return el;
    }
    return null;
  };

  const onMouseMove = (e: MouseEvent) => {
    const el = pickAt(e.clientX, e.clientY);
    if (el === hovered) return;
    hovered?.classList.remove('ph-anno-hover');
    hovered = el;
    hovered?.classList.add('ph-anno-hover');
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const el = pickAt(e.clientX, e.clientY);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const win = doc.defaultView;
    const pane = nearestPane(el);
    const container = captureContainerInfo(el);
    // React 原型：优先用运行时溯源拿到的精确坐标（拿不到时为 null，回退文字匹配）
    const trace = captureReactSource(el);
    onPick({
      selector: computeSelector(el),
      x: Math.round(rect.left + (win?.scrollX ?? 0)),
      y: Math.round(rect.top + (win?.scrollY ?? 0)),
      elementText: textOf(el).slice(0, 60) || undefined,
      elementDescription: captureElementContext(el),
      elementPane: pane ? buildPaneKey(pane) : undefined,
      elementPath: capturePath(el),
      elementContainer: container?.title,
      elementSiblings: captureSiblings(el),
      sourceFile: trace?.file,
      sourceLine: trace?.line,
    });
  };

  // 覆盖层拦截滚轮，手动转发给下方真实的可滚动容器，保留原型滚动能力
  const onWheel = (e: WheelEvent) => {
    const el = pickAt(e.clientX, e.clientY);
    let sc: HTMLElement | null = el as HTMLElement | null;
    while (sc && sc.scrollHeight <= sc.clientHeight) sc = sc.parentElement;
    if (sc) {
      e.preventDefault();
      sc.scrollTop += e.deltaY;
    }
  };

  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mousedown', onMouseDown);
    overlay.removeEventListener('wheel', onWheel);
    hovered?.classList.remove('ph-anno-hover');
    overlay.remove();
    layer.classList.remove('ph-anno-picking');
  };
}

// ────────────────────────────────────────────────────────────
// 加权评分定位
// ────────────────────────────────────────────────────────────

const W = {
  paneMatch: 30,
  paneMismatch: -30,
  containerMatch: 20,
  containerMismatch: -15,
  textExact: 40,
  textPartial: 15,
  textMismatch: -15,
  selectorFull: 30,
  selectorPartial: 12,
  path: 15,
  siblings: 10,
  position: 5,
};

/** 达到该分数视为高置信度；低于 MIN_SCORE_LOW 则判定元素已不存在 */
const MIN_SCORE_HIGH = 25;
const MIN_SCORE_LOW = 12;

function matchesSelector(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

/** 只用选择器末两段匹配：祖先链变化后仍可能命中 */
function partialSelectorMatch(el: Element, selector: string): boolean {
  const segs = selector
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean);
  if (segs.length < 2) return false;
  return matchesSelector(el, segs.slice(-2).join(' > '));
}

function scoreElement(el: Element, a: Annotation): number {
  let s = 0;

  // 页签归属：多 sheet 页面最强特征，不匹配直接重罚
  const wantPane = a.elementPane ? parsePaneKey(a.elementPane).label : '';
  if (wantPane) {
    const got = paneLabelOf(el);
    if (got) s += got === wantPane ? W.paneMatch : W.paneMismatch;
  }

  // 容器归属：区分主列表表格 vs 弹框内同名表格
  if (a.elementContainer) {
    const c = captureContainerInfo(el);
    if (c) s += c.title === a.elementContainer ? W.containerMatch : W.containerMismatch;
  }

  // 文字
  if (a.elementText) {
    const t = textOf(el);
    if (t === a.elementText) s += W.textExact;
    else if (t && (t.includes(a.elementText) || a.elementText.includes(t))) s += W.textPartial;
    else s += W.textMismatch;
  }

  // 选择器
  if (a.selector) {
    if (matchesSelector(el, a.selector)) s += W.selectorFull;
    else if (partialSelectorMatch(el, a.selector)) s += W.selectorPartial;
  }

  // 结构路径相似度
  if (a.elementPath) s += pathSimilarity(capturePath(el), a.elementPath) * W.path;

  // 相邻兄弟文字
  if (a.elementSiblings) {
    const [prev = '', next = ''] = a.elementSiblings.split('||');
    const got = captureSiblings(el);
    if (got) {
      const [gp = '', gn = ''] = got.split('||');
      if (prev && gp && prev === gp) s += W.siblings / 2;
      if (next && gn && next === gn) s += W.siblings / 2;
    }
  }

  // 位置（弱特征，仅用于同级消歧）
  // 与采集时保持一致：都用左上角 + 页面坐标。若这里改用中心点比对，
  // 嵌套元素（如 th 与其内部 span）的中心距几乎相同，判别力会丧失，
  // 导致漂移时定位到内层元素而非用户点选的外层元素。
  const win = el.ownerDocument.defaultView;
  const rect = el.getBoundingClientRect();
  const px = rect.left + (win?.scrollX ?? 0);
  const py = rect.top + (win?.scrollY ?? 0);
  const dist = Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  s += Math.max(0, W.position * (1 - dist / 800));

  return s;
}

function collectCandidates(scope: Element, a: Annotation): Element[] {
  const out = new Set<Element>();

  if (a.selector) {
    try {
      scope.querySelectorAll(a.selector).forEach((el) => out.add(el));
    } catch {
      /* 非法选择器忽略 */
    }
    const segs = a.selector
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean);
    if (segs.length > 1) {
      try {
        scope.querySelectorAll(segs[segs.length - 1]).forEach((el) => out.add(el));
      } catch {
        /* 末段非法忽略 */
      }
    }
  }

  // 文字兜底：选择器漂移后按文字找候选
  if (a.elementText && a.elementText.length > 1) {
    const walker = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    let scanned = 0;
    while (node && scanned < 600) {
      scanned += 1;
      const t = textOf(node);
      if (t) {
        const hit =
          t === a.elementText ||
          (t.length > 2 &&
            a.elementText.length > 2 &&
            (t.includes(a.elementText) || a.elementText.includes(t)));
        if (hit) out.add(node);
      }
      node = walker.nextNode() as Element | null;
    }
  }

  return Array.from(out);
}

interface Scored {
  el: Element;
  score: number;
}

/**
 * 在指定可见性范围内找最佳匹配。
 * mode='visible'：只考虑当前真正可见的元素（正常定位）
 * mode='hidden'：只考虑被隐藏的元素（判断批注是否只是藏在别的页签 / 未打开的弹窗里）
 */
function findBest(doc: Document, a: Annotation, mode: 'visible' | 'hidden'): Scored | null {
  let scope: Element | null = doc.body;
  if (a.elementPane) {
    const pane = findPaneEl(doc, a.elementPane);
    if (pane) scope = pane;
    // 找不到对应 pane 时退回整页，避免整批批注被误判为失效
  }
  if (!scope) return null;

  const candidates = collectCandidates(scope, a).filter((el) =>
    mode === 'visible' ? isVisible(el) : !isVisible(el),
  );

  let best: Scored | null = null;
  for (const el of candidates) {
    const score = scoreElement(el, a);
    if (!best || score > best.score) best = { el, score };
  }
  return best;
}

type ResolveStatus = 'ok' | 'hidden' | 'missing';

interface Resolved {
  status: ResolveStatus;
  el?: Element;
  score: number;
  low: boolean;
  paneLabel?: string;
}

function resolveAnnotation(doc: Document, a: Annotation): Resolved {
  // 先在当前可见范围内定位
  const visible = findBest(doc, a, 'visible');
  if (visible && visible.score >= MIN_SCORE_LOW) {
    return {
      status: 'ok',
      el: visible.el,
      score: visible.score,
      low: visible.score < MIN_SCORE_HIGH,
    };
  }
  // 可见范围找不到：元素可能只是藏在未激活的页签 / 未打开的弹窗里
  const hidden = findBest(doc, a, 'hidden');
  if (hidden && hidden.score >= MIN_SCORE_LOW) {
    return {
      status: 'hidden',
      el: hidden.el,
      score: hidden.score,
      low: hidden.score < MIN_SCORE_HIGH,
      paneLabel: paneLabelOf(hidden.el),
    };
  }
  return {
    status: 'missing',
    score: Math.max(visible?.score ?? 0, hidden?.score ?? 0),
    low: true,
  };
}

// ────────────────────────────────────────────────────────────
// 标记层：渲染 + 跟随 + 自动重定位
// ────────────────────────────────────────────────────────────

const RELAYOUT_DEBOUNCE = 150;

class MarkerLayer {
  private doc: Document;
  private annotations: Annotation[];
  private onMarkerClick: (a: Annotation) => void;
  private onResolve?: (r: ResolveReport) => void;
  private layer: HTMLElement;
  /** 需要跟随目标元素实时同步位置的标记 */
  private follow: { el: Element; marker: HTMLElement }[] = [];
  /** 本次创建的所有节点（标记 + 页签角标），清理时统一移除 */
  private created: HTMLElement[] = [];
  /** 被改过 position 的页签元素，清理时还原 */
  private tabsTouched: { el: HTMLElement; prev: string }[] = [];
  private raf = 0;
  private relayoutTimer: number | undefined;
  private observer: MutationObserver | null = null;
  private disposed = false;
  private lastReport: ResolveReport = { missing: [], hidden: [] };

  constructor(
    doc: Document,
    annotations: Annotation[],
    onMarkerClick: (a: Annotation) => void,
    onResolve?: (r: ResolveReport) => void,
  ) {
    this.doc = doc;
    this.annotations = annotations;
    this.onMarkerClick = onMarkerClick;
    this.onResolve = onResolve;
    this.layer = ensureLayer(doc);
  }

  mount(): ResolveReport {
    this.render();
    this.bindEvents();
    return this.lastReport;
  }

  private render() {
    this.clearRendered();

    const missing: Annotation[] = [];
    const hidden: Annotation[] = [];
    const hiddenPaneLabels = new Map<string, string>();

    const indexById = new Map<string, number>();
    this.annotations.forEach((a, i) => indexById.set(a.id, i + 1));

    // 只展示「待处理」批注的标记
    const openList = this.annotations.filter(
      (a) => a.status === 'open' && (a.selector || a.elementText),
    );

    // 按解析出的元素合并（同一元素上的多条批注合成一个标记）
    const groups = new Map<Element, { a: Annotation; low: boolean }[]>();
    for (const a of openList) {
      const r = resolveAnnotation(this.doc, a);
      if (r.status === 'missing' || !r.el) {
        missing.push(a);
        continue;
      }
      if (r.status === 'hidden') {
        hidden.push(a);
        if (r.paneLabel) hiddenPaneLabels.set(a.id, r.paneLabel);
        continue;
      }
      if (!groups.has(r.el)) groups.set(r.el, []);
      groups.get(r.el)!.push({ a, low: r.low });
    }

    groups.forEach((group, el) => {
      const low = group.some((g) => g.low);
      const marker = this.doc.createElement('div');
      marker.className = `ph-anno-marker${group.length > 1 ? ' ph-anno-merged' : ''}${
        low ? ' ph-anno-low' : ''
      }`;
      marker.textContent =
        group.length > 1 ? String(group.length) : String(indexById.get(group[0].a.id) ?? 1);
      const titleLines = group.map((g) => `• [待处理] ${g.a.text}`);
      marker.title =
        (group.length > 1 ? `该元素有 ${group.length} 条批注：\n` : '') +
        titleLines.join('\n') +
        (low ? '\n\n⚠ 页面结构可能已变化，定位仅供参考' : '');
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onMarkerClick(group[0].a);
      });
      this.layer.appendChild(marker);
      this.created.push(marker);
      this.follow.push({ el, marker });
    });

    this.renderTabBadges(hidden, hiddenPaneLabels);

    this.lastReport = { missing, hidden };
    this.sync();
  }

  /** 非当前页签的批注数，以角标形式挂在页签上，避免"批注凭空消失" */
  private renderTabBadges(hidden: Annotation[], paneLabels: Map<string, string>) {
    const badgeCount = new Map<Element, number>();
    for (const a of hidden) {
      let pane: Element | null = a.elementPane ? findPaneEl(this.doc, a.elementPane) : null;
      if (!pane) {
        const label = paneLabels.get(a.id);
        if (label) {
          pane =
            Array.from(this.doc.querySelectorAll(PANE_SELECTOR)).find(
              (p) => paneTabLabel(p) === label,
            ) || null;
        }
      }
      const tab = pane ? tabElOf(pane) : null;
      if (!tab) continue;
      badgeCount.set(tab, (badgeCount.get(tab) || 0) + 1);
    }

    badgeCount.forEach((count, tab) => {
      const htmlTab = tab as HTMLElement;
      if (htmlTab.style) {
        const prev = htmlTab.style.position;
        if (prev !== 'relative') {
          htmlTab.style.position = 'relative';
          this.tabsTouched.push({ el: htmlTab, prev });
        }
      }
      const badge = this.doc.createElement('span');
      badge.className = BADGE_CLASS;
      badge.textContent = String(count);
      badge.title = `该页签下有 ${count} 条批注，切换后可查看`;
      htmlTab.appendChild(badge);
      this.created.push(badge);
    });
  }

  /** 把标记同步到目标元素的当前位置（fixed 定位，随所有滚动容器实时跟随） */
  private sync() {
    const win = this.doc.defaultView;
    const vw = win?.innerWidth ?? 0;
    const vh = win?.innerHeight ?? 0;

    for (const { el, marker } of this.follow) {
      const rect = el.getBoundingClientRect();
      const empty = rect.width === 0 && rect.height === 0;
      const outside = rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw;
      if (empty || outside) {
        marker.style.display = 'none';
        continue;
      }
      // 元素部分露出视口时做命中测试，避免标记飘在裁剪容器之外
      const fullyInside = rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw;
      if (!fullyInside && vw > 0 && vh > 0) {
        const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), vw - 1);
        const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), vh - 1);
        const hit = this.doc.elementFromPoint(cx, cy);
        if (hit && !hit.classList.contains('ph-anno-marker')) {
          const related = el === hit || el.contains(hit) || hit.contains(el);
          if (!related) {
            marker.style.display = 'none';
            continue;
          }
        }
      }
      marker.style.display = '';
      const top = Math.max(10, Math.min(rect.top, vh - 26));
      const left = Math.max(2, Math.min(rect.left, vw - 26));
      marker.style.left = `${left - 8}px`;
      marker.style.top = `${top - 8}px`;
    }
  }

  private scheduleSync() {
    if (this.disposed || this.raf) return;
    const win = this.doc.defaultView;
    if (!win) return;
    this.raf = win.requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.disposed) this.sync();
    });
  }

  /** DOM 结构变化（切页签 / 展开收起 / 打开弹窗 / 数据加载）后整体重新定位 */
  private scheduleRelayout() {
    if (this.disposed) return;
    const win = this.doc.defaultView;
    if (!win) return;
    if (this.relayoutTimer) win.clearTimeout(this.relayoutTimer);
    this.relayoutTimer = win.setTimeout(() => {
      this.relayoutTimer = undefined;
      if (this.disposed) return;
      this.render();
      this.onResolve?.(this.lastReport);
    }, RELAYOUT_DEBOUNCE);
  }

  private bindEvents() {
    const win = this.doc.defaultView;
    const sync = () => this.scheduleSync();
    // capture 阶段可捕获内部滚动容器（表格 body、弹框 body 等）的 scroll
    this.doc.addEventListener('scroll', sync, true);
    win?.addEventListener('scroll', sync, true);
    win?.addEventListener('resize', sync);
    this.detachEvents = () => {
      this.doc.removeEventListener('scroll', sync, true);
      win?.removeEventListener('scroll', sync, true);
      win?.removeEventListener('resize', sync);
    };

    if (typeof MutationObserver !== 'undefined') {
      this.observer = new MutationObserver((records) => {
        // 忽略批注层自身的增删，避免自激循环
        const relevant = records.some((r) => {
          const t = r.target;
          if (!t || t.nodeType !== 1) return false;
          const el = t as Element;
          if (this.layer.contains(el) || el.classList.contains(BADGE_CLASS)) return false;
          return true;
        });
        if (!relevant) return;
        this.scheduleRelayout();
      });
      // 只观察 class：页签切换、展开收起都体现在 class 上；
      // 观察 style 会被动画频繁触发，造成无意义重排
      this.observer.observe(this.doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    }
  }

  private detachEvents: () => void = () => {};

  private clearRendered() {
    for (const node of this.created) node.remove();
    this.created = [];
    this.follow = [];
    for (const t of this.tabsTouched) t.el.style.position = t.prev;
    this.tabsTouched = [];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const win = this.doc.defaultView;
    if (this.raf) win?.cancelAnimationFrame(this.raf);
    if (this.relayoutTimer) win?.clearTimeout(this.relayoutTimer);
    this.observer?.disconnect();
    this.observer = null;
    this.detachEvents();
    this.clearRendered();
  }
}

// ────────────────────────────────────────────────────────────
// 对外接口
// ────────────────────────────────────────────────────────────

/**
 * 渲染批注标记。
 *
 * 标记采用 fixed 定位并跟随目标元素实时同步，页面内任何滚动容器
 * （弹框 body、表格 body、页签内容区）滚动时标记都不会脱节；
 * DOM 结构变化后自动重新定位。
 *
 * 返回清理函数 + 失效统计：
 * - missing：元素已不存在（可能已被 AI 改动删除）
 * - hidden：元素仍在，但当前视图不可见（在其他页签 / 未打开的弹窗）
 */
export function renderMarkers(
  doc: Document,
  annotations: Annotation[],
  onMarkerClick: (a: Annotation) => void,
  onResolve?: (r: ResolveReport) => void,
): { cleanup: () => void } & ResolveReport {
  ensureStyle(doc);
  const layer = new MarkerLayer(doc, annotations, onMarkerClick, onResolve);
  const report = layer.mount();
  return { cleanup: () => layer.dispose(), ...report };
}

/** 清空页面上的全部批注标记（含页签角标） */
export function clearMarkers(doc: Document) {
  doc.querySelectorAll('.ph-anno-marker').forEach((m) => m.remove());
  doc.querySelectorAll(`.${BADGE_CLASS}`).forEach((b) => b.remove());
}
