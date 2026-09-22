import React, { useState, useEffect } from 'react';
import { Factory } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import './ProductionRunsList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const STATUS_LABELS = {
  draft: 'Черновик',
  in_production: 'В производстве',
  otk_done: 'ОТК выполнен',
  gp_accepted: 'Принято на склад ГП',
};

const STATUS_MODIFIER = {
  draft: 'muted',
  in_production: 'info',
  otk_done: 'warning',
  gp_accepted: 'success',
};

const formatKg = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const ProductionRunsList = ({ items, loading, error, onRetry }) => {
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
    <div className="runs-list__cards">
      {list.map((row, idx) => {
        const modifier = STATUS_MODIFIER[row.status] || 'muted';
        return (
          <article key={row.id} className="runs-list__card" style={{ '--row-i': idx }}>
            <span className="runs-list__avatar"><Factory size={15} /></span>
            <div className="runs-list__card-info">
              <div className="runs-list__card-name">{row.blank_name}</div>
              <div className="runs-list__card-sub">
                <span className={`runs-list__status runs-list__status--${modifier}`}>
                  <span className="runs-list__status-dot" />
                  {STATUS_LABELS[row.status] || row.status}
                </span>
                <span className="runs-list__muted">{formatDateTime(row.created_at)}</span>
              </div>
            </div>
            <span className="runs-list__kg">{formatKg(row.blank_used_in_production_kg)}</span>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="runs-list">
      <div className={isMobile ? '' : 'runs-list__panel'}>
        {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : !list.length ? (
          <div className="runs-list__empty-wrap">
            <EmptyState message="Нет партий производства" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="runs-list__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Заготовка</th>
                <th>Списано с цеха</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, idx) => {
                const modifier = STATUS_MODIFIER[row.status] || 'muted';
                return (
                  <tr key={row.id} style={{ '--row-i': idx }}>
                    <td className="runs-list__muted">{formatDateTime(row.created_at)}</td>
                    <td>
                      <div className="runs-list__name-cell">
                        <span className="runs-list__avatar"><Factory size={13} /></span>
                        <span className="runs-list__name-text">{row.blank_name}</span>
                      </div>
                    </td>
                    <td className="runs-list__kg">{formatKg(row.blank_used_in_production_kg)}</td>
                    <td>
                      <span className={`runs-list__status runs-list__status--${modifier}`}>
                        <span className="runs-list__status-dot" />
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
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

export default ProductionRunsList;
