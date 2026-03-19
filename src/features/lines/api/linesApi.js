import { apiClient } from '../../../shared/api';

export const getLines = (params) => apiClient.get('lines/', { params });
export const getLine = (id) => apiClient.get(`lines/${id}/`);
export const createLine = (data) => apiClient.post('lines/', data);
export const updateLine = (id, data) => apiClient.patch(`lines/${id}/`, data);
export const deleteLine = (id) => apiClient.delete(`lines/${id}/`);
export const openShift = (id) => apiClient.post(`lines/${id}/open/`);
export const closeShift = (id) => apiClient.post(`lines/${id}/close/`);
export const getLineHistory = (id) => apiClient.get(`lines/${id}/history/`);
