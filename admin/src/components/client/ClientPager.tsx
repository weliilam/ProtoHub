import React from 'react';

export interface ClientPagerProps {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
}

/**
 * ClientPager —— 底部原生分页控件（记录总数 + 页码按钮 + 每页条数）。
 */
const ClientPager: React.FC<ClientPagerProps> = ({ total, page, pageSize, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const go = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onChange(p, pageSize);
  };

  // 页码窗口：最多 5 个
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="client-pager">
      <span>共 {total} 条记录</span>
      <button
        type="button"
        className="client-pager-btn"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        上一页
      </button>
      {start > 1 && (
        <>
          <button type="button" className="client-pager-btn" onClick={() => go(1)}>
            1
          </button>
          {start > 2 && <span style={{ color: '#666' }}>…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          type="button"
          key={p}
          className={`client-pager-btn${p === page ? ' is-current' : ''}`}
          onClick={() => go(p)}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ color: '#666' }}>…</span>}
          <button
            type="button"
            className="client-pager-btn"
            onClick={() => go(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        type="button"
        className="client-pager-btn"
        disabled={page >= totalPages}
        onClick={() => go(page + 1)}
      >
        下一页
      </button>
      <select
        className="client-select"
        value={pageSize}
        onChange={(e) => onChange(1, Number(e.target.value))}
      >
        {[10, 20, 50, 100].map((s) => (
          <option key={s} value={s}>
            {s} 条/页
          </option>
        ))}
      </select>
    </div>
  );
};

export default ClientPager;
