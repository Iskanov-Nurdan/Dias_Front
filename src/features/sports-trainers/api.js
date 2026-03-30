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

/**
 * GET /api/trainers/
 * query: sportId, sport_id, search, page, perPage,
 *        weekday (1=Пн … 7=Вс), timeFrom, timeTo (HH:mm) — см. docs/API_TRAINER_SCHEDULE.md
 */
export const fetchTrainers = async (queryState, signal) => {
  const params = {};
  const sid = queryState?.sportId ?? queryState?.sport_id;
  if (sid != null && sid !== '') {
    params.sportId = sid;
    params.sport_id = sid;
  }
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const wd = queryState?.weekday ?? queryState?.week_day;
  if (wd != null && wd !== '') {
    params.weekday = wd;
    params.week_day = wd;
  }
  const tf = queryState?.timeFrom ?? queryState?.time_from;
  const tt = queryState?.timeTo ?? queryState?.time_to;
  if (tf) {
    params.timeFrom = tf;
    params.time_from = tf;
  }
  if (tt) {
    params.timeTo = tt;
    params.time_to = tt;
  }
  const { data } = await apiClient.get('/trainers/', { params, ...withSignal({}, signal) });
  return data;
};

/** GET /api/trainers/{id}/schedule/ — график работы тренера */
export const fetchTrainerSchedule = async (id, signal) => {
  const { data } = await apiClient.get(`/trainers/${id}/schedule/`, withSignal({}, signal));
  return data;
};

/** PUT /api/trainers/{id}/schedule/ — полная замена графика */
export const updateTrainerSchedule = async (id, body, signal) => {
  const { data } = await apiClient.put(`/trainers/${id}/schedule/`, body, withSignal({}, signal));
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
