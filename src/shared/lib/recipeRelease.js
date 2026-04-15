import { parseLocaleNumber } from './numbers';
import { recipeOutputUnitKindRu } from './erpLabels';

/**
 * Нормативный выпуск из карточки рецепта (справочно, кг/м и т.д.).
 * Фактический выпуск и списание — только у ProductionBatch; эти хелперы не подменяют партию.
 */
export function recipeNormativeOutputQuantity(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  const bu = String(recipe.base_unit || '').toLowerCase();
  if (bu === 'per_meter' || bu === 'meter' || bu === 'm') {
    return 1;
  }
  const q = parseLocaleNumber(recipe.output_quantity ?? recipe.yield_quantity);
  if (!Number.isFinite(q) || q <= 0) return null;
  return q;
}

/** Короткая подпись единицы нормативного выпуска для таблиц. */
export function recipeNormativeOutputUnitLabel(recipe) {
  const k = recipe?.output_unit_kind ?? recipe?.output_measure;
  const ru = recipeOutputUnitKindRu(k);
  if (ru) return ru;
  if (k != null && String(k).trim() !== '') return String(k);
  return 'ед.';
}

/**
 * Справочное количество из вложенного объекта ответа API (если бэк оборачивает партию).
 * Для ОТК по текущему UI приоритетен объём партии ProductionBatch (штуки), не норма полуфабриката.
 */
export function normativeOtkQuantityFromRun(run) {
  if (!run || typeof run !== 'object') return null;
  const flat = parseLocaleNumber(
    run.output_quantity ??
      run.quantity ??
      run.released_quantity ??
      run.recipe_output_quantity ??
      run.normative_release_quantity,
  );
  if (Number.isFinite(flat) && flat > 0) return flat;
  return recipeNormativeOutputQuantity(run.recipe);
}
