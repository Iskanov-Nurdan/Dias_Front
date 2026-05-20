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

/** Справочник: профили (товары) и себестоимость за шт — не расход за период */
export const getProductUnitCosts = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/product-unit-costs/', { params, signal });
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

/** Долг клиентов — см. docs/ANALYTICS_BACKEND.md */
export const getDebtDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/debt-details/', { params, signal });
};

export const getOtkDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/otk-details/', { params, signal });
};

export const getWriteoffDetails = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/writeoff-details/', { params, signal });
};

/** Прочие расходы — см. docs/ANALYTICS_OTHER_EXPENSES_BACKEND.md */
export const getOtherExpenses = (opts) => {
  const { signal, ...params } = opts || {};
  return apiClient.get('analytics/other-expenses/', { params, signal });
};

export const createOtherExpense = (data, opts) => {
  const { signal } = opts || {};
  return apiClient.post('analytics/other-expenses/', data, { signal });
};

export const acceptOtherExpense = (id, opts) => {
  const { signal } = opts || {};
  return apiClient.post(`analytics/other-expenses/${id}/accept/`, {}, { signal });
};

export const rejectOtherExpense = (id, opts) => {
  const { signal } = opts || {};
  return apiClient.post(`analytics/other-expenses/${id}/reject/`, {}, { signal });
};
