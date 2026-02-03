import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** ТЗ: GET /api/sales/summary/ — query: dateFrom, dateTo → { data: { count, revenue, avgCheck } } */
export const fetchSalesSummary = async (queryState, signal) => {
  const params = {};
  if (queryState?.dateFrom) params.dateFrom = queryState.dateFrom;
  if (queryState?.dateTo) params.dateTo = queryState.dateTo;
  const { data } = await apiClient.get('/sales/summary/', { params, ...withSignal({}, signal) });
  return data;
};

/** ТЗ: GET /api/sales/ — query: dateFrom, dateTo, page, perPage */
export const fetchSales = async (queryState, signal) => {
  const params = {};
  if (queryState?.dateFrom) params.dateFrom = queryState.dateFrom;
  if (queryState?.dateTo) params.dateTo = queryState.dateTo;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/sales/', { params, ...withSignal({}, signal) });
  return data;
};

/** ТЗ: POST /api/sales/ — тело: productId, qty, pricePerUnit, discountPercent?, employeeId?, date?; 409 если мало товара */
export const createSale = async (body, signal) => {
  const { data } = await apiClient.post('/sales/', body, withSignal({}, signal));
  return data;
};
