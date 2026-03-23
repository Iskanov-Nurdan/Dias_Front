/** Месяцы для фильтров (индекс 0 — пусто) */
export const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Годы для статистики и дубликатов клиентов */
export const STATS_YEARS = ['2026', '2027'];

/** Короткие названия месяцев для графиков */
export const MONTHS_SHORT = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Форматирование суммы в сомах (целые числа) */
export const formatMoney = (v) => (v != null && !Number.isNaN(Number(v)) ? `${Math.round(Number(v)).toLocaleString('ru-RU')} сом` : '—');

/** Цвета сегментов для донат-диаграмм */
export const DONUT_COLORS = ['#c53030', '#059669', '#d97706', '#7c3aed', '#0891b2', '#1e3a5f', '#4f46e5', '#0d9488'];

/** Дебаунс поиска (мс) */
export const SEARCH_DEBOUNCE_MS = 350;

/** Проверка «оплачено» у клиента (поддержка paid, is_paid, paid_status) */
export const isClientPaid = (c) => {
  if (!c) return false;
  const v = c.paid ?? c.is_paid ?? c.paid_status;
  if (v === true || v === 'true' || v === 1) return true;
  if (v === false || v === 'false' || v === 0 || v === null || v === undefined) return false;
  return Boolean(v);
};

const SUBSCRIPTION_END_DATE_KEYS = [
  'dateEnd',
  'date_end',
  'subscriptionEnd',
  'subscription_end',
  'validUntil',
  'valid_until',
  'periodEnd',
  'period_end',
  'abonnementEnd',
  'abonnement_end',
];

/** Локальная полуночь для сравнения дат из API (YYYY-MM-DD или ISO) */
const parseLocalDay = (raw) => {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  const ymd = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const y = Number(ymd.slice(0, 4));
    const m = Number(ymd.slice(5, 7));
    const d = Number(ymd.slice(8, 10));
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return dt;
    return null;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const startOfLocalToday = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};

/**
 * Срок абонемента истёк (вчера и раньше по дате окончания).
 * Бэкенд может отдать флаг subscriptionExpired / isSubscriptionExpired или дату в одном из полей выше.
 */
export const isClientSubscriptionExpired = (c) => {
  if (!c) return false;
  const flag =
    c.subscriptionExpired ?? c.subscription_expired ?? c.isSubscriptionExpired ?? c.is_subscription_expired;
  if (flag === true || flag === 'true' || flag === 1) return true;
  if (flag === false || flag === 'false' || flag === 0) return false;

  for (const k of SUBSCRIPTION_END_DATE_KEYS) {
    const endDay = parseLocalDay(c[k]);
    if (!endDay) continue;
    return startOfLocalToday() > endDay;
  }
  return false;
};

/** Проверка «оплачено» в byPaid-элементе аналитики (поддержка paid, is_paid) */
export const isByPaidItemPaid = (x) => x?.paid ?? x?.is_paid ?? false;
