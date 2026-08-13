/**
 * Константы и расчётные хелперы линии «Пенополистирол».
 * Данные — реальные, с бэка (`src/features/foam/api/foamApi.js`); этот файл
 * содержит только бизнес-константы и чистые функции форматирования/предпросчёта,
 * которые используются в формах ДО отправки на сервер (сервер — источник истины
 * для итоговых чисел).
 */

export const FOAM_WAREHOUSE_RAW = 'Склад сырья №2 — Пенополистирол';
export const FOAM_WAREHOUSE_GP = 'Склад ГП — Пенопласт';

/** Все форматы товара (для подписей/единиц измерения, в т.ч. на складе). */
export const FOAM_OUTPUT_FORMATS = [
  { value: 'cube', label: 'Куб', unitLabel: 'шт' },
  { value: 'sheet', label: 'Лист', unitLabel: 'листов' },
  { value: 'granule', label: 'Гранулы на продажу', unitLabel: 'кг' },
];

/** Форматы, которые реально выходят из производства (лист — только на складе, нарезкой). */
export const FOAM_PRODUCTION_FORMATS = FOAM_OUTPUT_FORMATS.filter((f) => f.value !== 'sheet');

export const foamOutputFormatLabel = (value) =>
  FOAM_OUTPUT_FORMATS.find((f) => f.value === value)?.label || value;

export const foamOutputUnitLabel = (value) =>
  FOAM_OUTPUT_FORMATS.find((f) => f.value === value)?.unitLabel || 'шт';

/** Куб всегда одного физического размера — высота 60см, стороны 100×200см. */
export const FOAM_CUBE_DIMS_CM = { height: 60, width: 100, length: 200 };
export const FOAM_CUBE_VOLUME_M3 =
  (FOAM_CUBE_DIMS_CM.height / 100) * (FOAM_CUBE_DIMS_CM.width / 100) * (FOAM_CUBE_DIMS_CM.length / 100);

/** Толщины, на которые куб режут на листы уже на складе. */
export const FOAM_SHEET_THICKNESS_OPTIONS_CM = [2, 3, 4];

/** Технологические потери при обработке сырья в производстве (те же, что считает бэк). */
export const FOAM_PRODUCTION_LOSS_PERCENT = 3.5;

export function foamApplyProductionLoss(inputKg) {
  const kg = Number(inputKg);
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return kg * (1 - FOAM_PRODUCTION_LOSS_PERCENT / 100);
}

/** Средняя плотность по грейду, кг/м³. grades — справочник с бэка ({code,minKgM3,maxKgM3}). */
export function foamGradeMidDensityKgM3(gradeCode, grades = []) {
  const g = grades.find((x) => x.code === gradeCode);
  return g ? (g.minKgM3 + g.maxKgM3) / 2 : null;
}

/** Вес одного куба при заданной плотности. */
export function foamCubeWeightKg(gradeCode, grades = []) {
  const density = foamGradeMidDensityKgM3(gradeCode, grades);
  return density ? density * FOAM_CUBE_VOLUME_M3 : null;
}

/**
 * Сколько кубов выйдет из загрузки кг (с учётом потерь 3.5%) — предпросмотр в форме до отправки.
 * Авторитетное значение считает бэк (`POST foam/production-runs/` → `output_qty`).
 */
export function foamCalcCubesFromKg(gradeCode, inputKg, grades = []) {
  const cubeWeight = foamCubeWeightKg(gradeCode, grades);
  if (!cubeWeight) return null;
  const usableKg = foamApplyProductionLoss(inputKg);
  if (usableKg <= 0) return null;
  return Math.round((usableKg / cubeWeight) * 10) / 10;
}

/** Сколько кг гранул на продажу выйдет из загрузки — предпросмотр (авторитетно считает бэк). */
export function foamCalcGranuleKgFromKg(inputKg) {
  const usableKg = foamApplyProductionLoss(inputKg);
  if (usableKg <= 0) return null;
  return Math.round(usableKg * 10) / 10;
}

/** Сколько листов данной толщины получится из одного куба (по высоте куба 60см). */
export function foamSheetsPerCube(thicknessCm) {
  const t = Number(thicknessCm);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(FOAM_CUBE_DIMS_CM.height / t);
}

/** Вес одного листа данной толщины и плотности. */
export function foamSheetWeightKg(gradeCode, thicknessCm, grades = []) {
  const density = foamGradeMidDensityKgM3(gradeCode, grades);
  const t = Number(thicknessCm);
  if (!density || !Number.isFinite(t) || t <= 0) return null;
  const volumeM3 = (FOAM_CUBE_DIMS_CM.width / 100) * (FOAM_CUBE_DIMS_CM.length / 100) * (t / 100);
  return density * volumeM3;
}

/** Вес одной единицы товара на складе — с учётом формата (куб/лист/гранулы). Для гранул 1 единица = 1 кг. */
export function foamUnitWeightKg(row, grades = []) {
  if (!row) return null;
  if (row.outputFormat === 'cube') return foamCubeWeightKg(row.gradeCode, grades);
  if (row.outputFormat === 'sheet') return foamSheetWeightKg(row.gradeCode, row.thicknessCm, grades);
  if (row.outputFormat === 'granule') return 1;
  return null;
}

/** Оценочный вес остатка склада (qty × вес единицы), округлённо. */
export function foamStockRowWeightKg(row, grades = []) {
  const unitWeight = foamUnitWeightKg(row, grades);
  if (unitWeight == null) return null;
  return Math.round(unitWeight * row.qty * 10) / 10;
}

/** Подпись физических параметров единицы товара — для прозрачности в таблицах. */
export function foamFormatParamsLabel(row) {
  if (!row) return '';
  if (row.outputFormat === 'cube') {
    return `${FOAM_CUBE_VOLUME_M3} м³`;
  }
  if (row.outputFormat === 'sheet') {
    return `${FOAM_CUBE_DIMS_CM.width}×${FOAM_CUBE_DIMS_CM.length} см, ${row.thicknessCm} см`;
  }
  if (row.outputFormat === 'granule') {
    return 'россыпью, на развес';
  }
  return '';
}

export const FOAM_OPERATION_KIND_LABEL = {
  production_intake: 'Поступление с производства',
  sale: 'Продажа',
  defect: 'Брак',
  return: 'Возврат',
  cut_in: 'Нарезка листов (получено)',
  cut_out: 'Нарезка листов (списан куб)',
};

export const FOAM_SALE_PAYMENT_STATUS_LABEL = {
  paid: 'Оплачено',
  partial: 'Частично оплачено',
  debt: 'Долг',
};

export const FOAM_SALE_PAYMENT_STATUS_VARIANT = {
  paid: 'success',
  partial: 'warning',
  debt: 'danger',
};
