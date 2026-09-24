import React, { useEffect, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { FormModal, ErrorState, EmptyState, SkeletonTable } from '../../../shared/ui';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchDashboardDetails } from '../api';
import { money, dateRu } from '../format';

const PAGE = 50;

/**
 * Расшифровка KPI: из чего сложилась цифра (формула по слагаемым) + сами
 * записи (продажи, платежи, расходы). Всё считает сервер — здесь только вывод.
 */
const KpiDetailsModal = ({ kpi, range, onClose }) => {
  const [data, setData] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    setShown(PAGE);
    fetchDashboardDetails({ ...range, metric: kpi.key }, controller.signal)
      .then(setData)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); });
    return () => controller.abort();
  }, [kpi.key, range]);

  return (
    <FormModal
      icon={Calculator}
      eyebrow={`${dateRu(range.dateFrom)} — ${dateRu(range.dateTo)}`}
      title={kpi.label}
      onClose={onClose}
      size="fullscreen"
      className="an-details"
    >
      <div className="form-modal__form">
        <div className="form-modal__body">
          {error && <ErrorState message={error} compact />}
          {!error && !data && <SkeletonTable rows={6} cols={2} />}
          {data && (
            <>
              <div className="an-details__formula">
                {data.formula.map((f, i) => (
                  <div key={`${f.label}-${i}`} className={`an-details__f-row${f.total ? ' an-details__f-row--total' : ''}`}>
                    <span className="an-details__f-sign">{f.sign}</span>
                    <span className="an-details__f-label">{f.label}</span>
                    <span className="an-details__f-amount">{money(f.amount)}</span>
                  </div>
                ))}
              </div>
              <p className="an-details__note"><Info size={14} /> {data.note}</p>

              <h3 className="an-details__title">Записи <em>{data.items.length}</em></h3>
              {data.items.length === 0 ? <EmptyState compact message="За период записей нет" /> : (
                <ul className="an-details__list">
                  {data.items.slice(0, shown).map((it, i) => (
                    <li key={`${it.kind}-${it.title}-${i}`} style={{ '--row-i': Math.min(i, 20) }}>
                      <span className="an-details__main">
                        <strong>{it.title}{it.estimated && <em className="an-details__est">оценка</em>}</strong>
                        <small>{[it.date && dateRu(it.date), it.subtitle].filter(Boolean).join(' · ')}</small>
                      </span>
                      <span className={`an-details__amount${Number(it.amount) < 0 ? ' an-details__amount--neg' : ''}`}>{money(it.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.items.length > shown && (
                <button type="button" className="an-page__more" onClick={() => setShown((n) => n + PAGE)}>
                  Показать ещё {Math.min(PAGE, data.items.length - shown)} из {data.items.length - shown}
                </button>
              )}
              {data.items.length >= 500 && shown >= data.items.length && <p className="an-details__note">Показаны первые 500 записей.</p>}
            </>
          )}
        </div>
        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </FormModal>
  );
};

export default KpiDetailsModal;
