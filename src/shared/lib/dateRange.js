const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

/**
 * year/month/day (единый UI-фильтр периода, см. shared/ui/PeriodFilter) →
 * диапазон dateFrom/dateTo (YYYY-MM-DD), который понимают бэкенды, не
 * знающие отдельных year/month/day — только date_from/date_to (Смены,
 * Журнал действий). Общий, чтобы не дублировать в каждой фиче.
 */
export const ymdToRange = (year, month, day) => {
  if (!year) return {};
  if (day && month) return { dateFrom: isoDate(year, month, day), dateTo: isoDate(year, month, day) };
  if (month) {
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    return { dateFrom: isoDate(year, month, 1), dateTo: isoDate(year, month, lastDay) };
  }
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
};
