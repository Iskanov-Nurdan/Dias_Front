import React from 'react';
import './Pagination.scss';

const MAX_VISIBLE = 5;

const Pagination = ({ meta, currentPage, onPage, loading, entityLabel }) => {
  if (!meta || meta.totalPages <= 1) return null;
  const { total, totalPages } = meta;

  const half = Math.floor(MAX_VISIBLE / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + MAX_VISIBLE - 1);
  if (end - start + 1 < MAX_VISIBLE) {
    start = Math.max(1, end - MAX_VISIBLE + 1);
  }
  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="pagination">
      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage <= 1 || loading}
        aria-label="Предыдущая страница"
      >
        ‹
      </button>
      {start > 1 && (
        <>
          <button type="button" className="pagination__btn" onClick={() => onPage(1)} disabled={loading}>1</button>
          {start > 2 && <span className="pagination__ellipsis">…</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`pagination__btn${currentPage === p ? ' pagination__btn--active' : ''}`}
          onClick={() => onPage(p)}
          disabled={loading}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="pagination__ellipsis">…</span>}
          <button type="button" className="pagination__btn" onClick={() => onPage(totalPages)} disabled={loading}>{totalPages}</button>
        </>
      )}
      <button
        type="button"
        className="pagination__btn"
        onClick={() => onPage(currentPage + 1)}
        disabled={currentPage >= totalPages || loading}
        aria-label="Следующая страница"
      >
        ›
      </button>
      {total != null && (
        <span className="pagination__info">
          {total}{entityLabel ? ` ${entityLabel}` : ''}, стр. {currentPage} из {totalPages}
        </span>
      )}
    </div>
  );
};

export default Pagination;
