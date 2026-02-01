/**
 * Формат ошибок API по ТЗ: { error: { code, message }, errors?: [{ field, message }] }
 */
export const getApiErrorMessage = (err) => {
  if (!err?.response?.data) return err?.message || 'Ошибка запроса';
  const d = err.response.data;
  const msg = d.error?.message ?? d.message ?? d.detail;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg[0]?.message ?? msg[0] ?? 'Ошибка';
  if (d.errors?.length) return d.errors.map((e) => e.message || e.msg).filter(Boolean).join('; ') || 'Ошибка валидации';
  return 'Ошибка запроса';
};
