import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, CalendarDays, CalendarClock } from 'lucide-react';
import { fetchIncomeDetail, fetchExpenseDetail, fetchProfitDetail } from './api';
import { ErrorState, Select, DonutChart, Sparkline, Skeleton, SkeletonTable, FilterBar, EmptyState } from '../../shared/ui';
import { MONTHS, MONTHS_SHORT, DONUT_COLORS, formatMoney, STATS_YEARS } from '../../shared/constants/common';
import { useAnalyticsFilters } from './hooks/useAnalyticsFilters';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import './AnalyticsPage.scss';

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

const YEAR_OPTIONS = STATS_YEARS.map((y) => ({ value: y, label: y }));
const DAY_OPTIONS = [
  { value: '', label: 'Все дни' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
];

function scrollToAnalyticsSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const QUICK_NAV = [
  { id: 'analytics-kpi', label: 'Сводка' },
  { id: 'analytics-charts', label: 'Графики' },
  { id: 'analytics-leads', label: 'Лиды' },
];

const AnalyticsPage = () => {
  const [queryState, setQueryState, resetFilters] = useAnalyticsFilters(defaultQuery);
  const {
    summary,
    clientsBySport,
    incomeExpenseDaily,
    expensesByCategory,
    newClientsByMonth,
    periodComparison,
    leadsAnalytics,
    loading,
    error,
    loadAll,
  } = useAnalyticsData(queryState);
  const [leadsVisible, setLeadsVisible] = useState(false);
  const [chartHoveredDay, setChartHoveredDay] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestSeq = useRef(0);

  useEffect(() => {
    if (!detailModal) {
      setDetailData(null);
      return;
    }
    const seq = ++detailRequestSeq.current;
    setDetailLoading(true);
    const q = queryState;
    // Игнорируем устаревший ответ, если за это время открыли другой период/модалку —
    // иначе более медленный старый запрос может перезаписать свежие данные.
    const finish = (data) => {
      if (detailRequestSeq.current !== seq) return;
      setDetailData(data);
      setDetailLoading(false);
    };
    if (detailModal === 'expense') {
      fetchExpenseDetail(q, null)
        .then((res) => finish(res?.data ?? res))
        .catch(() => finish(null));
      return;
    }
    const fn = detailModal === 'income' ? fetchIncomeDetail : fetchProfitDetail;
    fn(q, null)
      .then((r) => finish(r?.data ?? r))
      .catch(() => finish(null));
  }, [detailModal, queryState.year, queryState.month, queryState.day]);

  const s = summary ?? {};
  const income = s.income ?? 0;
  const expense = s.expense ?? 0;
  const profit = s.profit;
  const paidCount = s.paidCount ?? null;
  const sportItems = clientsBySport?.items ?? [];
  const dailyItems = incomeExpenseDaily?.items ?? [];

  const daysInMonth = useMemo(() => queryState.month ? new Date(Number(queryState.year) || new Date().getFullYear(), Number(queryState.month), 0).getDate() : 31, [queryState.year, queryState.month]);
  const dailyMap = useMemo(() => new Map((dailyItems || []).map((x) => [x.day, { income: Number(x.income) || 0, expense: Number(x.expense) || 0 }])), [dailyItems]);
  const chartData = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const row = dailyMap.get(d) || { income: 0, expense: 0 };
    return { day: d, income: row.income, expense: row.expense };
  }), [daysInMonth, dailyMap]);
  const yMax = useMemo(() => {
    const maxVal = Math.max(1, ...chartData.flatMap((x) => [x.income, x.expense]));
    return Math.ceil(maxVal / 10000) * 10000 || 10000;
  }, [chartData]);
  const expensesByCatItems = expensesByCategory?.items ?? [];
  const expensesByCatTotal = expensesByCategory?.total ?? 0;
  const pc = periodComparison ?? {};
  const momChange = pc.momChange ?? {};
  const yoyChange = pc.yoyChange ?? {};
  const showPeriodComparison = queryState.month && !queryState.day;

  // ── Лиды: данные с бэкенда GET /api/analytics/leads/ ──────────────────────
  const la = leadsAnalytics ?? {};
  const leadsByStatus = la.byStatus ?? { total: 0, accepted: 0, rejected: 0, pending: 0 };
  const leadsByChannel = la.byChannel ?? [];
  const leadsByStage = la.byStage ?? [];
  const leadsByResult = la.byResult ?? [];
  const leadsBySource = la.bySource ?? [];
  const leadsByTargetType = la.byTargetType ?? [];
  const leadsBySport = la.bySport ?? [];
  const leadsByTrainer = la.byTrainer ?? [];
  const leadsByTrialStatus = la.byTrialStatus ?? [];

  const donutLeadsChannelData = useMemo(() => leadsByChannel.map((x, i) => ({
    label: x.label ?? x.key,
    value: x.count ?? 0,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  })), [leadsByChannel]);

  const leadsFunnelTotal = useMemo(() => leadsByStage.reduce((s, x) => s + (x.count ?? 0), 0), [leadsByStage]);
  const leadsStageMax = useMemo(() => Math.max(1, ...leadsByStage.map((x) => x.count ?? 0)), [leadsByStage]);
  const leadsCardMax = useMemo(() => Math.max(
    1,
    ...leadsBySource.map((x) => x.count ?? 0),
    ...leadsByTargetType.map((x) => x.count ?? 0),
    ...leadsBySport.map((x) => x.count ?? 0),
    ...leadsByTrainer.map((x) => x.count ?? 0),
    ...leadsByTrialStatus.map((x) => x.count ?? 0),
  ), [leadsBySource, leadsByTargetType, leadsBySport, leadsByTrainer, leadsByTrialStatus]);

  // Спарклайны по дням (только при выбранном месяце)
  const hasDaily = queryState.month && chartData.length > 0;
  const sparklineIncome = hasDaily ? chartData.map((d) => d.income) : [];
  const sparklineExpense = hasDaily ? chartData.map((d) => d.expense) : [];
  const sparklineProfit = hasDaily ? chartData.map((d) => (d.income || 0) - (d.expense || 0)) : [];

  const TrendBadge = ({ value, type }) => {
    if (value == null || Number.isNaN(Number(value))) return null;
    const v = Number(value);
    if (v === 0) return <span className="analytics-page__trend analytics-page__trend--neutral">0%</span>;
    const isGood = type === 'expense' ? v < 0 : v > 0;
    const isBad = type === 'expense' ? v > 0 : v < 0;
    const dir = v > 0 ? '↑' : '↓';
    const cls = isGood ? 'analytics-page__trend--good' : isBad ? 'analytics-page__trend--bad' : 'analytics-page__trend--neutral';
    return (
      <span className={`analytics-page__trend ${cls}`}>
        {dir}{Math.abs(v).toFixed(1)}%
      </span>
    );
  };

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
      <div className="analytics-page__sticky-top">
        <header className="analytics-page__header analytics-page__header--dashboard">
          <div className="analytics-page__filters-card">
            <span className="analytics-page__filters-label">Период</span>
            <FilterBar className="analytics-page__filter-bar">
              <label className="analytics-page__filter">
                Год
                <Select
                  value={String(queryState.year)}
                  onChange={(v) => setQueryState((q) => ({ ...q, year: v }))}
                  options={YEAR_OPTIONS}
                  placeholder="Год"
                  className="analytics-page__select-wrap"
                  icon={<Calendar size={15} />}
                />
              </label>
              <label className="analytics-page__filter analytics-page__filter--month">
                Месяц
                <Select
                  value={queryState.month ? String(queryState.month) : ''}
                  onChange={(v) => setQueryState((q) => ({ ...q, month: v ? Number(v) : '' }))}
                  options={[{ value: '', label: 'Все месяцы' }, ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))]}
                  placeholder="Месяц"
                  className="analytics-page__select-wrap"
                  icon={<CalendarDays size={15} />}
                />
              </label>
              <label className="analytics-page__filter">
                День
                <Select
                  value={String(queryState.day ?? '')}
                  onChange={(v) => setQueryState((q) => ({ ...q, day: v }))}
                  options={DAY_OPTIONS}
                  placeholder="Все дни"
                  className="analytics-page__select-wrap"
                  icon={<CalendarClock size={15} />}
                />
              </label>
              <button type="button" className="analytics-page__reset" onClick={resetFilters}>Сбросить</button>
            </FilterBar>
          </div>
        </header>

        <nav className="analytics-page__quicknav" aria-label="Быстрый переход по разделам">
          {QUICK_NAV.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="analytics-page__quicknav-btn"
              onClick={() => scrollToAnalyticsSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="analytics-page__error-wrap" role="alert">
          <ErrorState message={error} onRetry={loadAll} />
        </div>
      )}

      {loading ? (
        <div className="analytics-page__loading-block" aria-busy="true" aria-label="Загрузка аналитики">
          <div className="analytics-page__skeleton-kpi-row">
            {[1, 2, 3].map((k) => (
              <Skeleton key={k} variant="card" className="analytics-page__skeleton-kpi" />
            ))}
          </div>
          <div className="analytics-page__skeleton-kpi-row analytics-page__skeleton-kpi-row--sm">
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} variant="card" className="analytics-page__skeleton-kpi-sm" />
            ))}
          </div>
          <div className="analytics-page__skeleton-chart">
            <Skeleton variant="card" className="analytics-page__skeleton-chart-inner" />
          </div>
          <div className="analytics-page__skeleton-split">
            <div className="analytics-page__skeleton-table-wrap">
              <SkeletonTable rows={5} cols={4} />
            </div>
            <div className="analytics-page__skeleton-table-wrap">
              <SkeletonTable rows={5} cols={3} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <section id="analytics-kpi" className="analytics-page__hero">
            <div className="analytics-page__kpis-primary">
              <button type="button" className="analytics-page__card analytics-page__card--income" onClick={() => setDetailModal('income')}>
                <span className="analytics-page__card-icon" aria-hidden><IconTrendUp /></span>
                <span className="analytics-page__card-label">Приход</span>
                <span className="analytics-page__card-value">{formatMoney(income)}</span>
                {showPeriodComparison && (
                  <div className="analytics-page__card-trends">
                    <span className="analytics-page__trend-label" title="К прошлому месяцу">к пр. мес.</span>
                    <TrendBadge value={momChange.income} type="income" />
                    <span className="analytics-page__trend-label" title="К тому же месяцу прошлого года">к пр. году</span>
                    <TrendBadge value={yoyChange.income} type="income" />
                  </div>
                )}
                {sparklineIncome.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineIncome} width={160} height={52} color="var(--analytics-spark-income, #34d399)" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
              <button type="button" className="analytics-page__card analytics-page__card--expense" onClick={() => setDetailModal('expense')}>
                <span className="analytics-page__card-icon" aria-hidden><IconTrendDown /></span>
                <span className="analytics-page__card-label">Расход</span>
                <span className="analytics-page__card-value">{formatMoney(expense)}</span>
                {showPeriodComparison && (
                  <div className="analytics-page__card-trends">
                    <span className="analytics-page__trend-label" title="К прошлому месяцу">к пр. мес.</span>
                    <TrendBadge value={momChange.expense} type="expense" />
                    <span className="analytics-page__trend-label" title="К тому же месяцу прошлого года">к пр. году</span>
                    <TrendBadge value={yoyChange.expense} type="expense" />
                  </div>
                )}
                {sparklineExpense.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineExpense} width={160} height={52} color="var(--analytics-spark-expense, #fb7185)" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
              <button type="button" className="analytics-page__card analytics-page__card--profit" onClick={() => setDetailModal('profit')}>
                <span className="analytics-page__card-icon" aria-hidden><IconPie /></span>
                <span className="analytics-page__card-label">Прибыль</span>
                <span className="analytics-page__card-value">{formatMoney(profit)}</span>
                {showPeriodComparison && (
                  <div className="analytics-page__card-trends">
                    <span className="analytics-page__trend-label" title="К прошлому месяцу">к пр. мес.</span>
                    <TrendBadge value={momChange.profit} type="income" />
                    <span className="analytics-page__trend-label" title="К тому же месяцу прошлого года">к пр. году</span>
                    <TrendBadge value={yoyChange.profit} type="income" />
                  </div>
                )}
                {sparklineProfit.length >= 2 && (
                  <div className="analytics-page__card-chart">
                    <Sparkline values={sparklineProfit} width={160} height={52} color="var(--analytics-spark-profit, #a78bfa)" />
                  </div>
                )}
                <span className="analytics-page__card-hint">за период · нажмите для детализации</span>
              </button>
            </div>
            <div className="analytics-page__kpis">
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

          <div id="analytics-charts" className="analytics-page__charts-region">
          <section className="analytics-page__section analytics-page__section--chart">
            <div className="analytics-page__section-head">
              <h3 className="analytics-page__section-title">Динамика доходов и расходов по дням</h3>
              <p className="analytics-page__section-desc">Сравнение прихода и расхода по календарным дням выбранного месяца</p>
            </div>
            <div className="analytics-page__chart-wrap">
              {!queryState.month ? (
                <EmptyState compact message="Выберите месяц, чтобы увидеть график по дням" />
              ) : chartData.length > 0 ? (
                <>
                  <div className="analytics-page__chart-legend">
                    <span className="analytics-page__chart-legend-item analytics-page__chart-legend-item--income">Приход</span>
                    <span className="analytics-page__chart-legend-item analytics-page__chart-legend-item--expense">Расход</span>
                    <span className="analytics-page__chart-legend-hint">Наведите на день для точных сумм</span>
                  </div>
                  <div className="analytics-page__chart-container">
                    <svg className="analytics-page__chart" viewBox="0 0 800 280" preserveAspectRatio="xMinYMid meet">
                      <defs>
                        <linearGradient id="chart-income-fill" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="var(--analytics-chart-income)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--analytics-chart-income)" stopOpacity={0.06} />
                        </linearGradient>
                        <linearGradient id="chart-expense-fill" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor="var(--analytics-chart-expense)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--analytics-chart-expense)" stopOpacity={0.06} />
                        </linearGradient>
                      </defs>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <line key={i} className="analytics-page__chart-grid" x1={60} y1={40 + i * 40} x2={760} y2={40 + i * 40} />
                      ))}
                      {Array.from({ length: daysInMonth + 1 }, (_, i) => i).map((i) => (
                        <line key={i} className="analytics-page__chart-grid" x1={60 + (700 * i) / daysInMonth} y1={40} x2={60 + (700 * i) / daysInMonth} y2={240} />
                      ))}
                      {[0, 1, 2, 3, 4, 5].map((i) => {
                        const val = Math.round((yMax * i) / 5);
                        const y = 240 - (val / yMax) * 200;
                        return (
                          <text key={i} className="analytics-page__chart-axis" x={52} y={y + 4} textAnchor="end">{val.toLocaleString('ru-RU')}</text>
                        );
                      })}
                      {chartData.length >= 1 && (() => {
                        const w = 700;
                        const h = 200;
                        const scaleX = (d) => 60 + (w * (d - 1)) / (daysInMonth - 1 || 1);
                        const scaleYi = (v) => 240 - (v / yMax) * h;
                        const scaleYe = (v) => 240 - (v / yMax) * h;
                        const incomePath = chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.day)} ${scaleYi(p.income)}`).join(' ') + ` L ${scaleX(chartData[chartData.length - 1].day)} 240 L 60 240 Z`;
                        const expensePath = chartData.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.day)} ${scaleYe(p.expense)}`).join(' ') + ` L ${scaleX(chartData[chartData.length - 1].day)} 240 L 60 240 Z`;
                        return (
                          <g key="areas">
                            <path d={incomePath} fill="url(#chart-income-fill)" stroke="var(--analytics-chart-income)" strokeWidth="2" strokeLinejoin="round" />
                            <path d={expensePath} fill="url(#chart-expense-fill)" stroke="var(--analytics-chart-expense)" strokeWidth="2" strokeLinejoin="round" />
                          </g>
                        );
                      })()}
                      {[1, Math.ceil(daysInMonth / 4), Math.ceil(daysInMonth / 2), Math.ceil((3 * daysInMonth) / 4), daysInMonth].filter((v, i, a) => a.indexOf(v) === i).map((d) => (
                        <text key={d} className="analytics-page__chart-axis analytics-page__chart-axis--x" x={60 + (700 * (d - 1)) / (daysInMonth - 1 || 1)} y={258} textAnchor="middle">{d}</text>
                      ))}
                      {chartData.map((p) => {
                        const w = 700;
                        const scaleX = (d) => 60 + (w * (d - 1)) / (daysInMonth - 1 || 1);
                        const x = scaleX(p.day);
                        const dayWidth = Math.max(4, w / (daysInMonth - 1 || 1));
                        return (
                          <rect
                            key={p.day}
                            className="analytics-page__chart-hover-zone"
                            x={x - dayWidth / 2}
                            y={40}
                            width={dayWidth}
                            height={200}
                            onMouseEnter={() => setChartHoveredDay(p)}
                            onMouseLeave={() => setChartHoveredDay(null)}
                          />
                        );
                      })}
                    </svg>
                    {chartHoveredDay && (
                      <div className="analytics-page__chart-tooltip">
                        <div className="analytics-page__chart-tooltip-title">День {chartHoveredDay.day}</div>
                        <div className="analytics-page__chart-tooltip-row analytics-page__chart-tooltip-row--income">
                          Приход: {formatMoney(chartHoveredDay.income)}
                        </div>
                        <div className="analytics-page__chart-tooltip-row analytics-page__chart-tooltip-row--expense">
                          Расход: {formatMoney(chartHoveredDay.expense)}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState compact message="Нет данных за период" />
              )}
            </div>
          </section>

          {queryState.year && newClientsByMonth && (
            <section className="analytics-page__section analytics-page__section--card analytics-page__section--vbar-chart">
              <h3 className="analytics-page__section-title">Новые клиенты по месяцам</h3>
              <p className="analytics-page__section-hint">За {queryState.year} год</p>
              <div className="analytics-page__vbar-chart">
                {(() => {
                  const monthsData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({ month: m, count: newClientsByMonth[m] ?? 0 }));
                  const maxCount = Math.max(1, ...monthsData.map((d) => d.count));
                  return (
                    <div className="analytics-page__vbar-chart-scroll">
                    <div className="analytics-page__vbar-chart-inner">
                      {monthsData.map((d) => (
                        <div key={d.month} className="analytics-page__vbar-col">
                          <div className="analytics-page__vbar-bar-wrap">
                            <div
                              className="analytics-page__vbar-bar"
                              style={{ height: `${(d.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="analytics-page__vbar-label">{MONTHS_SHORT[d.month]}</span>
                          <span className="analytics-page__vbar-value">{d.count}</span>
                        </div>
                      ))}
                    </div>
                    </div>
                  );
                })()}
              </div>
            </section>
          )}

          <div className="analytics-page__grid analytics-page__grid--two">
            <section className="analytics-page__section analytics-page__section--card analytics-page__section--bar-chart">
              <h3 className="analytics-page__section-title">Клиенты по виду спорта</h3>
              <div className="analytics-page__hbar-chart">
                {sportItems.length > 0 ? (() => {
                  const maxCount = Math.max(1, ...sportItems.map((x) => x.clientCount ?? 0));
                  return (
                    <div className="analytics-page__hbar-chart-inner">
                      {sportItems.map((x, i) => (
                        <div key={x.sportId ?? x.sportName ?? i} className="analytics-page__hbar-row">
                          <span className="analytics-page__hbar-label">{x.sportName ?? '—'}</span>
                          <div className="analytics-page__hbar-track">
                            <div
                              className="analytics-page__hbar-bar"
                              style={{
                                width: `${((x.clientCount ?? 0) / maxCount) * 100}%`,
                                backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                              }}
                            />
                          </div>
                          <span className="analytics-page__hbar-value">{(x.clientCount ?? 0).toLocaleString('ru-RU')}</span>
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <EmptyState compact message="Нет данных" />
                )}
              </div>
            </section>

            <section className="analytics-page__section analytics-page__section--card analytics-page__section--with-donut">
              <h3 className="analytics-page__section-title">Расходы по категориям</h3>
              <p className="analytics-page__section-hint">За выбранный период</p>
              {expensesByCatTotal > 0 ? (
                <div className="analytics-page__expenses-wrap">
                  <div className="analytics-page__donut-wrap analytics-page__donut-wrap--expenses">
                    <DonutChart
                      data={expensesByCatItems.map((x, i) => ({
                        label: x.categoryName ?? '—',
                        value: x.amount ?? 0,
                        color: DONUT_COLORS[i % DONUT_COLORS.length],
                      })).filter((d) => d.value > 0)}
                      size={180}
                      strokeWidth={22}
                      centerLabel={formatMoney(expensesByCatTotal)}
                    />
                  </div>
                  <ul className="analytics-page__expenses-legend">
                    {expensesByCatItems.map((x, i) => {
                      const pct = expensesByCatTotal > 0 ? ((x.amount ?? 0) / expensesByCatTotal * 100).toFixed(1) : 0;
                      return (
                        <li key={x.categoryId ?? x.categoryName ?? i}>
                          <span className="analytics-page__expenses-legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                          {x.categoryName ?? '—'}: {formatMoney(x.amount)} ({pct}%)
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <EmptyState compact message="Нет расходов за период" />
              )}
            </section>
          </div>
          </div>

          <section id="analytics-leads" className="analytics-page__section analytics-page__section--leads">
            <div className="analytics-page__section-head">
              <div>
                <h3 className="analytics-page__section-title">Заявки и воронка лидов</h3>
                <p className="analytics-page__section-desc">
                  {queryState.year ? `Период: ${queryState.year}${queryState.month ? ` / ${queryState.month}` : ''}${queryState.day ? ` / ${queryState.day}` : ''}` : 'Выберите год для фильтрации по периоду'}
                </p>
              </div>
              <button
                type="button"
                className="analytics-page__leads-toggle"
                onClick={() => setLeadsVisible((v) => !v)}
              >
                {leadsVisible ? 'Скрыть' : 'Показать'}
              </button>
            </div>
            {leadsVisible && (
            <>
            <div className="analytics-page__leads-kpis">
              <div className="analytics-page__card analytics-page__card--static">
                <span className="analytics-page__card-label">Всего заявок</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{leadsByStatus.total}</span>
              </div>
              <div className="analytics-page__card analytics-page__card--static analytics-page__card--green">
                <span className="analytics-page__card-label">Принято</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{leadsByStatus.accepted}</span>
              </div>
              <div className="analytics-page__card analytics-page__card--static analytics-page__card--red">
                <span className="analytics-page__card-label">Отказано</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{leadsByStatus.rejected}</span>
              </div>
              <div className="analytics-page__card analytics-page__card--static analytics-page__card--gray">
                <span className="analytics-page__card-label">В работе</span>
                <span className="analytics-page__card-value analytics-page__card-value--num">{leadsByStatus.pending}</span>
              </div>
            </div>
            <div className="analytics-page__leads-grid">
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Лиды по каналам</h4>
                <div className="analytics-page__leads-donut-wrap">
                  <DonutChart
                    data={donutLeadsChannelData}
                    size={180}
                    strokeWidth={22}
                    centerLabel={leadsByStatus.total > 0 ? String(leadsByStatus.total) : ''}
                  />
                </div>
                <ul className="analytics-page__leads-channel-list">
                  {leadsByChannel.map((x, i) => (
                    <li key={x.key ?? x.label ?? `channel-${i}`}>{x.label ?? x.key ?? '—'}: {x.count ?? 0}</li>
                  ))}
                  {leadsByChannel.length === 0 && (
                    <li className="analytics-page__leads-empty-li">
                      <EmptyState compact message="Нет данных" />
                    </li>
                  )}
                </ul>
              </div>
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Воронка по этапам</h4>
                <div className="analytics-page__bars">
                  {leadsByStage.map((x, i) => (
                    <div key={x.stageId ?? x.stageName ?? `stage-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.stageName ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className="analytics-page__bar analytics-page__bar--blue" style={{ width: `${((x.count ?? 0) / leadsStageMax) * 100}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsByStage.length === 0 && <EmptyState compact message="Нет этапов или лидов в воронке" />}
                </div>
                {leadsFunnelTotal > 0 && (
                  <p className="analytics-page__leads-funnel-total">В воронке: <strong>{leadsFunnelTotal}</strong> лидов</p>
                )}
              </div>
              <div className="analytics-page__leads-block analytics-page__leads-block--wide">
                <h4 className="analytics-page__leads-subtitle">Результат (принятые лиды)</h4>
                <div className="analytics-page__bars">
                  {leadsByResult.map((x, i) => (
                    <div key={x.key ?? `result-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.label ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div
                          className={`analytics-page__bar ${(x.key ?? '').toLowerCase() === 'bought' ? 'analytics-page__bar--green' : (x.key ?? '').toLowerCase() === 'rejected' ? 'analytics-page__bar--red' : 'analytics-page__bar--gray'}`}
                          style={{ width: `${leadsByStatus.accepted > 0 ? ((x.count ?? 0) / leadsByStatus.accepted) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsByResult.length === 0 && leadsByStatus.accepted > 0 && (
                    <EmptyState compact message="Статусы результата не заполнены" />
                  )}
                  {leadsByStatus.accepted === 0 && <EmptyState compact message="Нет принятых лидов" />}
                </div>
              </div>
            </div>

            <h4 className="analytics-page__leads-section-title">По полям карточки лида</h4>
            <div className="analytics-page__leads-grid analytics-page__leads-grid--card">
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Источник лида</h4>
                <div className="analytics-page__bars">
                  {leadsBySource.map((x, i) => (
                    <div key={x.key ?? `source-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.label ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className="analytics-page__bar" style={{ width: `${((x.count ?? 0) / leadsCardMax) * 100}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsBySource.length === 0 && <EmptyState compact message="Нет данных" />}
                </div>
              </div>
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Для себя или для детей</h4>
                <div className="analytics-page__bars">
                  {leadsByTargetType.map((x, i) => (
                    <div key={x.key ?? `target-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.label ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className="analytics-page__bar" style={{ width: `${((x.count ?? 0) / leadsCardMax) * 100}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsByTargetType.length === 0 && <EmptyState compact message="Нет данных" />}
                </div>
              </div>
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Вид спорта</h4>
                <div className="analytics-page__bars">
                  {leadsBySport.slice(0, 8).map((x, i) => (
                    <div key={x.sportId ?? `sport-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.sportName ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div className="analytics-page__bar analytics-page__bar--blue" style={{ width: `${((x.count ?? 0) / leadsCardMax) * 100}%` }} />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsBySport.length === 0 && <EmptyState compact message="Нет данных" />}
                </div>
              </div>
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Топ тренеров по лидам</h4>
                <ol className="analytics-page__top-list">
                  {leadsByTrainer.map((x, i) => (
                    <li key={x.trainerId ?? `trainer-${i}`}>{x.trainerName ?? '—'}: {x.count ?? 0}</li>
                  ))}
                  {leadsByTrainer.length === 0 && (
                    <li className="analytics-page__leads-empty-li">
                      <EmptyState compact message="Нет данных" />
                    </li>
                  )}
                </ol>
              </div>
              <div className="analytics-page__leads-block">
                <h4 className="analytics-page__leads-subtitle">Пробная тренировка</h4>
                <div className="analytics-page__bars">
                  {leadsByTrialStatus.map((x, i) => (
                    <div key={x.key ?? `trial-${i}`} className="analytics-page__bar-row analytics-page__bar-row--readonly">
                      <span className="analytics-page__bar-label">{x.label ?? '—'}</span>
                      <div className="analytics-page__bar-wrap">
                        <div
                          className={`analytics-page__bar ${(x.key ?? '').toLowerCase() === 'came' ? 'analytics-page__bar--green' : ['rejected', 'no_contact'].includes((x.key ?? '').toLowerCase()) ? 'analytics-page__bar--red' : 'analytics-page__bar--gray'}`}
                          style={{ width: `${leadsByStatus.accepted > 0 ? ((x.count ?? 0) / leadsByStatus.accepted) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="analytics-page__bar-value">{x.count ?? 0}</span>
                    </div>
                  ))}
                  {leadsByTrialStatus.length === 0 && leadsByStatus.accepted > 0 && (
                    <EmptyState compact message="Статусы не заполнены" />
                  )}
                  {leadsByStatus.accepted === 0 && <EmptyState compact message="Нет принятых лидов" />}
                </div>
              </div>
            </div>
            </>
            )}
          </section>

        </>
      )}

      {detailModal && (
        <div className="analytics-page__modal" onClick={() => setDetailModal(null)}>
          <div className="analytics-page__modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="analytics-page__modal-header">
              <h3 className="analytics-page__modal-title">
                {detailModal === 'income' ? 'Детализация приходов' : detailModal === 'expense' ? 'Детализация расходов' : 'Детализация прибыли'}
              </h3>
              <button type="button" className="analytics-page__modal-x" onClick={() => setDetailModal(null)} aria-label="Закрыть">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {detailLoading && <div className="analytics-page__modal-loading">Загрузка детализации…</div>}
            {!detailLoading && detailModal === 'income' && (() => {
              const incomeItems = detailData?.items ?? detailData?.records ?? detailData?.incomeItems ?? [];
              const hasItems = Array.isArray(incomeItems) && incomeItems.length > 0;
              const totalFromApi = detailData?.total ?? detailData?.incomeTotal;
              if (hasItems) {
                return (
                  <>
                    <div className="ui-list__table-wrap analytics-page__table-wrap analytics-page__modal-table-wrap">
                      <table className="ui-list__table analytics-page__table">
                        <thead><tr><th>Источник</th><th>Описание</th><th>Сумма</th></tr></thead>
                        <tbody>
                          {incomeItems.map((row, i) => (
                            <tr key={i}>
                              <td>{row.sourceLabel ?? (row.source === 'clients' ? 'Клиенты' : row.source === 'sales' ? 'Продажи' : row.source) ?? '—'}</td>
                              <td>{row.description ?? '—'}</td>
                              <td className="analytics-page__table-td--positive">{formatMoney(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="analytics-page__modal-footer">
                      <div className="analytics-page__modal-total-info">
                        <span className="analytics-page__modal-total-label">Итого приход</span>
                        <span className="analytics-page__modal-total-value analytics-page__modal-total-value--income">
                          {formatMoney(totalFromApi)}
                        </span>
                      </div>
                      <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <EmptyState compact className="analytics-page__modal-empty-state" message={<>Нет записей за период.{income != null && Number(income) > 0 && (<span className="analytics-page__modal-summary"> Приход по сводке: <strong>{formatMoney(income)}</strong></span>)}</>} />
                  <div className="analytics-page__modal-footer">
                    <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                  </div>
                </>
              );
            })()}
            {!detailLoading && detailModal === 'expense' && (() => {
              const baseItems = detailData?.items ?? [];
              const isRowSaved = (r) => {
                const saved = r.saved ?? r.is_saved;
                if (saved === false || saved === 'false') return false;
                return saved === true || saved === 'true';
              };
              const expenseItems = baseItems.filter(isRowSaved);
              const expenseTotal = Number(detailData?.total) || 0;
              if (expenseItems.length === 0) {
                return (
                  <>
                    <EmptyState compact className="analytics-page__modal-empty-state" message="Нет записей за период" />
                    <div className="analytics-page__modal-footer">
                      <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <div className="ui-list__table-wrap analytics-page__table-wrap analytics-page__modal-table-wrap">
                    <table className="ui-list__table analytics-page__table">
                      <thead><tr><th>Категория</th><th>Название</th><th>Дата</th><th>Сумма</th></tr></thead>
                      <tbody>
                        {expenseItems.map((row, i) => (
                          <tr key={i}>
                            <td>{row.categoryName ?? '—'}</td>
                            <td>{getExpenseName(row)}</td>
                            <td>{row.date ?? '—'}</td>
                            <td className="analytics-page__table-td--negative">{formatMoney(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="analytics-page__modal-footer">
                    <div className="analytics-page__modal-total-info">
                      <span className="analytics-page__modal-total-label">Итого расход</span>
                      <span className="analytics-page__modal-total-value analytics-page__modal-total-value--expense">{formatMoney(expenseTotal)}</span>
                    </div>
                    <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                  </div>
                </>
              );
            })()}
            {!detailLoading && detailModal === 'profit' && detailData?.items?.length > 0 && (
              <>
                <div className="ui-list__table-wrap analytics-page__table-wrap analytics-page__modal-table-wrap">
                  <table className="ui-list__table analytics-page__table">
                    <thead><tr><th>Тип</th><th>Описание</th><th>Сумма</th></tr></thead>
                    <tbody>
                      {detailData.items.map((row, i) => (
                        <tr key={i}>
                          <td>{row.typeLabel ?? row.type ?? '—'}</td>
                          <td>{row.description ?? '—'}</td>
                          <td className={(row.type ?? '').toLowerCase() === 'expense' ? 'analytics-page__table-td--negative' : 'analytics-page__table-td--positive'}>{formatMoney(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="analytics-page__modal-footer">
                  <div className="analytics-page__modal-profit-summary">
                    <span className="analytics-page__modal-profit-item">
                      <span className="analytics-page__modal-profit-label">Приходы</span>
                      <span className="analytics-page__modal-profit-val analytics-page__modal-profit-val--income">{formatMoney(detailData.incomeTotal)}</span>
                    </span>
                    <span className="analytics-page__modal-profit-sep">·</span>
                    <span className="analytics-page__modal-profit-item">
                      <span className="analytics-page__modal-profit-label">Расходы</span>
                      <span className="analytics-page__modal-profit-val analytics-page__modal-profit-val--expense">{formatMoney(detailData.expenseTotal)}</span>
                    </span>
                    <span className="analytics-page__modal-profit-sep">·</span>
                    <span className="analytics-page__modal-profit-item">
                      <span className="analytics-page__modal-profit-label">Прибыль</span>
                      <span className="analytics-page__modal-profit-val analytics-page__modal-profit-val--profit">{formatMoney(detailData.profit)}</span>
                    </span>
                  </div>
                  <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                </div>
              </>
            )}
            {!detailLoading && detailModal === 'profit' && !detailData?.items?.length && (
              <>
                <EmptyState compact className="analytics-page__modal-empty-state" message="Нет записей за период" />
                <div className="analytics-page__modal-footer">
                  <button type="button" className="analytics-page__modal-close" onClick={() => setDetailModal(null)}>Закрыть</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AnalyticsPage;
