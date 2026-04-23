import { apiClient } from '../../../shared/api';

export const getOrders = (params) => apiClient.get('orders/', { params });
export const getOrder = (id) => apiClient.get(`orders/${id}/`);
export const createOrder = (payload) => apiClient.post('orders/', payload);
export const updateOrder = (id, payload) => apiClient.patch(`orders/${id}/`, payload);
export const deleteOrder = (id) => apiClient.delete(`orders/${id}/`);
export const patchOrderStatus = (id, status) => apiClient.patch(`orders/${id}/status/`, { status });

export const downloadOrderWaybill = async (orderId) => {
  const res = await apiClient.get(`orders/${orderId}/nakladnaya/`, {
    responseType: 'blob',
    headers: { Accept: 'text/html,application/pdf,application/octet-stream,*/*' },
  });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Пустой ответ по накладной заявки');
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `order-waybill-${orderId}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
