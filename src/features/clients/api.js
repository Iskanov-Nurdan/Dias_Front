import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** ТЗ: GET /api/clients/ — query: search, sportId, paid, clientType, page, perPage (camelCase) */
const getLastDay = (year, month) => new Date(year, month, 0).getDate();

const pad = (n) => String(n).padStart(2, '0');

export const fetchClients = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.sportId) params.sportId = queryState.sportId;
  if (queryState?.paid !== undefined && queryState?.paid !== '') params.paid = queryState.paid;
  if (queryState?.clientType) params.clientType = queryState.clientType;

  const y = queryState?.year;
  const m = queryState?.month;
  const d = queryState?.day;

  if (y) {
    const month = m ? pad(m) : '01';
    const monthEnd = m ? pad(m) : '12';
    const dayStart = d ? pad(d) : '01';
    const dayEnd = d ? pad(d) : String(m ? getLastDay(Number(y), Number(m)) : 31);

    params.dateFrom = `${y}-${month}-${dayStart}`;
    params.dateTo   = `${y}-${monthEnd}-${dayEnd}`;
  }

  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/clients/', { params, ...withSignal({}, signal) });
  return data;
};

export const fetchClient = async (id, signal) => {
  const { data } = await apiClient.get(`/clients/${id}/`, withSignal({}, signal));
  return data;
};

export const createClient = async (body, signal) => {
  const { data } = await apiClient.post('/clients/', body, withSignal({}, signal));
  return data;
};

export const updateClient = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/clients/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteClient = async (id, signal) => {
  await apiClient.delete(`/clients/${id}/`, withSignal({}, signal));
};

export const extendClient = async (id, body, signal) => {
  const { data } = await apiClient.post(`/clients/${id}/extend/`, body, withSignal({}, signal));
  return data;
};
