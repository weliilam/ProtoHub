import type { Annotation } from './types';

export interface PickedElement {
  selector: string;
  x: number;
  y: number;
  /** 元素的可见文本，用于 AI 修改 DOM 后 CSS 选择器漂移时的文字兜底匹配 */
  elementText?: string;
}

const STYLE_ID = 'ph-annotation-style';

const INJECTED_CSS = `
  .ph-anno-hover { outline: 2px solid #1677ff !important; outline-offset: 1px; cursor: crosshair !important; }
  .ph-anno-marker {
    position: absolute; z-index: 2147483000; width: 22px; height: 22px; border-radius: 50%;
    background: #1677ff; color: #fff; font-size: 12px; font-family: sans-serif; line-height: 22px;
    text-align: center; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.35); user-select: none;
  }
  .ph-anno-marker.ph-anno-done { background: #52c41a; }
  .ph-anno-marker.ph-anno-merged { box-shadow: 0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,.45); font-weight: 700; }
`;

function ensureStyle(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = INJECTED_CSS;
  doc.head.appendChild(style);
}

/** 计算元素的简洁 CSS 路径 */
export function computeSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'BODY' && cur.tagName !== 'HTML' && parts.length < 6) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`#${cur.id}`);
      break;
    }
    const cls = Array.from(cur.classList).find((c) => !c.startsWith('ph-') && !c.includes('hover'));
    if (cls) part += `.${cls}`;
    const parent: Element | null = cur.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
      }
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(' > ');
}

const OVERLAY_ID = 'ph-anno-overlay';

/** 创建/复用覆盖层：拦截鼠标事件，使禁用元素也能被命中测试选中 */
function ensureOverlay(doc: Document): HTMLElement {
  let ov = doc.getElementById(OVERLAY_ID) as HTMLElement | null;
  if (!ov) {
    ov = doc.createElement('div');
    ov.id = OVERLAY_ID;
    // 置于所有原型内容之上、批注标记之下（marker z-index 2147483000）
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
 * 关键点：禁用（disabled）的按钮/输入不会向自身调度任何鼠标事件，
 * 因此无法靠 element 上的 click/mousedown 捕获。这里改为在 iframe 内铺一层
 * 透明的 enabled 覆盖层来拦截事件，处理时临时隐藏覆盖层、用 elementFromPoint
 * 取下方的真实元素（含 disabled）。
 */
export function enablePicking(doc: Document, onPick: (picked: PickedElement) => void): () => void {
  ensureStyle(doc);
  const overlay = ensureOverlay(doc);
  let hovered: Element | null = null;

  // 临时隐藏覆盖层后做命中测试，取真实元素（即使它是 disabled）
  const pickAt = (x: number, y: number): Element | null => {
    overlay.style.pointerEvents = 'none';
    const el = doc.elementFromPoint(x, y) as Element | null;
    overlay.style.pointerEvents = 'auto';
    if (el && !el.classList.contains('ph-anno-marker')) return el;
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
    if (e.button !== 0) return; // 仅处理左键
    const el = pickAt(e.clientX, e.clientY);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = el.getBoundingClientRect();
    const win = doc.defaultView!;
    const elemText = (el.textContent || '').trim().slice(0, 60) || undefined;
    onPick({
      selector: computeSelector(el),
      x: Math.round(rect.left + win.scrollX),
      y: Math.round(rect.top + win.scrollY),
      elementText: elemText,
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
  };
}

/** 渲染批注标记点，返回清理函数 + 找不到对应元素的"失效"批注 */
export function renderMarkers(
  doc: Document,
  annotations: Annotation[],
  onMarkerClick: (a: Annotation) => void,
): { cleanup: () => void; orphan: Annotation[] } {
  ensureStyle(doc);
  clearMarkers(doc);
  const created: Element[] = [];
  const orphan: Annotation[] = [];

  // 同一元素上的多条批注合并成一个标记，避免重叠
  const indexById = new Map<string, number>();
  annotations.forEach((a, i) => indexById.set(a.id, i + 1));

  const groups = new Map<string, Annotation[]>();
  // 只展示「待处理」批注的标记，已完成的「绿圆圈」不渲染
  annotations
    .filter((a) => a.status === 'open')
    .forEach((a) => {
      if (!a.selector) return;
      if (!groups.has(a.selector)) groups.set(a.selector, []);
      groups.get(a.selector)!.push(a);
    });

  groups.forEach((group) => {
    const selector = group[0].selector;
    const elemText = (group[0] as any).elementText as string | undefined;
    const storedX = group[0].x;
    const storedY = group[0].y;
    let el: Element | null = null;

    // 步骤 1：CSS 选择器匹配
    const selMatch = doc.querySelector(selector) as HTMLElement | null;

    // 步骤 2：如果有 elementText，验证 CSS 匹配是否准确
    if (selMatch && elemText) {
      const selText = (selMatch.textContent || '').trim();
      if (selText === elemText || selText.includes(elemText) || elemText.includes(selText)) {
        el = selMatch; // 文字匹配，选择器正确
      }
      // 文字不匹配 → 选择器发生了漂移，走步骤 3
    } else if (selMatch) {
      el = selMatch; // 无 elementText 兜底，直接信任选择器
    }

    // 步骤 3：用文字 + 位置兜底找（收集所有匹配，选距存储坐标最近的）
    if (!el && elemText) {
      const candidates: { node: Element; dist: number }[] = [];
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
      let node: Element | null = walker.currentNode as Element;
      while ((node = walker.nextNode() as Element | null)) {
        const t = (node.textContent || '').trim();
        const match = t === elemText || (t.length > 2 && elemText.length > 2 && (t.includes(elemText) || elemText.includes(t)));
        if (!match) continue;
        const rect = node.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((cx - storedX) ** 2 + (cy - storedY) ** 2);
        candidates.push({ node, dist });
      }
      // 按距离排序，取最近的（位置兜底解决同名元素歧义）
      candidates.sort((a, b) => a.dist - b.dist);
      el = candidates[0]?.node || null;
    }

    if (!el) {
      // 元素已被 AI 改动删除/结构变化，批注不再静默消失，标记为失效
      orphan.push(...group);
      return;
    }
    const rect = el.getBoundingClientRect();
    const win = doc.defaultView!;
    const merged = group.length > 1;
    const marker = doc.createElement('div');
    marker.className = `ph-anno-marker${merged ? ' ph-anno-merged' : ''}`;
    marker.textContent = merged ? String(group.length) : String(indexById.get(group[0].id));
    marker.style.left = `${rect.left + win.scrollX - 8}px`;
    marker.style.top = `${rect.top + win.scrollY - 8}px`;
    const titleLines = group.map((a) => `• [待处理] ${a.text}`);
    marker.title = (merged ? `该元素有 ${group.length} 条批注：\n` : '') + titleLines.join('\n');
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      onMarkerClick(group[0]);
    });
    doc.body.appendChild(marker);
    created.push(marker);
  });

  return { cleanup: () => created.forEach((m) => m.remove()), orphan };
}

export function clearMarkers(doc: Document) {
  doc.querySelectorAll('.ph-anno-marker').forEach((m) => m.remove());
}
