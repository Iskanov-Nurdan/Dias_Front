import { apiClient } from '../../../shared/api';
import { parseApiListResponse } from '../../../shared/lib/apiList';

/**
 * Фильтр для выбора линии под **ProductionBatch**: открытая смена на линии, без паузы.
 * На бэке могут поддерживаться оба ключа; при появлении только одного — оставьте нужный в объекте.
 */
export const LINES_QUERY_OPEN_SHIFT_FOR_PRODUCTION_BATCH = Object.freeze({
  eligible_for_production_batch: true,
  eligible_for_recipe_run: true,
});

/**
 * Список линий (LineViewSet, доступ `lines`).
 */
export const getLines = (params) => apiClient.get('lines/', { params });
export const getLine = (id) => apiClient.get(`lines/${id}/`);
export const createLine = (data) => apiClient.post('lines/', data);
export const updateLine = (id, data) => apiClient.patch(`lines/${id}/`, data);
export const deleteLine = (id) => apiClient.delete(`lines/${id}/`);
/** Открыть смену на линии (LineHistory + Shift с линией). 409 — уже открыта смена на этой же линии; личная смена не мешает. Тело: height, width, angle_deg, comment (опц.), session_title (опц.). */
export const openShift = (id, data = {}) => apiClient.post(`lines/${id}/open/`, data);
/** Закрыть смену этого пользователя на линии. Тело: height, width, angle_deg, comment — снимок на закрытие. */
export const closeShift = (id, data = {}) => apiClient.post(`lines/${id}/close/`, data);
/** Пока линия открыта — обновить параметры смены */
export const updateShiftParams = (id, data) => apiClient.patch(`lines/${id}/shift-params/`, data);
/** Пауза (LineHistory shift_pause; запись Shift не закрывается). Тело с причиной по сериализатору бэка, обычно `{ reason }`. */
export const pauseLineShift = (id, data) => apiClient.post(`lines/${id}/shift-pause/`, data);
/** Снятие паузы (shift_resume). Тело может быть `{}`. */
export const resumeLineShift = (id, data = {}) => apiClient.post(`lines/${id}/shift-resume/`, data);
export const getLineHistory = (id, config = {}) =>
  apiClient.get(`lines/${id}/history/`, config);

/** Общая лента: GET lines/history/ (пагинация как у shifts/history/). */
export const getLinesHistoryFeed = (params = {}, config = {}) =>
  apiClient.get('lines/history/', { params, ...config });

/**
 * Таймлайн смены: GET /api/lines/{line_id}/history/session/?open_event_id=…
 * Ответ: { open, close | null, updates } — LineHistorySerializer, как в общей истории.
 */
export const getLineHistorySessionDetail = (lineId, openEventId, config = {}) => {
  const { params: extraParams, ...rest } = config;
  return apiClient.get(`lines/${lineId}/history/session/`, {
    params: { open_event_id: Number(openEventId), ...extraParams },
    ...rest,
  });
};

/**
 * Список линий с shift_is_open, shift_is_paused, shift_snapshot.
 * Для модалки ProductionBatch передавайте `...LINES_QUERY_OPEN_SHIFT_FOR_PRODUCTION_BATCH` в params.
 */
export const fetchLinesWithShiftSnapshot = async (params = { page_size: 200 }) => {
  const res = await apiClient.get('lines/', { params });
  return parseApiListResponse(res.data);
};

export const fetchLinesHistoryPage = async (queryState, signal) => {
  const page = queryState.page || 1;
  const page_size = Math.min(100, Math.max(1, Number(queryState.page_size) || 20));
  const res = await getLinesHistoryFeed({ page, page_size }, { signal });
  const raw = res.data || {};
  const m = raw.meta || {};
  const pages = Number(m.totalPages ?? m.total_pages ?? m.pages ?? 1) || 1;
  return {
    items: raw.items ?? [],
    meta: {
      page: Number(m.page) || 1,
      pages,
      total: m.total,
    },
    links: raw.links,
  };
};
