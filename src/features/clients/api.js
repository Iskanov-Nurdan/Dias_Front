import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** Абсолютный URL для путей вида /media/... из ответа API */
export const resolveClientMediaUrl = (pathOrUrl) => {
  if (pathOrUrl == null || pathOrUrl === '') return '';
  const s = String(pathOrUrl);
  if (/^https?:\/\//i.test(s)) return s;
  const base = String(apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return base ? `${base}${path}` : s;
};

export const normalizeClientPhoto = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const url =
    raw.url ??
    raw.fileUrl ??
    raw.file_url ??
    raw.image ??
    raw.imageUrl ??
    raw.image_url ??
    '';
  return {
    id: raw.id,
    kind: raw.kind ?? raw.photoKind ?? raw.photo_kind ?? 'receipt',
    url: resolveClientMediaUrl(url),
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
};

/** GET /api/clients/{id}/photos/ — список вложений (items | results | массив). */
export const fetchClientPhotos = async (clientId, signal) => {
  const { data } = await apiClient.get(`/clients/${clientId}/photos/`, withSignal({}, signal));
  const list = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];
  return { ...data, items: list.map((p) => normalizeClientPhoto(p)).filter(Boolean) };
};

/**
 * POST /api/clients/{id}/photos/ — multipart: по одному полю files и kinds на каждый файл (порядок совпадает).
 */
export const uploadClientPhotos = async (clientId, items, signal) => {
  const fd = new FormData();
  for (const { file, kind } of items) {
    if (!file) continue;
    fd.append('files', file);
    fd.append('kinds', kind || 'receipt');
  }
  const { data } = await apiClient.post(`/clients/${clientId}/photos/`, fd, {
    ...withSignal({}, signal),
    transformRequest: [
      (body, headers) => {
        if (body instanceof FormData) {
          delete headers['Content-Type'];
        }
        return body;
      },
    ],
  });
  const list = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []) ?? [];
  return { ...data, items: list.map((p) => normalizeClientPhoto(p)).filter(Boolean) };
};

/** DELETE /api/clients/{id}/photos/{photoId}/ */
export const deleteClientPhoto = async (clientId, photoId, signal) => {
  await apiClient.delete(`/clients/${clientId}/photos/${photoId}/`, withSignal({}, signal));
};

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
