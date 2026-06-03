/**
 * ОТК v2: пул заготовок, учёт профилей, история приходов.
 * Бэкенд: docs/BACKEND_OTK_SIMPLIFICATION.md
 */

import { apiClient } from '../../../shared/api';
import { parseApiListResponse } from '../../../shared/lib/apiList';

export function mapOtkBlankPoolFromApi(row) {
  if (!row || typeof row !== 'object') return null;
  const remaining = Number(row.remaining_kg ?? row.remainingKg);
  return {
    blankId: row.blank_id != null ? String(row.blank_id) : '',
    blankName: row.blank_name != null ? String(row.blank_name) : '',
    remainingKg: Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
    totalIntakeKg: Number(row.total_intake_kg ?? row.totalIntakeKg) || 0,
    canAccount: row.can_account != null ? Boolean(row.can_account) : remaining >= 0.001,
    lastIntakeAt: row.last_intake_at ?? row.lastIntakeAt ?? null,
  };
}

export function mapOtkIntakeFromApi(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id != null ? String(row.id) : '',
    blankId: row.blank_id != null ? String(row.blank_id) : '',
    blankName: row.blank_name != null ? String(row.blank_name) : '',
    kg: Number(row.kg ?? row.intake_kg ?? row.blank_used_in_production_kg) || 0,
    createdAt: row.created_at ?? row.produced_at ?? null,
    runId: row.run_id != null ? String(row.run_id) : '',
    source: row.source ?? 'produce',
  };
}

export function mapOtkAccountLineFromApi(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    profileId: row.profile_id != null ? String(row.profile_id) : '',
    profileName: row.profile_name != null ? String(row.profile_name) : '',
    pieces: Number(row.pieces ?? row.quantity_pieces) || 0,
    kg: Number(row.kg ?? row.consumed_kg) || 0,
  };
}

export function mapOtkAccountSessionFromApi(row) {
  if (!row || typeof row !== 'object') return null;
  const lines = Array.isArray(row.lines ?? row.profile_lines)
    ? (row.lines ?? row.profile_lines).map(mapOtkAccountLineFromApi).filter(Boolean)
    : [];
  return {
    id: row.id != null ? String(row.id) : '',
    blankId: row.blank_id != null ? String(row.blank_id) : '',
    blankName: row.blank_name != null ? String(row.blank_name) : '',
    createdAt: row.created_at ?? null,
    consumedKg: Number(row.consumed_kg ?? row.total_consumed_kg) || 0,
    defectKg: Number(row.defect_kg) || 0,
    remainingAfterKg: Number(row.remaining_kg_after ?? row.remaining_after_kg) || 0,
    operatorId: row.operator_id != null ? String(row.operator_id) : '',
    chemistId: row.chemist_id != null ? String(row.chemist_id) : '',
    packerId: row.packer_id != null ? String(row.packer_id) : '',
    operatorName: row.operator_name ?? '',
    chemistName: row.chemist_name ?? '',
    packerName: row.packer_name ?? '',
    lines,
    warehousePosted: Boolean(row.warehouse_posted ?? row.gp_posted),
  };
}

export const getOtkBlankPool = async (params) => {
  const res = await apiClient.get('workshop/otk-blanks/', { params });
  return parseApiListResponse(res.data).map(mapOtkBlankPoolFromApi).filter(Boolean);
};

export const getOtkBlankIntakes = async (params) => {
  const res = await apiClient.get('workshop/otk-blanks/intakes/', { params });
  return parseApiListResponse(res.data).map(mapOtkIntakeFromApi).filter(Boolean);
};

export const getOtkAccountHistory = async (params) => {
  const res = await apiClient.get('workshop/otk-accounting/', { params });
  return parseApiListResponse(res.data).map(mapOtkAccountSessionFromApi).filter(Boolean);
};

/** Учёт в ОТК: профили × шт, брак, сотрудники → склад ГП + списание кг из пула. */
export const postOtkAccount = (blankId, body) =>
  apiClient.post(`workshop/otk-blanks/${blankId}/account/`, body);

export function buildOtkAccountPayload({
  profileLines,
  defect,
  operatorId,
  chemistId,
  packerId,
  comment,
}) {
  const lines = (profileLines || [])
    .filter((ln) => ln.profileId && Number(ln.pieces) > 0)
    .map((ln) => ({
      profile_id: Number(ln.profileId),
      pieces: Math.floor(Number(ln.pieces)),
    }));

  const payload = {
    lines,
    operator_id: operatorId ? Number(operatorId) : null,
    chemist_id: chemistId ? Number(chemistId) : null,
    packer_id: packerId ? Number(packerId) : null,
  };

  if (defect) {
    payload.defect = {
      unit: defect.unit === 'pieces' ? 'pieces' : 'kg',
      value: String(defect.value ?? '0'),
    };
    if (defect.unit === 'pieces' && defect.profileId) {
      payload.defect.profile_id = Number(defect.profileId);
    }
  }

  if (comment != null && String(comment).trim() !== '') {
    payload.comment = String(comment).trim();
  }

  return payload;
}
