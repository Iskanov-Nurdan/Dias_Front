import { apiClient } from '../../shared/api/client';

const withSignal = (signal) => (signal ? { signal } : {});

/**
 * Дашборд — GET /analytics/dashboard/ (apps/analytics/dashboard.py).
 * Все суммы приходят строкой (Decimal на бэкенде), финансовые поля — null,
 * если у пользователя нет ключа analytics_finance (см. data.finance_access).
 */
export const fetchDashboard = async ({ dateFrom, dateTo, line }, signal) => {
  const { data } = await apiClient.get('/analytics/dashboard/', {
    params: { date_from: dateFrom, date_to: dateTo, product_line: line },
    ...withSignal(signal),
  });
  return data;
};

/** Расшифровка KPI: формула + записи. metric: revenue|cash_in|gross_margin|expenses|net_profit */
export const fetchDashboardDetails = async ({ dateFrom, dateTo, line, metric }, signal) => {
  const { data } = await apiClient.get('/analytics/dashboard-details/', {
    params: { date_from: dateFrom, date_to: dateTo, product_line: line, metric },
    ...withSignal(signal),
  });
  return data;
};

// ── Реестр «Расходы и доходы» (AnalyticsOtherExpense) ─────────────────────

export const fetchEntries = async ({ dateFrom, dateTo }, signal) => {
  const { data } = await apiClient.get('/analytics/other-expenses/', {
    params: { date_from: dateFrom, date_to: dateTo },
    ...withSignal(signal),
  });
  return { items: data?.items || [], templates: data?.recurring_templates || [] };
};

const entryPayload = (body) => ({
  kind: body.kind,
  category_id: body.categoryId || null,
  name: body.name || '',
  amount: body.amount,
  date: body.date,
  product_line: body.productLine,
  comment: body.comment || '',
  recurring: Boolean(body.recurring),
});

export const createEntry = async (body) => {
  const { data } = await apiClient.post('/analytics/other-expenses/', entryPayload(body));
  return data;
};

export const updateEntry = async (id, body) => {
  const { data } = await apiClient.patch(`/analytics/other-expenses/${id}/`, entryPayload(body));
  return data;
};

export const acceptEntry = async (id) => {
  const { data } = await apiClient.post(`/analytics/other-expenses/${id}/accept/`);
  return data;
};

/** Отклонить = удалить запись (так устроено на бэкенде, reject → delete). */
export const rejectEntry = async (id) => {
  await apiClient.post(`/analytics/other-expenses/${id}/reject/`);
};

export const fetchCategories = async (signal) => {
  const { data } = await apiClient.get('/analytics/expense-categories/', {
    params: { active: 1 },
    ...withSignal(signal),
  });
  return data?.items || [];
};

export const createCategory = async ({ name, kind }) => {
  const { data } = await apiClient.post('/analytics/expense-categories/', { name, kind });
  return data;
};
