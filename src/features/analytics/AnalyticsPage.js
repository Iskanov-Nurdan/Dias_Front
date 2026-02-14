import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSummary,
  fetchClientStatuses,
  fetchClientsBySport,
  fetchIncomeExpenseDaily,
  fetchTopTrainers,
  fetchWarehouseRestocks,
  fetchSalesByProduct,
  fetchSalesByCategory,
  fetchIncomeDetail,
  fetchExpenseDetail,
  fetchProfitDetail,
} from './api';
import { fetchSalary } from '../salary/api';
import { ErrorState, Select } from '../../shared/ui';
import './AnalyticsPage.scss';

const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const formatMoney = (v) => (v != null && !Number.isNaN(Number(v)) ? `${Number(v).toLocaleString('ru-RU')} Р` : '—');

const DONUT_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5', '#0d9488'];

// Донат-диаграмма: data = [{ label, value, color? }]
const DonutChart = ({ data, size = 180, strokeWidth = 22, centerLabel = '' }) => {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (total === 0) return <div className="analytics-donut analytics-donut--empty">Нет данных</div>;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = data.filter((d) => Number(d.value) > 0).map((d, i) => {
    const pct = Number(d.value) / total;
    const dash = circumference * pct;
    const seg = { color: d.color || DONUT_COLORS[i % DONUT_COLORS.length], dash, offset };
    offset += dash;
    return seg;
  });
  return (
    <div className="analytics-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="analytics-donut__svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-bg)" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.dash} ${circumference}`}
            strokeDashoffset={-seg.offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <span className="analytics-donut__center">{centerLabel}</span>
    </div>
  );
};

// Мини-линия по массиву чисел
const Sparkline = ({ values, width = 140, height = 44, color = '#2563eb' }) => {
  const arr = Array.isArray(values) ? values.filter((v) => typeof v === 'number' && !Number.isNaN(v)) : [];
  if (arr.length < 2) return null;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const points = arr.map((v, i) => {
    const x = padding + (i / (arr.length - 1)) * w;
    const y = padding + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="analytics-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill={`url(#spark-fill-${(color || '').replace(/[^a-z0-9]/gi, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// expense-detail: для складских строк бэк передаёт type "add" | "restock"; у остальных type нет
const getExpenseName = (row) => {
  const type = (row.type ?? row.expenseType ?? '').toLowerCase();
  if (type === 'add') return 'Добавление товара';
  if (type === 'restock') return 'Пополнение товара';
  const cat = (row.categoryName || '').toLowerCase();
  const name = (row.name || '').toLowerCase();
  if (cat.includes('склад') || name.includes('пополнен') || name.includes('добавлен')) {
    if (name.includes('добавлен')) return 'Добавление товара';
    if (name.includes('пополнен')) return 'Пополнение товара';
  }
  return row.name ?? '—';
};

const now = new Date();
const defaultQuery = { year: now.getFullYear(), month: now.getMonth() + 1, day: '' };

const AnalyticsPage = () => {
  const [queryState, setQueryState] = useState(defaultQuery);
  const [summary, setSummary] = useState(null);
  const [clientStatuses, setClientStatuses] = useState(null);
  const [clientsBySport, setClientsBySport] = useState(null);
  const [incomeExpenseDaily, setIncomeExpenseDaily] = useState(null);
  const [topTrainers, setTopTrainers] = useState(null);
  const [warehouseRestocks, setWarehouseRestocks] = useState(null);
  const [salesByProduct, setSalesByProduct] = useState(null);
  const [salesByCategory, setSalesByCategory] = useState(null);
  const [salesTab, setSalesTab] = useState('product');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const controllerRef = useRef(null);

  const loadAll = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const s = controllerRef.current.signal;
    setLoading(true);
    setError(null);
    try {
      const q = queryState;
      const hasMonth = q.month != null && q.month !== '';
      const promises = [
        fetchSummary(q, s).then((r) => r?.data ?? r),
        fetchClientStatuses(q, s).then((r) => r?.data ?? r),
        fetchClientsBySport(q, s).then((r) => r?.data ?? r),
        hasMonth ? fetchIncomeExpenseDaily(q, s).then((r) => r?.data ?? r) : Promise.resolve({ items: [] }),
        fetchTopTrainers(q, s).then((r) => r?.data ?? r),
        fetchWarehouseRestocks(q, s).then((r) => r?.data ?? r),
        fetchSalesByProduct(q, s).then((r) => r?.data ?? r),
        fetchSalesByCategory(q, s).then((r) => r?.data ?? r),
      ];
      const [summaryRes, statusesRes, bySportRes, dailyRes, trainersRes, warehouseRes, salesProductRes, salesCategoryRes] = await Promise.all(promises);
      setSummary(summaryRes ?? {});
      setClientStatuses(statusesRes ?? {});
      setClientsBySport(bySportRes ?? {});
      setIncomeExpenseDaily(dailyRes ?? {});
      setTopTrainers(trainersRes ?? {});
      setWarehouseRestocks(warehouseRes ?? {});
      setSalesByProduct(salesProductRes ?? {});
      setSalesByCategory(salesCategoryRes ?? {});
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
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
    if (detailModal === 'expense') {
      fetchExpenseDetail(q, null)
        .then((res) => {
          const expenseData = res?.data ?? res;
          setDetailData(expenseData);
        })
        .catch(() => setDetailData(null))
        .finally(() => setDetailLoading(false));
      return;
    }
    const fn = detailModal === 'income' ? fetchIncomeDetail : fetchProfitDetail;
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
  const profit = s.profit;
  const byType = clientStatuses?.byType ?? [];
  const byPaid = clientStatuses?.byPaid ?? [];
  const paidCount = s.paidCount ?? byPaid.find((b) => b.paid)?.count ?? null;
  const sportItems = clientsBySport?.items ?? [];
  const dailyItems = incomeExpenseDaily?.items ?? [];
  const daysInMonth = queryState.month ? new Date(Number(queryState.year) || new Date().getFullYear(), Number(queryState.month), 0).getDate() : 31;
  const dailyMap = new Map((dailyItems || []).map((x) => [x.day, { income: Number(x.income) || 0, expense: Number(x.expense) || 0 }]));
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const row = dailyMap.get(d) || { income: 0, expense: 0 };
    return { day: d, income: row.income, expense: row.expense };
  });
  const maxVal = Math.max(1, ...chartData.flatMap((x) => [x.income, x.expense]));
  const yMax = Math.ceil(maxVal / 10000) * 10000 || 10000;
  const trainerItems = topTrainers?.items ?? [];
  const restocksPayload = warehouseRestocks ?? {};
  const restockItems = restocksPayload.items ?? [];
  const productItems = salesByProduct?.items ?? [];
  const categoryItems = salesByCategory?.items ?? [];
  const salesTotalRevenue = salesTab === 'product' ? (salesByProduct?.totalRevenue ?? null) : (salesByCategory?.totalRevenue ?? null);

  // Данные для доната «Статусы клиентов»
  const donutStatusesData = [
    ...byType.map((x, i) => ({ label: x.label ?? x.type, value: x.count ?? 0, color: DONUT_COLORS[i % DONUT_COLORS.length] })),
    ...byPaid.map((x, i) => ({ label: x.label ?? (x.paid ? 'Оплачено' : 'Не оплачено'), value: x.count ?? 0, color: x.paid ? '#059669' : '#dc2626' })),
  ].filter((d) => d.value > 0);
  const totalClientsStatuses = donutStatusesData.reduce((s, d) => s + d.value, 0);

  // Данные для доната «Клиенты по виду спорта»
  const donutSportsData = sportItems.map((x, i) => ({
    label: x.sportName ?? '—',
    value: x.clientCount ?? 0,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  })).filter((d) => d.value > 0);
  const totalClientsSports = donutSportsData.reduce((s, d) => s + d.value, 0);

  // Спарклайны по дням (только при выбранном месяце)
  const hasDaily = queryState.month && chartData.length > 0;
  const sparklineIncome = hasDaily ? chartData.map((d) => d.income) : [];
  const sparklineExpense = hasDaily ? chartData.map((d) => d.expense) : [];
  const sparklineProfit = hasDaily ? chartData.map((d) => (d.income || 0) - (d.expense || 0)) : [];

  const IconTrendUp = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 7L13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </svg>
  );
  const IconTrendDown = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 17L13.5 8.5 8.5 13.5 2 7" />
      <path d="M16 17h6v-6" />
    </svg>
  );
  const IconPie = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );

  return (
    <div className="analytics-page">
      <header className="analytics-page__header">
        <div className="analytics-page__header-text">
          <h1 className="analytics-page__title">Аналитика</h1>
          <p className="analytics-page__subtitle">Сводка по выбранному периоду</p>
        </div>
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
        <label className="analytics-page__filter analytics-page__filter--month">
          Месяц
          <Select
            value={queryState.month ? String(queryState.month) : ''}
            onChange={(v) => setQueryState((q) => ({ ...q, month: v ? Number(v) : '' }))}
            options={[{ value: '', label: 'Месяц' }, ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))]}
            placeholder="Месяц"
            className="analytics-page__select-wrap"
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
      </header>

      {error && <ErrorState message={error} onRetry={loadAll} />}

      {loading ? (
        <div className="analytics-page__loading-block">
          <span className="loading-inline">
            <span className="loading-inline__spinner" aria-hidden />
            Загрузка…
          </span>
        </div>
      ) : (
        <>
          <section className="analytics-page__hero">
            <div className="analytics-page__kpis-primary">
              <button type="button" className="analytics-page__card analytics-page__card--income" onClick={() => setDetailModal('income')}>
                <span className="analytics-page__card-icon" aria-hidden><IconTrendUp /></span>
                <span className="analytics-page__card-label">Приход</span>
                <span className="analytics-page__card-value">{formatMoney(income)}</span>
                {sparklineIncome.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineIncome} width={140} height={48} color="#059669" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
              <button type="button" className="analytics-page__card analytics-page__card--expense" onClick={() => setDetailModal('expense')}>
                <span className="analytics-page__card-icon" aria-hidden><IconTrendDown /></span>
                <span className="analytics-page__card-label">Расход</span>
                <span className="analytics-page__card-value">{formatMoney(expense)}</span>
                {sparklineExpense.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineExpense} width={140} height={48} color="#dc2626" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
              <button type="button" className="analytics-page__card analytics-page__card--profit" onClick={() => setDetailModal('profit')}>
                <span className="analytics-page__card-icon" aria-hidden><IconPie /></span>
                <span className="analytics-page__card-label">Прибыль</span>
                <span className="analytics-page__card-value">{formatMoney(profit)}</span>
                {sparklineProfit.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineProfit} width={140} height={48} color="#2563eb" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
            </div>
            <div className="analytics-page__kpis">
              <div className="analytics-page__card analytics-page__card--static">
                <span className="analytics-page__card-label">Продаж</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{s.salesCount ?? '—'}</span>
              </div>
              <div className="analytics-page__card analytics-page__card--static">
                <span className="analytics-page__card-label">Клиентов</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{s.clientsCount ?? '—'}</span>
              </div>
              <div className="analytics-page__card analytics-page__card--static">
                <span className="analytics-page__card-label">Оплачено</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">
                  {paidCount != null ? (s.paidPercent != null ? `${paidCount} (${s.paidPercent}%)` : String(paidCount)) : (s.paidPercent != null ? `${s.paidPercent}%` : '—')}
                </span>
              </div>
              <div className="analytics-page__card analytics-page__card--static">
                <span className="analytics-page__card-label">Видов спорта</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{s.sportsCount ?? '—'}</span>
              </div>
            </div>
          </section>

          <div className="analytics-page__grid analytics-page__grid--two">
            <section className="analytics-page__section analytics-page__section--card analytics-page__section--with-donut">
              <h3 className="analytics-page__section-title">Решение по клиентам (статусы)</h3>
              <div className="analytics-page__statuses-wrap">
                <div className="analytics-page__bars">
                  {byType.map((x) => (
                    <button key={x.type ?? x.label} type="button" className="analytics-page__bar-row" onClick={() => setStatusModal({ label: x.label ?? x.type, count: x.count ?? 0, percent: x.percent ?? 0 })}>
                      <span className="analytics-page__bar-label">{x.label ?? x.type}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className="analytics-page__bar" style={{ width: `${x.percent ?? 0}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0} · {x.percent ?? 0}%</span>
                    </button>
                  ))}
                  {byPaid.map((x) => (
                    <button key={String(x.paid)} type="button" className="analytics-page__bar-row" onClick={() => setStatusModal({ label: x.label ?? (x.paid ? 'Оплачено' : 'Не оплачено'), count: x.count ?? 0, percent: x.percent ?? 0 })}>
                      <span className="analytics-page__bar-label">{x.label ?? (x.paid ? 'Оплачено' : 'Не оплачено')}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className={`analytics-page__bar ${x.paid ? 'analytics-page__bar--green' : 'analytics-page__bar--red'}`} style={{ width: `${x.percent ?? 0}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0} · {x.percent ?? 0}%</span>
                    </button>
                  ))}
                  {byType.length === 0 && byPaid.length === 0 && <p className="analytics-page__empty">Нет данных</p>}
                </div>
                <div className="analytics-page__donut-wrap">
                  <DonutChart
                    data={donutStatusesData}
                    size={200}
                    strokeWidth={24}
                    centerLabel={totalClientsStatuses > 0 ? `Всего\n${totalClientsStatuses}` : ''}
                  />
                </div>
              </div>
            </section>

            <section className="analytics-page__section analytics-page__section--card analytics-page__section--with-donut">
              <h3 className="analytics-page__section-title">Клиенты по виду спорта</h3>
              <div className="analytics-page__sports-wrap">
                <div className="analytics-page__donut-wrap analytics-page__donut-wrap--sports">
                  <DonutChart
                    data={donutSportsData}
                    size={180}
                    strokeWidth={22}
                    centerLabel={totalClientsSports > 0 ? String(totalClientsSports) : ''}
                  />
                </div>
                <div className="analytics-page__list">
                  {sportItems.map((x) => (
                    <div key={x.sportId ?? x.sportName} className="analytics-page__list-item">
                      {x.sportName ?? '—'}: {x.clientCount ?? 0} ({x.percent ?? 0}%)
                    </div>
                  ))}
                  {sportItems.length === 0 && <p className="analytics-page__empty">Нет данных</p>}
                </div>
              </div>
            </section>
          </div>

          <section className="analytics-page__section analytics-page__section--chart">
            <h3 className="analytics-page__section-title">Динамика доходов и расходов по дням</h3>
            <div className="analytics-page__chart-wrap">
              {!queryState.month ? (
                <p className="analytics-page__empty">Выберите месяц для графика по дням</p>
              ) : chartData.length > 0 ? (
                <>
                  <div className="analytics-page__chart-legend">
                    <span className="analytics-page__chart-legend-item analytics-page__chart-legend-item--income">Приход</span>
                    <span className="analytics-page__chart-legend-item analytics-page__chart-legend-item--expense">Расход</span>
                  </div>
                  <svg className="analytics-page__chart" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="chart-income-fill" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#ea580c" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#ea580c" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="chart-expense-fill" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <line key={i} className="analytics-page__chart-grid" x1={80} y1={40 + i * 40} x2={780} y2={40 + i * 40} />
                    ))}
                    {Array.from({ length: daysInMonth + 1 }, (_, i) => i).map((i) => (
                      <line key={i} className="analytics-page__chart-grid" x1={80 + (700 * i) / daysInMonth} y1={40} x2={80 + (700 * i) / daysInMonth} y2={240} />
                    ))}
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const val = Math.round((yMax * i) / 5);
                      const y = 240 - (val / yMax) * 200;
                      return (
                        <text key={i} className="analytics-page__chart-axis" x={72} y={y + 4} textAnchor="end">{val.toLocaleString('ru-RU')}</text>
                      );
                    })}
                    {chartData.length >= 1 && (() => {
                      const w = 700;
                      const h = 200;
                      const scaleX = (d) => 80 + (w * (d - 1)) / (daysInMonth - 1 || 1);
                      const scaleYi = (v) => 240 - (v / yMax) * h;
                      const scaleYe = (v) => 240 - (v / yMax) * h;
                      const incomePath = chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.day)} ${scaleYi(p.income)}`).join(' ') + ` L ${scaleX(chartData[chartData.length - 1].day)} 240 L 80 240 Z`;
                      const expensePath = chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.day)} ${scaleYe(p.expense)}`).join(' ') + ` L ${scaleX(chartData[chartData.length - 1].day)} 240 L 80 240 Z`;
                      return (
                        <g key="areas">
                          <path d={incomePath} fill="url(#chart-income-fill)" stroke="#ea580c" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d={expensePath} fill="url(#chart-expense-fill)" stroke="#dc2626" strokeWidth="1.5" strokeLinejoin="round" />
                        </g>
                      );
                    })()}
                    {[1, Math.ceil(daysInMonth / 4), Math.ceil(daysInMonth / 2), Math.ceil((3 * daysInMonth) / 4), daysInMonth].filter((v, i, a) => a.indexOf(v) === i).map((d) => (
                      <text key={d} className="analytics-page__chart-axis analytics-page__chart-axis--x" x={80 + (700 * (d - 1)) / (daysInMonth - 1 || 1)} y={254} textAnchor="middle">{d}</text>
                    ))}
                  </svg>
                </>
              ) : (
                <p className="analytics-page__empty">Нет данных за период</p>
              )}
            </div>
          </section>

          <div className="analytics-page__grid analytics-page__grid--two">
            <section className="analytics-page__section analytics-page__section--card">
              <h3 className="analytics-page__section-title">Топ тренеров</h3>
            <ol className="analytics-page__top-list">
              {trainerItems.map((x, i) => (
                <li key={x.trainerId ?? i}>{x.trainerName ?? '—'}: {x.clientCount ?? 0} учеников</li>
              ))}
              {trainerItems.length === 0 && <li className="analytics-page__empty">Нет данных</li>}
            </ol>
            </section>

            <section className="analytics-page__section analytics-page__section--card">
              <h3 className="analytics-page__section-title">Пополнения склада</h3>
            <p className="analytics-page__section-summary">
              Всего пополнений: <strong>{restocksPayload.restockCount ?? 0}</strong> на сумму <strong>{formatMoney(restocksPayload.totalRestockSum)}</strong>.
              {restocksPayload.totalUnitsAdded != null && ` ${restocksPayload.totalUnitsAdded} единиц добавлено.`}
              {restocksPayload.currentWarehouseValue != null && ` Сумма склада сейчас: ${formatMoney(restocksPayload.currentWarehouseValue)}`}
            </p>
            <div className="analytics-page__table-wrap">
              <table className="analytics-page__table">
                <thead><tr><th>Дата</th><th>Товар</th><th>Кол-во</th><th>Сумма</th><th>Сотрудник</th></tr></thead>
                <tbody>
                  {restockItems.map((r, i) => (
                    <tr key={r.id ?? `${r.date}-${r.productId}-${i}`}>
                      <td>{r.date ?? '—'}</td>
                      <td>{r.productName ?? '—'}</td>
                      <td>{r.quantity ?? r.qty ?? 0}</td>
                      <td>{formatMoney(r.amount)}</td>
                      <td>{r.employeeName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {restockItems.length === 0 && <p className="analytics-page__empty">Нет пополнений за период</p>}
            </div>
            </section>
          </div>

          <section className="analytics-page__section analytics-page__section--table">
            <h3 className="analytics-page__section-title">Продажи за период</h3>
            <div className="analytics-page__tabs">
              <button type="button" className={`analytics-page__tab ${salesTab === 'product' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('product')}>Товары</button>
              <button type="button" className={`analytics-page__tab ${salesTab === 'category' ? 'analytics-page__tab--active' : ''}`} onClick={() => setSalesTab('category')}>Категории</button>
            </div>
            <p className="analytics-page__section-summary">
              Всего продаж на сумму: <strong>{formatMoney(salesTotalRevenue)}</strong>
            </p>
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
                <p className="analytics-page__empty">Нет продаж за период</p>
              )}
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
            {!detailLoading && detailModal === 'income' && (() => {
              const incomeItems = detailData?.items ?? detailData?.records ?? detailData?.incomeItems ?? [];
              const hasItems = Array.isArray(incomeItems) && incomeItems.length > 0;
              const totalFromApi = detailData?.total ?? detailData?.incomeTotal;
              if (hasItems) {
                return (
                  <>
                    <table className="analytics-page__table">
                      <thead><tr><th>Источник</th><th>Описание</th><th>Сумма</th></tr></thead>
                      <tbody>
                        {incomeItems.map((row, i) => (
                          <tr key={i}>
                            <td>{row.sourceLabel ?? (row.source === 'clients' ? 'Клиенты' : row.source === 'sales' ? 'Продажи' : row.source) ?? '—'}</td>
                            <td>{row.description ?? '—'}</td>
                            <td>{formatMoney(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="analytics-page__modal-total">Итого приход: {formatMoney(totalFromApi)}</p>
                  </>
                );
              }
              return (
                <p className="analytics-page__modal-empty">
                  Нет записей за период.
                  {income != null && Number(income) > 0 && (
                    <span className="analytics-page__modal-summary"> Приход по сводке: <strong>{formatMoney(income)}</strong></span>
                  )}
                </p>
              );
            })()}
            {!detailLoading && detailModal === 'expense' && (() => {
              const baseItems = detailData?.items ?? [];
              const isRowSaved = (r) => {
                const saved = r.saved ?? r.is_saved;
                if (saved === false || saved === 'false') return false;
                return saved === true || saved === 'true';
              };
              const savedOnly = baseItems.filter(isRowSaved);
              const expenseItems = savedOnly;
              const expenseTotal = Number(detailData?.total) ?? 0;
              if (expenseItems.length === 0) return <p>Нет записей за период</p>;
              return (
                <>
                  <table className="analytics-page__table">
                    <thead><tr><th>Категория</th><th>Название</th><th>Дата</th><th>Сумма</th></tr></thead>
                    <tbody>
                      {expenseItems.map((row, i) => (
                        <tr key={i}>
                          <td>{row.categoryName ?? '—'}</td>
                          <td>{getExpenseName(row)}</td>
                          <td>{row.date ?? '—'}</td>
                          <td>{formatMoney(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="analytics-page__modal-total">Итого расход: {formatMoney(expenseTotal)}</p>
                </>
              );
            })()}
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
            {!detailLoading && detailModal === 'profit' && !detailData?.items?.length && <p>Нет записей за период</p>}
            <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
          </div>
        </div>
      )}

      {statusModal && (
        <div className="analytics-page__modal" onClick={() => setStatusModal(null)}>
          <div className="analytics-page__modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="analytics-page__modal-title">{statusModal.label}</h3>
            <p><strong>{statusModal.count}</strong> клиентов · {statusModal.percent}%</p>
            <button type="button" className="analytics-page__modal-close" onClick={() => setStatusModal(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
