/**
 * Демо-данные линии «Пенополистирол».
 * Только фронтенд-прототип: без API, без persist.
 *
 * Реальный процесс (по описанию заказчика):
 * Сырьё (гранула) со склада сразу идёт в производство. Производство даёт
 * только 2 формата — Куб и Мешок. Лист получается позже, на Складе, нарезкой
 * готового куба. Плотность выбирается на производстве (не привязана к сырью).
 */

export const FOAM_WAREHOUSE_RAW = 'Склад сырья №2 — Пенополистирол';
export const FOAM_WAREHOUSE_GP = 'Склад ГП — Пенопласт';

/** Плотность гранулы/продукции — свои цифры завода, а не ГОСТ-марки. */
export const FOAM_DENSITY_GRADES = [
  { code: '6', minKgM3: 5, maxKgM3: 7 },
  { code: '12', minKgM3: 10, maxKgM3: 12 },
  { code: '14-15', minKgM3: 13, maxKgM3: 15.5 },
];

/** grades — необязательный, живой список из стора (если добавляли свои плотности). */
export const foamDensityToleranceFor = (gradeCode, grades = FOAM_DENSITY_GRADES) => {
  const grade = grades.find((g) => g.code === gradeCode);
  return grade ? { min: grade.minKgM3, max: grade.maxKgM3 } : { min: 0, max: 999 };
};

/** Средняя плотность по грейду, кг/м³. */
export const foamGradeMidDensityKgM3 = (gradeCode, grades = FOAM_DENSITY_GRADES) => {
  const g = grades.find((x) => x.code === gradeCode);
  return g ? (g.minKgM3 + g.maxKgM3) / 2 : null;
};

/** Все форматы товара (для подписей/единиц измерения, в т.ч. на складе). */
export const FOAM_OUTPUT_FORMATS = [
  { value: 'cube', label: 'Куб', unitLabel: 'куб.' },
  { value: 'sheet', label: 'Лист', unitLabel: 'листов' },
  { value: 'bag', label: 'Мешок', unitLabel: 'мешков' },
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

/** Технологические потери при обработке сырья в производстве. */
export const FOAM_PRODUCTION_LOSS_PERCENT = 3.5;

export function foamApplyProductionLoss(inputKg) {
  const kg = Number(inputKg);
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return kg * (1 - FOAM_PRODUCTION_LOSS_PERCENT / 100);
}

/** Вес одного куба при заданной плотности. */
export function foamCubeWeightKg(gradeCode, grades = FOAM_DENSITY_GRADES) {
  const density = foamGradeMidDensityKgM3(gradeCode, grades);
  return density ? density * FOAM_CUBE_VOLUME_M3 : null;
}

/** Сколько кубов выйдет из загрузки кг (с учётом потерь 3.5%). Дробное значение — норм, льют по объёму. */
export function foamCalcCubesFromKg(gradeCode, inputKg, grades = FOAM_DENSITY_GRADES) {
  const cubeWeight = foamCubeWeightKg(gradeCode, grades);
  if (!cubeWeight) return null;
  const usableKg = foamApplyProductionLoss(inputKg);
  if (usableKg <= 0) return null;
  return Math.round((usableKg / cubeWeight) * 10) / 10;
}

/** Сколько мешков выйдет из загрузки кг при заданном весе одного мешка (с учётом потерь 3.5%). */
export function foamCalcBagsFromKg(inputKg, bagWeightKg) {
  const bw = Number(bagWeightKg);
  if (!Number.isFinite(bw) || bw <= 0) return null;
  const usableKg = foamApplyProductionLoss(inputKg);
  if (usableKg <= 0) return null;
  return Math.floor(usableKg / bw);
}

/** Сколько листов данной толщины получится из одного куба (по высоте куба 60см). */
export function foamSheetsPerCube(thicknessCm) {
  const t = Number(thicknessCm);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.floor(FOAM_CUBE_DIMS_CM.height / t);
}

/** Вес одного листа данной толщины и плотности. */
export function foamSheetWeightKg(gradeCode, thicknessCm, grades = FOAM_DENSITY_GRADES) {
  const density = foamGradeMidDensityKgM3(gradeCode, grades);
  const t = Number(thicknessCm);
  if (!density || !Number.isFinite(t) || t <= 0) return null;
  const volumeM3 = (FOAM_CUBE_DIMS_CM.width / 100) * (FOAM_CUBE_DIMS_CM.length / 100) * (t / 100);
  return density * volumeM3;
}

/** Вес одной единицы товара на складе — с учётом формата (куб/лист/мешок). */
export function foamUnitWeightKg(row, grades = FOAM_DENSITY_GRADES) {
  if (!row) return null;
  if (row.outputFormat === 'cube') return foamCubeWeightKg(row.gradeCode, grades);
  if (row.outputFormat === 'sheet') return foamSheetWeightKg(row.gradeCode, row.thicknessCm, grades);
  if (row.outputFormat === 'bag') return row.bagWeightKg || null;
  return null;
}

/** Оценочный вес остатка склада (qty × вес единицы), округлённо. */
export function foamStockRowWeightKg(row, grades = FOAM_DENSITY_GRADES) {
  const unitWeight = foamUnitWeightKg(row, grades);
  if (unitWeight == null) return null;
  return Math.round(unitWeight * row.qty * 10) / 10;
}

/** Подпись физических параметров единицы товара — для прозрачности в таблицах. */
export function foamFormatParamsLabel(row) {
  if (!row) return '';
  if (row.outputFormat === 'cube') {
    return `${FOAM_CUBE_DIMS_CM.height}×${FOAM_CUBE_DIMS_CM.width}×${FOAM_CUBE_DIMS_CM.length} см`;
  }
  if (row.outputFormat === 'sheet') {
    return `${FOAM_CUBE_DIMS_CM.width}×${FOAM_CUBE_DIMS_CM.length} см, ${row.thicknessCm} см`;
  }
  if (row.outputFormat === 'bag') {
    return row.bagWeightKg ? `${row.bagWeightKg} кг/мешок` : '—';
  }
  return '';
}

/** Лоты сырья — биг-бэги гранулы на складе (плотности у сырья нет — она выбирается в производстве). */
export const FOAM_RAW_LOTS = [
  {
    id: 'lot-1',
    lotNumber: 'KG-2607-01',
    supplier: 'Kingeps',
    bagWeightKg: 800,
    receivedKg: 800,
    remainingKg: 560,
    receivedAt: '2026-07-24T09:10:00',
    warehouse: FOAM_WAREHOUSE_RAW,
    status: 'in_stock',
  },
  {
    id: 'lot-2',
    lotNumber: 'KG-2607-02',
    supplier: 'Kingeps',
    bagWeightKg: 800,
    receivedKg: 800,
    remainingKg: 680,
    receivedAt: '2026-07-25T14:40:00',
    warehouse: FOAM_WAREHOUSE_RAW,
    status: 'in_stock',
  },
  {
    id: 'lot-3',
    lotNumber: 'KG-2607-03',
    supplier: 'Kingeps',
    bagWeightKg: 800,
    receivedKg: 800,
    remainingKg: 96,
    receivedAt: '2026-07-20T11:00:00',
    warehouse: FOAM_WAREHOUSE_RAW,
    status: 'low',
  },
  {
    id: 'lot-4',
    lotNumber: 'SP-2607-11',
    supplier: 'СинтезПласт',
    bagWeightKg: 750,
    receivedKg: 750,
    remainingKg: 0,
    receivedAt: '2026-07-18T08:20:00',
    warehouse: FOAM_WAREHOUSE_RAW,
    status: 'empty',
  },
];

/**
 * Выпуски производства: лот сырья → обработка → куб или мешок.
 * otkStatus держится тут же — партия сразу видна и в «Производстве», и в «ОТК».
 * bagWeightKg заполнен только для формата «мешок» (его вписывает оператор).
 */
export const FOAM_PRODUCTION_RUNS = [
  {
    id: 'run-1',
    lotId: 'lot-1',
    lotNumber: 'KG-2607-01',
    gradeCode: '12',
    inputKg: 180,
    outputFormat: 'bag',
    bagWeightKg: 25,
    outputQty: 6,
    producedAt: '2026-07-25T10:00:00',
    operator: 'Азамат Р.',
    otkStatus: 'accepted',
    measuredDensityKgM3: 11.4,
    defectPercent: 1.2,
    inspector: 'Гульнара К.',
    checkedAt: '2026-07-25T11:15:00',
  },
  {
    id: 'run-2',
    lotId: 'lot-3',
    lotNumber: 'KG-2607-03',
    gradeCode: '14-15',
    inputKg: 90,
    outputFormat: 'cube',
    outputQty: 5,
    producedAt: '2026-07-25T16:45:00',
    operator: 'Ербол С.',
    otkStatus: 'accepted',
    measuredDensityKgM3: 14.8,
    defectPercent: 0.8,
    inspector: 'Гульнара К.',
    checkedAt: '2026-07-25T17:05:00',
  },
  {
    id: 'run-3',
    lotId: 'lot-2',
    lotNumber: 'KG-2607-02',
    gradeCode: '6',
    inputKg: 120,
    outputFormat: 'bag',
    bagWeightKg: 20,
    outputQty: 5,
    producedAt: '2026-07-26T07:30:00',
    operator: 'Азамат Р.',
    otkStatus: 'pending',
    measuredDensityKgM3: null,
    defectPercent: null,
  },
  {
    id: 'run-4',
    lotId: 'lot-1',
    lotNumber: 'KG-2607-01',
    gradeCode: '12',
    inputKg: 60,
    outputFormat: 'cube',
    outputQty: 4.4,
    producedAt: '2026-07-26T09:15:00',
    operator: 'Ербол С.',
    otkStatus: 'pending',
    measuredDensityKgM3: null,
    defectPercent: null,
  },
];

/** Остаток склада готовой продукции — по формату, плотности и параметрам (толщина/вес мешка). */
export const FOAM_GP_STOCK = [
  { key: 'bag-12-25', outputFormat: 'bag', gradeCode: '12', bagWeightKg: 25, qty: 5, warehouse: FOAM_WAREHOUSE_GP },
  { key: 'cube-14-15', outputFormat: 'cube', gradeCode: '14-15', qty: 5, warehouse: FOAM_WAREHOUSE_GP },
  { key: 'sheet-12-3', outputFormat: 'sheet', gradeCode: '12', thicknessCm: 3, qty: 84, warehouse: FOAM_WAREHOUSE_GP },
];

const OPERATION_KIND = {
  OTK_INTAKE: 'otk_intake',
  SALE: 'sale',
  DEFECT: 'defect',
  RETURN: 'return',
  CUT_IN: 'cut_in',
  CUT_OUT: 'cut_out',
};

export const FOAM_OPERATION_KIND_LABEL = {
  [OPERATION_KIND.OTK_INTAKE]: 'Приёмка из ОТК',
  [OPERATION_KIND.SALE]: 'Продажа',
  [OPERATION_KIND.DEFECT]: 'Брак',
  [OPERATION_KIND.RETURN]: 'Возврат',
  [OPERATION_KIND.CUT_IN]: 'Нарезка листов (получено)',
  [OPERATION_KIND.CUT_OUT]: 'Нарезка листов (списан куб)',
};

export const FOAM_GP_OPERATIONS = [
  {
    id: 'gpop-1',
    kind: OPERATION_KIND.OTK_INTAKE,
    outputFormat: 'bag',
    gradeCode: '12',
    bagWeightKg: 25,
    qty: 6,
    createdAt: '2026-07-25T11:20:00',
    ref: 'run-1',
  },
  {
    id: 'gpop-2',
    kind: OPERATION_KIND.SALE,
    outputFormat: 'bag',
    gradeCode: '12',
    bagWeightKg: 25,
    qty: -1,
    createdAt: '2026-07-25T19:45:00',
    ref: 'Продажа №4482',
  },
  {
    id: 'gpop-3',
    kind: OPERATION_KIND.OTK_INTAKE,
    outputFormat: 'cube',
    gradeCode: '14-15',
    qty: 5,
    createdAt: '2026-07-25T17:10:00',
    ref: 'run-2',
  },
  {
    id: 'gpop-4',
    kind: OPERATION_KIND.CUT_IN,
    outputFormat: 'sheet',
    gradeCode: '12',
    thicknessCm: 3,
    qty: 84,
    createdAt: '2026-07-24T12:00:00',
    ref: 'Нарезка (до внедрения учёта)',
  },
];

let localIdCounter = 1000;
export const nextFoamId = (prefix) => `${prefix}-${(localIdCounter += 1)}`;
