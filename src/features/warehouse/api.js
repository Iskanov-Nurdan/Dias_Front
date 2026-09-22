import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/warehouse/gp-stock/ — агрегированный остаток готовой продукции
 * по товару и заготовке. Это единственный реально используемый источник
 * «Остатков» — /warehouse/batches/ на бэкенде жив, но упаковка/резерв через
 * него сняты с фронта (POST на упаковку у бэкенда возвращает 410), поэтому
 * не строим UI под него.
 */
export const fetchGpStock = async (signal) => {
  const { data } = await apiClient.get('/warehouse/gp-stock/', { params: { page_size: 500 }, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/warehouse/operations/ — журнал движений (приход из ОТК, продажа,
 * возврат, брак...), растёт без остановки → настоящая серверная пагинация,
 * а не «взять 200 разом», как было в старом фронтенде.
 */
export const fetchWarehouseOperations = async (queryState, signal) => {
  const params = { page: queryState?.page || 1, page_size: queryState?.pageSize || 20, ordering: '-created_at' };
  const { data } = await apiClient.get('/warehouse/operations/', { params, ...withSignal({}, signal) });
  return data;
};
