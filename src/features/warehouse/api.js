import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/warehouse/categories/ — query: search (поиск по названию, серверная фильтрация) */
export const fetchCategories = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/warehouse/categories/', { params, ...withSignal({}, signal) });
  return data;
};

export const createCategory = async (body, signal) => {
  const { data } = await apiClient.post('/warehouse/categories/', body, withSignal({}, signal));
  return data;
};

export const updateCategory = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/warehouse/categories/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteCategory = async (id, signal) => {
  await apiClient.delete(`/warehouse/categories/${id}/`, withSignal({}, signal));
};

/** ТЗ: GET /api/warehouse/products/ — query: search, categoryId, page, perPage (camelCase) */
export const fetchProducts = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.categoryId) params.categoryId = queryState.categoryId;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/warehouse/products/', { params, ...withSignal({}, signal) });
  return data;
};

export const fetchProduct = async (id, signal) => {
  const { data } = await apiClient.get(`/warehouse/products/${id}/`, withSignal({}, signal));
  return data;
};

export const createProduct = async (body, signal) => {
  const { data } = await apiClient.post('/warehouse/products/', body, withSignal({}, signal));
  return data;
};

export const updateProduct = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/warehouse/products/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteProduct = async (id, signal) => {
  await apiClient.delete(`/warehouse/products/${id}/`, withSignal({}, signal));
};

export const restockProduct = async (id, body, signal) => {
  const { data } = await apiClient.post(`/warehouse/products/${id}/restock/`, body, withSignal({}, signal));
  return data;
};

/** ТЗ: GET /api/warehouse/restocks/ — query: search, dateFrom, dateTo, page, perPage */
export const fetchRestocks = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.dateFrom) params.dateFrom = queryState.dateFrom;
  if (queryState?.dateTo) params.dateTo = queryState.dateTo;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/warehouse/restocks/', { params, ...withSignal({}, signal) });
  return data;
};
