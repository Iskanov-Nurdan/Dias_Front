import { apiClient } from '../../../shared/api';

export const getRoles = (params) => apiClient.get('roles/', { params });
export const getRole = (id) => apiClient.get(`roles/${id}/`);
export const createRole = (data) => apiClient.post('roles/', data);
export const updateRole = (id, data) => apiClient.patch(`roles/${id}/`, data);
export const deleteRole = (id) => apiClient.delete(`roles/${id}/`);
