import React from 'react';

export interface GridColumn<T = any> {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** 自定义单元格渲染 */
  render?: (row: T, index: number) => React.ReactNode;
}

export interface ClientTableProps<T = any> {
  columns: GridColumn<T>[];
  dataSource: T[];
  rowKey?: (row: T, index: number) => string;
  /** 当前选中行 key */
  selectedKey?: string | null;
  onSelectRow?: (row: T) => void;
  /** 是否显示首列复选框列（colSelect，30px） */
  showCheckbox?: boolean;
  checkedKeys?: string[];
  onCheck?: (keys: string[], rows: T[]) => void;
  /** 单元格默认居中显示的列 key（复选框、状态列等） */
  centerKeys?: string[];
  /** 空数据文案 */
  emptyText?: string;
}

/**
 * ClientTable —— 数据网格（DataGridView 风格：灰表头、行高23px、网格线、选中蓝、复选框列）。
 * 自绘 table，完全对齐 WinForms 观感。
 */
const ClientTable = <T extends Record<string, any>>({
  columns,
  dataSource,
  rowKey,
  selectedKey,
  onSelectRow,
  showCheckbox = true,
  checkedKeys = [],
  onCheck,
  centerKeys = [],
  emptyText = '无数据',
}: ClientTableProps<T>) => {
  const getKey = (row: T, i: number) => (rowKey ? rowKey(row, i) : String(i));
  const isChecked = (key: string) => checkedKeys.includes(key);

  const toggleCheck = (row: T, i: number) => {
    if (!onCheck) return;
    const key = getKey(row, i);
    const next = isChecked(key)
      ? checkedKeys.filter((k) => k !== key)
      : [...checkedKeys, key];
    const rows = dataSource.filter((r, idx) => next.includes(getKey(r, idx)));
    onCheck(next, rows);
  };

  return (
    <div className="client-grid-wrap">
      <table className="client-grid">
        <thead>
          <tr>
            {showCheckbox && (
              <th className="client-col-check">
                <span
                  className={`client-cell-check${
                    dataSource.length > 0 && checkedKeys.length === dataSource.length
                      ? ' is-checked'
                      : ''
                  }`}
                  onClick={() => {
                    if (!onCheck) return;
                    if (checkedKeys.length === dataSource.length) {
                      onCheck([], []);
                    } else {
                      const keys = dataSource.map((r, i) => getKey(r, i));
                      onCheck(keys, dataSource);
                    }
                  }}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  width: c.width,
                  textAlign: c.align ?? 'left',
                }}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (showCheckbox ? 1 : 0)}
                style={{ textAlign: 'center', color: '#888', padding: 24 }}
              >
                {emptyText}
              </td>
            </tr>
          )}
          {dataSource.map((row, i) => {
            const key = getKey(row, i);
            const selected = selectedKey != null && selectedKey === key;
            return (
              <tr
                key={key}
                className={selected ? 'client-row-selected' : ''}
                onClick={() => onSelectRow?.(row)}
                style={{ cursor: onSelectRow ? 'default' : undefined }}
              >
                {showCheckbox && (
                  <td
                    className="client-col-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`client-cell-check${isChecked(key) ? ' is-checked' : ''}`}
                      onClick={() => toggleCheck(row, i)}
                    />
                  </td>
                )}
                {columns.map((c) => {
                  const center = c.align === 'center' || centerKeys.includes(c.key);
                  return (
                    <td
                      key={c.key}
                      style={{
                        width: c.width,
                        textAlign: center ? 'center' : c.align ?? 'left',
                      }}
                      onClick={() => onSelectRow?.(row)}
                    >
                      {c.render ? c.render(row, i) : (row[c.key] ?? '')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ClientTable;
