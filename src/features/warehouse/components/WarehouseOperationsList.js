import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import './WarehouseOperationsList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const KIND_LABELS = {
  otk_account: 'Приход (ОТК)',
  accept: 'Приход (ОТК)',
  sale: 'Продажа',
  return: 'Возврат',
  defect: 'Брак',
  package: 'Упаковка',
  rework: 'Переделка',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const WarehouseOperationsList = ({ items, loading, error, onRetry }) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const list = items ?? [];

  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const renderMobileCards = () => (
    <div className="warehouse-ops__cards">
      {list.map((row, idx) => {
        const isIn = row.direction === 'in';
        return (
          <article key={row.id} className="warehouse-ops__card" style={{ '--row-i': idx }}>
            <span className={`warehouse-ops__dir-icon warehouse-ops__dir-icon--${isIn ? 'in' : 'out'}`}>
              {isIn ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
            </span>
            <div className="warehouse-ops__card-info">
              <div className="warehouse-ops__card-name">{row.product_name}</div>
              <div className="warehouse-ops__card-sub">
                <span className={`warehouse-ops__kind-pill warehouse-ops__kind-pill--${isIn ? 'in' : 'out'}`}>
                  {row.kind_label || KIND_LABELS[row.kind] || row.kind}
                </span>
                <span className="warehouse-ops__card-date">{formatDateTime(row.at ?? row.created_at)}</span>
              </div>
            </div>
            <span className={isIn ? 'warehouse-ops__pieces--in' : 'warehouse-ops__pieces--out'}>
              {isIn ? '+' : '−'}{Math.abs(Number(row.pieces) || 0).toLocaleString('ru-RU')}
            </span>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="warehouse-ops">
      <div className={isMobile ? '' : 'warehouse-ops__panel'}>
        {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : !list.length ? (
          <div className="warehouse-ops__empty-wrap">
            <EmptyState message="Движений пока нет" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="warehouse-ops__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Операция</th>
                <th>Товар</th>
                <th>Штук</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, idx) => {
                const isIn = row.direction === 'in';
                return (
                  <tr key={row.id} style={{ '--row-i': idx }}>
                    <td className="warehouse-ops__muted">{formatDateTime(row.at ?? row.created_at)}</td>
                    <td>
                      <div className="warehouse-ops__kind-cell">
                        <span className={`warehouse-ops__dir-icon warehouse-ops__dir-icon--${isIn ? 'in' : 'out'}`}>
                          {isIn ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
                        </span>
                        <span className={`warehouse-ops__kind-pill warehouse-ops__kind-pill--${isIn ? 'in' : 'out'}`}>
                          {row.kind_label || KIND_LABELS[row.kind] || row.kind}
                        </span>
                      </div>
                    </td>
                    <td>{row.product_name}</td>
                    <td className={isIn ? 'warehouse-ops__pieces--in' : 'warehouse-ops__pieces--out'}>
                      {isIn ? '+' : '−'}{Math.abs(Number(row.pieces) || 0).toLocaleString('ru-RU')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default WarehouseOperationsList;
