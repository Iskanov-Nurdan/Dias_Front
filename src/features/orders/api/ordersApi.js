import { apiClient } from '../../../shared/api';

export const getOrders = (params) => apiClient.get('orders/', { params });
export const getOrder = (id) => apiClient.get(`orders/${id}/`);
export const getOrderSelectSources = () => apiClient.get('orders/select-sources/');
export const createOrder = (payload) => apiClient.post('orders/', payload);
export const updateOrder = (id, payload) => apiClient.patch(`orders/${id}/`, payload);
export const patchOrderStatus = (id, status) => apiClient.patch(`orders/${id}/status/`, { status });
export const cancelOrder = (id) => apiClient.patch(`orders/${id}/cancel/`);
export const getOrderHistory = (id) => apiClient.get(`orders/${id}/history/`);
export const getOrderWaybillUrl = (id) => `${apiClient.defaults.baseURL}orders/${id}/waybill/`;
