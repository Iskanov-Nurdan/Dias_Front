/**
 * Клиентский фильтр по календарной дате (без изменения запросов к API).
 * Сравнение по строке YYYY-MM-DD.
 */

export function extractIsoDatePart(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return '';
}

/** Берёт первую непустую дату из полей объекта (имена полей как в API / маппере). */
export function pickFirstIsoDate(item, fieldNames) {
  if (!item || !Array.isArray(fieldNames)) return '';
  for (const key of fieldNames) {
    const d = extractIsoDatePart(item[key]);
    if (d) return d;
  }
  return '';
}

export function matchesClientDateFilter(filterIso, rowIso) {
  const f = String(filterIso ?? '').trim().slice(0, 10);
  if (!f) return true;
  const r = String(rowIso ?? '').trim().slice(0, 10);
  return r === f;
}
