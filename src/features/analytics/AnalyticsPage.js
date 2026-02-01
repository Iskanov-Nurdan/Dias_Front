import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSummary,
  fetchClientStatuses,
  fetchClientsBySport,
  fetchActivityByWeekday,
  fetchIncomeExpenseDaily,
  fetchTopTrainers,
  fetchTopClients,
  fetchTopSports,
  fetchSalesByProduct,
  fetchSalesByCategory,
  fetchClientsBreakdown,
  fetchWarehouseRestocks,
  fetchIncomeDetail,
  fetchExpenseDetail,
  fetchProfitDetail,
} from './api';
import { Loading, ErrorState, Select } from '../../shared/ui';
import './AnalyticsPage.scss';

const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatMoney = (v) => (v != null && !Number.isNaN(Number(v)) ? `${Number(v).toLocaleString('ru-RU')} Р` : '—');

const now = new Date();
const defaultQuery = { year: now.getFullYear(), month: now.getMonth() + 1, day: '' };

const AnalyticsPage = () => {
  const [queryState, setQueryState] = useState(defaultQuery);
  const [summary, setSummary] = useState(null);
  const [clientStatuses, setClientStatuses] = useState(null);
  const [clientsBySport, setClientsBySport] = useState(null);
  const [activityByWeekday, setActivityByWeekday] = useState(null);
  const [incomeExpenseDaily, setIncomeExpenseDaily] = useState(null);
  const [topTrainers, setTopTrainers] = useState(null);
  const [topClients, setTopClients] = useState(null);
  const [topSports, setTopSports] = useState(null);
  const [salesByProduct, setSalesByProduct] = useState(null);
  const [salesByCategory, setSalesByCategory] = useState(null);
  const [clientsBreakdown, setClientsBreakdown] = useState(null);
  const [warehouseRestocks, setWarehouseRestocks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [salesTab, setSalesTab] = useState('product');
  const controllerRef = useRef(null);

  const loadAll = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const s = controllerRef.current.signal;
    setLoading(true);
    setError(null);
    try {
      const q = queryState;
      const [
        summaryRes,
        statusesRes,
        bySportRes,
        weekdayRes,
        dailyRes,
        trainersRes,
        clientsRes,
        sportsRes,
        salesProductRes,
        salesCategoryRes,
        breakdownRes,
        warehouseRes,
      ] = await Promise.all([
        fetchSummary(q, s).then((r) => r?.data ?? r),
        fetchClientStatuses(q, s).then((r) => r?.data ?? r),
        fetchClientsBySport(q, s).then((r) => r?.data ?? r),
        fetchActivityByWeekday(q, s).then((r) => r?.data ?? r),
        fetchIncomeExpenseDaily(q, s).then((r) => r?.data ?? r),
        fetchTopTrainers(q, s).then((r) => r?.data ?? r),
        fetchTopClients(q, s).then((r) => r?.data ?? r),
        fetchTopSports(q, s).then((r) => r?.data ?? r),
        fetchSalesByProduct(q, s).then((r) => r?.data ?? r),
        fetchSalesByCategory(q, s).then((r) => r?.data ?? r),
        fetchClientsBreakdown(q, s).then((r) => r?.data ?? r),
        fetchWarehouseRestocks(q, s).then((r) => r?.data ?? r),
      ]);
      setSummary(summaryRes ?? {});
      setClientStatuses(statusesRes ?? {});
      setClientsBySport(bySportRes ?? {});
      setActivityByWeekday(weekdayRes ?? {});
      setIncomeExpenseDaily(dailyRes ?? {});
      setTopTrainers(trainersRes ?? {});
      setTopClients(clientsRes ?? {});
      setTopSports(sportsRes ?? {});
      setSalesByProduct(salesProductRes ?? {});
      setSalesByCategory(salesCategoryRes ?? {});
      setClientsBreakdown(breakdownRes ?? {});
      setWarehouseRestocks(warehouseRes ?? {});
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [queryState.year, queryState.month, queryState.day]);

  useEffect(() => {
    loadAll();
    return () => controllerRef.current?.abort();
  }, [loadAll]);

  useEffect(() => {
    if (!detailModal) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    const q = queryState;
    const fn =
      detailModal === 'income'
        ? fetchIncomeDetail
        : detailModal === 'expense'
          ? fetchExpenseDetail
          : fetchProfitDetail;
    fn(q, null)
      .then((r) => {
        const d = r?.data ?? r;
        setDetailData(d);
      })
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [detailModal, queryState.year, queryState.month, queryState.day]);

  const resetFilters = () => setQueryState(defaultQuery);

  const s = summary ?? {};
  const income = s.income ?? 0;
  const expense = s.expense ?? 0;
  const profit = s.profit ?? (income - expense);
  const byType = clientStatuses?.byType ?? [];
  const byPaid = clientStatuses?.byPaid ?? [];
  const sportItems = clientsBySport?.items ?? [];
  const weekdayItems = activityByWeekday?.items ?? [];
  const dailyItems = incomeExpenseDaily?.items ?? [];
  const trainerItems = topTrainers?.items ?? [];
  const clientItems = topClients?.items ?? [];
  const sportTopItems = topSports?.items ?? [];
  const productItems = salesByProduct?.items ?? [];
  const categoryItems = salesByCategory?.items ?? [];
  const breakdown = clientsBreakdown ?? {};
  const restocksPayload = warehouseRestocks ?? {};
  const restockItems = restocksPayload.items ?? [];

  return (
    <div className="analytics-page">
      <h1 className="analytics-page__title">Аналитика</h1>
      <p className="analytics-page__subtitle">За период</p>
      <div className="analytics-page__filters">
        <label className="analytics-page__filter">
          Год
          <input
            type="number"
            value={queryState.year}
            onChange={(e) => setQueryState((q) => ({ ...q, year: e.target.value }))}
            className="analytics-page__input"
            min="2020"
            max="2030"
          />
        </label>
        <label className="analytics-page__filter">
          Месяц
          <Select
            value={queryState.month ? String(queryState.month) : ''}
            onChange={(v) => setQueryState((q) => ({ ...q, month: v ? Number(v) : '' }))}
            options={[{ value: '', label: '—' }, ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))]}
            placeholder="—"
            className="analytics-page__input analytics-page__select-wrap"
          />
        </label>
        <label className="analytics-page__filter">
          День
          <input
            type="number"
            placeholder="Весь месяц"
            value={queryState.day}
            onChange={(e) => setQueryState((q) => ({ ...q, day: e.target.value }))}
            className="analytics-page__input"
            min="1"
            max="31"
          />
        </label>
        <button type="button" className="analytics-page__reset" onClick={resetFilters}>Сброс</button>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={loadAll} />}

      {!loading && !error && (
        <>
          <div className="analytics-page__kpis">
            <button type="button" className="analytics-page__card" onClick={() => setDetailModal('income')}>
              <span className="analytics-page__card-label">Приход (месяц)</span>
              <span className="analytics-page__card-value">{formatMoney(income)}</span>
            </button>
            <button type="button" className="analytics-page__card" onClick={() => setDetailModal('expense')}>
              <span className="analytics-page__card-label">Расход (месяц)</span>
              <span className="analytics-page__card-value">{formatMoney(expense)}</span>
            </button>
            <button type="button" className="analytics-page__card" onClick={() => setDetailModal('profit')}>
              <span className="analytics-page__card-label">Прибыль (месяц)</span>
              <span className="analytics-page__card-value">{formatMoney(profit)}</span>
            </button>
            <div className="analytics-page__card analytics-page__card--static">
              <span className="analytics-page__card-label">Оплачено (клиенты)</span>
              <span className="analytics-page__card-value">{s.paidPercent != null ? `${s.paidPercent}%` : '—'}</span>
            </div>
            <div className="analytics-page__card analytics-page__card--static">
              <span className="analytics-page__card-label">Клиентов (месяц)</span>
              <span className="analytics-page__card-value">{s.clientsCount ?? '—'}</span>
            </div>
            <div className="analytics-page__card analytics-page__card--static">
              <span className="analytics-page__card-label">Видов спорта</span>
              <span className="analytics-page__card-value">{s.sportsCount ?? '—'}</span>
            </div>
            <div className="analytics-page__card analytics-page__card--static">
              <span className="analytics-page__card-label">Продаж (месяц)</span>
              <span className="analytics-page__card-value">{s.salesCount ?? '—'}</span>
            </div>
          </div>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Статусы клиентов (месяц)</h3>
            <div className="analytics-page__bars">
              {byType.map((x) => (
                <div key={x.type ?? x.label} className="analytics-page__bar-row">
                  <span className="analytics-page__bar-label">{x.label ?? x.type}</span>
                  <div className="analytics-page__bar-wrap">
                    <div className="analytics-page__bar" style={{ width: `${x.percent ?? 0}%` }} />
                  </div>
                  <span className="analytics-page__bar-value">{x.count ?? 0} · {x.percent ?? 0}%</span>
                </div>
              ))}
              {byPaid.map((x) => (
                <div key={String(x.paid)} className="analytics-page__bar-row">
                  <span className="analytics-page__bar-label">{x.label ?? (x.paid ? 'Оплачено' : 'Не оплачено')}</span>
                  <div className="analytics-page__bar-wrap">
                    <div className={`analytics-page__bar ${x.paid ? 'analytics-page__bar--green' : 'analytics-page__bar--red'}`} style={{ width: `${x.percent ?? 0}%` }} />
                  </div>
                  <span className="analytics-page__bar-value">{x.count ?? 0} · {x.percent ?? 0}%</span>
                </div>
              ))}
              {byType.length === 0 && byPaid.length === 0 && <p className="analytics-page__empty">Нет данных</p>}
            </div>
          </section>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Клиенты по виду спорта</h3>
            <div className="analytics-page__list">
              {sportItems.map((x) => (
                <div key={x.sportId ?? x.sportName} className="analytics-page__list-item">
                  {x.sportName ?? '—'}: {x.clientCount ?? 0} ({x.percent ?? 0}%)
                </div>
              ))}
              {sportItems.length === 0 && <p className="analytics-page__empty">Нет данных</p>}
            </div>
          </section>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Активность по дням недели</h3>
            <div className="analytics-page__weekday">
              {(weekdayItems.length ? weekdayItems : WEEKDAY_LABELS.map((label, i) => ({ weekday: i + 1, label, count: 0 }))).map((x) => (
                <div key={x.weekday ?? x.label} className="analytics-page__weekday-col">
                  <div className="analytics-page__weekday-bar" style={{ height: `${Math.min(100, (x.count ?? 0) * 20)}%` }} />
                  <span className="analytics-page__weekday-value">{x.count ?? 0}</span>
                  <span className="analytics-page__weekday-label">{x.label ?? WEEKDAY_LABELS[x.weekday - 1]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Динамика доходов и расходов (дни месяца)</h3>
            <div className="analytics-page__daily-wrap">
              {dailyItems.length ? (
                dailyItems.map((x) => (
                  <div key={x.day} className="analytics-page__daily-row">
                    <span className="analytics-page__daily-day">{x.day}</span>
                    <span className="analytics-page__daily-income">{formatMoney(x.income)}</span>
                    <span className="analytics-page__daily-expense">{formatMoney(x.expense)}</span>
                  </div>
                ))
              ) : (
                <p className="analytics-page__empty">Нет данных за период</p>
              )}
            </div>
          </section>

          <div className="analytics-page__grid">
            <section className="analytics-page__section">
              <h3 className="analytics-page__section-title">Топ тренеров (клиенты за период)</h3>
              <ol className="analytics-page__top-list">
                {trainerItems.map((x, i) => (
                  <li key={x.trainerId ?? i}>{x.trainerName ?? '—'}: {x.clientCount ?? 0} учеников</li>
                ))}
                {trainerItems.length === 0 && <li className="analytics-page__empty">Нет данных</li>}
              </ol>
            </section>
            <section className="analytics-page__section">
              <h3 className="analytics-page__section-title">Топ клиентов (визиты и срок)</h3>
              <ol className="analytics-page__top-list">
                {clientItems.map((x, i) => (
                  <li key={x.clientId ?? i}>{x.clientName ?? '—'}: {x.visitCount ?? 0} визит(ов), {x.monthsWithUs ?? 0} мес. с нами</li>
                ))}
                {clientItems.length === 0 && <li className="analytics-page__empty">Нет данных</li>}
              </ol>
            </section>
          </div>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Топ видов спорта по клиентам</h3>
            <ol className="analytics-page__top-list">
              {sportTopItems.map((x, i) => (
                <li key={x.sportId ?? i}>{x.sportName ?? '—'}: {x.clientCount ?? 0} клиентов</li>
              ))}
              {sportTopItems.length === 0 && <li className="analytics-page__empty">Нет данных</li>}
            </ol>
          </section>

          <section className="analytics-page__section">
            <div className="analytics-page__tabs">
              <button type="button" className={`analytics-page__tab ${salesTab === 'product' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('product')}>Товары</button>
              <button type="button" className={`analytics-page__tab ${salesTab === 'category' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('category')}>Категории</button>
            </div>
            <h3 className="analytics-page__section-title">{salesTab === 'product' ? 'Товары (продажи за период)' : 'Категории (продажи за период)'}</h3>
            <div className="analytics-page__table-wrap">
              <table className="analytics-page__table">
                <thead>
                  <tr>
                    <th>{salesTab === 'product' ? 'Товар' : 'Категория'}</th>
                    <th>Кол-во</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {(salesTab === 'product' ? productItems : categoryItems).map((x) => (
                    <tr key={x.productId ?? x.categoryId ?? x.productName ?? x.categoryName}>
                      <td>{salesTab === 'product' ? (x.productName ?? '—') : (x.categoryName ?? '—')}</td>
                      <td>{x.quantitySold ?? 0}</td>
                      <td>{formatMoney(x.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(salesTab === 'product' ? productItems : categoryItems).length === 0 && (
                <p className="analytics-page__empty">Нет данных</p>
              )}
            </div>
          </section>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">Клиенты (месяц)</h3>
            <div className="analytics-page__breakdown">
              <p><strong>Всего клиентов:</strong> {breakdown.totalClients ?? '—'}</p>
              <div className="analytics-page__breakdown-block">
                <strong>По сотрудникам:</strong>
                {(breakdown.byEmployee ?? []).map((x) => (
                  <span key={x.employeeId ?? x.employeeName}>{x.employeeName ?? '—'}: {x.clientCount ?? 0}</span>
                ))}
              </div>
              <div className="analytics-page__breakdown-block">
                <strong>По виду спорта:</strong>
                {(breakdown.bySport ?? []).map((x) => (
                  <span key={x.sportId ?? x.sportName}>{x.sportName ?? '—'}: {x.clientCount ?? 0}</span>
                ))}
              </div>
              <div className="analytics-page__breakdown-block">
                <strong>По тренеру:</strong>
                {(breakdown.byTrainer ?? []).map((x) => (
                  <span key={x.trainerId ?? x.trainerName}>{x.trainerName ?? '—'}: {x.clientCount ?? 0}</span>
                ))}
              </div>
              <div className="analytics-page__breakdown-block">
                <strong>По типу:</strong>
                {(breakdown.byType ?? []).map((x) => (
                  <span key={x.clientType ?? x.label}>{x.label ?? x.clientType ?? '—'}: {x.count ?? 0}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="analytics-page__section">
            <h3 className="analytics-page__section-title">История пополнений склада (месяц)</h3>
            <p>{restocksPayload.restockCount ?? 0} пополнений, {restocksPayload.totalUnitsAdded ?? 0} единиц добавлено. Сумма склада: {formatMoney(restocksPayload.currentWarehouseValue)}</p>
            <div className="analytics-page__table-wrap">
              <table className="analytics-page__table">
                <thead><tr><th>Дата</th><th>Товар</th><th>Кол-во</th><th>Сотрудник</th></tr></thead>
                <tbody>
                  {restockItems.map((r) => (
                    <tr key={r.id ?? `${r.date}-${r.productName}`}>
                      <td>{r.date ?? '—'}</td>
                      <td>{r.productName ?? '—'}</td>
                      <td>{r.quantity ?? 0}</td>
                      <td>{r.employeeName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {restockItems.length === 0 && <p className="analytics-page__empty">Нет пополнений</p>}
            </div>
          </section>
        </>
      )}

      {detailModal && (
        <div className="analytics-page__modal" onClick={() => setDetailModal(null)}>
          <div className="analytics-page__modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="analytics-page__modal-title">
              {detailModal === 'income' ? 'Детализация приходов' : detailModal === 'expense' ? 'Детализация расходов' : 'Детализация прибыли'}
            </h3>
            {detailLoading && <p>Загрузка...</p>}
            {!detailLoading && detailModal === 'income' && detailData?.items?.length > 0 && (
              <>
                <table className="analytics-page__table">
                  <thead><tr><th>Источник</th><th>Описание</th><th>Сумма</th></tr></thead>
                  <tbody>
                    {detailData.items.map((row, i) => (
                      <tr key={i}>
                        <td>{row.sourceLabel ?? row.source ?? '—'}</td>
                        <td>{row.description ?? '—'}</td>
                        <td>{formatMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="analytics-page__modal-total">Итого приход: {formatMoney(detailData.total)}</p>
              </>
            )}
            {!detailLoading && detailModal === 'expense' && detailData?.items?.length > 0 && (
              <>
                <table className="analytics-page__table">
                  <thead><tr><th>Категория</th><th>Название</th><th>Дата</th><th>Сумма</th></tr></thead>
                  <tbody>
                    {detailData.items.map((row, i) => (
                      <tr key={i}>
                        <td>{row.categoryName ?? '—'}</td>
                        <td>{row.name ?? '—'}</td>
                        <td>{row.date ?? '—'}</td>
                        <td>{formatMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="analytics-page__modal-total">Итого расход: {formatMoney(detailData.total)}</p>
              </>
            )}
            {!detailLoading && detailModal === 'profit' && detailData?.items?.length > 0 && (
              <>
                <table className="analytics-page__table">
                  <thead><tr><th>Тип</th><th>Описание</th><th>Сумма</th></tr></thead>
                  <tbody>
                    {detailData.items.map((row, i) => (
                      <tr key={i}>
                        <td>{row.typeLabel ?? row.type ?? '—'}</td>
                        <td>{row.description ?? '—'}</td>
                        <td>{formatMoney(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="analytics-page__modal-total">Приходы: {formatMoney(detailData.incomeTotal)} · Расходы: {formatMoney(detailData.expenseTotal)} · Прибыль: {formatMoney(detailData.profit)}</p>
              </>
            )}
            {!detailLoading && (!detailData?.items?.length) && <p>Нет записей за период</p>}
            <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
