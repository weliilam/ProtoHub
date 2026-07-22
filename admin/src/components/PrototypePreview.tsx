import { useEffect, useRef } from 'react';
import { enablePicking, renderMarkers, type PickedElement } from '../annotation';
import type { Annotation, EntryItem } from '../types';

interface Props {
  item: EntryItem;
  device: 'desktop' | 'tablet' | 'mobile';
  refreshKey: number;
  annotationMode: boolean;
  annotations: Annotation[];
  onPick: (picked: PickedElement) => void;
  onMarkerClick: (a: Annotation) => void;
  onCancelPick: () => void;
  onUndo: () => void;
  /** 找不到对应元素的失效批注（可能已被 AI 删除/结构变化） */
  onOrphans?: (orphan: Annotation[]) => void;
}

const DEVICE_WIDTH: Record<Props['device'], string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export default function PrototypePreview(props: Props) {
  const { item, device, refreshKey, annotationMode, annotations, onPick, onMarkerClick, onCancelPick, onUndo, onOrphans } = props;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pickingCleanupRef = useRef<(() => void) | null>(null);
  const markerCleanupRef = useRef<(() => void) | null>(null);

  const getDoc = () => iframeRef.current?.contentDocument ?? null;

  const stopPicking = () => {
    pickingCleanupRef.current?.();
    pickingCleanupRef.current = null;
  };

  // 批注模式开关
  useEffect(() => {
    if (!annotationMode) {
      stopPicking();
      return;
    }
    const doc = getDoc();
    if (!doc) return;
    pickingCleanupRef.current = enablePicking(doc, onPick);
    // iframe 内的按键事件不会冒泡到父窗口，单独在 iframe 文档上监听 ESC 取消与 Ctrl/Cmd+Z 撤销
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancelPick();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      }
    };
    doc.addEventListener('keydown', onKey);
    return () => {
      stopPicking();
      doc.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationMode, refreshKey, item.name]);

  // 渲染批注标记
  useEffect(() => {
    const doc = getDoc();
    if (!doc) return;
    markerCleanupRef.current?.();
    const { cleanup, orphan } = renderMarkers(doc, annotations, onMarkerClick);
    markerCleanupRef.current = cleanup;
    onOrphans?.(orphan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, refreshKey, item.name]);

  // iframe 加载完成后重渲染标记 & 批注模式
  const handleLoad = () => {
    const doc = getDoc();
    if (!doc) return;
    const { cleanup, orphan } = renderMarkers(doc, annotations, onMarkerClick);
    markerCleanupRef.current = cleanup;
    onOrphans?.(orphan);
    if (annotationMode) {
      stopPicking();
      pickingCleanupRef.current = enablePicking(doc, onPick);
    }
  };

  return (
    <div className="ph-stage">
      <div className="ph-iframe-wrap" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}>
        <iframe
          key={`${item.type}-${item.name}-${refreshKey}`}
          ref={iframeRef}
          className="ph-iframe"
          src={item.url}
          title={item.title}
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
}
