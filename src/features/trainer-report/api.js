import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/**
 * GET /api/clients/trainer-report/?year=&month= — кабинет тренера.
 *
 * trainerId здесь нет и быть не может: бэкенд сам определяет тренера по
 * аккаунту, отправившему запрос. Отдаёт учеников за месяц и тех, кто не
 * продлился после него.
 */
export const fetchMyTrainerReport = async ({ year, month }, signal) => {
  const { data } = await apiClient.get('/clients/trainer-report/', {
    params: { year, month }, ...withSignal({}, signal),
  });
  return {
    period: data?.period ?? { year, month },
    items: data?.items ?? [],
    lost: { count: data?.lost?.count ?? 0, items: data?.lost?.items ?? [] },
  };
};
