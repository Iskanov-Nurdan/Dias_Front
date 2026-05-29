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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import './AnalyticsPage.scss';
import {
  getAnalyticsSummary,
  getRevenueDetails,
  getSalesCostDetails,
  getProductUnitCosts,
  getProfitDetails,
  getDebtDetails,
  getProductionCostDetails,
  getPurchaseDetails,
  getOtherExpenses,
} from '../../api';
import { STAGE2_TABS_ENABLED } from '../../../../shared/config/constants';
import { Loading, ErrorState, Select } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useIsMobile } from '../../../../shared/hooks';
import OtherExpensesModal from '../OtherExpensesModal';

const formatNumber = (num) => Number(num || 0).toLocaleString('ru-RU');

const buildAnalyticsQueryParams = ({
  year,
  month,
  day,
  lineId,
  clientId,
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
  const n = (c?.client_name || c?.name || '').trim();
  return n || '—';
};

const clientDebtTotal = (cards) => Number(cards?.client_debt_total ?? 0) || 0;

/** Подпись к долгу из debt_as_of summary (бэкенд). */
const debtAsOfHint = (debtAsOf) => {
  const k = String(debtAsOf ?? '').trim();
  if (k === 'current_outstanding_by_sale_date_in_period') {
    return 'Продажи за выбранный период · остаток долга на сейчас';
  }
  return '';
};

const TREND_CHART_LEGEND = [
  { value: 'Выручка', color: 'var(--success)' },
  { value: 'Расходы', color: 'var(--danger)' },
];

const TREND_CHART_HEIGHT = { desktop: 360, mobile: 312 };

const AnalyticsChartLegend = ({ payload }) => {
  const items = payload?.length ? payload : TREND_CHART_LEGEND;
  return (
    <ul className="analytics-chart-legend">
      {items.map((entry, i) => (
        <li key={String(entry.dataKey ?? entry.value ?? i)} className="analytics-chart-legend__item">
          <span className="analytics-chart-legend__swatch" style={{ background: entry.color }} aria-hidden />
          <span className="analytics-chart-legend__label">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

const moneyGtZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
};

const trendsMoneyHasValues = (rows) =>
  Array.isArray(rows) &&
  rows.some((r) => moneyGtZero(r.revenue) || moneyGtZero(r.expenses));

const otkDefectPercent = (o) => {
  if (!o || typeof o !== 'object') return null;
  if (o.defect_percent != null) return Number(o.defect_percent);
  if (o.defect_rate_pct != null) return Number(o.defect_rate_pct);
  if (o.defect_rate != null) return Number(o.defect_rate) * 100;
  const a = Number(o.accepted ?? o.accepted_total ?? 0) || 0;
  const d = Number(o.defect ?? o.defect_total ?? o.rejected ?? 0) || 0;
  if (a + d <= 0) return null;
  return (d / (a + d)) * 100;
};

/** Доля брака: 1 знак после запятой, без хвоста .0 → «6,9%», но «0%» при нуле. */
const formatDefectPct = (pct) => {
  if (pct == null || !Number.isFinite(pct)) return '—';
  if (pct === 0) return '0%';
  return `${pct.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

/** Целое для штук ОТК (бэк может прислать дробное при пересчёте кг → шт). */
const formatPiecesInt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('ru-RU');
};

const formatMoney = (num) => `${formatNumber(num)} сом`;

const CHART_COLORS = [
  'var(--success)',
  'var(--info)',
  'var(--accent-2)',
  'var(--danger)',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#64748b',
];

const chartTooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--card-border)',
  borderRadius: '10px',
  fontSize: '12px',
  boxShadow: 'var(--shadow-md)',
};

const compactMoneyTick = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
};

const sumSeries = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + (Number(row.value) || 0), 0);

const topSeriesWithOther = (rows, limit = 5) => {
  const clean = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ ...row, value: Number(row.value) || 0 }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
  const head = clean.slice(0, limit);
  const tail = clean.slice(limit);
  const other = tail.reduce((sum, row) => sum + row.value, 0);
  return other > 0 ? [...head, { name: 'Остальные', value: other }] : head;
};

const toMoneyNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Закупки сырья за период (из cards summary). */
const purchaseTotalFromCards = (c) =>
  toMoneyNum(
    c?.purchase_total ??
      c?.purchases_total ??
      c?.material_purchase_total ??
      c?.total_purchase_amount ??
      c?.raw_purchase_total,
  );

/** Прочие расходы (принятые) за период. */
const otherExpensesFromCards = (c) =>
  toMoneyNum(c?.other_expenses_total ?? c?.accepted_other_expenses_total ?? c?.misc_expenses_total);

/** Расходы периода = приход сырья + принятые прочие (по дате расхода). */
const periodExpensesFromCards = (c) => {
  const purchase = purchaseTotalFromCards(c);
  const other = otherExpensesFromCards(c);
  if (c?.period_expenses_total != null || c?.operating_expenses_total != null) {
    return toMoneyNum(c?.period_expenses_total ?? c?.operating_expenses_total);
  }
  return purchase + other;
};

/** Приход сырья за точку тренда (день/месяц). */
const trendPurchaseFromPoint = (t) =>
  toMoneyNum(t?.purchase_total ?? t?.purchase ?? t?.period_expenses);

const trendOtherExpensesFromPoint = (t) =>
  toMoneyNum(t?.other_expenses_total ?? t?.misc_expenses_total);

/** Расходы за точку тренда. */
const trendPeriodExpensesFromPoint = (t) => {
  const combined = toMoneyNum(t?.period_expenses_total ?? t?.expenses);
  if (t?.period_expenses_total != null || t?.expenses != null) return combined;
  return trendPurchaseFromPoint(t) + trendOtherExpensesFromPoint(t);
};

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

const DETAIL_MODAL_TYPES = new Set(['revenue', 'sales_cost', 'product_cost', 'profit', 'debt', 'production', 'purchase']);

const unitCostPerPieceFromRecord = (row) => {
  const raw =
    row?.unit_cost_per_piece ??
    row?.cost_per_piece ??
    row?.material_cost_per_piece ??
    row?.current_unit_cost ??
    row?.unit_cost;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const normalizeProductCostCatalog = (data) => {
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    items: items.map((item) => ({
      profile_id: item.profile_id ?? item.id,
      profile_name: String(item.profile_name ?? item.name ?? '').trim(),
      product_name: item.product_name != null ? String(item.product_name).trim() : '',
      code: String(item.code ?? item.profile_code ?? '').trim(),
      is_active: item.is_active !== false,
      unit_cost_per_piece: unitCostPerPieceFromRecord(item),
    })),
  };
};

const AnalyticsPage = () => {
  const isMobile = useIsMobile();
  const now = new Date();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [day, setDay] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [otherExpensesOpen, setOtherExpensesOpen] = useState(false);

  const load = useCallback(
    (signal) => {
      setLoading(true);
      setError(null);
      const trendGroup = resolveTrendGroup({ month, day, dateFrom: '', dateTo: '' });
      const params = buildAnalyticsQueryParams({
        year,
        month,
        day,
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
    [year, month, day],
  );

  const detailQueryParams = useMemo(
    () => buildAnalyticsQueryParams({ year, month, day }),
    [year, month, day],
  );

  const trendChartMargin = useMemo(
    () => ({
      top: isMobile ? 8 : 12,
      right: isMobile ? 4 : 12,
      left: isMobile ? -4 : 0,
      bottom: isMobile ? 36 : 16,
    }),
    [isMobile],
  );
  const trendChartHeight = isMobile ? TREND_CHART_HEIGHT.mobile : TREND_CHART_HEIGHT.desktop;

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useOperationalRefetch(
    ['sale', 'payment', 'order', 'return', 'warehouse_batch', 'defect_record', 'rework_request', 'other_expense'],
    () => {
      load();
    },
    true,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const cards = data?.cards || {};
  const otkSummary = data?.otk_summary || {};
  const warehouseSummary = data?.warehouse_summary || {};
  const debtTotal = clientDebtTotal(cards);
  const debtHint = debtAsOfHint(data?.debt_as_of);
  const defectPct = otkDefectPercent(otkSummary);

  const months = [
    { value: '', label: 'Весь год' },
    { value: 1, label: 'Январь' }, { value: 2, label: 'Февраль' }, { value: 3, label: 'Март' },
    { value: 4, label: 'Апрель' }, { value: 5, label: 'Май' }, { value: 6, label: 'Июнь' },
    { value: 7, label: 'Июль' }, { value: 8, label: 'Август' }, { value: 9, label: 'Сентябрь' },
    { value: 10, label: 'Октябрь' }, { value: 11, label: 'Ноябрь' }, { value: 12, label: 'Декабрь' },
  ];
  const selectedMonth = months.find((m) => String(m.value) === String(month));
  const periodTitle = day
    ? `${day} ${selectedMonth?.label?.toLowerCase() || ''} ${year}`
    : `${selectedMonth?.label || 'Весь год'} ${year}`;

  const salesByProfile = Array.isArray(data?.sales_by_profile) ? data.sales_by_profile : [];
  const productChartData = salesByProfile.map((p) => ({
    name: profileDisplayName(p),
    value: Number(p.sold_units) || 0,
    revenue: Number(p.revenue) || 0,
  }));

  const trendsList = Array.isArray(data?.trends) ? data.trends : [];
  const trendsData = trendsList.map((t) => {
    const revenue = Number(t.revenue) || 0;
    const expenses = trendPeriodExpensesFromPoint(t);
    return {
      date: formatTrendPeriodLabel(t.period),
      fullDate: t.period,
      revenue,
      expenses,
    };
  });

  const showTrendChart = trendsList.length > 0 && trendsMoneyHasValues(trendsData);
  const salesCount = Number(cards.sales_count) || 0;
  const salesQty = Number(cards.sold_units_total) || 0;
  const revenueVal = toMoneyNum(cards.revenue_total);
  const purchaseVal = purchaseTotalFromCards(cards);
  const otherExpensesVal = otherExpensesFromCards(cards);
  const expenseTotalSum = periodExpensesFromCards(cards);
  const netMargin = revenueVal - expenseTotalSum;
  const marginPct = revenueVal > 0 ? (netMargin / revenueVal) * 100 : null;
  const avgCheck = salesCount > 0 ? revenueVal / salesCount : 0;
  const packagingSummary = data?.packaging_summary && typeof data.packaging_summary === 'object' ? data.packaging_summary : null;
  const packagingPieces = Number(packagingSummary?.pieces_total ?? packagingSummary?.pieces ?? 0) || 0;
  const packagingPackages = Number(packagingSummary?.packages_count ?? packagingSummary?.packages ?? 0) || 0;
  const packagingKg = packagingSummary?.weight_kg_total ?? packagingSummary?.weight_kg;
  const showPackagingCard =
    packagingSummary &&
    (packagingPieces > 0 || packagingPackages > 0 || (packagingKg != null && Number(packagingKg) > 0));
  const showDebtBlock = STAGE2_TABS_ENABLED && debtTotal > 0;
  const acceptedQty = Number(otkSummary.accepted ?? otkSummary.accepted_total ?? 0) || 0;
  const defectQty = Number(otkSummary.defect ?? otkSummary.defect_total ?? otkSummary.rejected ?? 0) || 0;
  const reservedQty = Number(warehouseSummary.reserved ?? 0) || 0;
  const availableQty = Number(warehouseSummary.available ?? 0) || 0;
  const expensePieData = [
    { name: 'Приход сырья', value: purchaseVal, color: 'var(--accent-2)' },
    { name: 'Прочие расходы', value: otherExpensesVal, color: 'var(--danger)' },
  ].filter((item) => item.value > 0);
  const revenuePieData = topSeriesWithOther(
    productChartData.map((item) => ({
      name: item.name,
      value: item.revenue,
    })),
    6,
  );
  const qualityPieData = [
    { name: 'Годные', value: acceptedQty, color: 'var(--success)' },
    { name: 'Брак', value: defectQty, color: 'var(--danger)' },
  ].filter((item) => item.value > 0);
  const stockBarData = [
    { name: 'Доступно', value: availableQty, color: '#8b5cf6' },
    { name: 'Резерв', value: reservedQty, color: 'var(--warning)' },
  ].filter((item) => item.value > 0);
  const salesRevenueChartData = productChartData
    .filter((item) => item.value > 0 || item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const marginTrendData = trendsData.map((item) => ({
    ...item,
    margin: item.revenue - item.expenses,
  }));
  const showExpensePie = sumSeries(expensePieData) > 0;
  const showRevenuePie = sumSeries(revenuePieData) > 0;
  const showQualityPie = sumSeries(qualityPieData) > 0;
  const showStockBar = stockBarData.length > 1 && sumSeries(stockBarData) > 0;
  const showSalesRevenueCombo = salesRevenueChartData.length > 0;
  const showMarginTrend = marginTrendData.some((item) => item.revenue > 0 || item.expenses > 0 || item.margin !== 0);

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
          </div>
          <div className="analytics-toolbar__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                const d = new Date();
                setYear(d.getFullYear());
                setMonth(String(d.getMonth() + 1));
                setDay('');
              }}
            >
              Сброс
            </button>
          </div>
        </div>
      </header>

      <section className="analytics-finance-shell analytics-pnl" aria-label="Финансы за период">
        <header className="analytics-finance-shell__head">
          <div>
            <h2 className="analytics-finance-shell__title">Сводка</h2>
            <p className="analytics-finance-shell__hint">
              {periodTitle}
            </p>
          </div>
          <div className="analytics-finance-shell__actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setDetailModal({ type: 'product_cost' })}
            >
              Себестоимость товара
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setOtherExpensesOpen(true)}
            >
              Прочие расходы
            </button>
          </div>
        </header>
        <div className="analytics-pnl__grid">
          <div className="analytics-pnl__card analytics-pnl__card--in">
            <div className="analytics-pnl__card-body">
              <h3 className="analytics-pnl__card-title">Выручка</h3>
              <p className="analytics-pnl__card-caption analytics-pnl__card-caption--spacer" aria-hidden="true">
                &nbsp;
              </p>
              <p className="analytics-pnl__card-figure">{formatMoney(revenueVal)}</p>
            </div>
            <div className="analytics-pnl__card-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setDetailModal({ type: 'revenue' })}
              >
                Детали
              </button>
            </div>
          </div>
          <div className="analytics-pnl__card analytics-pnl__card--out">
            <div className="analytics-pnl__card-body">
              <h3 className="analytics-pnl__card-title">Расходы</h3>
              <p className="analytics-pnl__card-caption">Приход сырья и прочие</p>
              <p className="analytics-pnl__card-figure">{formatMoney(expenseTotalSum)}</p>
            </div>
            <div className="analytics-pnl__card-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setDetailModal({ type: 'purchase' })}
              >
                Детали
              </button>
            </div>
          </div>
          <div
            className={`analytics-pnl__card analytics-pnl__card--net${netMargin >= 0 ? ' analytics-pnl__card--net-pos' : ' analytics-pnl__card--net-neg'}`}
          >
            <h3 className="analytics-pnl__card-title">Маржа</h3>
            <p className="analytics-pnl__card-figure analytics-pnl__card-figure--net">{formatMoney(netMargin)}</p>
          </div>
        </div>
        <div className="analytics-fact-rail" aria-label="Короткая сводка">
          <div className="analytics-fact">
            <span>Продаж</span>
            <strong>{formatNumber(salesCount)}</strong>
          </div>
          <div className="analytics-fact">
            <span>Средний чек</span>
            <strong>{formatMoney(avgCheck)}</strong>
          </div>
          <div className="analytics-fact">
            <span>Продано</span>
            <strong>{formatNumber(salesQty)} шт</strong>
          </div>
          <div className="analytics-fact">
            <span>ОТК</span>
            <strong>{formatDefectPct(defectPct)}</strong>
          </div>
          <div className="analytics-fact">
            <span>Склад</span>
            <strong>{formatNumber(availableQty)} шт</strong>
          </div>
          {showPackagingCard ? (
            <div className="analytics-fact">
              <span>Упаковка</span>
              <strong>{formatNumber(packagingPackages)}</strong>
            </div>
          ) : null}
          {showDebtBlock ? (
            <button
              type="button"
              className="analytics-fact analytics-fact--button"
              onClick={() => setDetailModal({ type: 'debt' })}
            >
              <span>Долг</span>
              <strong>{formatMoney(debtTotal)}</strong>
            </button>
          ) : null}
        </div>
      </section>

      <section className="analytics-command-grid" aria-label="Ключевые цифры аналитики">
        <article className="analytics-command-card analytics-command-card--primary">
          <span className="analytics-command-card__label">Чистый результат</span>
          <strong className={netMargin >= 0 ? 'analytics-command-card__value analytics-command-card__value--good' : 'analytics-command-card__value analytics-command-card__value--bad'}>
            {formatMoney(netMargin)}
          </strong>
          <span className="analytics-command-card__hint">
            {marginPct == null ? 'Маржа не рассчитана без выручки' : `Маржинальность ${formatDefectPct(marginPct)}`}
          </span>
        </article>
        <article className="analytics-command-card">
          <span className="analytics-command-card__label">Средний чек</span>
          <strong className="analytics-command-card__value">{formatMoney(avgCheck)}</strong>
          <span className="analytics-command-card__hint">{formatNumber(salesCount)} продаж за период</span>
        </article>
        <article className="analytics-command-card">
          <span className="analytics-command-card__label">Продано единиц</span>
          <strong className="analytics-command-card__value">{formatNumber(salesQty)}</strong>
          <span className="analytics-command-card__hint">по всем профилям</span>
        </article>
        <article className="analytics-command-card">
          <span className="analytics-command-card__label">Качество ОТК</span>
          <strong className="analytics-command-card__value">{formatDefectPct(defectPct)}</strong>
          <span className="analytics-command-card__hint">
            {formatPiecesInt(acceptedQty)} годных · {formatPiecesInt(defectQty)} брак
          </span>
        </article>
      </section>

      {showTrendChart && (
        <section className="analytics-panel analytics-panel--chart">
          <header className="analytics-panel__header">
            <h2 className="analytics-panel__title">Динамика</h2>
            <p className="analytics-panel__lede">Выручка и расходы по периоду</p>
          </header>
          {isMobile ? (
            <AnalyticsChartLegend payload={TREND_CHART_LEGEND} />
          ) : null}
          <div className="analytics-chart-surface analytics-chart-surface--trend">
            <ResponsiveContainer width="100%" height={trendChartHeight}>
              <ComposedChart data={trendsData} margin={trendChartMargin}>
                <defs>
                  <linearGradient id="analyticsFillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.45} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={isMobile ? 6 : 10}
                  height={isMobile ? 52 : 32}
                  minTickGap={isMobile ? 24 : 12}
                  interval={isMobile ? 'preserveStartEnd' : 0}
                  angle={isMobile ? -42 : 0}
                  textAnchor={isMobile ? 'end' : 'middle'}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                  stroke="transparent"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={isMobile ? 40 : 48}
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
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
                {!isMobile ? (
                  <Legend verticalAlign="top" align="center" content={<AnalyticsChartLegend />} />
                ) : null}
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
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="var(--danger)"
                  strokeWidth={2.25}
                  name="Расходы"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {trendsList.length > 0 && !showTrendChart ? (
        <p className="analytics-empty analytics-empty--inline analytics-empty--soft" role="status">
          Динамика скрыта: за период нет выручки и расходов по дням/месяцам (все нули).
        </p>
      ) : null}

      <section className="analytics-insight-grid analytics-insight-grid--top" aria-label="Финансовые графики">
        <article className="analytics-panel analytics-panel--subchart">
          <header className="analytics-panel__header analytics-panel__header--compact">
            <h2 className="analytics-panel__title">Структура расходов</h2>
            <p className="analytics-panel__lede">Приход сырья и прочие расходы</p>
          </header>
          {showExpensePie ? (
            <div className="analytics-donut-layout">
              <div className="analytics-chart-surface analytics-chart-surface--compact">
                <ResponsiveContainer width="100%" height={238}>
                  <PieChart>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatMoney(value)} />
                    <Pie
                      data={expensePieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={4}
                      stroke="var(--card)"
                      strokeWidth={3}
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <dl className="analytics-legend-list">
                {expensePieData.map((item, index) => (
                  <div key={item.name} className="analytics-legend-list__item">
                    <dt>
                      <span
                        className="analytics-legend-list__dot"
                        style={{ background: item.color || CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      {item.name}
                    </dt>
                    <dd>{formatMoney(item.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="analytics-empty analytics-empty--inline">Нет расходов за выбранный период.</p>
          )}
        </article>

        <article className="analytics-panel analytics-panel--subchart">
          <header className="analytics-panel__header analytics-panel__header--compact">
            <h2 className="analytics-panel__title">Выручка по профилям</h2>
            <p className="analytics-panel__lede">Доля товаров в деньгах</p>
          </header>
          {showRevenuePie ? (
            <div className="analytics-donut-layout">
              <div className="analytics-chart-surface analytics-chart-surface--compact">
                <ResponsiveContainer width="100%" height={238}>
                  <PieChart>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatMoney(value)} />
                    <Pie
                      data={revenuePieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="52%"
                      outerRadius="82%"
                      paddingAngle={3}
                      stroke="var(--card)"
                      strokeWidth={3}
                    >
                      {revenuePieData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <dl className="analytics-legend-list">
                {revenuePieData.map((item, index) => (
                  <div key={item.name} className="analytics-legend-list__item">
                    <dt>
                      <span className="analytics-legend-list__dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                      {item.name}
                    </dt>
                    <dd>{formatMoney(item.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="analytics-empty analytics-empty--inline">Нет выручки по профилям за выбранный период.</p>
          )}
        </article>

        <article className="analytics-panel analytics-panel--subchart analytics-panel--wide">
          <header className="analytics-panel__header analytics-panel__header--compact">
            <h2 className="analytics-panel__title">Маржа в динамике</h2>
            <p className="analytics-panel__lede">Выручка, расходы и результат</p>
          </header>
          {showMarginTrend ? (
            <div className="analytics-chart-surface analytics-chart-surface--compact">
              <ResponsiveContainer width="100%" height={278}>
                <ComposedChart data={marginTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.42} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                    tickFormatter={compactMoneyTick}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => formatMoney(value)} />
                  <Legend verticalAlign="top" align="center" content={<AnalyticsChartLegend />} />
                  <Bar dataKey="revenue" name="Выручка" fill="var(--success)" fillOpacity={0.65} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="expenses" name="Расходы" fill="var(--danger)" fillOpacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Line type="monotone" dataKey="margin" name="Маржа" stroke="var(--info)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="analytics-empty analytics-empty--inline">Нет динамики для расчёта маржи.</p>
          )}
        </article>
      </section>

      <section className="analytics-kpi-grid" aria-label="Операционные показатели">
        <article className="analytics-kpi analytics-kpi--sales">
          <header className="analytics-kpi__head">
            <span className="analytics-kpi__tag">Продажи</span>
          </header>
          <p className="analytics-kpi__value">{formatNumber(salesCount)}</p>
          <p className="analytics-kpi__caption">сделок</p>
          <dl className="analytics-kpi__sub">
            <div className="analytics-kpi__sub-item">
              <dt>Единиц</dt>
              <dd>{formatNumber(salesQty)}</dd>
            </div>
          </dl>
        </article>

        <article className="analytics-kpi analytics-kpi--otk">
          <header className="analytics-kpi__head">
            <span className="analytics-kpi__tag">ОТК</span>
          </header>
          <p className="analytics-kpi__value">
            {formatPiecesInt(otkSummary.accepted ?? otkSummary.accepted_total ?? 0)}
          </p>
          <p className="analytics-kpi__caption">годных</p>
          <dl className="analytics-kpi__sub">
            <div className="analytics-kpi__sub-item">
              <dt>Брак</dt>
              <dd>{formatPiecesInt(otkSummary.defect ?? otkSummary.defect_total ?? otkSummary.rejected ?? 0)}</dd>
            </div>
            <div className="analytics-kpi__sub-item">
              <dt>Доля</dt>
              <dd>{formatDefectPct(defectPct)}</dd>
            </div>
          </dl>
        </article>

        <article className="analytics-kpi analytics-kpi--stock">
          <header className="analytics-kpi__head">
            <span className="analytics-kpi__tag">Склад</span>
          </header>
          <p className="analytics-kpi__value">{formatNumber(warehouseSummary.available ?? 0)}</p>
          <p className="analytics-kpi__caption">доступно, шт</p>
        </article>

        {showPackagingCard && (
          <article className="analytics-kpi analytics-kpi--pack">
            <header className="analytics-kpi__head">
              <span className="analytics-kpi__tag">Упаковка за период</span>
            </header>
            <p className="analytics-kpi__value">{formatNumber(packagingPackages)}</p>
            <p className="analytics-kpi__caption">упаковок</p>
            <dl className="analytics-kpi__sub">
              <div className="analytics-kpi__sub-item">
                <dt>Шт</dt>
                <dd>{formatNumber(packagingPieces)}</dd>
              </div>
              <div className="analytics-kpi__sub-item">
                <dt>Кг</dt>
                <dd>
                  {packagingKg != null && Number(packagingKg) > 0 ? formatNumber(Number(packagingKg)) : '—'}
                </dd>
              </div>
            </dl>
          </article>
        )}

        {showDebtBlock && (
          <article
            className="analytics-kpi analytics-kpi--debt analytics-kpi--action"
            role="button"
            tabIndex={0}
            onClick={() => setDetailModal({ type: 'debt' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDetailModal({ type: 'debt' });
              }
            }}
          >
            <header className="analytics-kpi__head">
              <span className="analytics-kpi__tag">Долг клиентов</span>
            </header>
            <p className="analytics-kpi__value analytics-kpi__value--money">{formatMoney(debtTotal)}</p>
            {debtHint ? <p className="analytics-kpi__caption">{debtHint}</p> : null}
            <span className="analytics-kpi__action-hint">Детали →</span>
          </article>
        )}
      </section>

      <section className="analytics-insight-grid analytics-insight-grid--bottom" aria-label="Операционные графики">
        <article className="analytics-panel analytics-panel--subchart analytics-panel--wide">
          <header className="analytics-panel__header analytics-panel__header--compact">
            <h2 className="analytics-panel__title">Продажи и выручка</h2>
            <p className="analytics-panel__lede">Топ профилей: штуки и деньги</p>
          </header>
          {showSalesRevenueCombo ? (
            <div className="analytics-chart-surface analytics-chart-surface--compact">
              <ResponsiveContainer width="100%" height={292}>
                <ComposedChart data={salesRevenueChartData} margin={{ top: 8, right: 12, left: 0, bottom: 34 }}>
                  <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.42} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickMargin={10}
                    height={46}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                    tickFormatter={(v) => truncateAxisLabel(v, 16)}
                  />
                  <YAxis
                    yAxisId="units"
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                  />
                  <YAxis
                    yAxisId="money"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                    tickFormatter={compactMoneyTick}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name) => (name === 'Выручка' ? formatMoney(value) : [formatNumber(value), name])}
                  />
                  <Legend verticalAlign="top" align="center" content={<AnalyticsChartLegend />} />
                  <Bar yAxisId="units" dataKey="value" name="Шт" fill="var(--info)" fillOpacity={0.72} radius={[4, 4, 0, 0]} maxBarSize={34} />
                  <Line yAxisId="money" type="monotone" dataKey="revenue" name="Выручка" stroke="var(--success)" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="analytics-empty analytics-empty--inline">Нет продаж и выручки по профилям.</p>
          )}
        </article>

        <article className="analytics-panel analytics-panel--subchart">
          <header className="analytics-panel__header analytics-panel__header--compact">
            <h2 className="analytics-panel__title">Качество</h2>
            <p className="analytics-panel__lede">Годные и брак ОТК</p>
          </header>
          {showQualityPie ? (
            <div className="analytics-donut-layout analytics-donut-layout--compact">
              <div className="analytics-chart-surface analytics-chart-surface--compact">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => `${formatPiecesInt(value)} шт`} />
                    <Pie
                      data={qualityPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={4}
                      stroke="var(--card)"
                      strokeWidth={3}
                    >
                      {qualityPieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <dl className="analytics-legend-list">
                {qualityPieData.map((item, index) => (
                  <div key={item.name} className="analytics-legend-list__item">
                    <dt>
                      <span
                        className="analytics-legend-list__dot"
                        style={{ background: item.color || CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      {item.name}
                    </dt>
                    <dd>{formatPiecesInt(item.value)} шт</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="analytics-empty analytics-empty--inline">Нет данных ОТК за период.</p>
          )}
        </article>

        {showStockBar ? (
          <article className="analytics-panel analytics-panel--subchart">
            <header className="analytics-panel__header analytics-panel__header--compact">
              <h2 className="analytics-panel__title">Склад</h2>
              <p className="analytics-panel__lede">Доступно и в резерве</p>
            </header>
            <div className="analytics-chart-surface analytics-chart-surface--compact">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stockBarData} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="4 10" stroke="var(--border)" strokeOpacity={0.35} horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 500 }}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => `${formatNumber(value)} шт`} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
                    {stockBarData.map((entry, index) => (
                      <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        ) : null}
      </section>
      <OtherExpensesModal
        open={otherExpensesOpen}
        onClose={() => setOtherExpensesOpen(false)}
        onChanged={load}
        initialYear={year}
        initialMonth={month}
        initialDay={day}
      />

      {detailModal && DETAIL_MODAL_TYPES.has(detailModal.type) && (
        <DetailModal
          type={detailModal.type}
          queryParams={detailQueryParams}
          summaryCards={cards}
          debtAsOfHint={debtHint}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  );
};

const DETAIL_TITLES = {
  revenue: 'Выручка',
  sales_cost: 'Себестоимость продаж',
  product_cost: 'Себестоимость товара',
  profit: 'Прибыль',
  debt: 'Долг клиентов',
  production: 'Затраты производства',
  purchase: 'Расходы',
};

const DetailModal = ({ type, queryParams, summaryCards, debtAsOfHint: debtHintText, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [expenseSectionsOpen, setExpenseSectionsOpen] = useState({ purchase: false, other: false });

  useEffect(() => {
    if (!DETAIL_MODAL_TYPES.has(type)) return undefined;
    setLoading(true);
    setError(false);
    setDetails(null);
    const ctrl = new AbortController();
    const p = queryParams || {};
    const req = { ...p, signal: ctrl.signal };
    const loadDetails = async () => {
      try {
        if (type === 'product_cost') {
          const res = await getProductUnitCosts(req);
          setDetails(normalizeProductCostCatalog(res.data));
          return;
        }

        if (type === 'purchase') {
          const [purchaseRes, otherRes] = await Promise.all([
            getPurchaseDetails(req),
            getOtherExpenses(req),
          ]);
          const purchaseData = purchaseRes.data || {};
          const otherRaw = Array.isArray(otherRes.data?.items) ? otherRes.data.items : [];
          const otherAccepted = otherRaw.filter(
            (row) => String(row.status ?? '').toLowerCase() === 'accepted',
          );
          const purchaseTotal =
            Number(purchaseData.total_purchase_amount ?? purchaseData.total ?? 0) || 0;
          const otherTotal = otherAccepted.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
          setDetails({
            purchase: purchaseData,
            purchase_items: Array.isArray(purchaseData.items) ? purchaseData.items : [],
            other_items: otherAccepted,
            purchase_total: purchaseTotal,
            other_total: otherTotal,
            period_total: purchaseTotal + otherTotal,
          });
          return;
        }

        const fetchDetails =
          type === 'revenue'
            ? getRevenueDetails(req)
            : type === 'sales_cost'
              ? getSalesCostDetails(req)
              : type === 'profit'
                ? getProfitDetails(req)
                : type === 'production'
                  ? getProductionCostDetails(req)
                  : getDebtDetails(req);

        const res = await fetchDetails;
        setDetails(res.data);
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        if (type === 'debt' && err.response?.status === 404) {
          setDetails({ total_debt: summaryCards?.client_debt_total, items: [] });
          return;
        }
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();

    return () => ctrl.abort();
  }, [type, queryParams]);

  useEffect(() => {
    if (type === 'purchase') {
      setExpenseSectionsOpen({ purchase: false, other: false });
    }
  }, [type, details]);

  const toggleExpenseSection = (key) => {
    setExpenseSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const profitTotals = details?.totals;
  const summary = summaryCards || {};
  const displayProfit = profitTotals?.profit ?? summary.profit_total;
  const displayRevenue = profitTotals?.revenue ?? summary.revenue_total;
  const displayCost = profitTotals?.sales_cost ?? summary.sales_cost_total;

  const itemsLen = (() => {
    if (type === 'purchase' && details) {
      return (details.purchase_items?.length || 0) + (details.other_items?.length || 0);
    }
    if (!details?.items || !Array.isArray(details.items)) return 0;
    return details.items.length;
  })();

  const EmptyHint = () => (
    <p className="analytics-empty analytics-empty--inline analytics-empty--modal">Нет данных за выбранный период.</p>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide modal--detail-tight" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head modal__head--compact modal__head--with-lede">
          <div>
            <h3>{DETAIL_TITLES[type] || 'Детализация'}</h3>
            {type === 'debt' && debtHintText ? (
              <p className="analytics-debt-modal__lede">{debtHintText}</p>
            ) : null}
          </div>
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

          {type === 'product_cost' && details && !loading && !error && (
            <>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--2">
                    <div className="detail-table-cell">Товар (профиль)</div>
                    <div className="detail-table-cell detail-table-cell--num">Себестоимость за шт</div>
                  </div>
                  <div className="detail-table">
                    {[...details.items]
                      .sort((a, b) =>
                        String(a.profile_name || a.code || '').localeCompare(
                          String(b.profile_name || b.code || ''),
                          'ru',
                        ),
                      )
                      .map((item) => {
                        const title =
                          String(item.profile_name || '').trim() ||
                          String(item.product_name || '').trim() ||
                          String(item.code || '').trim() ||
                          (item.profile_id != null ? `Профиль #${item.profile_id}` : '—');
                        const sub = [item.code, item.product_name].filter(Boolean).join(' · ');
                        const cost = item.unit_cost_per_piece;
                        return (
                          <div
                            key={item.profile_id ?? `${title}-${sub}`}
                            className="detail-table-row detail-table-row--2"
                          >
                            <div className="detail-table-cell detail-table-cell--object">
                              {title}
                              {sub ? <span className="detail-table-cell__sub">{sub}</span> : null}
                              {item.is_active === false ? (
                                <span className="detail-table-cell__sub"> · неактивен</span>
                              ) : null}
                            </div>
                            <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                              {cost != null ? formatMoney(cost) : '—'}
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
                <span className="detail-row__label">Итого расходов</span>
                <span className="detail-row__value">{formatMoney(details.period_total ?? 0)}</span>
              </div>
              <div className="detail-accordion">
                <button
                  type="button"
                  className={`detail-row detail-row--compact detail-accordion__trigger${expenseSectionsOpen.purchase ? ' detail-accordion__trigger--open' : ''}`}
                  aria-expanded={expenseSectionsOpen.purchase}
                  onClick={() => toggleExpenseSection('purchase')}
                >
                  <span className="detail-accordion__label">
                    <span className="detail-accordion__chevron" aria-hidden>
                      {expenseSectionsOpen.purchase ? '▾' : '▸'}
                    </span>
                    <span className="detail-row__label">Приход сырья</span>
                  </span>
                  <span className="detail-row__value">{formatMoney(details.purchase_total ?? 0)}</span>
                </button>
                {expenseSectionsOpen.purchase && (
                  <div className="detail-accordion__panel">
                    {details.purchase_items?.length > 0 ? (
                      <>
                        <div className="detail-table-header detail-table-header--6">
                          <div className="detail-table-cell">Дата</div>
                          <div className="detail-table-cell">Материал</div>
                          <div className="detail-table-cell">Поставщик</div>
                          <div className="detail-table-cell detail-table-cell--num">Кол-во</div>
                          <div className="detail-table-cell detail-table-cell--num">Цена</div>
                          <div className="detail-table-cell detail-table-cell--num">Сумма</div>
                        </div>
                        <div className="detail-table">
                          {details.purchase_items.map((item, i) => {
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
                      </>
                    ) : (
                      <EmptyHint />
                    )}
                  </div>
                )}
              </div>
              <div className="detail-accordion">
                <button
                  type="button"
                  className={`detail-row detail-row--compact detail-accordion__trigger${expenseSectionsOpen.other ? ' detail-accordion__trigger--open' : ''}`}
                  aria-expanded={expenseSectionsOpen.other}
                  onClick={() => toggleExpenseSection('other')}
                >
                  <span className="detail-accordion__label">
                    <span className="detail-accordion__chevron" aria-hidden>
                      {expenseSectionsOpen.other ? '▾' : '▸'}
                    </span>
                    <span className="detail-row__label">Прочие расходы</span>
                  </span>
                  <span className="detail-row__value">{formatMoney(details.other_total ?? 0)}</span>
                </button>
                {expenseSectionsOpen.other && (
                  <div className="detail-accordion__panel">
                    {details.other_items?.length > 0 ? (
                      <>
                        <div className="detail-table-header detail-table-header--3">
                          <div className="detail-table-cell">Дата</div>
                          <div className="detail-table-cell">Название</div>
                          <div className="detail-table-cell detail-table-cell--num">Сумма</div>
                        </div>
                        <div className="detail-table">
                          {details.other_items.map((item, i) => (
                            <div
                              key={item.id ?? `${item.date}-${item.name}-${i}`}
                              className="detail-table-row detail-table-row--3"
                            >
                              <div className="detail-table-cell">{sliceIsoDate(item.date)}</div>
                              <div className="detail-table-cell detail-table-cell--object">
                                {String(item.name ?? '').trim() || '—'}
                              </div>
                              <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                                {formatMoney(item.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyHint />
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {type === 'debt' && !loading && !error && (
            <>
              <div className="detail-row detail-row--big detail-row--compact">
                <span className="detail-row__label">Итого</span>
                <span className="detail-row__value">
                  {formatMoney(details?.total_debt ?? summaryCards?.client_debt_total ?? 0)}
                </span>
              </div>
              {itemsLen === 0 ? (
                <EmptyHint />
              ) : (
                <div className="detail-section detail-section--tight">
                  <div className="detail-table-header detail-table-header--4">
                    <div className="detail-table-cell">Клиент</div>
                    <div className="detail-table-cell detail-table-cell--num">Продаж</div>
                    <div className="detail-table-cell">Старый долг</div>
                    <div className="detail-table-cell detail-table-cell--num">Сумма долга</div>
                  </div>
                  <div className="detail-table">
                    {details.items.map((item, i) => (
                      <div
                        key={item.client_id ?? `${item.client_name}-${i}`}
                        className="detail-table-row detail-table-row--4"
                      >
                        <div className="detail-table-cell detail-table-cell--object">
                          {clientDisplayName(item)}
                        </div>
                        <div className="detail-table-cell detail-table-cell--num">
                          {item.sales_count != null ? formatNumber(item.sales_count) : '—'}
                        </div>
                        <div className="detail-table-cell">
                          {sliceIsoDate(item.oldest_debt_date)}
                        </div>
                        <div className="detail-table-cell detail-table-cell--strong detail-table-cell--num">
                          {formatMoney(item.debt_amount)}
                        </div>
                      </div>
                    ))}
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
