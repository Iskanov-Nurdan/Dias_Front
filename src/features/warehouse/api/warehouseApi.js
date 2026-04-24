import { apiClient } from '../../../shared/api';

/**
 * Упаковка: POST warehouse/batches/package/
 * Тело: warehouse_batch_id, pieces_per_package, packages_count; опционально comment.
 */
export const packFromOtk = (body) => apiClient.post('warehouse/batches/package/', body);
