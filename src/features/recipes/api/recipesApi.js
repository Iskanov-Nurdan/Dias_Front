import { apiClient } from '../../../shared/api';

export const getRecipes = (params) => apiClient.get('recipes/', { params });
export const getRecipe = (id) => apiClient.get(`recipes/${id}/`);
export const getRecipeAvailability = (id) => apiClient.get(`recipes/${id}/availability/`);
export const createRecipe = (data) => apiClient.post('recipes/', data);
export const updateRecipe = (id, data) => apiClient.patch(`recipes/${id}/`, data);
export const deleteRecipe = (id) => apiClient.delete(`recipes/${id}/`);
