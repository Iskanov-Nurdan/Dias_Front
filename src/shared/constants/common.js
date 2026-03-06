/** Месяцы для фильтров (индекс 0 — пусто) */
export const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

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

/** Проверка «оплачено» в byPaid-элементе аналитики (поддержка paid, is_paid) */
export const isByPaidItemPaid = (x) => x?.paid ?? x?.is_paid ?? false;
