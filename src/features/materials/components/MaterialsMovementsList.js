import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { movementTypeLabel } from '../movementTypes';
import './MaterialsMovementsList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const unitLabel = (unit) => (unit === 'g' ? 'г' : 'кг');

const formatQty = (value, unit) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} ${unitLabel(unit)}`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const MaterialsMovementsList = ({ items, loading, error, onRetry }) => {
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
    <div className="materials-movements__cards">
      {list.map((row, idx) => {
        const isIn = Number(row.quantity) > 0;
        return (
          <article key={row.id} className="materials-movements__card" style={{ '--row-i': idx }}>
            <span className={`materials-movements__dir-icon materials-movements__dir-icon--${isIn ? 'in' : 'out'}`}>
              {isIn ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
            </span>
            <div className="materials-movements__card-info">
              <div className="materials-movements__card-name">{row.material_name}</div>
              <div className="materials-movements__card-sub">
                <span className={`materials-movements__type-pill materials-movements__type-pill--${isIn ? 'in' : 'out'}`}>
                  {movementTypeLabel(row.movement_type)}
                </span>
                <span className="materials-movements__muted">{formatDateTime(row.occurred_at)}</span>
              </div>
            </div>
            <span className={isIn ? 'materials-movements__qty--in' : 'materials-movements__qty--out'}>
              {formatQty(row.quantity, row.unit)}
            </span>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="materials-movements">
      <div className="materials-movements__panel">
        {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : !list.length ? (
          <div className="materials-movements__empty-wrap">
            <EmptyState message="Нет записей движения" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="materials-movements__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сырьё</th>
                <th>Тип</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, idx) => {
                const isIn = Number(row.quantity) > 0;
                return (
                  <tr key={row.id} style={{ '--row-i': idx }}>
                    <td className="materials-movements__muted">{formatDateTime(row.occurred_at)}</td>
                    <td>
                      <div className="materials-movements__name-cell">
                        <span className={`materials-movements__dir-icon materials-movements__dir-icon--${isIn ? 'in' : 'out'}`}>
                          {isIn ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
                        </span>
                        {row.material_name}
                      </div>
                    </td>
                    <td>
                      <span className={`materials-movements__type-pill materials-movements__type-pill--${isIn ? 'in' : 'out'}`}>
                        {movementTypeLabel(row.movement_type)}
                      </span>
                    </td>
                    <td className={isIn ? 'materials-movements__qty--in' : 'materials-movements__qty--out'}>
                      {formatQty(row.quantity, row.unit)}
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

export default MaterialsMovementsList;
