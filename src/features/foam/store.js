import { useSyncExternalStore } from 'react';
import {
  FOAM_RAW_LOTS,
  FOAM_PRODUCTION_RUNS,
  FOAM_GP_STOCK,
  FOAM_GP_OPERATIONS,
  FOAM_DENSITY_GRADES,
  FOAM_SALES,
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
  sales: FOAM_SALES.map((s) => ({ ...s, lines: s.lines.map((ln) => ({ ...ln })) })),
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

/** У гранул на продажу нет плотности/размера — все они лежат в одной строке склада. */
const gpStockKeyFor = (run) =>
  run.outputFormat === 'granule' ? 'granule' : `cube-${run.gradeCode}`;

/**
 * Списывает кг с лота и создаёт новую партию производства. ОТК для линии
 * пенопласта не нужен вообще — куб и гранулы сразу уходят на склад ГП.
 */
export function startProductionRun({ lotId, inputKg, gradeCode, outputFormat, outputQty, operator }) {
  setState((s) => {
    const lot = s.rawLots.find((l) => l.id === lotId);
    if (!lot) return {};
    const producedAt = new Date().toISOString();
    const run = {
      id: nextFoamId('run'),
      lotId,
      lotNumber: lot.lotNumber,
      materialName: lot.materialName,
      ...(outputFormat === 'cube' ? { gradeCode } : {}),
      inputKg,
      outputFormat,
      outputQty,
      producedAt,
      operator: operator || 'Не указан',
    };
    const rawLots = s.rawLots.map((l) =>
      l.id === lotId ? { ...l, remainingKg: Math.max(0, l.remainingKg - inputKg) } : l,
    );

    const stockKey = gpStockKeyFor(run);
    let found = false;
    const gpStock = s.gpStock.map((row) => {
      if (row.key === stockKey) {
        found = true;
        return { ...row, qty: row.qty + outputQty };
      }
      return row;
    });
    if (!found) {
      gpStock.push({
        key: stockKey,
        outputFormat,
        ...(run.gradeCode ? { gradeCode: run.gradeCode } : {}),
        qty: outputQty,
        warehouse: FOAM_WAREHOUSE_GP,
      });
    }

    return {
      rawLots,
      productionRuns: [run, ...s.productionRuns],
      gpStock,
      gpOperations: [
        {
          id: nextFoamId('gpop'),
          kind: 'production_intake',
          outputFormat,
          ...(run.gradeCode ? { gradeCode: run.gradeCode } : {}),
          qty: outputQty,
          createdAt: producedAt,
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
          ...(row.gradeCode ? { gradeCode: row.gradeCode } : {}),
          ...(row.thicknessCm ? { thicknessCm: row.thicknessCm } : {}),
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

/**
 * Продажа готовой продукции клиенту: списывает кг/шт/листы с указанных строк
 * склада и заводит запись о продаже (сумма/оплата/долг), плюс движения склада.
 */
export function createFoamSale({ client, saleDate, lines, paidAmount }) {
  setState((s) => {
    const cleanLines = (lines || [])
      .map((ln) => {
        const row = s.gpStock.find((r) => r.key === ln.key);
        if (!row) return null;
        const qty = Math.min(Number(ln.qty) || 0, row.qty);
        const unitPrice = Math.max(0, Number(ln.unitPrice) || 0);
        if (qty <= 0) return null;
        return {
          key: ln.key,
          outputFormat: row.outputFormat,
          ...(row.gradeCode ? { gradeCode: row.gradeCode } : {}),
          ...(row.thicknessCm ? { thicknessCm: row.thicknessCm } : {}),
          qty,
          unitPrice,
        };
      })
      .filter(Boolean);
    if (!cleanLines.length) return {};

    const totalAmount = Math.round(cleanLines.reduce((sum, ln) => sum + ln.qty * ln.unitPrice, 0) * 100) / 100;
    const paid = Math.round(Math.min(Math.max(0, Number(paidAmount) || 0), totalAmount) * 100) / 100;
    const debtAmount = Math.round((totalAmount - paid) * 100) / 100;
    const paymentStatus = paid <= 0 ? 'debt' : (debtAmount > 0 ? 'partial' : 'paid');
    const createdAt = saleDate ? new Date(saleDate).toISOString() : new Date().toISOString();

    const sale = {
      id: nextFoamId('sale'),
      client: client || 'Клиент',
      date: createdAt,
      lines: cleanLines,
      totalAmount,
      paidAmount: paid,
      debtAmount,
      paymentStatus,
    };

    const gpStock = s.gpStock.map((row) => {
      const line = cleanLines.find((ln) => ln.key === row.key);
      return line ? { ...row, qty: Math.max(0, Math.round((row.qty - line.qty) * 100) / 100) } : row;
    });

    const gpOperations = [
      ...cleanLines.map((ln) => ({
        id: nextFoamId('gpop'),
        kind: 'sale',
        outputFormat: ln.outputFormat,
        ...(ln.gradeCode ? { gradeCode: ln.gradeCode } : {}),
        ...(ln.thicknessCm ? { thicknessCm: ln.thicknessCm } : {}),
        qty: -ln.qty,
        createdAt,
        ref: `Продажа ${sale.id}`,
      })),
      ...s.gpOperations,
    ];

    return { gpStock, gpOperations, sales: [sale, ...s.sales] };
  });
}
