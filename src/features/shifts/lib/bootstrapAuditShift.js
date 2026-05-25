import { getMyShift } from '../api/shiftsApi';
import { applyAuditShiftFromShift, clearAuditShift, parseMyShiftFromResponse } from '../../../shared/lib/auditShiftSync';

/** Подтянуть личную смену с сервера и выставить auditShiftId (при старте приложения / после login). */
export async function bootstrapAuditShiftFromServer() {
  try {
    const res = await getMyShift();
    const shift = parseMyShiftFromResponse(res.data);
    applyAuditShiftFromShift(shift);
    return shift;
  } catch {
    clearAuditShift();
    return null;
  }
}
