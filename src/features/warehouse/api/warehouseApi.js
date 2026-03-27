import { apiClient } from '../../../shared/api';

/**
 * Упаковка: канонический путь POST /api/warehouse/batches/package/ (см. API_MIGRATION_CHANGELOG.md).
 * Тело: product_id, shift_height, shift_width, angle_deg, pieces_per_package, packages_count;
 * плюс unit_meters, package_total_meters — см. BACKEND_PACKAGING_FRONTEND_CONTRACT.md.
 */
export const packFromOtk = (body) => apiClient.post('warehouse/batches/package/', body);
