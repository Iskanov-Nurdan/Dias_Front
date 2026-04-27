import { apiClient } from '../../../shared/api';

export const getClients = (params) => apiClient.get('clients/', { params });
export const getClient = (id) => apiClient.get(`clients/${id}/`);
export const createClient = (payload) => apiClient.post('clients/', payload);
export const updateClient = (id, payload) => apiClient.patch(`clients/${id}/`, payload);
export const getClientHistory = (id) => apiClient.get(`clients/${id}/history/`);
export const getClientProfile = (id) => apiClient.get(`clients/${id}/profile/`);
export const getClientFinancialSummary = (clientId) =>
  apiClient.get('client-financial-summary/', { params: { client_id: clientId } });
