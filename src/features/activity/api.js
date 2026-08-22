import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/activity-log/ — журнал действий сотрудников.
 * Query: search, actionType, section, year, month, day, page, perPage.
 * Ответ: { items, meta: { total, page, perPage, totalPages } }
 */
export const fetchActivityLog = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.actionType) params.actionType = queryState.actionType;
  if (queryState?.section) params.section = queryState.section;
  if (queryState?.year) params.year = queryState.year;
  if (queryState?.month) params.month = queryState.month;
  if (queryState?.day) params.day = queryState.day;
  params.page = queryState?.page || 1;
  params.perPage = queryState?.perPage || 20;
  const { data } = await apiClient.get('/activity-log/', { params, ...withSignal({}, signal) });
  return data;
};
