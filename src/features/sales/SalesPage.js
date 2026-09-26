import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { fetchSales } from './api';
import { useProductLine, PRODUCT_LINE } from '../../shared/hooks/useProductLine';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, ProductLineTabs, Fab, PeriodFilter } from '../../shared/ui';
import { STATS_YEARS } from '../../shared/constants/common';
import { SalesList, SaleDetailModal } from './components';
import RegisterModal from './register/RegisterModal';
import { FoamSalesTab } from '../foam/components';
import './SalesPage.scss';

const NOW = new Date();
const CURRENT_YEAR_STR = String(NOW.getFullYear());
// Год и месяц по умолчанию — текущие, день — не выбран («весь месяц»),
// тот же дефолт, что у PeriodFilter на «Сменах» (ShiftsPage) — один и тот
// же паттерн фильтра периода на весь проект, не отдельный «DateSelect»
// в тулбаре: тот подходит для инлайн-контекста с местом на 3 селекта,
// здесь — узкий тулбар вкладок, туда нужна одна компактная кнопка.
const DEFAULT_YEAR = STATS_YEARS.includes(CURRENT_YEAR_STR) ? CURRENT_YEAR_STR : STATS_YEARS[STATS_YEARS.length - 1];
const DEFAULT_MONTH = String(NOW.getMonth() + 1);
const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const SalesPage = () => {
  const [line, setLine] = useProductLine();
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [month, setMonth] = useState(DEFAULT_MONTH);
  const [day, setDay] = useState('');
  const [queryState, setQueryState] = useState({ page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailsSaleId, setDetailsSaleId] = useState(null);

  const isDefaultPeriod = year === DEFAULT_YEAR && month === DEFAULT_MONTH && day === '';
  const y = Number(year);
  const m = Number(month);
  const dateFrom = day ? `${year}-${pad2(m)}-${pad2(Number(day))}` : `${year}-${pad2(m)}-01`;
  const dateTo = day ? dateFrom : `${year}-${pad2(m)}-${pad2(daysInMonth(y, m))}`;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSales({ ...queryState, dateFrom, dateTo }, null)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryState, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setQueryState((q) => ({ ...q, page: 1 })); }, [dateFrom, dateTo]);

  const resetPeriod = () => { setYear(DEFAULT_YEAR); setMonth(DEFAULT_MONTH); setDay(''); };

  if (line === PRODUCT_LINE.FOAM) {
    // ProductLineTabs рендерится внутри FoamSalesTab самим (с action-слотом
    // под «Продать» этой вкладки) — не здесь: раньше тут стоял отдельный
    // ProductLineTabs без action, а «Продать» рисовался в FoamSalesTab уже
    // своей отдельной строкой ниже — кнопка уезжала не в ту строку.
    return (
      <div className="sales-page">
        <FoamSalesTab line={line} onLineChange={setLine} />
      </div>
    );
  }

  return (
    <div className="sales-page">
      <ProductLineTabs
        value={line}
        onChange={setLine}
        action={(
          <button type="button" className="sales-page__add" onClick={() => setRegisterOpen(true)}>
            <Plus size={16} /> Продать
          </button>
        )}
      />

      {/* Отдельная строка под вкладками — видна на всех экранах (в отличие
          от action-слота PrimaryTabs, который на мобиле скрывается в пользу
          Fab), иначе на телефоне пропадал бы фильтр периода. */}
      <div className="sales-page__toolbar">
        <PeriodFilter
          year={year} month={month} day={day}
          onYear={setYear} onMonth={setMonth} onDay={setDay}
          onReset={resetPeriod}
          isDefault={isDefaultPeriod}
        />
      </div>

      <SalesList
        items={data?.items}
        loading={loading}
        error={error}
        onRetry={load}
        onDetails={(s) => setDetailsSaleId(s.id)}
        emptyMessage="Продаж пока нет"
        onAdd={() => setRegisterOpen(true)}
      />
      <Pagination
        meta={data?.meta}
        currentPage={queryState.page}
        onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
        loading={loading}
        entityLabel="продаж"
      />

      {registerOpen && (
        <RegisterModal
          onClose={() => setRegisterOpen(false)}
          onSaved={load}
        />
      )}

      {detailsSaleId && (
        <SaleDetailModal saleId={detailsSaleId} onClose={() => setDetailsSaleId(null)} />
      )}

      <Fab onClick={() => setRegisterOpen(true)} label="Продать" />
    </div>
  );
};

export default SalesPage;
