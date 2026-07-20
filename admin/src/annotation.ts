import type { Annotation } from './types';

export interface PickedElement {
  selector: string;
  x: number;
  y: number;
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

/**
 * 开启取元素模式：hover 高亮，点击后回调元素信息。
 * 返回清理函数。
 */
export function enablePicking(doc: Document, onPick: (picked: PickedElement) => void): () => void {
  ensureStyle(doc);
  let hovered: Element | null = null;

  const onMouseOver = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.classList?.contains('ph-anno-marker')) return;
    hovered?.classList.remove('ph-anno-hover');
    hovered = target;
    hovered.classList.add('ph-anno-hover');
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.classList?.contains('ph-anno-marker')) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = target.getBoundingClientRect();
    const win = doc.defaultView!;
    onPick({
      selector: computeSelector(target),
      x: Math.round(rect.left + win.scrollX),
      y: Math.round(rect.top + win.scrollY),
    });
  };

  doc.addEventListener('mouseover', onMouseOver, true);
  doc.addEventListener('click', onClick, true);

  return () => {
    doc.removeEventListener('mouseover', onMouseOver, true);
    doc.removeEventListener('click', onClick, true);
    hovered?.classList.remove('ph-anno-hover');
  };
}

/** 在 iframe 文档中渲染批注标记点，返回清理函数 */
export function renderMarkers(doc: Document, annotations: Annotation[], onMarkerClick: (a: Annotation) => void): () => void {
  ensureStyle(doc);
  clearMarkers(doc);
  const created: Element[] = [];

  annotations.forEach((a, idx) => {
    if (!a.selector) return;
    const el = doc.querySelector(a.selector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const win = doc.defaultView!;
    const marker = doc.createElement('div');
    marker.className = `ph-anno-marker${a.status === 'done' ? ' ph-anno-done' : ''}`;
    marker.textContent = String(idx + 1);
    marker.style.left = `${rect.left + win.scrollX - 8}px`;
    marker.style.top = `${rect.top + win.scrollY - 8}px`;
    marker.title = a.text;
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      onMarkerClick(a);
    });
    doc.body.appendChild(marker);
    created.push(marker);
  });

  return () => created.forEach((m) => m.remove());
}

export function clearMarkers(doc: Document) {
  doc.querySelectorAll('.ph-anno-marker').forEach((m) => m.remove());
}
