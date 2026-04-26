import { apiClient } from '../../../shared/api';

export const getReturns = (params) => apiClient.get('returns/', { params });
export const getReturn = (id) => apiClient.get(`returns/${id}/`);
export const getReturnSelectSources = (params = {}) =>
  apiClient.get('returns/select-sources/', { params });
export const createReturn = (payload) => apiClient.post('returns/', payload);
export const updateReturn = (id, payload) => apiClient.patch(`returns/${id}/`, payload);
export const completeReturn = (id) => apiClient.patch(`returns/${id}/complete/`, {});
export const cancelReturn = (id) => apiClient.patch(`returns/${id}/cancel/`, {});
export const getReturnWaybillUrl = (id) => `${apiClient.defaults.baseURL}returns/${id}/waybill/`;
