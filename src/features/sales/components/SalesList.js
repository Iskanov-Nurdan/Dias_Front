import React, { useState, useEffect } from 'react';
import { Info, Receipt } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { getSaleStatusBadge } from '../saleStatus';
import './SalesList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');

const SalesList = ({
  items, loading, error, onRetry, onDetails, emptyMessage, onAdd,
}) => {
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
    <div className="sales-list__cards">
      {list.map((s, idx) => {
        const badge = getSaleStatusBadge(s);
        return (
          <article key={s.id} className="sales-list__card" style={{ '--row-i': idx }} onClick={() => onDetails(s)}>
            <span className="sales-list__avatar"><Receipt size={14} /></span>
            <div className="sales-list__card-info">
              <div className="sales-list__card-name">
                {s.sale_number || `#${s.id}`}
                {s.is_defect_sale && <span className="sales-list__badge sales-list__badge--defect">Брак</span>}
              </div>
              <div className="sales-list__card-sub">
                {s.client_name || s.client?.name || '—'} · {dateFmt(s.date)}
              </div>
              <div className="sales-list__card-meta">
                <span className="sales-list__amount">{money(s.revenue)}</span>
                <span className={`sales-list__status sales-list__status--${badge.modifier}`}>
                  <span className="sales-list__status-dot" />
                  {badge.label}
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="sales-list">
      <div className={isMobile ? '' : 'sales-list__panel'}>
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : !list.length ? (
          <div className="sales-list__empty-wrap">
            <EmptyState message={emptyMessage} actionLabel={onAdd ? 'Продать' : undefined} onAction={onAdd} />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="sales-list__table">
            <thead>
              <tr>
                <th>№ продажи</th>
                <th>Клиент</th>
                <th>Дата</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, idx) => {
                const badge = getSaleStatusBadge(s);
                return (
                  <tr key={s.id} style={{ '--row-i': idx }}>
                    <td>
                      <div className="sales-list__name-cell">
                        <span className="sales-list__avatar"><Receipt size={13} /></span>
                        <span className="sales-list__name-text">{s.sale_number || `#${s.id}`}</span>
                        {s.is_defect_sale && <span className="sales-list__badge sales-list__badge--defect">Брак</span>}
                      </div>
                    </td>
                    <td className="sales-list__muted">{s.client_name || s.client?.name || '—'}</td>
                    <td className="sales-list__muted">{dateFmt(s.date)}</td>
                    <td className="sales-list__amount">{money(s.revenue)}</td>
                    <td>
                      <span className={`sales-list__status sales-list__status--${badge.modifier}`}>
                        <span className="sales-list__status-dot" />
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="sales-list__icon-btn" title="Подробнее" onClick={() => onDetails(s)}><Info size={13} /></button>
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

export default SalesList;
