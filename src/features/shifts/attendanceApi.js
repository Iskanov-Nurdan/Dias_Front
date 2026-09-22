import { apiClient } from '../../shared/api/client';
import { ymdToRange } from '../../shared/lib/dateRange';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

// Личный приход/уход (учёт времени) — apps/production.Shift на бэкенде,
// эндпоинты /api/shifts/open|close|my/. Не путать с денежной сдачей смены
// (cash/card/expense/advance) из ./api.js, которая живёт на /shift-closings/ —
// это две независимые фичи, разделённые по требованию продукта.

/** GET /api/shifts/my/ — текущая открытая личная смена (без привязки к линии) или null. */
export const fetchMyOpenShift = async (signal) => {
  const { data } = await apiClient.get('/shifts/my/', withSignal({}, signal));
  return data?.shift ?? null;
};

/** POST /api/shifts/open/ — начать личную смену (без line_id). */
export const openMyShift = async (signal) => {
  const { data } = await apiClient.post('/shifts/open/', {}, withSignal({}, signal));
  return data;
};

/** POST /api/shifts/close/ — завершить личную смену (без line_id). */
export const closeMyShift = async (signal) => {
  const { data } = await apiClient.post('/shifts/close/', {}, withSignal({}, signal));
  return data;
};

/**
 * GET /api/shifts/ — история личного прихода/ухода ВСЕХ сотрудников (не
 * `/shifts/history/`, та отдаёт только свою историю). Тот же ShiftViewSet,
 * что и open/close/my — доступ по праву my_shift, пагинация {items, meta}
 * (репозиторий-wide StandardResultsSetPagination, ShiftViewSet её не
 * переопределяет).
 */
export const fetchShiftHistory = async ({ year, month, day, page = 1 } = {}, signal) => {
  const { dateFrom, dateTo } = ymdToRange(year, month, day);
  const params = { page };
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const { data } = await apiClient.get('/shifts/', { params, ...withSignal({}, signal) });
  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
  return { items, meta: data?.meta ?? null };
};
