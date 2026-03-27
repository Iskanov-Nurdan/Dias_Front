import { apiClient } from '../../../shared/api';

export const getAnalyticsSummary = (params) => apiClient.get('analytics/summary/', { params });

// Детализация прихода/расхода/прибыли
export const getRevenueDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/revenue-details/', { params, signal });
};
export const getExpenseDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/expense-details/', { params, signal });
};

export const getWriteoffDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/writeoff-details/', { params, signal });
};
