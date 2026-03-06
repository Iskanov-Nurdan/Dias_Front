import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

const buildParams = (queryState, extra = {}) => {
  const params = { ...extra };
  if (queryState?.year != null && queryState.year !== '') params.year = queryState.year;
  if (queryState?.month != null && queryState.month !== '') params.month = queryState.month;
  if (queryState?.day != null && queryState.day !== '') params.day = queryState.day;
  return params;
};

const get = (path, queryState, signal, extraParams) => {
  const params = buildParams(queryState || {}, extraParams);
  return apiClient.get(`/analytics/${path}/`, { params, ...withSignal({}, signal) }).then((res) => res.data);
};

/** GET /api/analytics/summary/ */
export const fetchSummary = (queryState, signal) => get('summary', queryState, signal);

/** GET /api/analytics/clients-by-sport/ */
export const fetchClientsBySport = (queryState, signal) => get('clients-by-sport', queryState, signal);

/** GET /api/analytics/activity-by-weekday/ */
export const fetchActivityByWeekday = (queryState, signal) => get('activity-by-weekday', queryState, signal);

/** GET /api/analytics/income-expense-daily/ */
export const fetchIncomeExpenseDaily = (queryState, signal) => get('income-expense-daily', queryState, signal);

/** GET /api/analytics/top-trainers/ */
export const fetchTopTrainers = (queryState, signal) => get('top-trainers', queryState, signal);

/** GET /api/analytics/top-clients/ */
export const fetchTopClients = (queryState, signal) => get('top-clients', queryState, signal, { limit: 10 });

/** GET /api/analytics/top-sports/ */
export const fetchTopSports = (queryState, signal) => get('top-sports', queryState, signal, { limit: 5 });

/** GET /api/analytics/sales-by-product/ */
export const fetchSalesByProduct = (queryState, signal) => get('sales-by-product', queryState, signal);

/** GET /api/analytics/sales-by-category/ */
export const fetchSalesByCategory = (queryState, signal) => get('sales-by-category', queryState, signal);

/** GET /api/analytics/clients-breakdown/ */
export const fetchClientsBreakdown = (queryState, signal) => get('clients-breakdown', queryState, signal);

/** GET /api/analytics/warehouse-restocks/ */
export const fetchWarehouseRestocks = (queryState, signal) => get('warehouse-restocks', queryState, signal);

/** GET /api/analytics/income-detail/ */
export const fetchIncomeDetail = (queryState, signal) => get('income-detail', queryState, signal);

/** GET /api/analytics/expense-detail/ */
export const fetchExpenseDetail = (queryState, signal) => get('expense-detail', queryState, signal);

/** GET /api/analytics/profit-detail/ */
export const fetchProfitDetail = (queryState, signal) => get('profit-detail', queryState, signal);

/** GET /api/analytics/leads/ — агрегаты по заявкам и воронке (year, month, day) */
export const fetchLeadsAnalytics = (queryState, signal) => get('leads', queryState, signal);
