import { parseLocaleNumber, formatNumberForInput } from '../../../shared/lib';

/** Сырьё — только для UI (без бэкенда). */
export const MOCK_RAW_MATERIALS = [
  { id: '1', name: 'Мука в/с' },
  { id: '2', name: 'Сахар-песок' },
  { id: '3', name: 'Маргарин' },
  { id: '4', name: 'Дрожжи прессованные' },
  { id: '5', name: 'Соль пищевая' },
];

export const materialOptions = MOCK_RAW_MATERIALS.map((m) => ({
  value: String(m.id),
  label: m.name,
}));

export const newLineKey = () => `ln-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const normalizeRecipeRowsState = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ key: newLineKey(), raw_material_id: '', quantity_per_unit: '' }];
  }
  return rows.map((r) => ({
    key: r.key || newLineKey(),
    raw_material_id: r.raw_material_id === '' ? '' : String(r.raw_material_id),
    quantity_per_unit:
      r.quantity_per_unit != null && r.quantity_per_unit !== ''
        ? formatNumberForInput(r.quantity_per_unit)
        : '',
  }));
};

export const buildCompositionFromRows = (rows) => {
  const out = [];
  for (const row of rows) {
    const mid = row.raw_material_id === '' || row.raw_material_id == null
      ? NaN
      : Number(row.raw_material_id);
    const q = parseLocaleNumber(row.quantity_per_unit ?? '');
    if (!Number.isFinite(mid)) continue;
    if (!Number.isFinite(q) || q <= 0) continue;
    out.push({
      raw_material_id: String(mid),
      quantity_per_unit: q,
    });
  }
  return out;
};

export const previewSumKgFromRows = (rows) => {
  let s = 0;
  for (const row of rows || []) {
    const q = parseLocaleNumber(row.quantity_per_unit ?? '');
    if (Number.isFinite(q) && q > 0) s += q;
  }
  return s;
};

/** Сумма кг по составу заготовки (как после сохранения в «Заготовка»). */
export const sumCompositionKg = (composition) => {
  if (!Array.isArray(composition)) return null;
  let s = 0;
  for (const row of composition) {
    const q = parseLocaleNumber(row.quantity_per_unit ?? row.quantity ?? '');
    if (Number.isFinite(q) && q > 0) s += q;
  }
  return s > 0 ? s : null;
};

export const formatKgGramsHuman = (kg) => {
  if (!Number.isFinite(kg) || kg <= 0) return '';
  const totalG = Math.round(kg * 1000);
  const fullKg = Math.floor(totalG / 1000);
  const g = totalG % 1000;
  const parts = [];
  if (fullKg > 0) parts.push(`${fullKg} кг`);
  if (g > 0) parts.push(`${g} г`);
  return parts.length ? parts.join(' ') : '0 г';
};

export const compositionTotalSummaryText = (sumKg) => {
  if (!Number.isFinite(sumKg) || sumKg <= 0) return '';
  const dec = formatNumberForInput(sumKg);
  const human = formatKgGramsHuman(sumKg);
  return `Общий итог: ${dec} кг (${human})`;
};

/** Демо: макс. наполнение ёмкости (бочка), подсказка в ОТК — не с бэка. */
export const DEMO_PRODUCTION_VAT_MAX_KG = 180;

export const validateRecipeRows = (recipeRows) => {
  const comp = buildCompositionFromRows(recipeRows);
  if (comp.length === 0) {
    return {
      ok: false,
      error: 'Добавьте хотя бы одно сырьё и положительный вес в кг.',
      comp: null,
    };
  }
  const mids = comp.map((r) => r.raw_material_id);
  if (new Set(mids).size !== mids.length) {
    return { ok: false, error: 'Одно и то же сырьё указано дважды.', comp: null };
  }
  return { ok: true, error: '', comp };
};
