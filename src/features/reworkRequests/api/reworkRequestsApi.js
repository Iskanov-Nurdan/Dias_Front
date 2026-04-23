import { apiClient } from '../../../shared/api';

export const getReworkRequests = (params) => apiClient.get('rework-requests/', { params });
export const createReworkRequest = (payload) => apiClient.post('rework-requests/', payload);
export const updateReworkRequest = (id, payload) => apiClient.patch(`rework-requests/${id}/`, payload);
export const completeReworkRequest = (id, payload) => apiClient.post(`rework-requests/${id}/complete/`, payload);
