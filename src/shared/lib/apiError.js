/** Ошибка отмены запроса (AbortController / axios) — не показывать пользователю */
export const isCanceledError = (err) =>
  !err ? false : err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED';

/**
 * Код ошибки API. DIAS_ERP отдаёт { code, error, detail, errors? } (code — на верхнем
 * уровне, error/detail — просто строки); старый формат { error: { code, message } }
 * оставлен вторым вариантом на случай не до конца мигрированных бэкендов.
 */
export const getApiErrorCode = (err) => err?.response?.data?.code ?? err?.response?.data?.error?.code ?? null;

/** Проверка: нет доступа (403 forbidden/permission_denied) */
export const isForbiddenError = (err) => err?.response?.status === 403;

/** Проверка: период закрыт (409 period_closed) */
export const isPeriodClosedError = (err) => getApiErrorCode(err) === 'period_closed';

/** Проверка: rate limit (429 too_many_requests) */
export const isTooManyRequestsError = (err) => getApiErrorCode(err) === 'too_many_requests';

/**
 * Формат ошибок API по ТЗ: { error: { code, message }, errors?: [{ field, message }] }
 */
export const getApiErrorMessage = (err) => {
  // userMessage ставит интерцептор в client.js (нет сети, нет доступа) — он уже
  // по-русски и понятнее, чем сырое axios-сообщение вроде «Network Error».
  if (err?.userMessage) return err.userMessage;
  if (!err?.response?.data) {
    // Сеть отвалилась до ответа сервера: response нет вообще.
    if (!err?.response) return 'Нет соединения с сервером. Проверьте интернет.';
    return err?.message || 'Ошибка запроса';
  }
  const d = err.response.data;
  const msg = d.error?.message ?? d.message ?? d.detail;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg[0]?.message ?? msg[0] ?? 'Ошибка';
  if (d.errors?.length) return d.errors.map((e) => e.message || e.msg).filter(Boolean).join('; ') || 'Ошибка валидации';
  // DRF иногда отдаёт "плоскую" ошибку поля без code/error/detail/errors —
  // { field: "сообщение" } или { field: ["сообщение"] }, например
  // { quantity: "Количество должно быть > 0" } из apps/chemistry/produce.py.
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    const firstValue = Object.values(d)[0];
    if (typeof firstValue === 'string') return firstValue;
    if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') return firstValue[0];
  }
  return 'Ошибка запроса';
};
