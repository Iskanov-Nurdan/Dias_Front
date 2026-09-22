import React, { useState, useEffect } from 'react';
import { Info, Package, MoreVertical } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable, ActionSheet } from '../../../shared/ui';
import './WarehouseStockList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const WarehouseStockList = ({ items, loading, error, onRetry, onDetails, emptyMessage }) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );
  const [menuRow, setMenuRow] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const list = items ?? [];

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const closeMenu = () => setMenuRow(null);

  const renderMobileCards = () => (
    <div className="warehouse-stock__cards">
      {list.map((row, idx) => {
        const hasDetails = row.breakdown.length > 1;
        return (
          <article
            key={row.productId}
            className="warehouse-stock__card"
            style={{ '--row-i': idx }}
            onClick={hasDetails ? () => onDetails(row) : undefined}
          >
            <span className="warehouse-stock__avatar"><Package size={14} /></span>
            <div className="warehouse-stock__card-info">
              <div className="warehouse-stock__card-name">{row.productName}</div>
              <div className="warehouse-stock__card-sub">{row.pieces.toLocaleString('ru-RU')} шт.</div>
            </div>
            {hasDetails && (
              <button
                type="button"
                className="warehouse-stock__card-menu-btn"
                aria-label="Действия"
                onClick={(e) => { e.stopPropagation(); setMenuRow(row); }}
              >
                <MoreVertical size={17} />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="warehouse-stock">
        <div className={isMobile ? '' : 'warehouse-stock__panel'}>
          {loading ? (
            <SkeletonTable rows={8} cols={2} />
          ) : !list.length ? (
            <div className="warehouse-stock__empty-wrap">
              <EmptyState message={emptyMessage} />
            </div>
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="warehouse-stock__table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Штук</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((row, idx) => (
                  <tr key={row.productId} style={{ '--row-i': idx }}>
                    <td>
                      <div className="warehouse-stock__name-cell">
                        <span className="warehouse-stock__avatar"><Package size={14} /></span>
                        <span className="warehouse-stock__name-text">{row.productName}</span>
                      </div>
                    </td>
                    <td className="warehouse-stock__pieces">{row.pieces.toLocaleString('ru-RU')}</td>
                    <td>
                      {row.breakdown.length > 1 && (
                        <button type="button" className="warehouse-stock__pill-btn" onClick={() => onDetails(row)}>
                          <Info size={13} /> Подробнее
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ActionSheet open={!!menuRow} onClose={closeMenu} title={menuRow?.productName}>
        <button type="button" className="action-sheet__item" onClick={() => { onDetails(menuRow); closeMenu(); }}>
          <Info size={17} /> Подробнее
        </button>
      </ActionSheet>
    </>
  );
};

export default WarehouseStockList;
