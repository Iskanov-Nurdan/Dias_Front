import { apiClient } from '../../../shared/api';
import { normativeOtkQuantityFromRun } from '../../../shared/lib/recipeRelease';

// Справочник хим. элементов
export const getChemicalElements = (params) => apiClient.get('chemistry/elements/', { params });
export const getChemicalElement = (id) => apiClient.get(`chemistry/elements/${id}/`);
export const createChemicalElement = (data) => apiClient.post('chemistry/elements/', data);
export const updateChemicalElement = (id, data) => apiClient.patch(`chemistry/elements/${id}/`, data);
export const deleteChemicalElement = (id) => apiClient.delete(`chemistry/elements/${id}/`);

// Остатки
export const getChemistryBalances = () => apiClient.get('chemistry/balances/');

// Запуски производства по рецепту (партии, без списания склада)
export const getRecipeRuns = (params) => apiClient.get('chemistry/recipe-runs/', { params });
export const getRecipeRun = (id) => apiClient.get(`chemistry/recipe-runs/${id}/`);
export const createRecipeRun = (data) => apiClient.post('chemistry/recipe-runs/', data);
export const updateRecipeRun = (id, data) => apiClient.patch(`chemistry/recipe-runs/${id}/`, data);
export const deleteRecipeRun = (id) => apiClient.delete(`chemistry/recipe-runs/${id}/`);

/**
 * Повторная синхронизация с ОТК / пересчёт quantity для ProductionBatch.
 * POST /api/chemistry/recipe-runs/{id}/submit-to-otk/
 * Тело: опционально { quantity }; без тела — правила как при создании запуска.
 * Ответ: production_batch, recipe_run, already_submitted (идемпотентно).
 */
export const submitRecipeRunToOtk = (runId, body = {}) =>
  apiClient.post(`chemistry/recipe-runs/${runId}/submit-to-otk/`, body);

const parseQty = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isNaN(n) ? NaN : n;
};

/** @deprecated используйте normativeOtkQuantityFromRun из shared/lib/recipeRelease */
export const sumRecipeRunReleaseQuantity = normativeOtkQuantityFromRun;

/**
 * Явный вызов submit-to-otk (опционально): после обновления бэкенд сам пересчитывает объём
 * при POST/PATCH recipe-runs, если партия ОТК ещё pending. Оставлено для совместимости.
 */
export const syncRecipeRunToOtk = async (runId) => {
  const { data: run } = await getRecipeRun(runId);
  const qty = normativeOtkQuantityFromRun(run);
  const body = qty != null && qty > 0 ? { quantity: qty } : {};
  return submitRecipeRunToOtk(runId, body);
};

/** Компонент партии для PATCH (из ответа API или из формы). */
const serializeComponentRow = (c) => {
  const qty = parseQty(c.quantity);
  if (Number.isNaN(qty) || qty <= 0) return null;
  const row = {
    quantity: qty,
    unit: (c.unit && String(c.unit)) || 'кг',
  };
  const mid = c.material_id ?? c.raw_material_id;
  const cid = c.chemistry_id ?? c.element_id;
  if (mid != null && mid !== '') row.material_id = Number(mid);
  if (cid != null && cid !== '') row.chemistry_id = Number(cid);
  if (c.id != null && c.id !== '') row.id = c.id;
  return row;
};

/** Сводное число партии: только если все строки в одной единице — сумма (для колонки Σ). */
export const deriveBatchQuantityFromComponents = (components) => {
  if (!Array.isArray(components) || !components.length) return undefined;
  const rows = components.map(serializeComponentRow).filter(Boolean);
  if (!rows.length) return undefined;
  const units = new Set(rows.map((r) => r.unit));
  if (units.size !== 1) return undefined;
  return rows.reduce((s, r) => s + r.quantity, 0);
};

const serializeBatchForPatch = (b, i) => {
  const row = {
    index: b.index != null ? Number(b.index) : i,
    label: b.label || `Партия ${i + 1}`,
  };
  if (b.id != null && b.id !== '') row.id = b.id;
  if (Array.isArray(b.components) && b.components.length) {
    row.components = b.components.map(serializeComponentRow).filter(Boolean);
  }
  return row;
};

const buildNewBatchPayload = (batch, nextIdx) => {
  const rawComps = Array.isArray(batch.components) ? batch.components : [];
  const components = rawComps.map(serializeComponentRow).filter(Boolean);
  if (components.length === 0) {
    throw new Error('Укажите расход по составу рецепта хотя бы по одной позиции');
  }
  return {
    index: batch.index != null ? Number(batch.index) : nextIdx,
    label: batch.label || `Партия ${nextIdx + 1}`,
    components,
  };
};

/**
 * Добавить партию: GET + PATCH полным списком партий (с сохранением components у старых партий).
 * batch: { components: [...], label?, quantity? }
 */
export const appendRecipeRunBatch = async (runId, batch) => {
  const { data: run } = await getRecipeRun(runId);
  const existing = Array.isArray(run?.batches) ? run.batches : [];
  const nextIdx = existing.length;
  const batches = existing.map((b, i) => serializeBatchForPatch(b, i));
  batches.push(buildNewBatchPayload(batch, nextIdx));
  const q = normativeOtkQuantityFromRun(run);
  return updateRecipeRun(runId, {
    batches,
    ...(q != null && q > 0 ? { quantity: q } : {}),
  });
};

/**
 * Добавить несколько партий одним PATCH (без промежуточных сохранений на сервере).
 * batch: { components, label?, quantity? } — как в appendRecipeRunBatch.
 */
export const appendRecipeRunBatchesBulk = async (runId, newBatches) => {
  if (!Array.isArray(newBatches) || newBatches.length === 0) {
    return getRecipeRun(runId);
  }
  const { data: run } = await getRecipeRun(runId);
  const existing = Array.isArray(run?.batches) ? run.batches : [];
  const batches = existing.map((b, i) => serializeBatchForPatch(b, i));
  let idx = batches.length;
  for (const batch of newBatches) {
    batches.push(buildNewBatchPayload(batch, idx));
    idx += 1;
  }
  const q = normativeOtkQuantityFromRun(run);
  return updateRecipeRun(runId, {
    batches,
    ...(q != null && q > 0 ? { quantity: q } : {}),
  });
};

/**
 * Удалить партию по индексу в текущем списке. Если партия была последней — удаляется весь запуск.
 * Возвращает { deletedRun: true } или { deletedRun: false, data } (ответ PATCH).
 */
export const removeRecipeRunBatchAtIndex = async (runId, removeIndex) => {
  const { data: run } = await getRecipeRun(runId);
  const existing = Array.isArray(run?.batches) ? run.batches : [];
  if (removeIndex < 0 || removeIndex >= existing.length) {
    throw new Error('Партия не найдена');
  }
  const filtered = existing.filter((_, i) => i !== removeIndex);
  if (filtered.length === 0) {
    await deleteRecipeRun(runId);
    return { deletedRun: true };
  }
  const batches = filtered.map((b, i) => serializeBatchForPatch(b, i));
  const q = normativeOtkQuantityFromRun(run);
  const res = await updateRecipeRun(runId, {
    batches,
    ...(q != null && q > 0 ? { quantity: q } : {}),
  });
  return { deletedRun: false, data: res.data };
};
