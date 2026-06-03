/**
 * Цех: заготовки, остатки, партии, ОТК, приёмка ГП.
 * Пагинация: чаще всего { items, meta, links }; для prepared-blanks допускается DRF { count, results }.
 */

import { apiClient } from '../../../shared/api';
import { formatNumberForInput } from '../../../shared/lib/numbers';

// --- Чтение справочника заготовок (WorkshopBlank) ---

export const getWorkshopBlanks = (params) => apiClient.get('workshop/blanks/', { params });

export const getWorkshopBlank = (id) => apiClient.get(`workshop/blanks/${id}/`);

/** Создание заготовки (нужен writable ViewSet на бэке). */
export const postWorkshopBlank = (data) => apiClient.post('workshop/blanks/', data);

export const patchWorkshopBlank = (id, data) => apiClient.patch(`workshop/blanks/${id}/`, data);

export const deleteWorkshopBlank = (id) => apiClient.delete(`workshop/blanks/${id}/`);

/**
 * Состав для API: quantity_kg — строка с точкой (как api_decimal_str на бэке).
 * @param {{ raw_material_id: string|number, quantity_per_unit: number }[]} comp
 */
export function compositionToApiPayload(comp) {
  if (!Array.isArray(comp)) return [];
  const out = [];
  for (const row of comp) {
    const id = Number(row.raw_material_id);
    const q = Number(row.quantity_per_unit);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(q) || q <= 0) continue;
    out.push({
      raw_material_id: id,
      quantity_kg: formatNumberForInput(q),
    });
  }
  return out;
}

// --- Остатки цеха ---

export const getWorkshopPreparedBlanks = (params) =>
  apiClient.get('workshop/prepared-blanks/', { params });

export const postWorkshopAddBarrel = (blankId) =>
  apiClient.post(`workshop/prepared-blanks/${blankId}/add-barrel/`, {});

// --- Партии производства по заготовке ---

export const getWorkshopBlankProductionRuns = (params) =>
  apiClient.get('workshop/blank-production-runs/', { params });

export const getWorkshopBlankProductionRun = (id) =>
  apiClient.get(`workshop/blank-production-runs/${id}/`);

export const postWorkshopBlankProductionRun = (body) =>
  apiClient.post('workshop/blank-production-runs/', body);

/** @deprecated 410 Gone — учёт через POST workshop/otk-blanks/{blank_id}/account/ */
export const postWorkshopRunOtkDefect = (id, body) =>
  apiClient.post(`workshop/blank-production-runs/${id}/otk-defect/`, body);

/** @deprecated 410 Gone — приёмка в ОТК account */
export const postWorkshopRunAcceptGp = (id, body) =>
  apiClient.post(`workshop/blank-production-runs/${id}/accept-gp/`, body);

// --- Маппинг DRF → UI (camelCase, id строкой для Select) ---

export function mapWorkshopBlankFromApi(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    id: b.id != null ? String(b.id) : '',
    name: b.name != null ? String(b.name) : '',
    recipeKgPerBarrel: Number(b.recipe_kg_per_barrel) || 0,
    chemistryId: b.chemistry_id ?? b.chemistry ?? null,
    composition: mapWorkshopCompositionFromApi(b.composition ?? b.lines ?? b.recipe_lines ?? []),
  };
}

export function mapWorkshopCompositionFromApi(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((row) => {
      const rid = row.raw_material_id ?? row.material_id ?? row.raw_material;
      if (rid == null) return null;
      const q = Number(row.quantity_kg ?? row.quantity_per_unit ?? row.kg ?? row.amount ?? 0);
      if (!Number.isFinite(q) || q <= 0) return null;
      return {
        raw_material_id: String(rid),
        quantity_per_unit: q,
        raw_material_name:
          row.raw_material_name ?? row.material_name ?? row.name ?? null,
      };
    })
    .filter(Boolean);
}

export function mapPreparedBlankRowFromApi(row) {
  if (!row || typeof row !== 'object') return null;
  const bid = row.blank_id ?? row.id;
  const readOptNum = (v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    blankId: bid != null ? String(bid) : '',
    blankName: row.blank_name != null ? String(row.blank_name) : '',
    barrels: Number(row.barrels) || 0,
    extraKg: Number(row.extra_kg) || 0,
    recipeKgPerBarrel: Number(row.recipe_kg_per_barrel) || 0,
    totalKg: Number(row.total_kg) || 0,
    /** Кг заготовки, накопленные из остатка машины после приёмки ГП (см. бэкенд). */
    fromMachineRemainderKg: readOptNum(
      row.from_machine_remainder_kg ?? row.machine_remainder_to_blank_kg,
    ),
    /** Кг, возвращённые в заготовку из ОТК (брак). */
    fromDefectKg: readOptNum(row.from_defect_kg ?? row.defect_returned_to_blank_kg),
    /** «Чистая» масса без доли машины и брака (см. бэкенд). */
    pureKg: readOptNum(row.pure_kg ?? row.net_barrels_kg),
  };
}

export function mapBlankProductionRunFromApi(r) {
  if (!r || typeof r !== 'object') return null;
  return {
    id: r.id != null ? String(r.id) : '',
    createdAt: r.created_at ?? null,
    sourceType: r.source_type ?? 'blank',
    blankId: r.blank_id != null ? String(r.blank_id) : '',
    blankName: r.blank_name != null ? String(r.blank_name) : '',
    productId: r.product_id != null ? String(r.product_id) : '',
    productName: r.product_name != null ? String(r.product_name) : '',
    orderLineId: r.order_line_id != null ? String(r.order_line_id) : '',
    clientRequestId: r.client_request_id != null ? String(r.client_request_id) : '',
    blankTotalKg: r.blank_total_kg != null ? Number(r.blank_total_kg) : null,
    blankUsedInProductionKg:
      r.blank_used_in_production_kg != null ? Number(r.blank_used_in_production_kg) : null,
    vatMaxKgDemo: r.vat_max_kg_demo != null ? Number(r.vat_max_kg_demo) : null,
    weightKgPerPiece: r.weight_kg_per_piece != null ? Number(r.weight_kg_per_piece) : null,
    defectKg: r.defect_kg != null ? Number(r.defect_kg) : null,
    goodKg: r.good_kg != null ? Number(r.good_kg) : null,
    goodPieces: r.good_pieces != null ? Number(r.good_pieces) : null,
    otkRecordedAt: r.otk_recorded_at ?? null,
    gpAcceptedAt: r.gp_accepted_at ?? null,
    gpAcceptedPieces: r.gp_accepted_pieces != null ? Number(r.gp_accepted_pieces) : null,
    gpAcceptedKg: r.gp_accepted_kg != null ? Number(r.gp_accepted_kg) : null,
    gpMachineRemainderKg: r.gp_machine_remainder_kg != null ? Number(r.gp_machine_remainder_kg) : null,
    status: r.status != null ? String(r.status) : undefined,
    packedPieces: r.packed_pieces != null && Number.isFinite(Number(r.packed_pieces)) ? Number(r.packed_pieces) : null,
    unpackedPieces:
      r.unpacked_pieces != null && Number.isFinite(Number(r.unpacked_pieces)) ? Number(r.unpacked_pieces) : null,
    unpackedKg: r.unpacked_kg != null && Number.isFinite(Number(r.unpacked_kg)) ? Number(r.unpacked_kg) : null,
    remainingKgInPool: r.remaining_kg_in_pool != null ? Number(r.remaining_kg_in_pool) : null,
    otkFullyAccounted: Boolean(r.otk_fully_accounted),
    otkConsumedKg: r.otk_consumed_kg != null ? Number(r.otk_consumed_kg) : null,
  };
}

export function buildCreateBlankRunPayload({
  blankId,
  blankTotalKg,
  blankUsedInProductionKg,
  vatMaxKgDemo,
}) {
  return {
    blank_id: Number(blankId),
    blank_total_kg: blankTotalKg,
    blank_used_in_production_kg: blankUsedInProductionKg,
    vat_max_kg_demo: vatMaxKgDemo,
  };
}
