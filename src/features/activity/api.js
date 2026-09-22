import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/activity/ — журнал действий всех сотрудников (ActivityAdminView,
 * доступ по праву 'shifts', как и «Смены» — см. pages.js). Раньше фронт
 * стучался на несуществующий /activity-log/ с придуманными полями —
 * реальный адрес и реальные query-параметры бэкенда:
 * search, action, section, date_from, date_to, user_id, page, page_size.
 * Ответ: { items, meta } — общая пагинация бэкенда, как и везде в проекте.
 */
export const fetchActivityLog = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.action) params.action = queryState.action;
  if (queryState?.section) params.section = queryState.section;
  if (queryState?.dateFrom) params.date_from = queryState.dateFrom;
  if (queryState?.dateTo) params.date_to = queryState.dateTo;
  if (queryState?.userId) params.user_id = queryState.userId;
  params.page = queryState?.page || 1;
  params.page_size = queryState?.perPage || 20;
  const { data } = await apiClient.get('/activity/', { params, ...withSignal({}, signal) });
  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
  return { items, meta: data?.meta ?? null };
};
