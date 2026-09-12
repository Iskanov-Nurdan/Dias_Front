import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

// Вложения клиента (фото чеков) убраны: в форме клиента нет интерфейса их загрузки,
// а значит и запросы к /clients/{id}/photos/ никем не вызывались. Если функция вернётся —
// возвращать вместе с UI, а не держать мёртвый слой запросов.

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
  if (queryState?.hasWarnings) params.hasWarnings = true;

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

  if (queryState?.ordering) params.ordering = queryState.ordering;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;

  // Простой фильтр «занятия в этот день недели» (экран «Сегодня»).
  // Отдельно от фильтра по слоту ниже — тому нужны ещё время и тренер.
  if (queryState?.weekday) params.weekday = queryState.weekday;

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

/** Поставить клиенту предупреждение за неоплату (+1, максимум 3; бэкенд сам валидирует условия). */
export const addClientWarning = async (clientId, signal) => {
  const { data } = await apiClient.post(`/clients/${clientId}/warnings/`, {}, withSignal({}, signal));
  return data;
};

/** Сбросить предупреждения клиента в 0. */
export const resetClientWarning = async (clientId, signal) => {
  const { data } = await apiClient.delete(`/clients/${clientId}/warnings/`, withSignal({}, signal));
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

/**
 * Загружает ВСЕХ «не продливших» клиентов, проходя по всем страницам —
 * бэкенд молча обрезает ответ до своего max page size (обычно 100),
 * даже если запросить perPage=500, поэтому одним запросом не обойтись.
 */
export const fetchAllClientsNotRenewed = async ({ year, month }, signal) => {
  const perPage = 100;
  const maxPages = 200; // защита от бесконечного цикла
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= maxPages) {
    const res = await fetchClientsNotRenewed({ year, month, page, perPage }, signal);
    const list = res?.items ?? res?.results ?? (Array.isArray(res) ? res : []);
    all.push(...list);
    const meta = res?.meta;
    const totalPages = meta?.totalPages;
    const isLastPage = list.length < perPage;
    const reachedTotalPages = totalPages != null && page >= totalPages;
    hasMore = !isLastPage && !reachedTotalPages;
    page += 1;
  }
  return all;
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

/**
 * Ответы POST/PATCH/DELETE заморозки: либо тело клиента целиком, либо { client: {...} }.
 * @param {*} data
 * @returns {object|null}
 */
export const unwrapClientPayload = (data) => {
  if (data == null || typeof data !== 'object') return null;
  return data.client ?? data.data ?? data;
};

/**
 * POST /api/clients/{id}/freeze/ — создать заморозку. Тело: { days, reason }.
 * Бэкенд: сдвигает date_start вперёд на days, сохраняет baseline и метаданные заморозки.
 */
export const createClientFreeze = async (clientId, body, signal) => {
  const { data } = await apiClient.post(`/clients/${clientId}/freeze/`, body, withSignal({}, signal));
  return unwrapClientPayload(data);
};

/**
 * PATCH /api/clients/{id}/freeze/ — изменить заморозку (те же поля). Пересчёт date_start от baseline, без суммирования с прежним сдвигом.
 */
export const updateClientFreeze = async (clientId, body, signal) => {
  const { data } = await apiClient.patch(`/clients/${clientId}/freeze/`, body, withSignal({}, signal));
  return unwrapClientPayload(data);
};

/**
 * DELETE /api/clients/{id}/freeze/ — снять заморозку, вернуть date_start к исходному до заморозки.
 */
export const deleteClientFreeze = async (clientId, signal) => {
  const { data } = await apiClient.delete(`/clients/${clientId}/freeze/`, withSignal({}, signal));
  return unwrapClientPayload(data);
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

/**
 * GET /api/clients/stats/payment-days/?year=&month=
 * По дням месяца: записались по date_start; оплатили — по строкам частичных оплат (или legacy actual_payment_date), см. бэкенд.
 * Для колонки «Сумма итога»: сумма платежей за день — поле paid_total_amount или paidTotalAmount (и др. алиасы в paymentDayReportNormalize).
 */
export const fetchClientsPaymentDayReport = async ({ year, month }, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  const { data } = await apiClient.get('/clients/stats/payment-days/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/clients/stats/payment-days/clients/?year=&month=&day=YYYY-MM-DD&kind=registered|paid
 * Список клиентов для ячейки отчёта «Записи по дням».
 */
export const fetchClientsPaymentDayClients = async ({ year, month, day, kind }, signal) => {
  const params = { year, month, day, kind };
  const { data } = await apiClient.get('/clients/stats/payment-days/clients/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/clients/duplicates/ — дубликаты за период считает сервер.
 * Возвращает { exact: [{key, clients}], similar: [{key, clients}] }.
 */
export const fetchClientDuplicates = async ({ year, month, day }, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  const { data } = await apiClient.get('/clients/duplicates/', { params, ...withSignal({}, signal) });
  return { exact: data?.exact ?? [], similar: data?.similar ?? [] };
};

/**
 * GET /api/clients/needs-correction/ — записи с неполными данными.
 * У каждого клиента поле correctionReasons — список причин.
 */
export const fetchClientsNeedsCorrection = async ({ year, month, day, page, perPage }, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  if (page) params.page = page;
  if (perPage) params.perPage = perPage;
  const { data } = await apiClient.get('/clients/needs-correction/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * GET /api/clients/expiring/?days=N — абонементы, которые скоро заканчиваются
 * и ещё не продлены. У каждого клиента есть expiryDate и daysLeft.
 */
export const fetchExpiringClients = async ({ days = 7 } = {}, signal) => {
  const { data } = await apiClient.get('/clients/expiring/', {
    params: { days }, ...withSignal({}, signal),
  });
  return { items: data?.items ?? [], meta: data?.meta ?? {} };
};

/** GET /api/clients/{id}/history/ — все месяцы одного человека. */
export const fetchClientHistory = async (clientId, signal) => {
  const { data } = await apiClient.get(`/clients/${clientId}/history/`, withSignal({}, signal));
  return { items: data?.items ?? [], summary: data?.summary ?? {} };
};

/** POST /api/clients/bulk/ — групповое продление или отметка оплаты. */
export const bulkClientAction = async ({ action, ids, months }, signal) => {
  const body = { action, ids };
  if (months) body.months = months;
  const { data } = await apiClient.post('/clients/bulk/', body, withSignal({}, signal));
  return data;
};

/** GET /api/clients/attendance/?date= — отметки посещения за день. */
export const fetchAttendance = async (dateIso, signal) => {
  const { data } = await apiClient.get('/clients/attendance/', {
    params: dateIso ? { date: dateIso } : {}, ...withSignal({}, signal),
  });
  return data?.items ?? [];
};

/** POST /api/clients/attendance/ — отметить «был» / «не пришёл». */
export const markAttendance = async ({ clientId, date, status }, signal) => {
  const { data } = await apiClient.post('/clients/attendance/',
    { clientId, date, status }, withSignal({}, signal));
  return data;
};

/** DELETE — снять отметку, поставленную по ошибке. */
export const clearAttendance = async (clientId, dateIso, signal) => {
  await apiClient.delete(`/clients/${clientId}/attendance/${dateIso}/`, withSignal({}, signal));
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

// ─── Черновики карточки клиента ──────────────────────────────────────────────
// Незаконченная форма, отложенная «на потом». Хранится на сервере, а не в браузере:
// черновик должен пережить очистку кэша и открываться с любого устройства.

/** GET /api/clients/drafts/ — свои черновики, свежие сверху. */
export const fetchClientDrafts = async (signal) => {
  const { data } = await apiClient.get('/clients/drafts/', withSignal({}, signal));
  return data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
};

/** POST /api/clients/drafts/ — { title, payload } */
export const createClientDraft = async (body, signal) => {
  const { data } = await apiClient.post('/clients/drafts/', body, withSignal({}, signal));
  return data;
};

/** PATCH /api/clients/drafts/:id/ — обновить отложенный черновик на месте. */
export const updateClientDraft = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/clients/drafts/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteClientDraft = async (id, signal) => {
  await apiClient.delete(`/clients/drafts/${id}/`, withSignal({}, signal));
};
