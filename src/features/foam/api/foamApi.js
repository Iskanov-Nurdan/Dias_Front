import { apiClient } from '../../../shared/api';

// --- Сырьё (второй склад) ---
export const getFoamRawLots = (params) => apiClient.get('foam/raw-lots/', { params });
export const createFoamRawLot = (data) => apiClient.post('foam/raw-lots/', data);

export const getFoamDensityGrades = () => apiClient.get('foam/density-grades/');
export const createFoamDensityGrade = (data) => apiClient.post('foam/density-grades/', data);

// --- Производство ---
export const getFoamProductionRuns = (params) => apiClient.get('foam/production-runs/', { params });
export const createFoamProductionRun = (data) => apiClient.post('foam/production-runs/', data);

// --- Склад ГП ---
export const getFoamGpStock = () => apiClient.get('foam/gp-stock/');
export const cutFoamGpStock = (data) => apiClient.post('foam/gp-stock/cut/', data);
export const getFoamGpOperations = (params) => apiClient.get('foam/gp-operations/', { params });

// --- Продажи ---
export const getFoamSales = (params) => apiClient.get('foam/sales/', { params });
export const createFoamSale = (data) => apiClient.post('foam/sales/', data);
