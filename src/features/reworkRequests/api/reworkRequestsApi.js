import { apiClient } from '../../../shared/api';

export const getReworkRequests = (params) => apiClient.get('rework-requests/', { params });
export const getReworkSelectSources = () => apiClient.get('rework-requests/select-sources/');
export const createReworkRequest = (payload) => apiClient.post('rework-requests/', payload);
export const updateReworkRequest = (id, payload) => apiClient.patch(`rework-requests/${id}/`, payload);
export const startReworkRequest = (id) => apiClient.post(`rework-requests/${id}/start/`, {});
export const completeReworkRequest = (id, payload) => apiClient.post(`rework-requests/${id}/complete/`, payload);
export const cancelReworkRequest = (id) => apiClient.post(`rework-requests/${id}/cancel/`, {});
