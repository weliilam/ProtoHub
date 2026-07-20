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
}

const DEVICE_WIDTH: Record<Props['device'], string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export default function PrototypePreview(props: Props) {
  const { item, device, refreshKey, annotationMode, annotations, onPick, onMarkerClick } = props;
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
    return stopPicking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationMode, refreshKey, item.name]);

  // 渲染批注标记
  useEffect(() => {
    const doc = getDoc();
    if (!doc) return;
    markerCleanupRef.current?.();
    markerCleanupRef.current = renderMarkers(doc, annotations, onMarkerClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, refreshKey, item.name]);

  // iframe 加载完成后重渲染标记 & 批注模式
  const handleLoad = () => {
    const doc = getDoc();
    if (!doc) return;
    markerCleanupRef.current = renderMarkers(doc, annotations, onMarkerClick);
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
