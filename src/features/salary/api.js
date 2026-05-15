import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** Как в analytics/api buildParams — те же типы и отсутствие day при пустом значении */
const buildSalaryParams = (queryState) => {
  const params = {};
  if (queryState?.year != null && queryState.year !== '') params.year = Number(queryState.year);
  if (queryState?.month != null && queryState.month !== '') params.month = Number(queryState.month);
  if (queryState?.day != null && queryState.day !== '') params.day = Number(queryState.day);
  return params;
};

export const fetchSalary = async (queryState, signal) => {
  const params = buildSalaryParams(queryState);
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
