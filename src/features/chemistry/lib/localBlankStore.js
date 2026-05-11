/**
 * Локальное состояние заготовок и производств по заготовкам (без бэкенда).
 * Синхронизация между «Заготовка», «Производство», «ОТК» через localStorage + события.
 */

import { sumCompositionKg } from './blankRecipeShared';

const KEY_BLANKS = 'dias_local_blanks_v1';
const KEY_RUNS = 'dias_blank_production_runs_v1';
/** Каталог товаров для производства / ОТК (локально, без бэка). */
const KEY_PRODUCTS = 'dias_local_production_products_v1';
/** Накопленная заготовка цеха: бочки по рецепту + доп. кг после приёмки ГП. */
const KEY_EMPLOYEE_PREPARED = 'dias_employee_prepared_blanks_v1';

/** Масса заготовки «ушла в производство» — как в UI ОТК (дозаполнение из рецепта по blankId). */
export function resolveUsedKgForRun(run) {
  if (!run) return 0;
  let recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  let used = run.blankUsedInProductionKg != null ? Number(run.blankUsedInProductionKg) : NaN;
  if (!Number.isFinite(recipe) && run.blankId) {
    const b = loadBlanks().find((x) => String(x.id) === String(run.blankId));
    const s = sumCompositionKg(b?.composition);
    if (s != null) recipe = Number(s);
  }
  if (!Number.isFinite(used)) {
    used = Number.isFinite(recipe) ? recipe : NaN;
  }
  if (!Number.isFinite(used)) used = 0;
  return used < 0 ? 0 : used;
}

/** Масса по рецепту (состав заготовки), дозаполнение из blankId как в UI ОТК. */
export function resolveRecipeKgForRun(run) {
  if (!run) return null;
  let recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  if (!Number.isFinite(recipe) && run.blankId) {
    const b = loadBlanks().find((x) => String(x.id) === String(run.blankId));
    const s = sumCompositionKg(b?.composition);
    if (s != null) recipe = Number(s);
  }
  return Number.isFinite(recipe) ? recipe : null;
}

const safeParse = (raw, fallback) => {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

export function loadBlanks() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_BLANKS);
  const list = safeParse(raw, []);
  return Array.isArray(list) ? list : [];
}

export function saveBlanks(items) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_BLANKS, JSON.stringify(items ?? []));
  window.dispatchEvent(new CustomEvent('dias-blanks-changed'));
}

/** Добавить одну заготовку в конец списка. */
export function appendBlank(item) {
  const list = loadBlanks();
  saveBlanks([...(list || []), item]);
}

export function loadProducts() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_PRODUCTS);
  const list = safeParse(raw, []);
  return Array.isArray(list) ? list : [];
}

export function saveProducts(items) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(items ?? []));
  window.dispatchEvent(new CustomEvent('dias-products-changed'));
}

export function appendProduct(item) {
  const list = loadProducts();
  saveProducts([...(list || []), item]);
}

export function loadBlankProductionRuns() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_RUNS);
  const list = safeParse(raw, []);
  return Array.isArray(list) ? list : [];
}

/** ОТК зафиксировал брак (новая запись с меткой времени или старая только с defectKg). */
export function isBlankRunOtkRecorded(run) {
  if (!run) return false;
  if (run.otkRecordedAt) return true;
  return run.defectKg != null && Number.isFinite(Number(run.defectKg));
}

export function saveBlankProductionRuns(runs) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_RUNS, JSON.stringify(runs ?? []));
  window.dispatchEvent(new CustomEvent('dias-blank-runs-changed'));
}

export function appendBlankProductionRun(run) {
  const runs = loadBlankProductionRuns();
  runs.unshift(run);
  saveBlankProductionRuns(runs);
}

export function updateBlankProductionRun(runId, patch) {
  const runs = loadBlankProductionRuns();
  const i = runs.findIndex((r) => String(r.id) === String(runId));
  if (i < 0) return false;
  runs[i] = { ...runs[i], ...patch };
  saveBlankProductionRuns(runs);
  return true;
}

let employeePreparedStoreVersion = 0;

export function getEmployeePreparedSnapshot() {
  return employeePreparedStoreVersion;
}

export function subscribeEmployeePrepared(callback) {
  const bump = (ev) => {
    if (ev?.type === 'storage' && ev.key != null && ev.key !== KEY_EMPLOYEE_PREPARED) return;
    employeePreparedStoreVersion += 1;
    callback();
  };
  window.addEventListener('dias-employee-prepared-changed', bump);
  window.addEventListener('storage', bump);
  return () => {
    window.removeEventListener('dias-employee-prepared-changed', bump);
    window.removeEventListener('storage', bump);
  };
}

export function loadEmployeePreparedBlanks() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_EMPLOYEE_PREPARED);
  const list = safeParse(raw, []);
  return Array.isArray(list) ? list : [];
}

function saveEmployeePreparedBlanks(rows) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_EMPLOYEE_PREPARED, JSON.stringify(rows ?? []));
  window.dispatchEvent(new CustomEvent('dias-employee-prepared-changed'));
}

function ensurePreparedRow(list, blankId) {
  const id = String(blankId);
  let row = list.find((r) => String(r.blankId) === id);
  if (!row) {
    row = { blankId: id, barrels: 0, extraKg: 0 };
    list.push(row);
  }
  return row;
}

/** +1 бочка по выбранному рецепту (масса бочки = сумма кг по составу заготовки). */
export function addEmployeeBarrel(blankId) {
  if (blankId == null || blankId === '') return false;
  const blank = loadBlanks().find((b) => String(b.id) === String(blankId));
  const recipeKg = sumCompositionKg(blank?.composition);
  if (recipeKg == null || !Number.isFinite(Number(recipeKg)) || Number(recipeKg) <= 0) return false;
  const list = loadEmployeePreparedBlanks();
  const row = ensurePreparedRow(list, blankId);
  row.barrels = Number(row.barrels || 0) + 1;
  saveEmployeePreparedBlanks(list);
  return true;
}

/** Добавить кг в цеховую заготовку (остаток после частичной приёмки ГП). */
export function addEmployeePreparedExtraKg(blankId, kg) {
  if (blankId == null || blankId === '') return false;
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 1e-9) return false;
  const list = loadEmployeePreparedBlanks();
  const row = ensurePreparedRow(list, blankId);
  row.extraKg = Number(row.extraKg || 0) + n;
  saveEmployeePreparedBlanks(list);
  return true;
}

export function getEmployeePreparedBreakdown(blankId) {
  const blank = loadBlanks().find((b) => String(b.id) === String(blankId));
  const recipeKg = sumCompositionKg(blank?.composition);
  if (recipeKg == null || !Number.isFinite(Number(recipeKg)) || Number(recipeKg) <= 0) {
    return null;
  }
  const row = loadEmployeePreparedBlanks().find((r) => String(r.blankId) === String(blankId));
  const barrels = row ? Number(row.barrels) || 0 : 0;
  const extraKg = row ? Number(row.extraKg) || 0 : 0;
  const rp = Number(recipeKg);
  return {
    recipeKgPerBarrel: rp,
    barrels,
    extraKg,
    totalKg: barrels * rp + extraKg,
  };
}

/** Лимит штук для приёмки ГП и расчёт фактических кг. */
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
  return { ok: true, maxPieces, goodKg, weightKgPerPiece: w };
}

/** Брак (кг) и автоматический расчёт годного веса и штук (локально). */
export function setBlankRunDefectKg(runId, kg) {
  const runs = loadBlankProductionRuns();
  const i = runs.findIndex((r) => String(r.id) === String(runId));
  if (i < 0) return false;
  const n = Number(kg);
  if (!Number.isFinite(n) || n < 0) return false;
  const run = runs[i];
  const used = resolveUsedKgForRun(run);
  if (n > 0 && used <= 0) return false;
  if (used > 0 && n > used) return false;
  const goodKg = Math.max(0, used - n);
  const w = Number(run.weightKgPerPiece);
  const goodPieces =
    Number.isFinite(w) && w > 0 ? Math.floor(goodKg / w + 1e-9) : null;
  runs[i] = {
    ...run,
    defectKg: n,
    goodKg,
    goodPieces: goodPieces != null ? goodPieces : null,
    otkRecordedAt: new Date().toISOString(),
  };
  saveBlankProductionRuns(runs);
  return true;
}

/**
 * Принять выпуск на склад ГП.
 * @param {string|number} runId
 * @param {number|null|undefined} acceptedPieces — фактически принято шт; null/undefined = максимум (весь годный объём по расчёту)
 */
export function acceptGpWarehouseRunWithPieces(runId, acceptedPieces) {
  const runs = loadBlankProductionRuns();
  const i = runs.findIndex((r) => String(r.id) === String(runId));
  if (i < 0) return false;
  const run = runs[i];
  if (!isBlankRunOtkRecorded(run)) return false;
  if (run.gpAcceptedAt) return false;
  const bounds = getGpAcceptBounds(run);
  if (!bounds.ok) return false;
  const { maxPieces, goodKg, weightKgPerPiece: w } = bounds;
  const pieces =
    acceptedPieces == null || acceptedPieces === ''
      ? maxPieces
      : Math.floor(Number(acceptedPieces));
  if (!Number.isFinite(pieces) || pieces < 0 || pieces > maxPieces) return false;
  const acceptedKg = pieces * w;
  const machineRemainderKg = Math.max(0, goodKg - acceptedKg);
  runs[i] = {
    ...run,
    gpAcceptedAt: new Date().toISOString(),
    gpAcceptedPieces: pieces,
    gpAcceptedKg: acceptedKg,
    gpMachineRemainderKg: machineRemainderKg,
  };
  saveBlankProductionRuns(runs);
  if (machineRemainderKg > 1e-6 && run.blankId != null && run.blankId !== '') {
    addEmployeePreparedExtraKg(run.blankId, machineRemainderKg);
  }
  return true;
}

/** @deprecated Используйте acceptGpWarehouseRunWithPieces; без аргумента штук — полная приёмка. */
export function acceptGpWarehouseRun(runId) {
  return acceptGpWarehouseRunWithPieces(runId, null);
}

/** Для useSyncExternalStore — число, иначе каждый JSON.parse даёт новый [] → бесконечные ререндеры. */
let blankRunsStoreVersion = 0;

/** Для useSyncExternalStore */
export function getBlanksSnapshot() {
  return loadBlanks();
}

export function subscribeBlanks(callback) {
  const h = () => callback();
  window.addEventListener('dias-blanks-changed', h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener('dias-blanks-changed', h);
    window.removeEventListener('storage', h);
  };
}

export function getBlankRunsSnapshot() {
  return blankRunsStoreVersion;
}

export function subscribeBlankRuns(callback) {
  const bump = (ev) => {
    if (ev?.type === 'storage' && ev.key != null && ev.key !== KEY_RUNS) return;
    blankRunsStoreVersion += 1;
    callback();
  };
  window.addEventListener('dias-blank-runs-changed', bump);
  window.addEventListener('storage', bump);
  return () => {
    window.removeEventListener('dias-blank-runs-changed', bump);
    window.removeEventListener('storage', bump);
  };
}
