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
 * GET warehouse/gp-packages/ — журнал упаковок ГП (если включён list на бэке).
 */
export const getGpPackages = (params = {}, config = {}) =>
  apiClient.get('warehouse/gp-packages/', { params, ...config });

/**
 * POST warehouse/gp-packages/ — фиксация упаковки по BlankProductionRun (FIFO на бэке).
 * @param {object} body — product_id, blank_id, kind, label, split_mode, lines[], total_pieces, client_request_id
 */
export const postGpPackage = (body) => apiClient.post('warehouse/gp-packages/', body);
