import { apiClient } from '../../../shared/api';

export const getRawMaterials = (params) => apiClient.get('raw-materials/', { params });
export const getRawMaterial = (id) => apiClient.get(`raw-materials/${id}/`);
export const createRawMaterial = (data) => apiClient.post('raw-materials/', data);
export const updateRawMaterial = (id, data) => apiClient.patch(`raw-materials/${id}/`, data);
export const deleteRawMaterial = (id) => apiClient.delete(`raw-materials/${id}/`);

export const getIncoming = (params) => apiClient.get('incoming/', { params });
export const createIncoming = (data) => apiClient.post('incoming/', data);

export const getBalances = () => apiClient.get('materials/balances/');

/** Журнал движения сырья (приходы FIFO-списания и т.д.) — контракт для бэкенда. */
export const getMaterialMovements = (params) => apiClient.get('materials/movements/', { params });
