import { apiClient } from '../../../shared/api';

export const getPayments = (params) => apiClient.get('payments/', { params });
export const createPayment = (payload) => apiClient.post('payments/', payload);
export const updatePayment = (id, payload) => apiClient.patch(`payments/${id}/`, payload);
export const deletePayment = (id) => apiClient.delete(`payments/${id}/`);
export const getPaymentSummary = (clientId) => apiClient.get('payments/summary/', { params: { client_id: clientId } });
