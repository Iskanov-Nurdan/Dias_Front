/**
 * Поправка «Прихода» под фактически полученные деньги.
 *
 * CRM считает приход по всем записям периода, а на руках у клуба оказывается
 * меньше (часть абонементов не оплачена, часть оплат прошла другим месяцем).
 * Сверка по тетради за 2026 год дала пару чисел на месяц: сколько показывала
 * CRM и сколько получили по факту. Здесь эта сверка лежит таблицей, и весь
 * экран аналитики показывает уже пересчитанные суммы.
 *
 * Это правка только на фронте: в API и в базе всё остаётся как было, поэтому
 * детализация по записям (модалка «Детализация приходов») по-прежнему
 * показывает настоящие строки и их сумму — она не пересчитывается.
 *
 * Чтобы отключить поправку — очистить INCOME_FACTS ({}) или убрать нужный год.
 */

// crm — сумма, которую показывает бэкенд за полный месяц; shown — что выводим.
const INCOME_FACTS = {
  2026: {
    2: { crm: 614511, shown: 404310 },
    3: { crm: 1021862, shown: 986480 },
    4: { crm: 1161841, shown: 1118350 },
    5: { crm: 959820, shown: 949460 },
    6: { crm: 1011761, shown: 1034720 },
    7: { crm: 1048250, shown: 939310 },
    8: { crm: 986259, shown: 726190 },
  },
};

const entryFor = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return null;
  return INCOME_FACTS[y]?.[m] ?? null;
};

/**
 * Во сколько раз ужимаем приход за месяц. Работает и при выбранном дне:
 * день — часть месяца, и доля у него та же, что у месяца целиком.
 */
export const incomeFactor = (year, month) => {
  const e = entryFor(year, month);
  if (!e || !e.crm) return 1;
  return e.shown / e.crm;
};

/** Сумма поправок за год — для режима «весь год», где месяц не выбран. */
const yearDelta = (year) => {
  const months = INCOME_FACTS[Number(year)];
  if (!months) return 0;
  return Object.values(months).reduce((sum, e) => sum + (e.shown - e.crm), 0);
};

/** Приход с поправкой. Без данных по периоду возвращает исходное число. */
export function adjustIncome(raw, { year, month } = {}) {
  const value = Number(raw) || 0;
  if (month == null || month === '') return Math.round(value + yearDelta(year));
  return Math.round(value * incomeFactor(year, month));
}

/** Приход по дням — ужимаем тем же коэффициентом, чтобы график сходился с карточкой. */
export function adjustDailyItems(items, { year, month } = {}) {
  const k = incomeFactor(year, month);
  if (k === 1 || !Array.isArray(items)) return items;
  return items.map((x) => ({ ...x, income: Math.round((Number(x.income) || 0) * k) }));
}

/**
 * Сравнение с прошлым месяцем/годом. Проценты бэкенд считает по своим суммам,
 * а после поправки они относились бы к числам, которых на экране уже нет,
 * поэтому пересчитываем их из поправленных периодов.
 */
export function adjustPeriodComparison(pc, { year, month } = {}) {
  if (!pc || month == null || month === '') return pc;
  const y = Number(year);
  const m = Number(month);
  const prevMonth = m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
  const curr = adjustIncome(pc.currentPeriod?.income, { year: y, month: m });
  const next = { ...pc };

  const recalc = (prevRaw, prevQ, changeKey) => {
    const prev = adjustIncome(prevRaw, prevQ);
    if (!prev || pc[changeKey]?.income == null) return;
    next[changeKey] = { ...pc[changeKey], income: ((curr - prev) / prev) * 100 };
  };

  if (pc.previousPeriod?.income != null) recalc(pc.previousPeriod.income, prevMonth, 'momChange');
  if (pc.previousYearPeriod?.income != null) recalc(pc.previousYearPeriod.income, { year: y - 1, month: m }, 'yoyChange');
  return next;
}
