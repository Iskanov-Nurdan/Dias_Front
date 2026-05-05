import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
} from 'recharts';
import './AnalyticsPage.scss';
import { apiClient } from '../../../../shared/api';
import { parseApiListResponse } from '../../../../shared/lib';
import {
  getAnalyticsSummary,
  getRevenueDetails,
  getSalesCostDetails,
  getProfitDetails,
  getProductionCostDetails,
  getPurchaseDetails,
} from '../../api';
import { Loading, ErrorState, Select, FiltersModal } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';

const formatNumber = (num) => Number(num || 0).toLocaleString('ru-RU');

const buildAnalyticsQueryParams = ({
  year,
  month,
  day,
  lineId,
  clientId,
  profileId,
  recipeId,
  batchId,
  statusFilter,
  dateFrom,
  dateTo,
  trendGroup,
}) => {
  const params = {};
  if (year != null && year !== '') params.year = year;
  if (month !== '' && month != null) params.month = month;
  if (day !== '' && day != null) params.day = day;
  if (lineId && String(lineId).trim()) params.line_id = String(lineId).trim();
  if (clientId && String(clientId).trim()) params.client_id = String(clientId).trim();
  if (profileId && String(profileId).trim()) params.profile_id = String(profileId).trim();
  if (recipeId && String(recipeId).trim()) params.recipe_id = String(recipeId).trim();
  if (batchId && String(batchId).trim()) params.batch_id = String(batchId).trim();
  if (statusFilter && String(statusFilter).trim()) params.otk_status = String(statusFilter).trim();
  if (dateFrom && String(dateFrom).trim()) params.date_from = String(dateFrom).trim();
  if (dateTo && String(dateTo).trim()) params.date_to = String(dateTo).trim();
  if (trendGroup) params.trend_group = trendGroup;
  return params;
};

const resolveTrendGroup = ({ month, day, dateFrom, dateTo }) => {
  const df = dateFrom && String(dateFrom).trim();
  const dt = dateTo && String(dateTo).trim();
  if (df && dt) {
    const d1 = new Date(`${df}T00:00:00`);
    const d2 = new Date(`${dt}T00:00:00`);
    if (!Number.isNaN(d1.getTime()) && !Number.isNaN(d2.getTime())) {
      const days = Math.floor((d2 - d1) / 86400000) + 1;
      return days > 62 ? 'month' : 'day';
    }
  }
  if (month !== '' && month != null) return 'day';
  if (day !== '' && day != null) return 'day';
  return 'month';
};

const formatTrendPeriodLabel = (period) => {
  if (period == null || period === '') return '—';
  const s = typeof period === 'string' ? period : String(period);
  if (s.length >= 10) return s.slice(5, 10);
  if (s.length === 7) return s.slice(5);
  return s;
};

const truncateAxisLabel = (s, max = 14) => {
  const t = String(s ?? '').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const profileDisplayName = (p) => {
  const n = (p?.profile_name || '').trim();
  return n || 'Без названия';
};

const clientDisplayName = (c) => {
  const n = (c?.client_name || '').trim();
  return n || '—';
};

const lineDisplayName = (l) => {
  const n = (l?.line_name || '').trim();
  return n || '—';
};

const purchaseTotalFromCards = (c) =>
  Number(
    c?.purchase_total ??
      c?.purchases_total ??
      c?.material_purchase_total ??
      c?.total_purchase_amount ??
      c?.raw_purchase_total ??
      0,
  ) || 0;

const trendPurchaseAmount = (t) =>
  Number(
    t?.purchase_total ??
      t?.purchase_cost ??
      t?.purchase_amount ??
      t?.material_purchase ??
      t?.purchases_total ??
      t?.purchase ??
      0,
  ) || 0;

const AnalyticsChartLegend = ({ payload }) => {
  if (!payload?.length) return null;
  return (
    <ul className="analytics-chart-legend">
      {payload.map((entry, i) => (
        <li key={String(entry.dataKey ?? entry.value ?? i)} className="analytics-chart-legend__item">
          <span className="analytics-chart-legend__swatch" style={{ background: entry.color }} aria-hidden />
          <span className="analytics-chart-legend__label">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

const trendsSeriesHasValues = (rows) =>
  Array.isArray(rows) &&
  rows.some(
    (r) =>
      (Number(r.revenue) || 0) > 0 ||
      (Number(r.sales_cost) || 0) > 0 ||
      (Number(r.profit) || 0) !== 0 ||
      (Number(r.production_cost) || 0) > 0 ||
      (Number(r.purchase_cost) || 0) > 0,
  );

const barSeriesHasValues = (rows, key) =>
  Array.isArray(rows) && rows.some((r) => (Number(r[key]) || 0) > 0);

const pieSeriesHasValues = (rows) =>
  Array.isArray(rows) && rows.some((r) => (Number(r.value) || 0) > 0);

const warehouseBlockVisible = (w) =>
  w &&
  ((Number(w.available) || 0) > 0 ||
    (Number(w.reserved) || 0) > 0 ||
    (Number(w.good) || 0) > 0 ||
    (Number(w.defect) || 0) > 0);

const otkBlockVisible = (o) => {
  if (!o || typeof o !== 'object') return false;
  const a = Number(o.accepted ?? o.accepted_total ?? 0) || 0;
  const d = Number(o.defect ?? o.defect_total ?? o.rejected ?? 0) || 0;
  return a > 0 || d > 0;
};

const productionBlockVisible = (cards, prodSummary, lineRows) => {
  const q = Number(cards?.produced_units_total) || 0;
  const b = Number(prodSummary?.batches_count) || 0;
  if (b > 0 || q > 0) return true;
  return barSeriesHasValues(lineRows, 'quantity');
};

const formatMoney = (num) => `${formatNumber(num)} сом`;

const sliceIsoDate = (raw) => {
  if (raw == null || raw === '') return '—';
  const s = typeof raw === 'string' ? raw : String(raw);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const buildOperationLabel = (...parts) => {
  const cleaned = parts.map((p) => String(p ?? '').trim()).filter(Boolean);
  const deduped = [];
  for (const p of cleaned) {
    if (deduped[deduped.length - 1] !== p) deduped.push(p);
  }
  return deduped.length ? deduped.join(' · ') : '—';
};

const productCell = (name, fallback) => {
  const n = String(name ?? '').trim();
  if (n) return n;
  const f = String(fallback ?? '').trim();
  return f || '—';
};

const ANALYTICS_STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидает проверки' },
  { value: 'accepted', label: 'Принято' },
  { value: 'rejected', label: 'Брак' },
];

const DETAIL_MODAL_TYPES = new Set(['revenue', 'sales_cost', 'profit', 'production', 'purchase']);

const KpiCard = ({ variant, title, value, onOpen }) => (
  <article
    className={`analytics-kpi-card analytics-kpi-card--${variant}`}
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen();
      }
    }}
  >
    <span className="analytics-kpi-card__title">{title}</span>
    <span className="analytics-kpi-card__value">{value}</span>
    <span className="analytics-kpi-card__action">Детали</span>
  </article>
);

const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [lineId, setLineId] = useState('');
  const [clientId, setClientId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lineOptions, setLineOptions] = useState([{ value: '', label: 'Все линии' }]);
  const [clientOptions, setClientOptions] = useState([{ value: '', label: 'Все клиенты' }]);
  const [profileOptions, setProfileOptions] = useState([{ value: '', label: 'Все профили' }]);
  const [recipeOptions, setRecipeOptions] = useState([{ value: '', label: 'Все рецепты' }]);
  const [batchOptions, setBatchOptions] = useState([{ value: '', label: 'Все партии' }]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get('lines/', { params: { page_size: 200 } }).then((r) => parseApiListResponse(r.data)).catch(() => []),
      apiClient.get('clients/', { params: { page_size: 200 } }).then((r) => r.data?.items || []).catch(() => []),
      apiClient.get('plastic-profiles/', { params: { page_size: 200 } }).then((r) => parseApiListResponse(r.data)).catch(() => []),
      apiClient.get('recipes/', { params: { page_size: 200 } }).then((r) => parseApiListResponse(r.data)).catch(() => []),
      apiClient.get('batches/', { params: { page_size: 100, ordering: '-id' } }).then((r) => parseApiListResponse(r.data)).catch(() => []),
    ]).then(([lines, clients, profiles, recipes, batches]) => {
      if (cancelled) return;
      setLineOptions([
        { value: '', label: 'Все линии' },
        ...lines.map((l) => ({ value: String(l.id), label: l.name || 'Линия' })),
      ]);
      setClientOptions([
        { value: '', label: 'Все клиенты' },
        ...clients.map((c) => ({ value: String(c.id), label: c.name || 'Клиент' })),
      ]);
      setProfileOptions([
        { value: '', label: 'Все профили' },
        ...profiles.map((p) => ({
          value: String(p.id),
          label: p.name || 'Профиль',
        })),
      ]);
      setRecipeOptions([
        { value: '', label: 'Все рецепты' },
        ...recipes.map((r) => ({
          value: String(r.id),
          label: r.recipe || r.name || r.product || 'Рецепт',
        })),
      ]);
      setBatchOptions([
        { value: '', label: 'Все партии' },
        ...batches.map((b) => ({
          value: String(b.id),
          label: `${b.profile_name || b.profile?.name || b.recipe_name || b.recipe?.recipe || 'Партия'}`,
        })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    (signal) => {
      setLoading(true);
      setError(null);
      const trendGroup = resolveTrendGroup({ month, day, dateFrom, dateTo });
      const params = buildAnalyticsQueryParams({
        year,
        month,
        day,
        lineId,
        clientId,
        profileId,
        recipeId,
        batchId,
        statusFilter,
        dateFrom,
        dateTo,
        trendGroup,
      });
      return getAnalyticsSummary({ ...params, signal })
        .then((res) => {
          setData(res.data);
        })
        .catch((err) => {
          if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
            setError(err.response?.data || { error: err.message });
          }
        })
        .finally(() => setLoading(false));
    },
    [year, month, day, lineId, clientId, profileId, recipeId, batchId, statusFilter, dateFrom, dateTo],
  );

  const detailQueryParams = useMemo(
    () =>
      buildAnalyticsQueryParams({
        year,
        month,
        day,
        lineId,
        clientId,
        profileId,
        recipeId,
        batchId,
        statusFilter,
        dateFrom,
        dateTo,
      }),
    [year, month, day, lineId, clientId, profileId, recipeId, batchId, statusFilter, dateFrom, dateTo],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useOperationalRefetch(
    ['sale', 'payment', 'order', 'return', 'warehouse_batch', 'defect_record', 'rework_request'],
    () => { load(); },
    true,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const cards = data?.cards || {};
  const otkSummary = data?.otk_summary || {};
  const warehouseSummary = data?.warehouse_summary || {};
  const productionSummary = data?.production_summary || {};

  const months = [
    { value: '', label: 'Весь год' },
    { value: 1, label: 'Январь' }, { value: 2, label: 'Февраль' }, { value: 3, label: 'Март' },
    { value: 4, label: 'Апрель' }, { value: 5, label: 'Май' }, { value: 6, label: 'Июнь' },
    { value: 7, label: 'Июль' }, { value: 8, label: 'Август' }, { value: 9, label: 'Сентябрь' },
    { value: 10, label: 'Октябрь' }, { value: 11, label: 'Ноябрь' }, { value: 12, label: 'Декабрь' },
  ];

  const salesByProfile = Array.isArray(data?.sales_by_profile) ? data.sales_by_profile : [];
  const productChartData = salesByProfile.map((p) => ({
    name: profileDisplayName(p),
    value: Number(p.sold_units) || 0,
    revenue: p.revenue,
  }));

  const salesByClient = Array.isArray(data?.sales_by_client) ? data.sales_by_client : [];
  const clientChartData = salesByClient.map((c) => ({
    name: clientDisplayName(c),
    value: c.revenue,
  }));

  const productionByLine = Array.isArray(data?.production_by_line) ? data.production_by_line : [];
  const lineChartData = productionByLine.map((l) => ({
    name: lineDisplayName(l),
    quantity: Number(l.produced_units) || 0,
    batches: l.batches,
  }));

  const trendsList = Array.isArray(data?.trends) ? data.trends : [];
  const trendsData = trendsList.map((t) => {
    const period = t.period;
    const revenue = Number(t.revenue) || 0;
    const salesCost = Number(t.sales_cost) || 0;
    const profit = Number(t.profit) || 0;
    const productionCost = Number(t.production_cost) || 0;
    const purchaseCost = trendPurchaseAmount(t);
    return {
      date: formatTrendPeriodLabel(period),
      fullDate: period,
      revenue,
      sales_cost: salesCost,
      profit,
      production_cost: productionCost,
      purchase_cost: purchaseCost,
    };
  });

  const showTrendChart = trendsList.length > 0 && trendsSeriesHasValues(trendsData);
  const showProfilesChart = pieSeriesHasValues(productChartData);
  const showClientsChart = pieSeriesHasValues(clientChartData);
  const showProdLines = productionBlockVisible(cards, productionSummary, lineChartData);
  const showWarehouseStrip = warehouseBlockVisible(warehouseSummary);
  const showOtk = otkBlockVisible(otkSummary);
  const salesCount = Number(cards.sales_count) || 0;
  const salesQty = Number(cards.sold_units_total) || 0;
  const showSalesBlock = salesCount > 0 || salesQty > 0 || showProfilesChart;
  const showSkladBlock = showWarehouseStrip;
  const showRow2 = showSalesBlock || showOtk || showSkladBlock;
  const showRow3 = showProfilesChart || showClientsChart;

  const kpiPurchase = purchaseTotalFromCards(cards);

  return (
    <div className="page page--analytics">
      <header className="analytics-hero">
        <div className="analytics-hero__toolbar analytics-toolbar">
          <div className="analytics-toolbar__period">
            <div className="analytics-filters__group">
              <label>Год</label>
              <input
                type="number"
                min="2020"
                max="2030"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <div className="analytics-filters__group">
              <label>Месяц</label>
              <Select
                value={month === '' || month == null ? '' : String(month)}
                onChange={setMonth}
                placeholder="Весь год"
                options={months.map((m) => ({
                  value: m.value === '' || m.value == null ? '' : String(m.value),
                  label: m.label,
                }))}
              />
            </div>
            <div className="analytics-filters__group">
              <label>День</label>
              <Select
                value={day === '' || day == null ? '' : String(day)}
                onChange={setDay}
                placeholder="Весь месяц"
                options={[
                  { value: '', label: 'Весь месяц' },
                  ...Array.from({ length: 31 }, (_, i) => i + 1).map((d) => ({
                    value: String(d),
                    label: String(d),
                  })),
                ]}
              />
            </div>
            <div className="analytics-filters__group analytics-filters__group--toolbar-wide">
              <label>Профиль</label>
              <Select
                value={profileId === '' || profileId == null ? '' : String(profileId)}
                onChange={setProfileId}
                options={profileOptions}
                placeholder="Все профили"
              />
            </div>
            <div className="analytics-filters__group analytics-filters__group--toolbar-wide">
              <label>Партия</label>
              <Select
                value={batchId === '' || batchId == null ? '' : String(batchId)}
                onChange={setBatchId}
                options={batchOptions}
                placeholder="Все партии"
              />
            </div>
          </div>
          <div className="analytics-toolbar__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setMonth('');
                setDay('');
                setLineId('');
                setClientId('');
                setProfileId('');
                setRecipeId('');
                setBatchId('');
                setStatusFilter('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Сброс
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setFiltersOpen(true)}>
              Фильтры
            </button>
          </div>
        </div>
      </header>

      <section className="analytics-finance-shell" aria-label="Ключевые показатели">
        <header className="analytics-finance-shell__head">
          <h2 className="analytics-finance-shell__title">Сводка</h2>
          <p className="analytics-finance-shell__hint">Нажмите карточку, чтобы открыть список операций</p>
        </header>
        <div className="analytics-kpi-dashboard">
          <div className="analytics-kpi-dashboard__row analytics-kpi-dashboard__row--3">
            <KpiCard
              variant="revenue"
              title="Выручка"
              value={formatMoney(cards.revenue_total)}
              onOpen={() => setDetailModal({ type: 'revenue' })}
            />
            <KpiCard
              variant="cost"
              title="Себестоимость продаж"
              value={formatMoney(cards.sales_cost_total)}
              onOpen={() => setDetailModal({ type: 'sales_cost' })}
            />
            <KpiCard
              variant="profit"
              title="Прибыль"
              value={formatMoney(cards.profit_total)}
              onOpen={() => setDetailModal({ type: 'profit' })}
            />
          </div>
          <div className="analytics-kpi-dashboard__row analytics-kpi-dashboard__row--2">
            <KpiCard
              variant="production"
              title="Затраты производства"
              value={formatMoney(cards.production_cost_total)}
              onOpen={() => setDetailModal({ type: 'production' })}
            />
            <KpiCard
              variant="purchase"
              title="Закупки сырья"
              value={formatMoney(kpiPurchase)}
              onOpen={() => setDetailModal({ type: 'purchase' })}
            />
          </div>
        </div>
      </section>

      {showTrendChart && (
        <section className="analytics-panel analytics-panel--chart">
          <header className="analytics-panel__header">
            <h2 className="analytics-panel__title">Динамика</h2>
            <p className="analytics-panel__lede">
              Выручка, себестоимость продаж, прибыль, затраты производства и закупки сырья по периоду
            </p>
          </header>
          <div className="analytics-chart-surface">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={trendsData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="analyticsFillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="analyticsFillCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.45} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                  stroke="transparent"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                  stroke="transparent"
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  formatter={(value) => formatMoney(value)}
                />
                <Legend verticalAlign="top" align="center" content={<AnalyticsChartLegend />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--success)"
                  strokeWidth={2}
                  fill="url(#analyticsFillRevenue)"
                  name="Выручка"
                  dot={false}
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="sales_cost"
                  stroke="var(--danger)"
                  strokeWidth={2}
                  fill="url(#analyticsFillCost)"
                  name="Себестоимость продаж"
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--info)"
                  strokeWidth={2.25}
                  name="Прибыль"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="production_cost"
                  stroke="var(--accent)"
                  strokeWidth={1.85}
                  strokeOpacity={0.9}
                  name="Затраты производства"
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="purchase_cost"
                  stroke="var(--accent-2, var(--accent))"
                  strokeWidth={1.85}
                  strokeOpacity={0.9}
                  name="Закупки сырья"
                  dot={false}
                  activeDot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {showRow2 && (
        <section className="analytics-summary-row" aria-label="Сводка по продажам, ОТК и складу">
          {showSalesBlock && (
            <div className="analytics-summary-card">
              <h3 className="analytics-summary-card__title">Продажи</h3>
              <dl className="analytics-summary-card__dl">
                <div className="analytics-summary-card__pair">
                  <dt>Сделок</dt>
                  <dd>{formatNumber(salesCount)}</dd>
                </div>
                <div className="analytics-summary-card__pair">
                  <dt>Единиц</dt>
                  <dd>{formatNumber(salesQty)}</dd>
                </div>
              </dl>
            </div>
          )}
          {showOtk && (
            <div className="analytics-summary-card">
              <h3 className="analytics-summary-card__title">ОТК</h3>
              <dl className="analytics-summary-card__dl analytics-summary-card__dl--3">
                <div className="analytics-summary-card__pair">
                  <dt>Годных</dt>
                  <dd>{formatNumber(otkSummary.accepted ?? otkSummary.accepted_total ?? 0)}</dd>
                </div>
                <div className="analytics-summary-card__pair">
                  <dt>Брак</dt>
                  <dd>{formatNumber(otkSummary.defect ?? otkSummary.defect_total ?? otkSummary.rejected ?? 0)}</dd>
                </div>
                <div className="analytics-summary-card__pair">
                  <dt>Доля брака</dt>
                  <dd>
                    {otkSummary.defect_percent != null
                      ? `${formatNumber(otkSummary.defect_percent)}%`
                      : otkSummary.defect_rate_pct != null
                        ? `${formatNumber(otkSummary.defect_rate_pct)}%`
                        : otkSummary.defect_rate != null
                          ? `${formatNumber(Number(otkSummary.defect_rate) * 100)}%`
                          : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}
          {showSkladBlock && showWarehouseStrip && (
            <div className="analytics-summary-card">
              <h3 className="analytics-summary-card__title">Склад</h3>
              <dl className="analytics-summary-card__dl analytics-summary-card__dl--strip">
                <div className="analytics-summary-card__pair analytics-summary-card__pair--avail">
                  <dt>Доступно</dt>
                  <dd>{formatNumber(warehouseSummary.available)}</dd>
                </div>
                <div className="analytics-summary-card__pair analytics-summary-card__pair--res">
                  <dt>Резерв</dt>
                  <dd>{formatNumber(warehouseSummary.reserved)}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      )}

      {showRow3 && (
        <section className="analytics-charts-grid">
          {showProfilesChart && (
            <div className="analytics-panel analytics-panel--subchart">
              <header className="analytics-panel__header analytics-panel__header--compact">
                <h2 className="analytics-panel__title">Объём по профилям</h2>
                <p className="analytics-panel__lede">Продано, шт.</p>
              </header>
              <div className="analytics-chart-surface analytics-chart-surface--compact">
                <ResponsiveContainer width="100%" height={236}>
                  <BarChart data={productChartData} margin={{ top: 8, right: 12, left: 0, bottom: 32 }}>
                    <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)', strokeOpacity: 0.5 }}
                      interval={0}
                      angle={0}
                      textAnchor="middle"
                      tickMargin={8}
                      height={40}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                      tickFormatter={(v) => truncateAxisLabel(v, 18)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-hover)' }}
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [formatNumber(value), 'Продано, шт']}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="value" fill="var(--success)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {showClientsChart && (
            <div className="analytics-panel analytics-panel--subchart">
              <header className="analytics-panel__header analytics-panel__header--compact">
                <h2 className="analytics-panel__title">Клиенты</h2>
                <p className="analytics-panel__lede">Выручка</p>
              </header>
              <div className="analytics-chart-surface analytics-chart-surface--compact">
                <ResponsiveContainer width="100%" height={Math.min(56 + clientChartData.length * 32, 268)}>
                  <BarChart layout="vertical" data={clientChartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={112}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                      tickFormatter={(v) => truncateAxisLabel(v, 16)}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-hover)' }}
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => formatMoney(value)}
                      labelFormatter={(label) => String(label)}
                    />
                    <Bar dataKey="value" fill="var(--info)" fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      )}

      {showProdLines && (
        <section className="analytics-panel analytics-panel--production">
          <header className="analytics-panel__header analytics-panel__header--split">
            <div>
              <h2 className="analytics-panel__title">Производство по линиям</h2>
              <p className="analytics-panel__lede">Выпуск и загрузка линий</p>
            </div>
            <dl className="analytics-production-kpis">
              <div className="analytics-production-kpis__item">
                <dt>Партий</dt>
                <dd>{formatNumber(productionSummary.batches_count ?? 0)}</dd>
              </div>
              <div className="analytics-production-kpis__item">
                <dt>Выпуск, шт</dt>
                <dd>{formatNumber(cards.produced_units_total)}</dd>
              </div>
              {(Number(cards.produced_meters_total) || 0) > 0 && (
                <div className="analytics-production-kpis__item">
                  <dt>Выпуск, м</dt>
                  <dd>{formatNumber(cards.produced_meters_total)}</dd>
                </div>
              )}
            </dl>
          </header>
          {barSeriesHasValues(lineChartData, 'quantity') && lineChartData.length > 0 && (
            <div className="analytics-chart-surface analytics-chart-surface--compact">
              <ResponsiveContainer width="100%" height={216}>
                <BarChart data={lineChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                    tickFormatter={(v) => truncateAxisLabel(v, 14)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--bg-hover)' }}
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [formatNumber(value), 'Шт']}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="quantity" fill="var(--accent)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <FiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => {
          setLineId('');
          setClientId('');
          setProfileId('');
          setRecipeId('');
          setBatchId('');
          setStatusFilter('');
          setDateFrom('');
          setDateTo('');
        }}
        title="Фильтры"
      >
        <div className="analytics-advanced-filters">
          <div className="analytics-advanced-filters__row">
            <div className="analytics-advanced-filters__field">
              <label>Линия</label>
              <Select value={lineId} onChange={setLineId} options={lineOptions} placeholder="Все линии" />
            </div>
            <div className="analytics-advanced-filters__field">
              <label>Клиент</label>
              <Select value={clientId} onChange={setClientId} options={clientOptions} placeholder="Все клиенты" />
            </div>
            <div className="analytics-advanced-filters__field">
              <label>Профиль</label>
              <Select value={profileId} onChange={setProfileId} options={profileOptions} placeholder="Все профили" />
            </div>
          </div>
          <div className="analytics-advanced-filters__row">
            <div className="analytics-advanced-filters__field">
              <label>Рецепт</label>
              <Select value={recipeId} onChange={setRecipeId} options={recipeOptions} placeholder="Все рецепты" />
            </div>
            <div className="analytics-advanced-filters__field">
              <label>Партия</label>
              <Select value={batchId} onChange={setBatchId} options={batchOptions} placeholder="Все партии" />
            </div>
            <div className="analytics-advanced-filters__field">
              <label>Статус</label>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={ANALYTICS_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                placeholder="Все статусы"
              />
            </div>
          </div>
          <div className="analytics-advanced-filters__row analytics-advanced-filters__row--2">
            <div className="analytics-advanced-filters__field">
              <label>Период с</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="analytics-advanced-filters__field">
              <label>Период по</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>
      </FiltersModal>

      {detailModal && DETAIL_MODAL_TYPES.has(detailModal.type) && (
        <DetailModal
          type={detailModal.type}
          queryParams={detailQueryParams}
          summaryCards={cards}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
};

const DETAIL_TITLES = {
  revenue: 'Выручка',
  sales_cost: 'Себестоимость продаж',
  profit: 'Прибыль',
  production: 'Затраты производства',
  purchase: 'Закупки сырья',
};

const DetailModal = ({ type, queryParams, summaryCards, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!DETAIL_MODAL_TYPES.has(type)) return undefined;
    setLoading(true);
    setError(false);
    setDetails(null);
    const ctrl = new AbortController();
    const p = queryParams || {};
    const req = { ...p, signal: ctrl.signal };
    const fetchDetails =
      type === 'revenue'
        ? getRevenueDetails(req)
        : type === 'sales_cost'
          ? getSalesCostDetails(req)
          : type === 'profit'
            ? getProfitDetails(req)
            : type === 'production'
              ? getProductionCostDetails(req)
              : getPurchaseDetails(req);

    fetchDetails
      .then((res) => setDetails(res.data))
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') setError(true);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [type, queryParams]);

  const profitTotals = details?.totals;
  const summary = summaryCards || {};
  const displayProfit = profitTotals?.profit ?? summary.profit_total;
  const displayRevenue = profitTotals?.revenue ?? summary.revenue_total;
  const displayCost = profitTotals?.sales_cost ?? summary.sales_cost_total;

  const itemsLen = (() => {
    if (!details?.items || !Array.isArray(details.items)) return 0;
    return details.items.length;
  })();

  const EmptyHint = () => (
    <p className="analytics-empty analytics-empty--inline analytics-empty--modal">Нет данных за выбранный период.</p>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide modal--detail-tight" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head modal__head--compact">
          <h3>{DETAIL_TITLES[type] || 'Детализация'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="detail-content detail-content--tight">
          {loading && <p className="analytics-empty analytics-empty--inline">Загрузка…</p>}
          {error && <p className="analytics-empty analytics-empty--inline">Не удалось загрузить детализацию</p>}

          {type === 'revenue' && details && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Итого</span>
                <span className="detail-row__value">{formatMoney(details.total)}</span>
              </div>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--6">
                    <div className="detail-table-cell">Дата</div>
                    <div className="detail-table-cell">Клиент</div>
                    <div className="detail-table-cell">Продукт</div>
                    <div className="detail-table-cell detail-table-cell--num">Кол-во</div>
                    <div className="detail-table-cell detail-table-cell--num">Цена</div>
                    <div className="detail-table-cell detail-table-cell--num">Выручка</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => {
                      const client = String(item.client_name ?? '').trim() || '—';
                      const product = productCell(item.product_name, item.profile_name);
                      const lineRevenue =
                        Number(item.revenue ?? item.total ?? item.total_price ?? 0) || 0;
                      return (
                        <div key={item.id ?? `${item.date}-${client}-${i}`} className="detail-table-row detail-table-row--6">
                          <div className="detail-table-cell">{sliceIsoDate(item.date)}</div>
                          <div className="detail-table-cell detail-table-cell--object">{client}</div>
                          <div className="detail-table-cell detail-table-cell--object">{product}</div>
                          <div className="detail-table-cell detail-table-cell--num">{formatNumber(item.quantity)} шт</div>
                          <div className="detail-table-cell detail-table-cell--num">
                            {formatMoney(item.price_per_unit ?? item.unit_price)}
                          </div>
                          <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                            {formatMoney(lineRevenue)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'sales_cost' && details && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Итого</span>
                <span className="detail-row__value">
                  {formatMoney(details.total_sales_cost ?? details.total ?? 0)}
                </span>
              </div>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--6">
                    <div className="detail-table-cell">Дата</div>
                    <div className="detail-table-cell">Продажа / заказ</div>
                    <div className="detail-table-cell">Продукт</div>
                    <div className="detail-table-cell detail-table-cell--num">Кол-во</div>
                    <div className="detail-table-cell detail-table-cell--num">Себестоимость за ед.</div>
                    <div className="detail-table-cell detail-table-cell--num">Сумма</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => {
                      const rawD = item.date || item.sale_date || item.created_at;
                      const d = sliceIsoDate(rawD);
                      const q = item.quantity;
                      const sum = Number(item.total_cost ?? 0) || 0;
                      const cpu = item.cost_per_unit;
                      const unitLabel = cpu != null && cpu !== '' ? formatMoney(cpu) : '—';
                      const product = productCell(item.product_name, item.profile_name);
                      const orderLabel = String(item.order_number ?? '').trim() || '—';
                      return (
                        <div
                          key={`${d}-${orderLabel}-${i}`}
                          className="detail-table-row detail-table-row--6"
                        >
                          <div className="detail-table-cell">{d}</div>
                          <div className="detail-table-cell detail-table-cell--object">{orderLabel}</div>
                          <div className="detail-table-cell detail-table-cell--object">{product}</div>
                          <div className="detail-table-cell detail-table-cell--num">
                            {q != null && q !== '' ? `${formatNumber(q)} шт` : '—'}
                          </div>
                          <div className="detail-table-cell detail-table-cell--num">{unitLabel}</div>
                          <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                            {formatMoney(sum)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'production' && details && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Итого</span>
                <span className="detail-row__value">
                  {formatMoney(details.total_production_cost ?? details.total ?? 0)}
                </span>
              </div>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--7">
                    <div className="detail-table-cell">Дата</div>
                    <div className="detail-table-cell">Партия</div>
                    <div className="detail-table-cell">Профиль</div>
                    <div className="detail-table-cell">Линия</div>
                    <div className="detail-table-cell detail-table-cell--num">Шт</div>
                    <div className="detail-table-cell detail-table-cell--num">Метры</div>
                    <div className="detail-table-cell detail-table-cell--num">Затраты</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => {
                      const rawD = item.date || item.created_at;
                      const d = sliceIsoDate(rawD);
                      const batchNo = item.production_batch_id;
                      const batchLabel =
                        batchNo != null && batchNo !== '' ? `№ ${batchNo}` : '—';
                      const profile = String(item.profile_name ?? '').trim() || '—';
                      const line = String(item.line_name ?? '').trim() || '—';
                      const pieces = item.quantity_pieces ?? item.pieces ?? item.quantity;
                      const meters = item.total_meters ?? item.meters;
                      const cost = Number(item.material_cost_total ?? item.total_cost ?? 0) || 0;
                      return (
                        <div key={`${d}-${batchLabel}-${i}`} className="detail-table-row detail-table-row--7">
                          <div className="detail-table-cell">{d}</div>
                          <div className="detail-table-cell">{batchLabel}</div>
                          <div className="detail-table-cell detail-table-cell--object">{profile}</div>
                          <div className="detail-table-cell detail-table-cell--object">{line}</div>
                          <div className="detail-table-cell detail-table-cell--num">
                            {pieces != null && pieces !== '' ? formatNumber(pieces) : '—'}
                          </div>
                          <div className="detail-table-cell detail-table-cell--num">
                            {meters != null && meters !== '' ? formatNumber(meters) : '—'}
                          </div>
                          <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                            {formatMoney(cost)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'purchase' && details && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Итого</span>
                <span className="detail-row__value">
                  {formatMoney(details.total_purchase_amount ?? details.total ?? 0)}
                </span>
              </div>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--6">
                    <div className="detail-table-cell">Дата</div>
                    <div className="detail-table-cell">Материал</div>
                    <div className="detail-table-cell">Поставщик</div>
                    <div className="detail-table-cell detail-table-cell--num">Кол-во</div>
                    <div className="detail-table-cell detail-table-cell--num">Цена</div>
                    <div className="detail-table-cell detail-table-cell--num">Сумма</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => {
                      const rawD = item.date || item.created_at;
                      const d = sliceIsoDate(rawD);
                      const mat = String(item.material_name ?? '').trim() || '—';
                      const sup = String(item.supplier_name ?? '').trim() || '—';
                      const q = item.quantity;
                      const sum = Number(item.total_amount ?? 0) || 0;
                      const up = item.unit_price;
                      return (
                        <div key={`${d}-${mat}-${i}`} className="detail-table-row detail-table-row--6">
                          <div className="detail-table-cell">{d}</div>
                          <div className="detail-table-cell detail-table-cell--object">{mat}</div>
                          <div className="detail-table-cell detail-table-cell--object">{sup}</div>
                          <div className="detail-table-cell detail-table-cell--num">
                            {q != null && q !== '' ? formatNumber(q) : '—'}
                          </div>
                          <div className="detail-table-cell detail-table-cell--num">{formatMoney(up)}</div>
                          <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                            {formatMoney(sum)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {type === 'profit' && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Прибыль</span>
                <span className="detail-row__value">{formatMoney(displayProfit)}</span>
              </div>
              <div className="detail-section detail-section--tight">
                <div className="detail-row">
                  <span className="detail-row__label">Выручка</span>
                  <span className="detail-row__value detail-row__value--positive">+ {formatMoney(displayRevenue)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-row__label">Себестоимость</span>
                  <span className="detail-row__value detail-row__value--negative">− {formatMoney(displayCost)}</span>
                </div>
                <div className="detail-row detail-row--total">
                  <span className="detail-row__label">Итого</span>
                  <span className="detail-row__value">{formatMoney(displayProfit)}</span>
                </div>
              </div>
              {details?.items && details.items.length > 0 ? (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--6">
                    <div className="detail-table-cell">Дата</div>
                    <div className="detail-table-cell">Продажа / заказ</div>
                    <div className="detail-table-cell">Объект</div>
                    <div className="detail-table-cell detail-table-cell--num">Выручка</div>
                    <div className="detail-table-cell detail-table-cell--num">Себестоимость</div>
                    <div className="detail-table-cell detail-table-cell--num">Прибыль</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => {
                      const obj =
                        String(item.object ?? '').trim() ||
                        buildOperationLabel(item.client_name, item.profile_name, item.product_name);
                      return (
                        <div
                          key={item.sale_id ?? item.id ?? `${item.date}-${obj}-${i}`}
                          className="detail-table-row detail-table-row--6"
                        >
                          <div className="detail-table-cell">{sliceIsoDate(item.date)}</div>
                          <div className="detail-table-cell">{String(item.order_number ?? '').trim() || '—'}</div>
                          <div className="detail-table-cell detail-table-cell--object">{obj}</div>
                          <div className="detail-table-cell detail-table-cell--num">{formatMoney(item.revenue)}</div>
                          <div className="detail-table-cell detail-table-cell--num">{formatMoney(item.sales_cost)}</div>
                          <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                            {formatMoney(item.profit)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                details && <EmptyHint />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
