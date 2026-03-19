import { apiClient } from '../../../shared/api';

export const getRawMaterials = (params) => apiClient.get('raw-materials/', { params });
export const getRawMaterial = (id) => apiClient.get(`raw-materials/${id}/`);
export const createRawMaterial = (data) => apiClient.post('raw-materials/', data);
export const updateRawMaterial = (id, data) => apiClient.patch(`raw-materials/${id}/`, data);
export const deleteRawMaterial = (id) => apiClient.delete(`raw-materials/${id}/`);

export const getIncoming = (params) => apiClient.get('incoming/', { params });
export const getIncomingOne = (id) => apiClient.get(`incoming/${id}/`);
export const createIncoming = (data) => apiClient.post('incoming/', data);
export const updateIncoming = (id, data) => apiClient.patch(`incoming/${id}/`, data);
export const deleteIncoming = (id) => apiClient.delete(`incoming/${id}/`);

export const getBalances = () => apiClient.get('materials/balances/');
