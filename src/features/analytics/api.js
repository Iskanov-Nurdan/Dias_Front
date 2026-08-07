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

/** GET /api/analytics/ — основной сводный endpoint (income, expense, profit, clientsCount, salesCount, ...) */
export const fetchAnalytics = (queryState, signal) => {
  const params = buildParams(queryState || {}, {});
  return apiClient.get('/analytics/', { params, ...withSignal({}, signal) }).then((res) => res.data);
};

/** GET /api/analytics/period-comparison/ — MoM, YoY (только month, без day) */
export const fetchPeriodComparison = (queryState, signal) => get('period-comparison', queryState, signal);

/** GET /api/analytics/new-clients/ — для подсчёта по месяцу (limit высокий для точного count) */
export const fetchNewClientsForMonth = (year, month, signal) => get('new-clients', { year, month }, signal, { limit: 1000 });

/** GET /api/analytics/expenses-by-category/ */
export const fetchExpensesByCategory = (queryState, signal) => get('expenses-by-category', queryState, signal);

/** GET /api/analytics/clients-by-sport/ */
export const fetchClientsBySport = (queryState, signal) => get('clients-by-sport', queryState, signal);

/** GET /api/analytics/income-expense-daily/ */
export const fetchIncomeExpenseDaily = (queryState, signal) => get('income-expense-daily', queryState, signal);

/** GET /api/analytics/income-detail/ */
export const fetchIncomeDetail = (queryState, signal) => get('income-detail', queryState, signal);

/** GET /api/analytics/expense-detail/ */
export const fetchExpenseDetail = (queryState, signal) => get('expense-detail', queryState, signal);

/** GET /api/analytics/profit-detail/ */
export const fetchProfitDetail = (queryState, signal) => get('profit-detail', queryState, signal);

/** GET /api/analytics/leads/ — агрегаты по заявкам и воронке (year, month, day) */
export const fetchLeadsAnalytics = (queryState, signal) => get('leads', queryState, signal);
