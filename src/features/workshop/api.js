import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/workshop/blanks/ — справочник заготовок (без запросов балансов
 * отдельно — recipe_kg_per_barrel и state приходят из других эндпоинтов,
 * поэтому список каталога маленький и статичный, обновляется медленно).
 */
export const fetchBlanks = async (signal) => {
  const { data } = await apiClient.get('/workshop/blanks/', { params: { page_size: 100 }, ...withSignal({}, signal) });
  return data;
};

export const fetchBlankDetail = async (id, signal) => {
  const { data } = await apiClient.get(`/workshop/blanks/${id}/`, withSignal({}, signal));
  return data;
};

/** Тело: { name, composition: [{ raw_material_id, quantity_kg }] } — recipe_kg_per_barrel считает сам бэкенд (сумма состава). */
export const createBlank = async (body, signal) => {
  const { data } = await apiClient.post('/workshop/blanks/', body, withSignal({}, signal));
  return data;
};

/** PATCH принимает name и/или composition вместе или по отдельности (в отличие от химии — тут можно одним запросом). */
export const updateBlank = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/workshop/blanks/${id}/`, body, withSignal({}, signal));
  return data;
};

/** Может вернуть 409, если есть партии производства по этой заготовке. */
export const deleteBlank = async (id, signal) => {
  await apiClient.delete(`/workshop/blanks/${id}/`, withSignal({}, signal));
};

/**
 * GET /api/workshop/prepared-blanks/ — цеховой запас (бочки + дробный остаток).
 * У этого эндпоинта СВОЙ формат пагинации: { count, next, previous, results }
 * (сознательно другой на бэкенде — legacy-контракт), не {items, meta} как везде.
 */
export const fetchPreparedBlanks = async (signal) => {
  const { data } = await apiClient.get('/workshop/prepared-blanks/', { params: { page_size: 100 }, ...withSignal({}, signal) });
  return data;
};

/** GET .../prepared-blanks/{id}/ — свежий агрегат одной заготовки (для окна «Подробнее», не из кэша списка). */
export const fetchPreparedBlankDetail = async (id, signal) => {
  const { data } = await apiClient.get(`/workshop/prepared-blanks/${id}/`, withSignal({}, signal));
  return data;
};

/** POST .../add-barrel/ — тело пустое, списывает сырьё по составу FIFO, +1 бочка. */
export const addBarrel = async (blankId, signal) => {
  const { data } = await apiClient.post(`/workshop/prepared-blanks/${blankId}/add-barrel/`, {}, withSignal({}, signal));
  return data;
};

// fetchProductionRuns/createProductionRun (workshop/blank-production-runs/)
// переехали в features/production/api.js — это содержимое страницы
// «Производство» в реальном сайдбаре, не «Заготовки».

/**
 * GET /api/plastic-profiles/ — вкладка «Профили» (SKU готовой продукции).
 * Отдельный access-key на бэкенде — 'recipes' (не 'materials', как у
 * заготовок/цеха) — если у пользователя его нет, увидит понятную 403-ошибку
 * прямо на этой вкладке, отдельного гейта на фронте не городим.
 */
export const fetchProfiles = async (signal) => {
  const { data } = await apiClient.get('/plastic-profiles/', { params: { page_size: 100 }, ...withSignal({}, signal) });
  return data;
};

/**
 * Тело: name, blank_id (обязателен при создании — профиль обязан быть
 * привязан к заготовке), code (необязателен — бэкенд сгенерирует сам),
 * weight_kg_per_piece, markup_amount, extra_rubber/label/labor/electricity/repair.
 */
export const createProfile = async (body, signal) => {
  const { data } = await apiClient.post('/plastic-profiles/', body, withSignal({}, signal));
  return data;
};

export const updateProfile = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/plastic-profiles/${id}/`, body, withSignal({}, signal));
  return data;
};

/** Может вернуть 409 { code: 'PROFILE_IN_USE' } — есть рецепты или партии производства. */
export const deleteProfile = async (id, signal) => {
  await apiClient.delete(`/plastic-profiles/${id}/`, withSignal({}, signal));
};
