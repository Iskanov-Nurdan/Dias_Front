import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

export const fetchSalary = async (queryState, signal) => {
  const params = {};
  if (queryState?.year) params.year = queryState.year;
  if (queryState?.month) params.month = queryState.month;
  if (queryState?.day) params.day = queryState.day;
  const { data } = await apiClient.get('/salary/', { params, ...withSignal({}, signal) });
  return data;
};

/** Сохранить выплату тренера за период (POST /api/salary/save/ body: trainerId, year, month, day, trainerPercent?) */
export const saveSalary = async (trainerId, queryState, trainerPercent, signal) => {
  const body = {
    trainerId: trainerId,
    year: queryState?.year,
    month: queryState?.month,
    day: queryState?.day || undefined,
  };
  if (trainerPercent != null && trainerPercent !== '') body.trainerPercent = Number(trainerPercent);
  const { data } = await apiClient.post('/salary/save/', body, withSignal({}, signal));
  return data;
};
