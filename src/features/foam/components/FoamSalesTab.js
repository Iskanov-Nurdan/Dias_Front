import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { fetchFoamSales } from '../api';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import {
  ErrorState, EmptyState, SkeletonTable, Pagination, Fab, ProductLineTabs, PeriodFilter,
} from '../../../shared/ui';
import { STATS_YEARS } from '../../../shared/constants/common';
import FoamRegisterModal from './FoamRegisterModal';
import './FoamSalesTab.scss';

const MOBILE_MQ = '(max-width: 768px)';

const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');
const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const PAYMENT_LABEL = { paid: 'Оплачено', partial: 'Частично', debt: 'В долг' };

const NOW = new Date();
const CURRENT_YEAR_STR = String(NOW.getFullYear());
// Тот же дефолт и тот же PeriodFilter, что на вкладке «Пластиковый профиль»
// (см. SalesPage.js) — один вид фильтра периода на всю «Кассу», не два.
const DEFAULT_YEAR = STATS_YEARS.includes(CURRENT_YEAR_STR) ? CURRENT_YEAR_STR : STATS_YEARS[STATS_YEARS.length - 1];
const DEFAULT_MONTH = String(NOW.getMonth() + 1);
const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

/**
 * line/onLineChange — переключатель «Профиль/Пенопласт» рендерится ЗДЕСЬ,
 * а не в SalesPage поверх этого таба: раньше SalesPage сам рисовал
 * ProductLineTabs без action (кнопка «Продать» уезжала отдельной строкой
 * ниже, своя вёрстка), теперь ровно как на вкладке профиля — вкладки и
 * «Продать» в одной строке через action-слот одного и того же компонента.
 */
const FoamSalesTab = ({ line, onLineChange }) => {
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [day, setDay] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
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

  const isDefaultPeriod = year === DEFAULT_YEAR && month === DEFAULT_MONTH && day === '';
  const y = Number(year);
  const m = Number(month);
  const dateFrom = day ? `${year}-${pad2(m)}-${pad2(Number(day))}` : `${year}-${pad2(m)}-01`;
  const dateTo = day ? dateFrom : `${year}-${pad2(m)}-${pad2(daysInMonth(y, m))}`;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchFoamSales({ page, pageSize: 20, dateFrom, dateTo }, null)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dateFrom, dateTo]);

  const resetPeriod = () => { setYear(DEFAULT_YEAR); setMonth(DEFAULT_MONTH); setDay(''); };

  const renderMobileCards = () => (
    <div className="foam-sales__cards">
      {data.items.map((s, idx) => (
        <article key={s.id} className="foam-sales__card" style={{ '--row-i': idx }}>
          <span className="foam-sales__avatar"><Receipt size={14} /></span>
          <div className="foam-sales__card-info">
            <div className="foam-sales__card-name">{s.client}</div>
            <div className="foam-sales__card-sub">{dateFmt(s.date)} · Оплачено {money(s.paid_amount)}</div>
          </div>
          <div className="foam-sales__card-meta">
            <span className="foam-sales__amount">{money(s.total_amount)}</span>
            <span className={`foam-sales__status foam-sales__status--${s.payment_status}`}>
              {PAYMENT_LABEL[s.payment_status] || s.payment_status}
            </span>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className="foam-sales">
      <ProductLineTabs
        value={line}
        onChange={onLineChange}
        action={(
          <button type="button" className="foam-sales__add" onClick={() => setRegisterOpen(true)}>
            <Plus size={16} /> Продать
          </button>
        )}
      />

      <div className="foam-sales__toolbar">
        <PeriodFilter
          year={year} month={month} day={day}
          onYear={setYear} onMonth={setMonth} onDay={setDay}
          onReset={resetPeriod}
          isDefault={isDefaultPeriod}
        />
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : (
        <div className={isMobile ? '' : 'ui-list__table-wrap'}>
          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : !(data?.items?.length) ? (
            <EmptyState message="Продаж пока нет" actionLabel="Продать" onAction={() => setRegisterOpen(true)} />
          ) : isMobile ? (
            renderMobileCards()
          ) : (
            <table className="ui-list__table foam-sales__table">
              <thead><tr><th>Клиент</th><th>Дата</th><th>Сумма</th><th>Оплачено</th><th>Статус</th></tr></thead>
              <tbody>
                {data.items.map((s, idx) => (
                  <tr key={s.id} style={{ '--row-i': idx }}>
                    <td>{s.client}</td>
                    <td>{dateFmt(s.date)}</td>
                    <td className="foam-sales__amount">{money(s.total_amount)}</td>
                    <td>{money(s.paid_amount)}</td>
                    <td>
                      <span className={`foam-sales__status foam-sales__status--${s.payment_status}`}>
                        {PAYMENT_LABEL[s.payment_status] || s.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <Pagination meta={data?.meta} currentPage={page} onPage={setPage} loading={loading} entityLabel="продаж" />

      {registerOpen && (
        <FoamRegisterModal
          onClose={() => setRegisterOpen(false)}
          onSaved={load}
        />
      )}

      <Fab onClick={() => setRegisterOpen(true)} label="Продать" />
    </div>
  );
};

export default FoamSalesTab;
