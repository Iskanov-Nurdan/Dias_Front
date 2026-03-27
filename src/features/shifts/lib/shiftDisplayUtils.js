/**
 * Подпись линии в объекте смены (SHIFT_AND_AUDIT §8: line_name, line_label, line_name_snapshot, line).
 */
export function shiftLineLabel(s) {
  if (!s || typeof s !== 'object') return '';
  const nested =
    s.line && typeof s.line === 'object'
      ? s.line.name || s.line.label || s.line.title
      : null;
  const flat = s.line_name || s.line_label || s.line_name_snapshot;
  const v = flat != null && String(flat).trim() !== '' ? flat : nested;
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}
