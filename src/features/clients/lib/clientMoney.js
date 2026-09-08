/**
 * Деньги клиента — читаются из API, а не считаются здесь.
 *
 * Сервер отдаёт готовые поля (clients/pricing.py):
 *   priceDisplay / totalPrice — цена со скидкой,
 *   paidAmount                — фактически внесено,
 *   debt                      — остаток к доплате,
 *   fullyPaid                 — долг закрыт.
 *
 * Формулы живут только на бэкенде: если считать их ещё и в браузере, при первой же
 * правке (скидка, разовые доплаты, округление) отчёт и карточка покажут разные суммы.
 * Этот модуль — тонкий адаптер: понимает camelCase и snake_case, приводит к числу.
 */

const readNumber = (source, keys) => {
  for (const key of keys) {
    const raw = source?.[key];
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Цена абонемента со скидкой, как её считает сервер. */
export const getClientPriceDisplay = (client) =>
  readNumber(client, ['priceDisplay', 'price_display', 'totalPrice', 'total_price']);

/** Фактически внесённая сумма. */
export const getClientPaidAmount = (client) =>
  readNumber(client, ['paidAmount', 'paid_amount']);

/** Остаток к доплате. */
export const getClientDebt = (client) =>
  readNumber(client, ['debt', 'debtAmount', 'debt_amount']);

/** Долг закрыт: сервер прислал признак — используем его, иначе выводим из долга. */
export const isClientFullyPaid = (client) => {
  const flag = client?.fullyPaid ?? client?.fully_paid;
  if (typeof flag === 'boolean') return flag;
  const debt = getClientDebt(client);
  return debt != null ? debt <= 0 : false;
};

/**
 * Пришли ли денежные поля с сервера.
 * Нужно, чтобы отличить «долг равен нулю» от «бэкенд ещё старый и поля не прислал»
 * и не показать ноль там, где на самом деле нет данных.
 */
export const hasServerMoneyFields = (client) => getClientDebt(client) != null;
