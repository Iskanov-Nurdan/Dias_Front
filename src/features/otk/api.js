import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/workshop/otk-blanks/ — очередь: сколько кг заготовки накоплено и
 * ждёт учёта ОТК (наполняется автоматически при «Произвести» в Производстве).
 * Каталог заготовок небольшой — весь список одним запросом.
 */
export const fetchOtkPool = async (signal) => {
  const { data } = await apiClient.get('/workshop/otk-blanks/', { params: { page_size: 100 }, ...withSignal({}, signal) });
  return data;
};

/**
 * POST /api/workshop/otk-account/ — сессия учёта (может списывать сразу с
 * нескольких заготовок, если строки профилей ссылаются на разные).
 * Тело: { lines: [{profile_id, pieces}], defect_kg?, defect_blank_id?,
 * shift_period: 'day'|'night', operator_id?, chemist_id?, packer_ids?, comment? }.
 * Может вернуть 409 (гонка на пуле — конфликт optimistic-lock) или 400 с
 * понятным текстом (недостаточно кг, профиль не привязан к заготовке и т.д.).
 */
export const postOtkAccount = async (body, signal) => {
  const { data } = await apiClient.post('/workshop/otk-account/', body, withSignal({}, signal));
  return data;
};

/**
 * GET /api/workshop/otk-accounting/ — журнал сессий учёта, растёт без
 * остановки → настоящая серверная пагинация (не fetch-all, как было в
 * старом фронтенде).
 */
export const fetchOtkHistory = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20 };
  if (queryState?.blankId) params.blank_id = queryState.blankId;
  const { data } = await apiClient.get('/workshop/otk-accounting/', { params, ...withSignal({}, signal) });
  return data;
};
