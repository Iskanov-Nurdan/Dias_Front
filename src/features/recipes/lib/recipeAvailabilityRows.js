import { parseLocaleNumber, formatQuantityDisplay } from '../../../shared/lib/numbers';

const num = (v) => {
  const n = typeof v === 'number' ? v : parseLocaleNumber(v);
  return Number.isFinite(n) ? n : null;
};

const rowName = (row) =>
  row.component_name
  || row.material_name
  || row.element_name
  || row.name
  || row.raw_material
  || row.element
  || row.component
  || '—';

const rowType = (row) => {
  const t = String(row.type || row.kind || '').toLowerCase();
  if (t.includes('rework') || t.includes('передел')) return 'Переделанные';
  if (t.includes('chem')) return 'Химия';
  if (t.includes('raw') || t.includes('material')) return 'Сырьё';
  if (row.chemistry_id != null && row.material_id == null) return 'Химия';
  if (row.material_id != null || row.raw_material_id != null) return 'Сырьё';
  if (
    (row.warehouse_batch_id != null || row.rework_warehouse_batch_id != null)
    && row.material_id == null
    && row.raw_material_id == null
    && row.chemistry_id == null
    && row.element_id == null
  ) return 'Переделанные';
  return row.type_label || '—';
};

const rowRequired = (row) =>
  num(row.quantity_per_meter ?? row.qty_per_meter ?? row.required ?? row.need ?? row.quantity_needed);

const rowAvailable = (row) =>
  num(row.available ?? row.balance ?? row.stock ?? row.quantity_available);

/**
 * Нормализует ответ GET recipes/{id}/availability/ в строки таблицы для UI.
 */
export function buildRecipeAvailabilityRows(payload) {
  if (payload == null) return { rows: [], message: null, ok: null };

  if (typeof payload === 'string') {
    return { rows: [], message: payload, ok: null };
  }

  if (typeof payload !== 'object') {
    return { rows: [], message: String(payload), ok: null };
  }

  if (typeof payload.detail === 'string' && !Array.isArray(payload.items)) {
    return { rows: [], message: payload.detail, ok: null };
  }

  const okFlag =
    payload.ok === true
      ? true
      : payload.ok === false
        ? false
        : payload.sufficient === true
          ? true
          : payload.sufficient === false
            ? false
            : null;

  const arrays = [
    payload.items,
    payload.results,
    payload.components,
    payload.lines,
    payload.availability,
    payload.missing,
    payload.breakdown,
    payload.data?.items,
    payload.data?.components,
  ].filter(Array.isArray);

  const rawRows = arrays.find((a) => a.length > 0) || [];

  const rows = rawRows.map((row, idx) => {
    const name = rowName(row);
    const type = rowType(row);
    const required = rowRequired(row);
    const available = rowAvailable(row);
    let enough = null;
    if (required != null && available != null) {
      enough = available >= required - 1e-9;
    } else if (row.sufficient != null) {
      enough = Boolean(row.sufficient);
    } else if (row.short != null) {
      enough = !row.short;
    } else if (row.ok != null) {
      enough = Boolean(row.ok);
    }
    const unit = row.unit ? String(row.unit) : 'кг/м';
    return {
      key: row.id ?? row.material_id ?? row.chemistry_id ?? idx,
      name,
      type,
      required,
      available,
      enough,
      unit,
    };
  });

  const message =
    typeof payload.message === 'string'
      ? payload.message
      : typeof payload.summary === 'string'
        ? payload.summary
        : null;

  return { rows, message, ok: okFlag };
}

export function formatAvailabilityCell(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return formatQuantityDisplay(n);
}
