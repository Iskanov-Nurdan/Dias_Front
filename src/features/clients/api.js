import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** ТЗ: GET /api/clients/ — query: search, sportId, trainerId, paid, clientType, year/month/day, page, perPage (camelCase); опционально trainingWeekday (1–7), trainingTimeFrom, trainingTimeTo — фильтр по слоту графика */
const getLastDay = (year, month) => new Date(year, month, 0).getDate();

const pad = (n) => String(n).padStart(2, '0');

const buildClientsListParams = (queryState) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.sportId) params.sportId = queryState.sportId;
  if (queryState?.trainerId) params.trainerId = queryState.trainerId;
  if (queryState?.paid !== undefined && queryState?.paid !== '') params.paid = queryState.paid;
  if (queryState?.clientType) params.clientType = queryState.clientType;

  const y = queryState?.year;
  const m = queryState?.month;
  const d = queryState?.day;

  if (y) {
    params.year = y;
    if (m) params.month = m;
    const month = m ? pad(m) : '01';
    const monthEnd = m ? pad(m) : '12';
    const dayStart = d ? pad(d) : '01';
    const dayEnd = d ? pad(d) : String(m ? getLastDay(Number(y), Number(m)) : 31);
    params.dateFrom = `${y}-${month}-${dayStart}`;
    params.dateTo   = `${y}-${monthEnd}-${dayEnd}`;
  }

  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;

  const twd = queryState?.trainingWeekday ?? queryState?.training_weekday;
  if (twd !== undefined && twd !== null && twd !== '') {
    const n = Number(twd);
    if (Number.isFinite(n) && n >= 1 && n <= 7) params.trainingWeekday = n;
  }
  const ttf = queryState?.trainingTimeFrom ?? queryState?.training_time_from;
  const ttt = queryState?.trainingTimeTo ?? queryState?.training_time_to;
  if (ttf) params.trainingTimeFrom = String(ttf).slice(0, 5);
  if (ttt) params.trainingTimeTo = String(ttt).slice(0, 5);

  return params;
};

export const fetchClients = async (queryState, signal) => {
  const params = buildClientsListParams(queryState);
  const { data } = await apiClient.get('/clients/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/clients/not-renewed/ — только год + месяц (весь месяц) + пагинация.
 * Бэкенд отдаёт items, meta и объект summary со счётчиками.
 */
export const buildNotRenewedRequestParams = ({ year, month, page = 1, perPage = 20 }) => {
  const params = { page, perPage };
  if (!year || !month) return params;
  const y = String(year);
  const m = pad(Number(month));
  const last = getLastDay(Number(y), Number(month));
  params.year = y;
  params.month = String(Number(month));
  params.dateFrom = `${y}-${m}-01`;
  params.dateTo = `${y}-${m}-${pad(last)}`;
  return params;
};

export const fetchClientsNotRenewed = async ({ year, month, page, perPage }, signal) => {
  const params = buildNotRenewedRequestParams({ year, month, page, perPage });
  const { data } = await apiClient.get('/clients/not-renewed/', { params, ...withSignal({}, signal) });
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

/** POST /api/clients/{id}/extend/ — тело: { months }. Бэкенд: новые месяцы — paid=true; строка {id} (текущий период) — поле оплаты не трогать. */
export const extendClient = async (id, body, signal) => {
  const { data } = await apiClient.post(`/clients/${id}/extend/`, body, withSignal({}, signal));
  return data;
};

/** GET /api/clients/{id}/one-time/ — список разовых оплат клиента */
export const fetchClientOneTimePayments = async (clientId, signal) => {
  const { data } = await apiClient.get(`/clients/${clientId}/one-time/`, withSignal({}, signal));
  return data;
};

/** POST /api/clients/{id}/one-time/ — создать разовую оплату. 409 если период закрыт. */
export const createOneTimePayment = async (clientId, body, signal) => {
  const { data } = await apiClient.post(`/clients/${clientId}/one-time/`, body, withSignal({}, signal));
  return data;
};

/** DELETE /api/clients/{id}/one-time/{payment_id}/ — удалить разовую доплату. 409 если период закрыт. */
export const deleteOneTimePayment = async (clientId, paymentId, signal) => {
  await apiClient.delete(`/clients/${clientId}/one-time/${paymentId}/`, withSignal({}, signal));
};

/** GET /api/clients/stats/ — статистика по клиентам (year, month) */
export const fetchClientsStats = async ({ year, month }, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  const { data } = await apiClient.get('/clients/stats/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/clients/stats/schedule/ — ученики по слотам графика тренеров (тот же период, что и /clients/stats/).
 * Формат ответа см. ТЗ для бэкенда в репозитории / у команды.
 */
export const fetchClientsScheduleStats = async ({ year, month }, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  const { data } = await apiClient.get('/clients/stats/schedule/', { params, ...withSignal({}, signal) });
  return data;
};

/** Загружает ВСЕ клиенты, проходя по всем страницам (для дубликатов) */
export const fetchAllClientsPaginated = async (queryOverrides, signal) => {
  const perPage = 100;
  const maxPages = 200; // защита от бесконечного цикла
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= maxPages) {
    const q = { page, perPage, ...queryOverrides };
    const res = await fetchClients(q, signal);
    const list = res?.items ?? res?.results ?? [];
    all.push(...list);
    const meta = res?.meta;
    const totalPages = meta?.totalPages;
    // Останавливаемся, если: получили меньше чем perPage (последняя страница) ИЛИ достигли totalPages
    const isLastPage = list.length < perPage;
    const reachedTotalPages = totalPages != null && page >= totalPages;
    hasMore = !isLastPage && !reachedTotalPages;
    page += 1;
  }
  return all;
};
