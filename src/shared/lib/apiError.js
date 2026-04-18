export const isCanceledError = (err) =>
  err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled';

export const isForbiddenError = (err) =>
  err?.response?.status === 403 || err?.status === 403;

export const isUnauthorizedError = (err) =>
  err?.response?.status === 401 || err?.status === 401;

export const isNetworkError = (err) =>
  !err?.response && err?.request;

/** Строка из массива errors бэка (OpenAPI / API_README): [{ field, message }] */
const formatDiasErrorsArray = (errors) => {
  if (!Array.isArray(errors) || !errors.length) return '';
  return errors
    .map((e) => {
      if (!e || typeof e !== 'object') return '';
      const f = e.field != null ? String(e.field) : '';
      const m = e.message != null ? String(e.message) : '';
      if (f && m) return `${f}: ${m}`;
      return m || f;
    })
    .filter(Boolean)
    .join('; ');
};

/** Нормализует тело ошибки API (как в useServerQuery) в строку для UI */
export const getErrorPayloadMessage = (payload, fallback = 'Произошла ошибка') => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload.message === 'string' && payload.code != null && payload.code !== '') {
    return payload.message;
  }
  if (typeof payload.message === 'string') return payload.message;
  const fromErrors = formatDiasErrorsArray(payload.errors);
  if (fromErrors) return fromErrors;
  if (typeof payload.detail === 'string') return payload.detail;
  if (Array.isArray(payload.detail)) {
    const joined = payload.detail
      .map((x) => {
        if (typeof x === 'string') return x;
        if (x && typeof x === 'object') {
          return typeof x.message === 'string'
            ? x.message
            : typeof x.msg === 'string'
              ? x.msg
              : '';
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');
    if (joined) return joined;
  }
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error && typeof payload.error === 'object') {
    if (typeof payload.error.message === 'string') return payload.error.message;
    if (typeof payload.error.detail === 'string') return payload.error.detail;
  }
  if (payload.status === 500 || payload.code === 500 || String(payload.code) === 'INTERNAL_ERROR') {
    return 'Ошибка сервера (500). Попробуйте позже.';
  }
  return fallback;
};

export const getApiErrorMessage = (err, fallback = 'Произошла ошибка. Попробуйте снова.') => {
  if (!err) return fallback;
  if (isCanceledError(err)) return null;
  if (isNetworkError(err)) return 'Нет соединения с сервером. Проверьте интернет.';
  if (isForbiddenError(err)) return 'Нет доступа к этому ресурсу.';
  if (isUnauthorizedError(err)) return 'Сессия истекла. Войдите снова.';
  if (err?.response?.status === 429) {
    if (typeof err.userMessage === 'string' && err.userMessage) return err.userMessage;
    const d = err?.response?.data;
    const base =
      d && typeof d === 'object'
        ? (typeof d.detail === 'string' ? d.detail : typeof d.error === 'string' ? d.error : null)
        : null;
    const w = d && typeof d === 'object' && d.wait != null && Number.isFinite(Number(d.wait))
      ? ` Повторите через ${Math.ceil(Number(d.wait))} с.`
      : '';
    return (base || 'Слишком много запросов.') + w;
  }
  if (err?.response?.status === 409) {
    const data409 = err?.response?.data;
    const fromBody =
      data409 && typeof data409 === 'object'
        ? getErrorPayloadMessage(data409, null)
        : null;
    return (
      fromBody ||
      'Операция невозможна: конфликт состояния (например, у вас уже открыта другая смена).'
    );
  }

  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    const fromMissing = formatDiasErrorsArray(
      Array.isArray(data.missing) ? data.missing.map((m) =>
        typeof m === 'object' && m != null
          ? {
              field: m.component || m.raw_material || m.element || m.name || 'component',
              message: `нужно ${m.required ?? m.need ?? '?'} ${m.unit || ''}, доступно ${m.available ?? m.balance ?? 0} ${m.unit || ''}`.trim(),
            }
          : { field: '', message: String(m) },
      ) : [],
    );
    if (fromMissing) return fromMissing;
    const fromPayload = getErrorPayloadMessage(data, null);
    if (fromPayload) return fromPayload;
    if (data.detail != null && typeof data.detail !== 'string' && !Array.isArray(data.detail)) {
      return fallback;
    }
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.non_field_errors) return data.non_field_errors[0];
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val) && val[0] != null) return String(val[0]);
      if (typeof val === 'string') return val;
    }
  }

  return err?.message || fallback;
};
