import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/materials/balances/ — справочник сырья вместе с посчитанным остатком
 * (RawMaterial + сумма непотраченных партий). Это и есть данные вкладки
 * «Справочник» — отдельно тянуть /raw-materials/ для списка не нужно.
 *
 * Каталог сырья на заводе растёт медленно и ограниченно (это не журнал
 * операций) — поэтому просим сразу весь список одним запросом с page_size,
 * равным реальному максимуму бэкенда (100, см. config/pagination.py), и
 * фильтруем/ищем по нему на клиенте. Если каталог когда-нибудь перерастёт
 * 100 позиций, это надо будет заменить на серверный поиск — сигнал об этом
 * будет meta.total > 100 в ответе.
 */
export const fetchBalances = async (signal) => {
  const { data } = await apiClient.get('/materials/balances/', { params: { page_size: 100 }, ...withSignal({}, signal) });
  return data;
};

/** GET /api/raw-materials/ — только для выбора сырья в модалке «Приход» (когда оно не привязано к строке). */
export const fetchRawMaterials = async (queryState, signal) => {
  const params = { page_size: 100, is_active: true };
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/raw-materials/', { params, ...withSignal({}, signal) });
  return data;
};

/** Тело POST/PATCH /raw-materials/: name, unit ('kg'|'g'), min_balance, is_active, comment. */
export const createRawMaterial = async (body, signal) => {
  const { data } = await apiClient.post('/raw-materials/', body, withSignal({}, signal));
  return data;
};

export const updateRawMaterial = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/raw-materials/${id}/`, body, withSignal({}, signal));
  return data;
};

/** Может вернуть 409 { code: 'MATERIAL_IN_USE', error, detail } — сырьё используется где-то ещё. */
export const deleteRawMaterial = async (id, signal) => {
  await apiClient.delete(`/raw-materials/${id}/`, withSignal({}, signal));
};

/**
 * GET /api/incoming/ — журнал приходов, растёт без остановки → настоящая
 * серверная пагинация (page/page_size), без фиктивного «взять всё разом».
 */
export const fetchIncoming = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20 };
  if (queryState?.materialId) params.material_id = queryState.materialId;
  const { data } = await apiClient.get('/incoming/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * POST /api/incoming/ — приход партии сырья. Бэкенд сам переводит quantity
 * в единицу хранения (кг) и запрещает приход на неактивное сырьё (409).
 */
export const createIncoming = async (body, signal) => {
  const { data } = await apiClient.post('/incoming/', body, withSignal({}, signal));
  return data;
};

/**
 * GET /api/materials/movements/ — вычисляемый журнал (приходы + списания),
 * растёт без остановки → серверная пагинация. Поддерживает фильтры
 * material_id, occurred_at_after/before (YYYY-MM-DD), direction (in|out) —
 * они применяются на бэкенде ДО слияния и пагинации (см. apps/materials/views.py).
 */
export const fetchMovements = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20 };
  if (queryState?.materialId) params.material_id = queryState.materialId;
  if (queryState?.dateFrom) params.occurred_at_after = queryState.dateFrom;
  if (queryState?.dateTo) params.occurred_at_before = queryState.dateTo;
  if (queryState?.direction) params.direction = queryState.direction;
  const { data } = await apiClient.get('/materials/movements/', { params, ...withSignal({}, signal) });
  return data;
};
