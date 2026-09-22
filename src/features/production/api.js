import { apiClient } from '../../shared/api/client';

// Каталог заготовок и цеховой запас нужны здесь только для формы «Произвести»
// (выбор заготовки + проверка остатка на цеху перед запуском) — сами данные
// принадлежат фиче workshop, переиспользуем её api, а не дублируем эндпоинты.
export { fetchBlanks, fetchPreparedBlanks } from '../workshop/api';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/workshop/blank-production-runs/ — история партий производства.
 * Это и есть содержимое страницы «Производство» в реальном сайдбаре (не
 * «Заготовка») — серверная пагинация {items, meta}, растёт без остановки.
 */
export const fetchProductionRuns = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20 };
  if (queryState?.blankId) params.blank_id = queryState.blankId;
  const { data } = await apiClient.get('/workshop/blank-production-runs/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * POST .../blank-production-runs/ — «Произвести»: списывает кг заготовки с
 * цехового запаса (бочки/остаток), сырьё уже списано на этапе «+бочка» в Цехе.
 * Тело: { blank_id, blank_total_kg, blank_used_in_production_kg, vat_max_kg_demo }.
 *
 * Это тонкий, реально используемый в старом фронтенде путь запуска партии.
 * Настоящая система линий/смен/партий-с-ОТК (apps/production: Line, Shift,
 * ProductionBatch, RecipeRun) существует на бэкенде, но старый фронтенд её
 * никогда не строил — это отдельная, крупная задача на будущее, не часть
 * сегодняшнего v1.
 */
export const createProductionRun = async (body, signal) => {
  const { data } = await apiClient.post('/workshop/blank-production-runs/', body, withSignal({}, signal));
  return data;
};
