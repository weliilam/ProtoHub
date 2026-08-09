import React from 'react';

export interface FilterOption {
  value: string | number;
  label: string;
}

export interface ClientFilterField {
  key: string;
  label: string;
  type?: 'input' | 'select';
  width?: number;
  options?: FilterOption[];
}

export interface FilterButton {
  key: string;
  label: string;
  onClick: () => void;
}

export interface ClientFilterPanelProps {
  fields: ClientFilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSearch: () => void;
  onReset?: () => void;
  /** 查询按钮文案，默认「查询(&F)」 */
  searchText?: string;
  /** 查询按钮图标路径 */
  searchIcon?: string;
  /** 额外按钮（显示在查询/重置右侧） */
  extraButtons?: FilterButton[];
  /** 是否隐藏查询/重置按钮（用于更多查询条件行） */
  hideSearch?: boolean;
}

/**
 * ClientFilterPanel —— 筛选面板（WhiteSmoke 底、Label 右侧对齐、控件紧凑）。
 * 布局采用 flex 自动换行，控件尺寸还原 frmProductManage（下拉143x25 / 输入150）。
 */
const ClientFilterPanel: React.FC<ClientFilterPanelProps> = ({
  fields,
  values,
  onChange,
  onSearch,
  onReset,
  searchText = '查询(&F)',
  searchIcon,
  extraButtons,
  hideSearch,
}) => {
  return (
    <div className="client-filter">
      <div className="client-filter-row">
        {fields.map((f) => {
          const value = values[f.key] ?? '';
          if (f.type === 'select') {
            return (
              <div className="client-filter-item" key={f.key}>
                <label>{f.label}</label>
                <select
                  className="client-select"
                  style={f.width ? { width: f.width } : undefined}
                  value={value}
                  onChange={(e) => onChange(f.key, e.target.value)}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div className="client-filter-item" key={f.key}>
              <label>{f.label}</label>
              <input
                className="client-input"
                style={f.width ? { width: f.width } : undefined}
                value={value}
                placeholder=""
                onChange={(e) => onChange(f.key, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch();
                }}
              />
            </div>
          );
        })}
        {!hideSearch && (
          <div className="client-filter-item">
            <button type="button" className="client-btn" onClick={onSearch}>
              {searchIcon && <img src={searchIcon} alt="" draggable={false} />}
              {searchText}
            </button>
            {onReset && (
              <button type="button" className="client-btn" onClick={onReset}>
                重置
              </button>
            )}
            {extraButtons?.map((btn) => (
              <button key={btn.key} type="button" className="client-btn" onClick={btn.onClick}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientFilterPanel;
