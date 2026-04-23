import { apiClient } from '../../../shared/api';

export const getDefects = (params) => apiClient.get('defects/', { params });
export const createDefect = (payload) => apiClient.post('defects/', payload);
export const updateDefect = (id, payload) => apiClient.patch(`defects/${id}/`, payload);
export const deleteDefect = (id) => apiClient.delete(`defects/${id}/`);
export const sendDefectToRework = (id) => apiClient.post(`defects/${id}/send-to-rework/`, {});
export const completeDefectRework = (id) => apiClient.post(`defects/${id}/complete-rework/`, {});
export const writeoffDefect = (id, writeoff_reason) => apiClient.post(`defects/${id}/writeoff/`, { writeoff_reason });
export const sellDefect = (id, payload) => apiClient.post(`defects/${id}/sell/`, payload);

