/**
 * Чистые функции по партиям заготовки (без localStorage).
 * Run в camelCase после mapBlankProductionRunFromApi.
 */

/** Масса заготовки «ушла в производство». */
export function resolveUsedKgForRun(run) {
  if (!run) return 0;
  let recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  let used = run.blankUsedInProductionKg != null ? Number(run.blankUsedInProductionKg) : NaN;
  if (!Number.isFinite(used)) {
    used = Number.isFinite(recipe) ? recipe : NaN;
  }
  if (!Number.isFinite(used)) used = 0;
  return used < 0 ? 0 : used;
}

/** Масса по рецепту (с сервера: blank_total_kg). */
export function resolveRecipeKgForRun(run) {
  if (!run) return null;
  const recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  return Number.isFinite(recipe) ? recipe : null;
}

export function isBlankRunOtkRecorded(run) {
  if (!run) return false;
  if (run.otkRecordedAt) return true;
  return run.defectKg != null && Number.isFinite(Number(run.defectKg));
}

/**
 * Лимит штук для приёмки ГП (как на бэке: min по годному, good_pieces и vat_max/weight).
 */
export function getGpAcceptBounds(run) {
  if (!run) return { ok: false };
  const w = Number(run.weightKgPerPiece);
  const goodKg = Number(run.goodKg);
  if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(goodKg) || goodKg < 0) {
    return { ok: false };
  }
  const maxByKg = Math.floor(goodKg / w + 1e-9);
  let maxPieces = maxByKg;
  if (run.goodPieces != null && Number.isFinite(Number(run.goodPieces))) {
    maxPieces = Math.min(maxPieces, Math.floor(Number(run.goodPieces)));
  }
  const vat = Number(run.vatMaxKgDemo);
  if (Number.isFinite(vat) && vat > 0) {
    const maxByVat = Math.floor(vat / w + 1e-9);
    maxPieces = Math.min(maxPieces, maxByVat);
  }
  return { ok: true, maxPieces, goodKg, weightKgPerPiece: w };
}
