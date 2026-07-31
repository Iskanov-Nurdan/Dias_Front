import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/shifts/ — история смен. Query: year, month, day */
export const fetchShifts = async ({ year, month, day } = {}, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  const { data } = await apiClient.get('/shifts/', { params, ...withSignal({}, signal) });
  return data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
};

/** POST /api/shifts/ — завершить смену. Body: { cash, card, expense, advance, total, description } */
export const closeShift = async ({ cash, card, expense, advance, total, description }, signal) => {
  const body = { cash, card, expense, advance, total };
  if (description) body.description = description;
  const { data } = await apiClient.post('/shifts/', body, withSignal({}, signal));
  return data;
};

/**
 * PATCH /api/shifts/:id/ — исправить уже закрытую смену.
 * Разрешено только один раз на смену — повторная попытка должна вернуть 400/403,
 * бэкенд обязан сам это проверять (фронт только прячет кнопку после первого раза).
 * Бэкенд должен сохранить исходные значения (до правки) и вернуть их в ответе
 * в поле `previous`, а также `isEdited: true` и `editedAt`.
 */
export const updateShift = async (id, { cash, card, expense, advance, total, description }, signal) => {
  const body = { cash, card, expense, advance, total };
  if (description !== undefined) body.description = description;
  const { data } = await apiClient.patch(`/shifts/${id}/`, body, withSignal({}, signal));
  return data;
};

/** GET /api/shifts/photo-reports/ — список фото-отчётов. Query: year, month, day */
export const fetchPhotoReports = async ({ year, month, day } = {}, signal) => {
  const params = {};
  if (year) params.year = year;
  if (month) params.month = month;
  if (day) params.day = day;
  const { data } = await apiClient.get('/shifts/photo-reports/', { params, ...withSignal({}, signal) });
  return data?.items ?? data?.results ?? (Array.isArray(data) ? data : []);
};

/** POST /api/shifts/photo-reports/ — добавить фото-отчёт. multipart: photos[], description */
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
  const { data } = await apiClient.post('/shifts/photo-reports/', fd, {
    ...withSignal({}, signal),
    transformRequest: [(body, headers) => {
      if (body instanceof FormData) delete headers['Content-Type'];
      return body;
    }],
  });
  return data;
};
