import { apiClient } from '../../../shared/api';

export const getShipments = (params) => apiClient.get('shipments/', { params });
export const getShipment = (id) => apiClient.get(`shipments/${id}/`);
export const createShipment = (data) => apiClient.post('shipments/', data);
export const updateShipment = (id, data) => apiClient.patch(`shipments/${id}/`, data);
export const deleteShipment = (id) => apiClient.delete(`shipments/${id}/`);
export const shipShipment = (id, data) => apiClient.post(`shipments/${id}/ship/`, data || {});
export const deliverShipment = (id, data) => apiClient.post(`shipments/${id}/deliver/`, data || {});
