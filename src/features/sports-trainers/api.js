import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/sports/ — query: search (поиск по названию, серверная фильтрация) */
export const fetchSports = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/sports/', { params, ...withSignal({}, signal) });
  return data;
};

export const createSport = async (body, signal) => {
  const { data } = await apiClient.post('/sports/', body, withSignal({}, signal));
  return data;
};

export const updateSport = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/sports/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteSport = async (id, signal) => {
  await apiClient.delete(`/sports/${id}/`, withSignal({}, signal));
};

/** ТЗ: GET /api/trainers/ — query: sportId, search, page, perPage (camelCase) */
export const fetchTrainers = async (queryState, signal) => {
  const params = {};
  if (queryState?.sportId) params.sportId = queryState.sportId;
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/trainers/', { params, ...withSignal({}, signal) });
  return data;
};

export const createTrainer = async (body, signal) => {
  const { data } = await apiClient.post('/trainers/', body, withSignal({}, signal));
  return data;
};

export const updateTrainer = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/trainers/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteTrainer = async (id, signal) => {
  await apiClient.delete(`/trainers/${id}/`, withSignal({}, signal));
};
