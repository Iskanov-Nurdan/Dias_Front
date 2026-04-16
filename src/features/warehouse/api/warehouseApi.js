import { apiClient } from '../../../shared/api';

/**
 * Упаковка: POST warehouse/batches/package/
 * Тело: warehouse_batch_id (или warehouse_batch), pieces_per_package, packages_count; опционально comment.
 * Параметры штуки и качество берутся с выбранной строки склада на бэке.
 */
export const packFromOtk = (body) => apiClient.post('warehouse/batches/package/', body);
