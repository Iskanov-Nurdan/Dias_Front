import React from 'react';
import './Pagination.scss';

const Pagination = ({ meta, onPageChange }) => {
  if (!meta) return null;

  const { page, pages, total } = meta;
  if (!pages || pages <= 1) return null;

  const getPages = () => {
    const result = [];
    const delta = 2;
    const left = Math.max(1, page - delta);
    const right = Math.min(pages, page + delta);

    if (left > 1) {
      result.push(1);
      if (left > 2) result.push('...');
    }
    for (let i = left; i <= right; i++) result.push(i);
    if (right < pages) {
      if (right < pages - 1) result.push('...');
      result.push(pages);
    }
    return result;
  };

  return (
    <nav className="pagination" aria-label="Пагинация">
      {total !== undefined && (
        <span className="pagination__info">Всего: {total}</span>
      )}
      <div className="pagination__pages">
        <button
          type="button"
          className="pagination__btn pagination__btn--prev"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Предыдущая страница"
        >
          ←
        </button>

        {getPages().map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="pagination__ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pagination__btn${p === page ? ' pagination__btn--active' : ''}`}
              onClick={() => p !== page && onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="pagination__btn pagination__btn--next"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Следующая страница"
        >
          →
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
