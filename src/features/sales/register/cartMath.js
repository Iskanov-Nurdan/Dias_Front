/**
 * Чистая арифметика кассы — вынесена из компонентов, чтобы её было видно и
 * тестируемо в одном месте. Деньги на фронте храним как Number (сомы, не
 * тыйыны) — бэкенд сам квантует до 0.01 и является источником правды по
 * итоговым суммам; здесь только то, что нужно для живого пересчёта в UI.
 */

/** round(x*100)/100 — не даём плавающей арифметике плодить 0.1+0.2 мусор в UI. */
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const lineGross = (line) => round2(Number(line.quantity || 0) * Number(line.unitPrice || 0));

export const lineTotal = (line) => Math.max(0, round2(lineGross(line) - Number(line.discountAmount || 0)));

export const cartSubtotal = (lines) => round2(lines.reduce((sum, l) => sum + lineGross(l), 0));

export const cartLinesDiscount = (lines) => round2(lines.reduce((sum, l) => sum + Number(l.discountAmount || 0), 0));

/** Итог чека = сумма строк за вычетом построчных скидок и скидки на чек. */
export const cartTotal = (lines, headerDiscount) => {
  const linesTotal = round2(lines.reduce((sum, l) => sum + lineTotal(l), 0));
  return Math.max(0, round2(linesTotal - Number(headerDiscount || 0)));
};

export const splitsSum = (splits) => round2((splits || []).reduce((sum, s) => sum + Number(s.amount || 0), 0));

/** Сдача — только для наличных: излишек сверх «к оплате», внесённый cash-частью. */
export const changeDue = (splits, due) => {
  const cashPaid = round2((splits || []).filter((s) => s.method === 'cash').reduce((sum, s) => sum + Number(s.amount || 0), 0));
  const nonCashPaid = round2((splits || []).filter((s) => s.method !== 'cash').reduce((sum, s) => sum + Number(s.amount || 0), 0));
  const remainingForCash = Math.max(0, round2(due - nonCashPaid));
  return Math.max(0, round2(cashPaid - remainingForCash));
};

export const remainingToPay = (splits, due) => Math.max(0, round2(due - splitsSum(splits)));
