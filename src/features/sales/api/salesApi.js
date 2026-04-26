import { apiClient } from '../../../shared/api';

export const getSales = (params) => apiClient.get('sales/', { params });
export const getSale = (id) => apiClient.get(`sales/${id}/`);
export const createSale = (payload) => apiClient.post('sales/', payload);
export const updateSale = (id, payload) => apiClient.patch(`sales/${id}/`, payload);
export const patchSaleStatus = (id, status, extraPayload = {}) =>
  apiClient.patch(`sales/${id}/status/`, { status, ...extraPayload });
export const cancelSale = (id) => apiClient.patch(`sales/${id}/cancel/`, {});
export const getSaleCreditCheck = (id) => apiClient.get(`sales/${id}/credit-check/`);
export const getSaleWaybillUrl = (id) => `${apiClient.defaults.baseURL}sales/${id}/waybill/`;
export const getSaleReceiptUrl = (id) => `${apiClient.defaults.baseURL}sales/${id}/receipt/`;

export const getSaleSelectSources = (params = {}) =>
  apiClient.get('sales/select-sources/', {
    params,
  });
