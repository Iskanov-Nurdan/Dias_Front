/**
 * Глобальный id личной открытой смены для X-Audit-Shift-Id / X-Shift-Id.
 * Живёт между роутами; сброс только при закрытии смены или logout (см. auditShiftSync, AuthProvider).
 */
let auditShiftId = null;

export function setAuditShiftId(id) {
  auditShiftId = id != null && id !== '' ? String(id) : null;
}

export function getAuditShiftId() {
  return auditShiftId;
}

export function hasAuditShiftId() {
  return auditShiftId != null;
}
