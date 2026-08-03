import { useSyncExternalStore } from 'react';
import {
  FOAM_RAW_LOTS,
  FOAM_PRODUCTION_RUNS,
  FOAM_GP_STOCK,
  FOAM_GP_OPERATIONS,
  FOAM_DENSITY_GRADES,
  FOAM_WAREHOUSE_GP,
  foamSheetsPerCube,
  nextFoamId,
} from './mockData';

/**
 * Единое состояние линии пенопласта — общее для страниц «Сырьё», «Производство»,
 * «ОТК», «Склад», чтобы действие на одной странице отражалось на других
 * (приход лота уменьшает остаток при запуске производства, приёмка ОТК
 * пополняет склад, нарезка на складе превращает куб в листы и т.д.). Это
 * по-прежнему только фронтенд-прототип: состояние живёт в памяти вкладки
 * браузера, ничего не сохраняется на сервере.
 */

let state = {
  rawLots: FOAM_RAW_LOTS.map((l) => ({ ...l })),
  productionRuns: FOAM_PRODUCTION_RUNS.map((r) => ({ ...r })),
  gpStock: FOAM_GP_STOCK.map((s) => ({ ...s })),
  gpOperations: FOAM_GP_OPERATIONS.map((o) => ({ ...o })),
  densityGrades: FOAM_DENSITY_GRADES.map((g) => ({ ...g })),
};

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;

const setState = (patch) => {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
};

export function useFoamStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function addRawLot(lot) {
  setState((s) => ({ rawLots: [lot, ...s.rawLots] }));
}

/** Заводит новую плотность в справочник (код должен быть уникальным). */
export function addDensityGrade(grade) {
  setState((s) => {
    if (s.densityGrades.some((g) => g.code === grade.code)) return {};
    return { densityGrades: [...s.densityGrades, grade] };
  });
}

const gpStockKeyFor = (run) =>
  run.outputFormat === 'bag' ? `bag-${run.gradeCode}-${run.bagWeightKg}` : `cube-${run.gradeCode}`;

/** Списывает кг с лота и создаёт новую партию производства (статус ОТК — «на проверке»). */
export function startProductionRun({ lotId, inputKg, gradeCode, outputFormat, outputQty, bagWeightKg, operator }) {
  setState((s) => {
    const lot = s.rawLots.find((l) => l.id === lotId);
    if (!lot) return {};
    const run = {
      id: nextFoamId('run'),
      lotId,
      lotNumber: lot.lotNumber,
      gradeCode,
      inputKg,
      outputFormat,
      ...(outputFormat === 'bag' ? { bagWeightKg } : {}),
      outputQty,
      producedAt: new Date().toISOString(),
      operator: operator || 'Не указан',
      otkStatus: 'pending',
      measuredDensityKgM3: null,
      defectPercent: null,
      inspector: null,
      checkedAt: null,
    };
    return {
      rawLots: s.rawLots.map((l) =>
        l.id === lotId ? { ...l, remainingKg: Math.max(0, l.remainingKg - inputKg) } : l,
      ),
      productionRuns: [run, ...s.productionRuns],
    };
  });
}

/** Отменяет ещё не проверенную ОТК партию: возвращает кг обратно на лот сырья. */
export function cancelProductionRun(runId) {
  setState((s) => {
    const run = s.productionRuns.find((r) => r.id === runId);
    if (!run || run.otkStatus !== 'pending') return {};
    return {
      productionRuns: s.productionRuns.filter((r) => r.id !== runId),
      rawLots: s.rawLots.map((l) =>
        l.id === run.lotId ? { ...l, remainingKg: l.remainingKg + run.inputKg } : l,
      ),
    };
  });
}

/** Возвращает забракованную партию на повторную проверку ОТК (не трогает склад/сырьё). */
export function reopenOtkRun(runId) {
  setState((s) => ({
    productionRuns: s.productionRuns.map((r) =>
      r.id === runId
        ? { ...r, otkStatus: 'pending', measuredDensityKgM3: null, defectPercent: null, inspector: null, checkedAt: null }
        : r,
    ),
  }));
}

/** Приёмка ОТК: принято → пополняет склад ГП (куб/мешок); брак → только запись в движениях. */
export function resolveOtkRun(runId, { measuredDensityKgM3, defectPercent, otkStatus, inspector }) {
  setState((s) => {
    const run = s.productionRuns.find((r) => r.id === runId);
    if (!run) return {};
    const checkedAt = new Date().toISOString();
    const productionRuns = s.productionRuns.map((r) =>
      r.id === runId
        ? { ...r, measuredDensityKgM3, defectPercent, otkStatus, inspector: inspector || 'Не указан', checkedAt }
        : r,
    );

    if (otkStatus !== 'accepted') {
      return {
        productionRuns,
        gpOperations: [
          {
            id: nextFoamId('gpop'),
            kind: 'defect',
            outputFormat: run.outputFormat,
            gradeCode: run.gradeCode,
            ...(run.outputFormat === 'bag' ? { bagWeightKg: run.bagWeightKg } : {}),
            qty: -run.outputQty,
            createdAt: checkedAt,
            ref: `Брак партии ${run.lotNumber}`,
          },
          ...s.gpOperations,
        ],
      };
    }

    const stockKey = gpStockKeyFor(run);
    let found = false;
    const gpStock = s.gpStock.map((row) => {
      if (row.key === stockKey) {
        found = true;
        return { ...row, qty: row.qty + run.outputQty };
      }
      return row;
    });
    if (!found) {
      gpStock.push({
        key: stockKey,
        outputFormat: run.outputFormat,
        gradeCode: run.gradeCode,
        ...(run.outputFormat === 'bag' ? { bagWeightKg: run.bagWeightKg } : {}),
        qty: run.outputQty,
        warehouse: FOAM_WAREHOUSE_GP,
      });
    }

    return {
      productionRuns,
      gpStock,
      gpOperations: [
        {
          id: nextFoamId('gpop'),
          kind: 'otk_intake',
          outputFormat: run.outputFormat,
          gradeCode: run.gradeCode,
          ...(run.outputFormat === 'bag' ? { bagWeightKg: run.bagWeightKg } : {}),
          qty: run.outputQty,
          createdAt: checkedAt,
          ref: run.id,
        },
        ...s.gpOperations,
      ],
    };
  });
}

/**
 * Ручная операция по складу ГП (продажа/брак/возврат) на конкретной строке остатка.
 * qty — со знаком: положительное увеличивает остаток, отрицательное — уменьшает
 * (уменьшение не уйдёт ниже нуля).
 */
export function recordWarehouseOperation({ row, qty, kind, ref }) {
  setState((s) => {
    const gpStock = s.gpStock.map((r) => (r.key === row.key ? { ...r, qty: Math.max(0, r.qty + qty) } : r));
    return {
      gpStock,
      gpOperations: [
        {
          id: nextFoamId('gpop'),
          kind,
          outputFormat: row.outputFormat,
          gradeCode: row.gradeCode,
          ...(row.thicknessCm ? { thicknessCm: row.thicknessCm } : {}),
          ...(row.bagWeightKg ? { bagWeightKg: row.bagWeightKg } : {}),
          qty,
          createdAt: new Date().toISOString(),
          ref: ref || '',
        },
        ...s.gpOperations,
      ],
    };
  });
}

/** Нарезка куба на складе на N листов заданной толщины (по 60см высоты куба). */
export function cutCubeToSheets({ gradeCode, thicknessCm, cubesQty }) {
  setState((s) => {
    const cubeKey = `cube-${gradeCode}`;
    const cubeRow = s.gpStock.find((r) => r.key === cubeKey);
    const qty = Number(cubesQty);
    if (!cubeRow || !Number.isFinite(qty) || qty <= 0 || qty > cubeRow.qty) return {};
    const sheetsPerCube = foamSheetsPerCube(thicknessCm);
    if (!sheetsPerCube) return {};
    const sheetsQty = Math.floor(sheetsPerCube * qty);
    const sheetKey = `sheet-${gradeCode}-${thicknessCm}`;

    let found = false;
    const gpStock = s.gpStock.map((row) => {
      if (row.key === cubeKey) return { ...row, qty: Math.round((row.qty - qty) * 10) / 10 };
      if (row.key === sheetKey) {
        found = true;
        return { ...row, qty: row.qty + sheetsQty };
      }
      return row;
    });
    if (!found) {
      gpStock.push({
        key: sheetKey,
        outputFormat: 'sheet',
        gradeCode,
        thicknessCm: Number(thicknessCm),
        qty: sheetsQty,
        warehouse: FOAM_WAREHOUSE_GP,
      });
    }

    const now = new Date().toISOString();
    return {
      gpStock,
      gpOperations: [
        {
          id: nextFoamId('gpop'),
          kind: 'cut_in',
          outputFormat: 'sheet',
          gradeCode,
          thicknessCm: Number(thicknessCm),
          qty: sheetsQty,
          createdAt: now,
          ref: `Нарезка из ${qty} куб.`,
        },
        {
          id: nextFoamId('gpop'),
          kind: 'cut_out',
          outputFormat: 'cube',
          gradeCode,
          qty: -qty,
          createdAt: now,
          ref: `Нарезка на листы ${thicknessCm} см`,
        },
        ...s.gpOperations,
      ],
    };
  });
}
