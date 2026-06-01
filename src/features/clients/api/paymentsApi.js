import { apiClient } from '../../../shared/api';

export const getPayments = (params) => apiClient.get('payments/', { params });
export const getPayment = (id) => apiClient.get(`payments/${id}/`);
export const createPayment = (payload) => apiClient.post('payments/', payload);
export const updatePayment = (id, payload) => apiClient.patch(`payments/${id}/`, payload);
export const cancelPayment = (id) => apiClient.patch(`payments/${id}/cancel/`, {});
export const getPaymentsSummary = (clientId) =>
  apiClient.get('payments/summary/', { params: { client_id: clientId } });
export const getPaymentSelectSources = (params = {}) =>
  apiClient.get('payments/select-sources/', { params });
