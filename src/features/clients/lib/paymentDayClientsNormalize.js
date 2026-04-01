/**
 * Нормализация GET /api/clients/stats/payment-days/clients/
 */

const pick = (row, camel, snake) => row?.[camel] ?? row?.[snake];

/**
 * @param {unknown} raw
 * @returns {Array<{ id: string|number, fio: string, dateStart: string|null, actualPaymentDate: string|null, phone: string, trainerName: string, sportName: string }>}
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
    return {
      id,
      fio: row.fio != null ? String(row.fio) : '—',
      dateStart: ds != null && ds !== '' ? String(ds).slice(0, 10) : null,
      actualPaymentDate: ap != null && ap !== '' ? String(ap).slice(0, 10) : null,
      phone: row.phone != null ? String(row.phone) : '',
      trainerName:
        pick(row, 'trainerName', 'trainer_name') ??
        row.trainer?.fio ??
        '—',
      sportName: pick(row, 'sportName', 'sport_name') ?? row.sport?.name ?? '—',
    };
  }).filter(Boolean);
}
