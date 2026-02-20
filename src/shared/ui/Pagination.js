import React from 'react';
import './Pagination.scss';

const Pagination = ({ meta, currentPage, onPage, loading, entityLabel }) => {
  if (!meta || meta.totalPages <= 1) return null;
  const { total, totalPages } = meta;

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
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
