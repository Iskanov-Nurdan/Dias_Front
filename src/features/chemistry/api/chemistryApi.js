import { apiClient } from '../../../shared/api';

// Справочник хим. элементов
export const getChemicalElements = (params) => apiClient.get('chemistry/elements/', { params });
export const getChemicalElement = (id) => apiClient.get(`chemistry/elements/${id}/`);
export const createChemicalElement = (data) => apiClient.post('chemistry/elements/', data);
export const updateChemicalElement = (id, data) => apiClient.patch(`chemistry/elements/${id}/`, data);
export const deleteChemicalElement = (id) => apiClient.delete(`chemistry/elements/${id}/`);

// План заданий
export const getChemistryTasks = (params) => apiClient.get('chemistry/tasks/', { params });
export const getChemistryTask = (id) => apiClient.get(`chemistry/tasks/${id}/`);
export const createChemistryTask = (data) => apiClient.post('chemistry/tasks/', data);
export const updateChemistryTask = (id, data) => apiClient.patch(`chemistry/tasks/${id}/`, data);
export const deleteChemistryTask = (id) => apiClient.delete(`chemistry/tasks/${id}/`);
export const confirmChemistryTask = (id) => apiClient.post(`chemistry/tasks/${id}/confirm/`);

// Остатки
export const getChemistryBalances = () => apiClient.get('chemistry/balances/');
