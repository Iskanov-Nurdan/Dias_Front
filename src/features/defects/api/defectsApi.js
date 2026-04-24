import { apiClient } from '../../../shared/api';

export const getDefects = (params) => apiClient.get('defects/', { params });
export const getDefectsSelectSources = () => apiClient.get('defects/select-sources/');
export const createDefect = (payload) => apiClient.post('defects/', payload);
export const updateDefect = (id, payload) => apiClient.patch(`defects/${id}/`, payload);
export const sendDefectToRework = (id) => apiClient.post(`defects/${id}/send-to-rework/`, {});
export const writeoffDefect = (id, writeoff_reason) => apiClient.post(`defects/${id}/writeoff/`, { writeoff_reason });
export const sellDefect = (id, payload) => apiClient.post(`defects/${id}/sell/`, payload);

