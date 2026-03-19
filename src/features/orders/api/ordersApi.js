import { apiClient } from '../../../shared/api';

export const getOrders = (params) => apiClient.get('orders/', { params });
export const getOrder = (id) => apiClient.get(`orders/${id}/`);
export const createOrder = (data) => apiClient.post('orders/', data);
export const updateOrder = (id, data) => apiClient.patch(`orders/${id}/`, data);
export const deleteOrder = (id) => apiClient.delete(`orders/${id}/`);
