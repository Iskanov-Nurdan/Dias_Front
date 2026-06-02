import { apiClient } from '../../../shared/api';

/**
 * Упаковка: POST warehouse/batches/package/
 * Тело: warehouse_batch_id, pieces_per_package, packages_count; опционально comment.
 */
export const packFromOtk = (body) => apiClient.post('warehouse/batches/package/', body);

/** GET warehouse/gp-unpacked-balance/ — группы неупакованного ГП после приёмки. */
export const getGpUnpackedBalance = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-unpacked-balance/', { params, ...config });

/**
 * GET warehouse/gp-packages/ — журнал упаковок ГП.
 *
 * Доп. фильтры (ожидаемые от бэка):
 *   - status=available  — только доступные упаковки (по умолчанию, если параметр не передан)
 *   - status=sold       — только проданные/списанные
 *   - status=all        — без фильтра (для вкладки «История»)
 *   meta.summary: { rows_count, packages_count, pieces_total }
 * Поля ответа (ожидаемые от бэка по каждой упаковке):
 *   - status: 'available' | 'sold' | 'shipped'
 *   - is_sold: boolean
 *   - sold_at: ISO datetime | null
 *   - sold_sale_id: number | null
 *   - warehouse_batch_status: 'available' | 'shipped' | …
 */
export const getGpPackages = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-packages/', { params, ...config });

/**
 * POST warehouse/gp-packages/ — фиксация упаковки по BlankProductionRun (FIFO на бэке).
 * @param {object} body — product_id, blank_id, kind, label, split_mode, lines[], total_pieces, client_request_id
 */
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
