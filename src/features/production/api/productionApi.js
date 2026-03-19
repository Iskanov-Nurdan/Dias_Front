import { apiClient } from '../../../shared/api';

const isEndpointMissing = (err) => err?.response?.status === 404 || err?.response?.status === 405;
const normalizeList = (data) => ({
  items: data?.items ?? data?.results ?? [],
  meta: data?.meta ?? null,
  links: data?.links ?? null,
});

export const getProductionOrders = async ({ query = {}, signal } = {}) => {
  try {
    const res = await apiClient.get('production/orders/', { params: query, signal });
    return normalizeList(res.data);
  } catch (err) {
    if (!isEndpointMissing(err)) throw err;
    const res = await apiClient.get('orders/', { params: query, signal });
    return normalizeList(res.data);
  }
};

export const getProductionBatches = async ({ query = {}, signal } = {}) => {
  try {
    const res = await apiClient.get('production/batches/', { params: query, signal });
    return normalizeList(res.data);
  } catch (err) {
    if (isEndpointMissing(err)) {
      const res = await apiClient.get('batches/', { params: query, signal });
      return normalizeList(res.data);
    }
    throw err;
  }
};

export const releaseOrder = async (orderId, data) => {
  const quantity = Number(data?.quantity);
  try {
    return await apiClient.post(`orders/${orderId}/release/`, { quantity });
  } catch (err) {
    if (!isEndpointMissing(err)) throw err;
    return apiClient.post('production/release/', {
      orderId: Number(orderId),
      quantity,
    });
  }
};
