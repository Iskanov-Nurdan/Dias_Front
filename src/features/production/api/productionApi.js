import { apiClient } from '../../../shared/api';

/** GET/POST /api/plastic-profiles/ */
export const getPlasticProfiles = (params) => apiClient.get('plastic-profiles/', { params });
export const getPlasticProfile = (id) => apiClient.get(`plastic-profiles/${id}/`);
export const createPlasticProfile = (data) => apiClient.post('plastic-profiles/', data);
export const updatePlasticProfile = (id, data) => apiClient.patch(`plastic-profiles/${id}/`, data);
export const deletePlasticProfile = (id) => apiClient.delete(`plastic-profiles/${id}/`);

/**
 * Партии производства: POST /api/batches/
 * Обязательные: profile, recipe, line, pieces, length_per_piece
 * total_meters только read-only на сервере — не отправлять.
 */
export const getProductionBatches = (params) => apiClient.get('batches/', { params });
export const getProductionBatch = (id) => apiClient.get(`batches/${id}/`);
export const createProductionBatch = (data) => apiClient.post('batches/', data);
export const updateProductionBatch = (id, data) => apiClient.patch(`batches/${id}/`, data);
export const deleteProductionBatch = (id) => apiClient.delete(`batches/${id}/`);
