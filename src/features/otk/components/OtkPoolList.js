import React, { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import './OtkPoolList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

const OtkPoolList = ({ items, loading, error, onRetry }) => {
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
    <div className="otk-pool__cards">
      {list.map((row, idx) => (
        <article key={row.blank_id} className="otk-pool__card" style={{ '--row-i': idx }}>
          <span className="otk-pool__avatar"><Layers size={15} /></span>
          <div className="otk-pool__card-info">
            <div className="otk-pool__card-name">{row.blank_name}</div>
            <div className="otk-pool__card-sub">{formatKg(row.remaining_kg)} в ОТК</div>
          </div>
          {row.can_account ? (
            <span className="otk-pool__status otk-pool__status--warning">
              <span className="otk-pool__status-dot" /> Нужен учёт
            </span>
          ) : (
            <span className="otk-pool__status otk-pool__status--muted">
              <span className="otk-pool__status-dot" /> Использовано
            </span>
          )}
        </article>
      ))}
    </div>
  );

  return (
    <div className="otk-pool">
      <div className={isMobile ? '' : 'otk-pool__panel'}>
        {loading ? (
          <SkeletonTable rows={8} cols={3} />
        ) : !list.length ? (
          <div className="otk-pool__empty-wrap">
            <EmptyState message="В очереди ОТК пусто" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="otk-pool__table">
            <thead>
              <tr>
                <th>Заготовка</th>
                <th>Кг в ОТК</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, idx) => (
                <tr key={row.blank_id} style={{ '--row-i': idx }}>
                  <td>
                    <div className="otk-pool__name-cell">
                      <span className="otk-pool__avatar"><Layers size={14} /></span>
                      <span className="otk-pool__name-text">{row.blank_name}</span>
                    </div>
                  </td>
                  <td className="otk-pool__kg">{formatKg(row.remaining_kg)}</td>
                  <td>
                    {row.can_account ? (
                      <span className="otk-pool__status otk-pool__status--warning">
                        <span className="otk-pool__status-dot" /> Нужен учёт
                      </span>
                    ) : (
                      <span className="otk-pool__status otk-pool__status--muted">
                        <span className="otk-pool__status-dot" /> Использовано
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default OtkPoolList;
