import { apiClient } from '../../../shared/api';

export const getReturns = (params) => apiClient.get('returns/', { params });
export const getReturnById = (id) => apiClient.get(`returns/${id}/`);
export const createReturn = (payload) => apiClient.post('returns/', payload);
export const updateReturn = (id, payload) => apiClient.patch(`returns/${id}/`, payload);
export const deleteReturn = (id) => apiClient.delete(`returns/${id}/`);

export const downloadReturnWaybill = async (returnId) => {
  const res = await apiClient.get(`returns/${returnId}/nakladnaya/`, {
    responseType: 'blob',
    headers: { Accept: 'text/html,application/pdf,application/octet-stream,*/*' },
  });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Пустой ответ по акту возврата');
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `return-waybill-${returnId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
