import React from 'react';

export interface ClientToolbarItem {
  key: string;
  label?: string;
  /** 图标路径（public 绝对路径，如 /icons/toolbar/btn_View_Image.png） */
  icon?: string;
  /** true 表示在按钮前插入分隔符 */
  separatorBefore?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ClientToolbarProps {
  items: ClientToolbarItem[];
}

/**
 * ClientToolbar —— 顶部工具栏（ToolStrip 风格：图标+文字按钮组、竖分隔符）。
 */
const ClientToolbar: React.FC<ClientToolbarProps> = ({ items }) => {
  return (
    <div className="client-toolbar">
      {items
        .filter((it) => !it.hidden)
        .map((it) => (
          <React.Fragment key={it.key}>
            {it.separatorBefore && <div className="client-toolbar-sep" />}
            <button
              type="button"
              className={`client-toolbar-btn${it.disabled ? ' is-disabled' : ''}`}
              disabled={it.disabled}
              onClick={it.onClick}
              title={it.label}
            >
              {it.icon && <img src={it.icon} alt="" draggable={false} />}
              {it.label}
            </button>
          </React.Fragment>
        ))}
    </div>
  );
};

export default ClientToolbar;
