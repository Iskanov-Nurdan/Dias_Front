import { setAuditShiftId } from './auditContext';

/**
 * @param {object|null|undefined} data — тело GET shifts/my/
 * @returns {object|null}
 */
export function parseMyShiftFromResponse(data) {
  const d = data || {};
  return Object.prototype.hasOwnProperty.call(d, 'shift') ? d.shift : d;
}

/** Личная смена открыта (closed_at пустой или status open). */
export function isPersonalShiftOpen(shift) {
  if (!shift || shift.id == null) return false;
  if (shift.closed_at) return false;
  if (['open', 'opened', 'active'].includes(shift.status)) return true;
  return Boolean(shift.opened_at && !shift.closed_at);
}

/**
 * Синхронизировать глобальный auditShiftId из объекта смены.
 * @param {object|null|undefined} shift
 */
export function applyAuditShiftFromShift(shift) {
  if (isPersonalShiftOpen(shift)) {
    setAuditShiftId(shift.id);
  } else {
    setAuditShiftId(null);
  }
}

export function clearAuditShift() {
  setAuditShiftId(null);
}
