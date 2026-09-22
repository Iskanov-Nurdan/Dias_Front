import React, { useState, useEffect } from 'react';
import { Info, ClipboardCheck, ChevronRight } from 'lucide-react';
import { ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import './OtkHistoryList.scss';

const MOBILE_MQ = '(max-width: 768px)';

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const OtkHistoryList = ({ items, loading, error, onRetry, onDetails }) => {
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

  // Единственное действие над записью — «Подробнее», поэтому тап по всей
  // карточке уже и есть это действие: отдельное меню «⋯» тут избыточно.
  const renderMobileCards = () => (
    <div className="otk-history__cards">
      {list.map((row, idx) => (
        <article
          key={row.id}
          className="otk-history__card"
          style={{ '--row-i': idx }}
          onClick={() => onDetails(row)}
        >
          <span className="otk-history__avatar"><ClipboardCheck size={15} /></span>
          <div className="otk-history__card-info">
            <div className="otk-history__card-name">{row.blank_name}</div>
            <div className="otk-history__card-sub">
              <span>{formatKg(row.consumed_kg)} списано</span>
              {Number(row.defect_kg) > 0 && <span className="otk-history__card-defect">· {formatKg(row.defect_kg)} брак</span>}
            </div>
            <div className="otk-history__card-date">{formatDateTime(row.created_at)}</div>
          </div>
          <ChevronRight size={18} className="otk-history__card-chevron" />
        </article>
      ))}
    </div>
  );

  return (
    <div className="otk-history">
      <div className={isMobile ? '' : 'otk-history__panel'}>
        {loading ? (
          <SkeletonTable rows={8} cols={5} />
        ) : !list.length ? (
          <div className="otk-history__empty-wrap">
            <EmptyState message="Учётов пока нет" />
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          <table className="otk-history__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Заготовка</th>
                <th>Списано</th>
                <th>Брак</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, idx) => (
                <tr key={row.id} style={{ '--row-i': idx }}>
                  <td className="otk-history__muted">{formatDateTime(row.created_at)}</td>
                  <td>
                    <div className="otk-history__name-cell">
                      <span className="otk-history__avatar"><ClipboardCheck size={13} /></span>
                      <span className="otk-history__name-text">{row.blank_name}</span>
                    </div>
                  </td>
                  <td className="otk-history__kg">{formatKg(row.consumed_kg)}</td>
                  <td className={Number(row.defect_kg) > 0 ? 'otk-history__defect' : 'otk-history__muted'}>
                    {Number(row.defect_kg) > 0 ? formatKg(row.defect_kg) : '—'}
                  </td>
                  <td>
                    <button type="button" className="otk-history__icon-btn" title="Подробнее" onClick={() => onDetails(row)}><Info size={13} /></button>
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

export default OtkHistoryList;
