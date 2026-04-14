import { apiClient } from '../../../shared/api';

// Справочник хим. элементов
export const getChemicalElements = (params) => apiClient.get('chemistry/elements/', { params });
export const getChemicalElement = (id) => apiClient.get(`chemistry/elements/${id}/`);
export const createChemicalElement = (data) => apiClient.post('chemistry/elements/', data);
export const updateChemicalElement = (id, data) => apiClient.patch(`chemistry/elements/${id}/`, data);
export const deleteChemicalElement = (id) => apiClient.delete(`chemistry/elements/${id}/`);

// Остатки по агрегату (справочник химии)
export const getChemistryBalances = (params) => apiClient.get('chemistry/balances/', { params });

/** Партии химии (read-only), FIFO-списания ведутся по ним */
export const getChemistryBatches = (params) => apiClient.get('chemistry/batches/', { params });

/**
 * Производство химии: списание сырья FIFO, партия ChemistryBatch, себестоимость.
 * POST /api/chemistry/elements/produce/
 */
export const produceChemistry = (data) => apiClient.post('chemistry/elements/produce/', data);
