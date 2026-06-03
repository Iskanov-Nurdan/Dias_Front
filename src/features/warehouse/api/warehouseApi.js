import { apiClient } from '../../../shared/api';

/** GET warehouse/gp-stock/ — остатки ГП по profile_id + blank_id (шт и кг). */
export const getGpStock = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-stock/', { params, ...config });

/** @deprecated упаковка снята с фронта (410 на gp-packages) */
export const packFromOtk = (body) => apiClient.post('warehouse/batches/package/', body);

/** @deprecated 410 — остатки через gp-stock */
export const getGpUnpackedBalance = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-unpacked-balance/', { params, ...config });

/** @deprecated 410 — упаковка снята */
export const getGpPackages = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-packages/', { params, ...config });

/** @deprecated 410 */
export const postGpPackage = (body) => apiClient.post('warehouse/gp-packages/', body);

/**
 * GET warehouse/operations/ — единая лента движений склада ГП для вкладки «История».
 *
 * Параметры:
 *   - page, page_size, ordering
 *   - date_from, date_to (ISO date)
 *   - product_id, blank_id
 *   - kind: accept|package|sale|return|defect|rework  (можно через запятую)
 *
 * Items shape (ожидаемый):
 *   {
 *     id: string|number,
 *     at: ISO datetime,
 *     kind: 'accept'|'package'|'sale'|'return'|'defect'|'rework',
 *     kind_label: 'Приёмка'|'Упаковка'|'Продажа'|'Возврат'|'Брак'|'Переделка',
 *     direction: 'in'|'out',
 *     product_id, product_name,
 *     blank_id, blank_name,
 *     pieces: number,
 *     kg: number|null,
 *     packages: number,                 // сколько упаковок (для kind=package|sale упаковок)
 *     warehouse_batch_id: number|null,
 *     gp_package_id: number|null,
 *     sale_id: number|null,
 *     order_id: number|null,
 *     return_id: number|null,
 *     label: string|null,
 *     actor: string|null,
 *     comment: string|null,
 *   }
 */
export const getWarehouseOperations = (params = {}, config = {}) =>
  apiClient.get('warehouse/operations/', { params, ...config });
