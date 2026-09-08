/**
 * Отчёт «ученики тренера за месяц»: строка таблицы и агрегаты.
 *
 * Долг считаем как «цена со скидкой минус фактически внесённые деньги», а не по флагу paid:
 * флаг говорит только «да/нет», а вопрос был «сколько именно ученик ещё не заплатил».
 * Источник обеих цифр — тот же, что у карточки клиента, поэтому отчёт и карточка не расходятся.
 */

import { isClientPaid } from '../../../shared/constants/common';
import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';
import { getClientFinalPriceForList, getClientPartialPaymentsSum } from './clientActualPayments';

export const CLIENT_TYPE_LABELS = {
  regular: 'Регулярный',
  individual: 'Индивидуальный',
  'one-time': 'Разовый',
};

/** Следующий период с переходом через декабрь. */
export const getNextPeriod = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !(m >= 1 && m <= 12)) return null;
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
};

const trimTime = (v) => (v ? String(v).slice(0, 5) : '');

/** «Пн 18:00–19:00» или пустая строка, если слот не задан. */
export const formatSlotLabel = (client) => {
  const weekday = client?.trainingWeekday ?? client?.training_weekday;
  const from = trimTime(client?.trainingTimeFrom ?? client?.training_time_from);
  const to = trimTime(client?.trainingTimeTo ?? client?.training_time_to);
  const day = WEEKDAYS.find((d) => Number(d.weekday) === Number(weekday));
  const time = from && to ? `${from}–${to}` : from || to || '';
  return [day?.short, time].filter(Boolean).join(' ');
};

const formatDate = (v) => {
  if (!v) return '';
  const iso = String(v).slice(0, 10);
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

/** Клиент из API → строка отчёта. */
export const buildTrainerReportRow = (client) => {
  const price = Math.max(0, getClientFinalPriceForList(client));
  const collected = Math.max(0, getClientPartialPaymentsSum(client));
  const paid = isClientPaid(client);
  const rawType = client?.clientType ?? client?.client_type ?? 'regular';
  return {
    id: client?.id,
    client,
    fio: client?.fio || '—',
    phone: client?.phone || '',
    sportName: client?.sport?.name ?? client?.sportName ?? client?.sport_name ?? '',
    typeLabel: CLIENT_TYPE_LABELS[rawType] ?? rawType,
    slotLabel: formatSlotLabel(client),
    dateStart: formatDate(client?.dateStart ?? client?.date_start),
    price,
    collected,
    /** Остаток к доплате: отрицательного долга не бывает, переплату не показываем как минус. */
    debt: Math.max(0, price - collected),
    paid,
  };
};

/** Агрегаты по месяцу: сколько учеников, сколько оплатили, сколько должны. */
export const summarizeTrainerReport = (rows) => {
  const summary = {
    total: rows.length,
    paid: 0,
    unpaid: 0,
    priceTotal: 0,
    collectedTotal: 0,
    debtTotal: 0,
  };
  for (const row of rows) {
    if (row.paid) summary.paid += 1;
    else summary.unpaid += 1;
    summary.priceTotal += row.price;
    summary.collectedTotal += row.collected;
    summary.debtTotal += row.debt;
  }
  return summary;
};

/** Сортировка по умолчанию: сначала должники (с них и начинают работу), внутри — по алфавиту. */
export const sortTrainerReportRows = (rows) =>
  [...rows].sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    if (a.debt !== b.debt) return b.debt - a.debt;
    return a.fio.localeCompare(b.fio, 'ru');
  });
