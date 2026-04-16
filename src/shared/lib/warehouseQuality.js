/**
 * Качество строки склада: только поле `quality` — `good` | `defect`.
 * Иное или отсутствие → `good`.
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {'good'|'defect'}
 */
export function readWarehouseQuality(batch) {
  if (!batch || typeof batch !== 'object') return 'good';
  return String(batch.quality ?? '').trim().toLowerCase() === 'defect' ? 'defect' : 'good';
}

/** Причина брака: только `defect_reason`. */
export function readWarehouseDefectReason(batch) {
  if (!batch || typeof batch !== 'object') return '';
  const r = batch.defect_reason;
  const t = r != null ? String(r).trim() : '';
  return t;
}

/** @param {'good'|'defect'} quality */
export function warehouseQualityShortLabel(quality) {
  return quality === 'defect' ? 'Брак' : 'Годный';
}
