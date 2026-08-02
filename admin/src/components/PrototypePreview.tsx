import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // 用 ref 记录上次值，实现增量 diff 而非整体重挂载
  const prevRefreshRef = useRef(refreshKey);
  const prevUrlRef = useRef<string | null>(null);

  const getDoc = () => iframeRef.current?.contentDocument ?? null;

  const stopPicking = () => {
    pickingCleanupRef.current?.();
    pickingCleanupRef.current = null;
  };

  // ── 唯一的 src 管理：挂载初始加载 + 切换原型 + 刷新，全走此处 ──
  // iframe 的 key 固定为 "preview-frame"，DOM 节点永不销毁
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const isInit = prevUrlRef.current === null;
    const isUrlChange = prevUrlRef.current !== item.url;
    const isRefresh = prevRefreshRef.current !== refreshKey;

    // 跳过无效触发
    if (!isInit && !isUrlChange && !isRefresh) return;

    // 非初始化时做清理
    if (!isInit) {
      setLoading(true);
      setIframeError(false);
      stopPicking();
      markerCleanupRef.current?.();
    }

    prevRefreshRef.current = refreshKey;
    prevUrlRef.current = item.url;

    // URL 变化优先：导航到新页面（即便 refreshKey 也同时变化）
    if (isUrlChange) {
      iframe.src = item.url;
    } else if (isRefresh) {
      // 仅刷新、URL 未变：原地 reload
      iframe.src = iframe.src;
    }
    // isInit 是首次挂载，src 已在上面用 item.url 设置，不需要再设
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.url, refreshKey]);

  // ── 批注模式开关 ──
  useEffect(() => {
    if (!annotationMode) {
      stopPicking();
      return;
    }
    const doc = getDoc();
    if (!doc) return;
    pickingCleanupRef.current = enablePicking(doc, onPick);
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

  // ── 渲染批注标记 ──
  useEffect(() => {
    const doc = getDoc();
    if (!doc) return;
    markerCleanupRef.current?.();
    const { cleanup, orphan } = renderMarkers(doc, annotations, onMarkerClick);
    markerCleanupRef.current = cleanup;
    onOrphans?.(orphan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, refreshKey, item.name]);

  // ── iframe onLoad：隐藏 loading，注入批注标记和点击监听 ──
  const handleLoad = useCallback(() => {
    setLoading(false);
    setIframeError(false);
    const doc = getDoc();
    if (!doc) return;
    try {
      const { cleanup, orphan } = renderMarkers(doc, annotations, onMarkerClick);
      markerCleanupRef.current = cleanup;
      onOrphans?.(orphan);
      if (annotationMode) {
        stopPicking();
        pickingCleanupRef.current = enablePicking(doc, onPick);
      }
    } catch {
      // 跨域或 sandbox 限制导致 doc 不可用，忽略
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, annotationMode, onPick, onMarkerClick, onOrphans]);

  const handleError = useCallback(() => {
    setIframeError(true);
    setLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setIframeError(false);
    setLoading(true);
    const iframe = iframeRef.current;
    if (iframe) iframe.src = iframe.src;
  }, []);

  return (
    <div className="ph-stage">
      <div className="ph-iframe-wrap" style={{ width: DEVICE_WIDTH[device], maxWidth: '100%' }}>
        {/* 加载遮罩：半透明，旧页面内容透出，避免白屏 */}
        {loading && !iframeError && (
          <div className="ph-iframe-loader-overlay">
            <div className="ph-loader-dots">
              <div className="ph-loader-dot" />
              <div className="ph-loader-dot" />
              <div className="ph-loader-dot" />
            </div>
            <span className="ph-loader-text">加载中</span>
          </div>
        )}
        {iframeError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--ph-bg)',
              zIndex: 1,
              borderRadius: 8,
              gap: 12,
            }}
          >
            <span style={{ color: 'var(--ph-text-secondary)', fontSize: 14 }}>原型页面加载失败</span>
            <Button icon={<ReloadOutlined />} onClick={handleRetry}>重试</Button>
          </div>
        )}
        {/* 固定 key：iframe DOM 永不销毁，src 完全由下方的 useEffect 通过 .src= 赋值管理，
            避免 React 因 src prop 变化而重复触发导航 */}
        <iframe
          key="preview-frame"
          ref={iframeRef}
          className="ph-iframe"
          title={item.title}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    </div>
  );
}
