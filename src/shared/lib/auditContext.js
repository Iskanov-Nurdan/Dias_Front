/**
 * Текущий shift_id для X-Audit-Shift-Id / X-Shift-Id.
 * Бэк: заголовок, если это своя открытая смена; иначе при нескольких открытых — самая поздняя по opened_at (SHIFT_AND_AUDIT §6).
 * При одновременной личной и линейной смене для явной привязки аудита задавайте заголовок с нужным id.
 */
let auditShiftId = null;

export function setAuditShiftId(id) {
  auditShiftId = id != null && id !== '' ? String(id) : null;
}

export function getAuditShiftId() {
  return auditShiftId;
}
