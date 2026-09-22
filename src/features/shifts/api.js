import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

// Денежная сдача смены (нал/карта/расход/аванс) и фотоотчёты живут на
// бэкенде под /shift-closings/ и /shift-photo-reports/ — НЕ под /shifts/.
// /shifts/* — это отдельная, не связанная фича: личный приход/уход
// (apps/production.Shift, см. attendanceApi.js), которую нельзя путать
// с этой, денежной. Раньше фронт ходил на /shifts/, что не существовало
// на этом бэкенде (там /shifts/ — read-only учёт присутствия).

/**
 * GET /api/shift-closings/ — история сдач смен. Query: year, month, day, page, perPage
 *
 * Возвращаем { items, meta }: сервер отдаёт по 20 записей, а раньше здесь
 * оставались только items — страница молча показывала первые двадцать смен
 * из сотни, и остальные были недоступны.
 */
export const fetchShifts = async ({ year, month, day, page = 1, perPage } = {}, signal) => {
  const params = { page };
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  if (perPage) params.perPage = perPage;
  const { data } = await apiClient.get('/shift-closings/', { params, ...withSignal({}, signal) });
  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
  return { items, meta: data?.meta ?? null };
};

/** POST /api/shift-closings/ — завершить смену. Body: { cash, card, expense, advance, total, description } */
export const closeShift = async ({ cash, card, expense, advance, total, description }, signal) => {
  const body = { cash, card, expense, advance, total };
  if (description) body.description = description;
  const { data } = await apiClient.post('/shift-closings/', body, withSignal({}, signal));
  return data;
};

/**
 * PATCH /api/shift-closings/:id/ — исправить уже закрытую смену.
 * Разрешено только один раз на смену — повторная попытка должна вернуть 400/403,
 * бэкенд обязан сам это проверять (фронт только прячет кнопку после первого раза).
 * Бэкенд должен сохранить исходные значения (до правки) и вернуть их в ответе
 * в поле `previous`, а также `isEdited: true` и `editedAt`.
 */
export const updateShift = async (id, { cash, card, expense, advance, total, description }, signal) => {
  const body = { cash, card, expense, advance, total };
  if (description !== undefined) body.description = description;
  const { data } = await apiClient.patch(`/shift-closings/${id}/`, body, withSignal({}, signal));
  return data;
};

/**
 * GET /api/shift-closings/summary/ — итоги по сменам за период.
 * Query: year, month, day, employeeId (сужает только totals — общие
 * заголовочные цифры, byEmployee и coverage считаются по всем сотрудникам).
 * Возвращает { totals, byEmployee, coverage }, coverage — только когда
 * заданы year и month, а day не задан (иначе null).
 */
export const fetchShiftSummary = async ({ year, month, day, employeeId } = {}, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  if (employeeId) params.employeeId = employeeId;
  const { data } = await apiClient.get('/shift-closings/summary/', { params, ...withSignal({}, signal) });
  return data?.data ?? data;
};

/** GET /api/shift-photo-reports/ — фото-отчёты. Query: year, month, day, page, perPage */
export const fetchPhotoReports = async ({ year, month, day, page = 1, perPage } = {}, signal) => {
  const params = { page };
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  if (perPage) params.perPage = perPage;
  const { data } = await apiClient.get('/shift-photo-reports/', { params, ...withSignal({}, signal) });
  const items = data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
  return { items, meta: data?.meta ?? null };
};

/** POST /api/shift-photo-reports/ — добавить фото-отчёт. multipart: photos[], description */
export const addPhotoReport = async ({ photos, description }, signal) => {
  const fd = new FormData();
  for (const p of photos) {
    if (p.file) {
      fd.append('photos', p.file);
    } else if (p.url && p.url.startsWith('data:')) {
      // конвертируем dataURL → Blob если файл уже был прочитан через FileReader
      const res = await fetch(p.url);
      const blob = await res.blob();
      fd.append('photos', blob, p.name || 'photo.jpg');
    }
  }
  if (description) fd.append('description', description);
  const { data } = await apiClient.post('/shift-photo-reports/', fd, {
    ...withSignal({}, signal),
    transformRequest: [(body, headers) => {
      if (body instanceof FormData) delete headers['Content-Type'];
      return body;
    }],
  });
  return data;
};

/**
 * DELETE /api/shift-closings/:id/ — удалить ошибочно закрытую смену.
 *
 * Правка смены разрешена лишь однажды, поэтому ошибку в самом факте закрытия
 * (закрыли дважды, закрыли не за того) исправить было нечем. Бэкенд пускает
 * только администратора и только смену текущего дня — вчерашние отчёты
 * задним числом не переписываются.
 */
export const deleteShift = async (id, signal) => {
  await apiClient.delete(`/shift-closings/${id}/`, withSignal({}, signal));
};

/**
 * DELETE /api/shift-photo-reports/:id/ — удалить фото-отчёт.
 * Удаляет и записи, и сами файлы на сервере.
 */
export const deletePhotoReport = async (id, signal) => {
  await apiClient.delete(`/shift-photo-reports/${id}/`, withSignal({}, signal));
};
