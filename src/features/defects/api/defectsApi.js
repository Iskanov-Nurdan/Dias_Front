import { apiClient } from '../../../shared/api';

export const getDefects = (params) => apiClient.get('defects/', { params });
export const getDefectsSelectSources = () => apiClient.get('defects/select-sources/');
export const createDefect = (payload) => apiClient.post('defects/', payload);
export const updateDefect = (id, payload) => apiClient.patch(`defects/${id}/`, payload);
export const sendDefectToRework = (id, body = {}) => apiClient.post(`defects/${id}/send-to-rework/`, body);
/** @param {object} payload — { writeoff_reason, quantity? } */
export const writeoffDefect = (id, payload) => apiClient.post(`defects/${id}/writeoff/`, payload);
export const sellDefect = (id, payload) => apiClient.post(`defects/${id}/sell/`, payload);

