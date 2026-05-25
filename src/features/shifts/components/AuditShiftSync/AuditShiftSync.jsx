import { useEffect } from 'react';
import { useAuth } from '../../../auth';
import { clearAuditShift } from '../../../../shared/lib/auditShiftSync';
import { bootstrapAuditShiftFromServer } from '../../lib/bootstrapAuditShift';

/** Синхронизация auditShiftId при входе и сброс при выходе. */
export default function AuditShiftSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;
    if (!user) {
      clearAuditShift();
      return undefined;
    }
    let cancelled = false;
    bootstrapAuditShiftFromServer().catch(() => {
      if (!cancelled) clearAuditShift();
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);

  return null;
}
