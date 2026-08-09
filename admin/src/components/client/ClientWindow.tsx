import React from 'react';

export interface ClientWindowProps {
  open: boolean;
  title: string;
  icon?: string;
  width?: number;
  height?: number;
  onClose: () => void;
  /** 底部按钮区（通常放 保存/取消），不传则无 footer */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * ClientWindow —— WinForms 风格模态弹窗：
 * 自定义标题栏（图标+标题+关闭按钮）+ 内容区 + 底部按钮组，屏幕居中。
 */
const ClientWindow: React.FC<ClientWindowProps> = ({
  open,
  title,
  icon,
  width = 640,
  height = 480,
  onClose,
  footer,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="client-window-mask" onClick={onClose}>
      <div
        className="client-window"
        style={{ width, height }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="client-window-titlebar">
          {icon && (
            <img className="client-window-icon" src={icon} alt="" draggable={false} />
          )}
          <div className="client-window-title">{title}</div>
          <button
            type="button"
            className="client-window-btn"
            title="关闭"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="client-window-body">{children}</div>
        {footer && <div className="client-window-footer">{footer}</div>}
      </div>
    </div>
  );
};

export default ClientWindow;
