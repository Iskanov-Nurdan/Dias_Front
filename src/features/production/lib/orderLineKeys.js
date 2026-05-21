/** Стабильный ключ позиции заявки для состояния UI. */
export const orderLineKey = (ln, idx) => {
  if (ln?.id != null && ln.id !== 'root') return String(ln.id);
  if (ln?.profile_id != null) return `p-${ln.profile_id}`;
  return `i-${idx}`;
};

/** ID позиции для API (order_line_id). */
export const orderLineApiId = (ln) => {
  const id = ln?.id;
  if (id != null && id !== 'root' && Number.isFinite(Number(id))) return Number(id);
  return null;
};
