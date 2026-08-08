/**
 * Нормализация GET /api/clients/stats/payment-days/clients/
 */

const pick = (row, camel, snake) => row?.[camel] ?? row?.[snake];

/** @param {unknown} raw */
const normalizePaymentsThatDay = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((p) => {
      if (p == null || typeof p !== 'object') return null;
      const amt = Number(p.amount);
      const d = p.paymentDate ?? p.payment_date;
      const amount = Number.isFinite(amt) ? amt : null;
      const date = d != null && d !== '' ? String(d).slice(0, 10) : null;
      if (amount == null && date == null) return null;
      return { amount, date };
    })
    .filter(Boolean);
};

/**
 * @param {unknown} raw
 * @returns {Array<{ id: string|number, fio: string, dateStart: string|null, actualPaymentDate: string|null, actualPayments: Array|undefined, paymentsThatDay: Array<{ amount: number|null, date: string|null }>, phone: string, trainerName: string, sportName: string }>}
 */
export function normalizePaymentDayClientsResponse(raw) {
  const list = raw?.items ?? raw?.results ?? raw?.clients ?? [];
  if (!Array.isArray(list)) return [];

  return list.map((row) => {
    if (row == null || typeof row !== 'object') return null;
    const id = row.id;
    if (id == null) return null;
    const ds = pick(row, 'dateStart', 'date_start');
    const ap = pick(row, 'actualPaymentDate', 'actual_payment_date');
    // Стандартный Client[] с бэка может включать массив частичных оплат — берём как есть,
    // чтобы «Факт. оплата» считалась так же, как везде в приложении (см. clientActualPayments.js).
    const apArr = pick(row, 'actualPayments', 'actual_payments');
    const ptd = row.payments_that_day ?? row.paymentsThatDay;
    return {
      id,
      fio: row.fio != null ? String(row.fio) : '—',
      dateStart: ds != null && ds !== '' ? String(ds).slice(0, 10) : null,
      actualPaymentDate: ap != null && ap !== '' ? String(ap).slice(0, 10) : null,
      actualPayments: Array.isArray(apArr) ? apArr : undefined,
      paymentsThatDay: normalizePaymentsThatDay(ptd),
      phone: row.phone != null ? String(row.phone) : '',
      trainerName:
        pick(row, 'trainerName', 'trainer_name') ??
        row.trainer?.fio ??
        '—',
      sportName: pick(row, 'sportName', 'sport_name') ?? row.sport?.name ?? '—',
    };
  }).filter(Boolean);
}

/** Строка для ячейки «платежи за день» (kind=paid) */
export function formatPaymentsThatDayCell(parts) {
  if (!parts?.length) return '—';
  return parts
    .map((p) => {
      const a = p.amount;
      const sum =
        a != null && Number.isFinite(Number(a))
          ? `${Number(a).toLocaleString('ru-RU')} сом`
          : '—';
      return sum;
    })
    .join(', ');
}
