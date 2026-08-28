import React from 'react';
import './CompactList.scss';

/**
 * Таблица-список: 3–4 колонки + «Подробнее».
 *
 * @param {{ key: string, label: string, className?: string }[]} columns — до 4 видимых колонок
 * @param {object[]} items
 * @param {(item: object) => string|number} getRowKey
 * @param {(item: object, columnKey: string) => React.ReactNode} renderCell
 * @param {(item: object) => void} [onDetails]
 * @param {(item: object) => boolean} [showDetails] — по умолчанию всегда true если onDetails
 * @param {string|((item: object) => string)} [detailsLabel]
 * @param {(item: object) => string} [rowClassName]
 * @param {string} [className]
 */
export default function CompactList({
  columns,
  items,
  getRowKey,
  renderCell,
  onDetails,
  showDetails,
  detailsLabel = 'Подробнее',
  rowClassName,
  className = '',
}) {
  const cols = (columns || []).slice(0, 4);
  const gridCols = [...cols.map((c) => c.width || '1fr'), onDetails ? 'auto' : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`compact-list ${className}`.trim()} style={{ '--compact-cols': gridCols }}>
      <div className="compact-list__head" role="row">
        {cols.map((col) => (
          <span key={col.key} className={`compact-list__th${col.className ? ` ${col.className}` : ''}`}>
            {col.label}
          </span>
        ))}
        {onDetails ? (
          <span className="compact-list__th compact-list__th--actions" aria-hidden="true" />
        ) : null}
      </div>
      {items.map((item) => {
        const key = getRowKey(item);
        const canDetails = onDetails && (showDetails ? showDetails(item) : true);
        const extraRowClass = rowClassName ? rowClassName(item) : '';
        const label =
          typeof detailsLabel === 'function' ? detailsLabel(item) : detailsLabel;
        return (
          <div
            key={key}
            className={`compact-list__row${extraRowClass ? ` ${extraRowClass}` : ''}`}
            role="row"
          >
            {cols.map((col) => (
              <span
                key={col.key}
                className={`compact-list__cell${col.className ? ` ${col.className}` : ''}`}
                data-label={col.label}
              >
                {renderCell(item, col.key)}
              </span>
            ))}
            {onDetails ? (
              <span className="compact-list__actions">
                {canDetails ? (
                  <button
                    type="button"
                    className="compact-list__details-btn"
                    onClick={() => onDetails(item)}
                  >
                    {label}
                  </button>
                ) : (
                  <span className="compact-list__muted">—</span>
                )}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
