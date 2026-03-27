import { parseLocaleNumber } from './numbers';
import { recipeOutputUnitKindRu } from './erpLabels';

/**
 * Нормативный выпуск из карточки рецепта (НЕ из числа партий замеса).
 * Используется для quantity в корне recipe-run и для отображения «Выпуск» в UI.
 */
export function recipeNormativeOutputQuantity(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
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
 * Выпуск для ОТК / отображения по объекту замеса (ответ API).
 * Не суммирует party.quantity — только поля замеса и вложенный recipe.
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
