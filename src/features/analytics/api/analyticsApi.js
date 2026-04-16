import { apiClient } from '../../../shared/api';

export const getAnalyticsSummary = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/summary/', { params, signal });
};

export const getRevenueDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/revenue-details/', { params, signal });
};

export const getSalesCostDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/sales-cost-details/', { params, signal });
};

export const getProductionCostDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/production-cost-details/', { params, signal });
};

export const getPurchaseDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/purchase-details/', { params, signal });
};

export const getProfitDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/profit-details/', { params, signal });
};

export const getOtkDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/otk-details/', { params, signal });
};

export const getWriteoffDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/writeoff-details/', { params, signal });
};
