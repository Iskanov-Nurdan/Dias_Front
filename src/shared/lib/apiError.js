export const isCanceledError = (err) =>
  err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled';

export const isForbiddenError = (err) =>
  err?.response?.status === 403 || err?.status === 403;

export const isUnauthorizedError = (err) =>
  err?.response?.status === 401 || err?.status === 401;

export const isNetworkError = (err) =>
  !err?.response && err?.request;

export const getApiErrorMessage = (err, fallback = 'Произошла ошибка. Попробуйте снова.') => {
  if (!err) return fallback;
  if (isCanceledError(err)) return null;
  if (isNetworkError(err)) return 'Нет соединения с сервером. Проверьте интернет.';
  if (isForbiddenError(err)) return 'Нет доступа к этому ресурсу.';
  if (isUnauthorizedError(err)) return 'Сессия истекла. Войдите снова.';

  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.non_field_errors) return data.non_field_errors[0];
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
      if (typeof val === 'string') return `${firstKey}: ${val}`;
    }
  }

  return err?.message || fallback;
};
