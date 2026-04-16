import { parseLocaleNumber } from '../../../shared/lib';

/**
 * Жизненный цикл партии (ожидаемые ключи с бэка: lifecycle_status | batch_status).
 * Иначе — эвристика по otk_checked_at / otk_status.
 */
export function batchProductionLifecycleRu(b) {
  const explicit = String(b?.lifecycle_status ?? b?.batch_status ?? b?.production_status ?? '').toLowerCase();
  if (explicit === 'pending' || explicit === 'draft' || explicit === 'production') {
    return { key: 'pending', label: 'Производство' };
  }
  if (explicit === 'otk' || explicit === 'at_otk' || explicit === 'awaiting_otk') {
    return { key: 'otk', label: 'На ОТК' };
  }
  if (explicit === 'done' || explicit === 'completed' || explicit === 'closed') {
    return { key: 'done', label: 'Завершено' };
  }
  if (b?.otk_checked_at) {
    return { key: 'done', label: 'Завершено' };
  }
  const otk = String(b?.otk_status ?? '').toLowerCase();
  if (otk === 'accepted' || otk === 'rejected') {
    return { key: 'done', label: 'Завершено' };
  }
  if (
    b?.in_otk_queue === true
    || b?.sent_to_otk === true
    || otk === 'pending'
    || otk === 'awaiting'
    || otk === 'waiting'
  ) {
    return { key: 'otk', label: 'На ОТК' };
  }
  return { key: 'pending', label: 'Производство' };
}

/** Редактирование карточки (шт / длина / комментарий) — только до передачи на ОТК. */
export function batchMetaEditable(b) {
  if (b?.can_edit === false) return false;
  if (b?.otk_checked_at) return false;
  const ls = String(b?.lifecycle_status ?? b?.batch_status ?? '').toLowerCase();
  if (ls === 'otk' || ls === 'at_otk' || ls === 'done' || ls === 'completed') return false;
  if (b?.in_otk_queue === true || b?.sent_to_otk === true) return false;
  const otk = String(b?.otk_status ?? '').toLowerCase();
  if (['accepted', 'rejected'].includes(otk)) return false;
  return true;
}

export function canSendProductionBatchToOtk(b) {
  if (!batchMetaEditable(b)) return false;
  const life = batchProductionLifecycleRu(b);
  if (life.key !== 'pending') return false;
  if (b?.in_otk_queue === true || b?.sent_to_otk === true) return false;
  return true;
}

export function costPerMeterFromBatch(b) {
  const v = b?.cost_per_meter ?? b?.material_cost_per_meter ?? b?.unit_cost_per_meter;
  return v != null && v !== '' ? parseLocaleNumber(v) : null;
}

export function costPerPieceFromBatch(b) {
  const v = b?.cost_per_piece ?? b?.unit_cost_per_piece ?? b?.material_cost_per_piece;
  return v != null && v !== '' ? parseLocaleNumber(v) : null;
}

export function materialCostTotalFromBatch(b) {
  const v = b?.material_cost_total ?? b?.total_material_cost;
  return v != null && v !== '' ? parseLocaleNumber(v) : null;
}

export function batchTotalMetersDisplay(b) {
  const tm = parseLocaleNumber(b?.total_meters);
  if (Number.isFinite(tm) && tm > 0) return tm;
  const pcs = Number(b?.pieces ?? b?.quantity);
  const len = parseLocaleNumber(b?.length_per_piece);
  if (Number.isFinite(pcs) && Number.isFinite(len) && pcs > 0 && len > 0) return pcs * len;
  return null;
}
