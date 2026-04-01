/**
 * Нормализация ответа GET /api/clients/stats/payment-days/
 * (бэкенд может отдавать snake_case или camelCase).
 */

const pickDayKey = (row) => {
  if (row == null || typeof row !== 'object') return null;
  const d =
    row.day ??
    row.dayOfMonth ??
    row.day_of_month ??
    row.date;
  if (d == null || d === '') return null;
  if (typeof d === 'number' && Number.isFinite(d)) return d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
};

const pickCount = (row, camel, snake) => {
  const v = row?.[camel] ?? row?.[snake];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * @param {unknown} raw
 * @param {{ year?: string, month?: string }} [context] — для построения ISO-даты, если в ответе только номер дня
 * @returns {{ rows: Array<{ dayKey: string|number, dayIso: string|null, dayLabel: string, registeredCount: number, paidCount: number }> }}
 */
export function normalizeClientsPaymentDayReportResponse(raw, context = {}) {
  const list = raw?.items ?? raw?.days ?? raw?.results ?? raw?.data?.items ?? [];
  if (!Array.isArray(list)) return { rows: [] };

  const rows = list
    .map((row) => {
      const dayKey = pickDayKey(row);
      if (dayKey == null) return null;
      const registeredCount = pickCount(row, 'registeredCount', 'registered_count');
      const paidCount = pickCount(row, 'paidCount', 'paid_count');
      let dayIso = null;
      if (typeof dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        dayIso = dayKey;
      } else if (
        context.year &&
        context.month &&
        typeof dayKey === 'number' &&
        dayKey >= 1 &&
        dayKey <= 31
      ) {
        dayIso = `${context.year}-${pad2(Number(context.month))}-${pad2(dayKey)}`;
      }
      let dayLabel = String(dayKey);
      if (typeof dayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        try {
          const [y, m, d] = dayKey.split('-').map(Number);
          const dt = new Date(y, m - 1, d);
          dayLabel = dt.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          dayLabel = dayKey;
        }
      } else if (typeof dayKey === 'number' && context.year && context.month) {
        try {
          const dt = new Date(Number(context.year), Number(context.month) - 1, dayKey);
          dayLabel = dt.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        } catch {
          dayLabel = String(dayKey);
        }
      } else if (typeof dayKey === 'number') {
        dayLabel = String(dayKey);
      }
      return { dayKey, dayIso, dayLabel, registeredCount, paidCount };
    })
    .filter(Boolean);

  const sortKey = (key) => {
    if (typeof key === 'number' && Number.isFinite(key)) return key;
    const s = String(key);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number(s.replace(/-/g, ''));
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  rows.sort((a, b) => sortKey(a.dayKey) - sortKey(b.dayKey));

  return { rows };
}
