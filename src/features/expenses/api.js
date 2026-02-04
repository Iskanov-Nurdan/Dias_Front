import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/expense-categories/ — query: search (поиск по названию, серверная фильтрация) */
export const fetchExpenseCategories = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/expense-categories/', { params, ...withSignal({}, signal) });
  return data;
};

export const createExpenseCategory = async (body, signal) => {
  const { data } = await apiClient.post('/expense-categories/', body, withSignal({}, signal));
  return data;
};

export const updateExpenseCategory = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/expense-categories/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteExpenseCategory = async (id, signal) => {
  await apiClient.delete(`/expense-categories/${id}/`, withSignal({}, signal));
};

/** ТЗ: GET /api/expenses/ — query: search, dateFrom, dateTo, categoryId, page, perPage (camelCase) */
export const fetchExpenses = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.dateFrom) params.dateFrom = queryState.dateFrom;
  if (queryState?.dateTo) params.dateTo = queryState.dateTo;
  if (queryState?.categoryId) params.categoryId = queryState.categoryId;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/expenses/', { params, ...withSignal({}, signal) });
  return data;
};

export const createExpense = async (body, signal) => {
  const { data } = await apiClient.post('/expenses/', body, withSignal({}, signal));
  return data;
};

export const updateExpense = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/expenses/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteExpense = async (id, signal) => {
  await apiClient.delete(`/expenses/${id}/`, withSignal({}, signal));
};

export const saveExpense = async (id, signal) => {
  const { data } = await apiClient.patch(`/expenses/${id}/save/`, {}, withSignal({}, signal));
  return data;
};
