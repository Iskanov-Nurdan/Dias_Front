import { apiClient } from '../../../shared/api';

export const getUsers = (params) => apiClient.get('users/', { params });
export const getUser = (id) => apiClient.get(`users/${id}/`);
export const createUser = (data) => apiClient.post('users/', data);
export const updateUser = (id, data) => apiClient.patch(`users/${id}/`, data);
export const deleteUser = (id) => apiClient.delete(`users/${id}/`);
/** Вкладки интерфейса для конкретного пользователя (не для роли целиком). */
export const updateUserAccess = (id, accessKeys) =>
  apiClient.patch(`users/${id}/access/`, { access_keys: accessKeys });
