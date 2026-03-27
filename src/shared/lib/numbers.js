/**
 * Десятичные числа с бэка (Decimal) и RU-ввод: запятая как разделитель, без лишних нулей.
 */

/**
 * Приводит строку к виду с точкой для parseFloat (запятая → десятичный разделитель).
 * Если есть и «,» и «.» — последний символ из них считается десятичным разделителем.
 */
export function normalizeDecimalInput(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim().replace(/\s/g, '');
  if (s === '' || s === '-') return s;
  const neg = s.startsWith('-');
  s = s.replace(/^-/, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    const li = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    const left = s.slice(0, li).replace(/[,.]/g, '');
    const right = s.slice(li + 1).replace(/[,.]/g, '');
    s = `${left}.${right}`;
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  return (neg ? '-' : '') + s;
}

/** Число из поля (запятая или точка). */
export function parseLocaleNumber(raw) {
  const s = normalizeDecimalInput(raw);
  if (s === '' || s === '-' || s === '.' || s === '-.') return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Для отображения в инпутах и таблицах: 4.0000 → "4", 0.5 → "0.5", "10,0000" → "10".
 */
export function formatNumberForInput(value) {
  if (value === '' || value == null || value === undefined) return '';
  const s = normalizeDecimalInput(value);
  if (s === '' || s === '-') return '';
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return '';
  if (Object.is(n, -0) || n === 0) return '0';
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-12) return String(rounded);
  let out = n.toString();
  if (out.includes('e') || out.includes('E')) {
    out = Number(n).toFixed(16).replace(/\.?0+$/, '');
  }
  out = out.replace(/(\.\d*?[1-9])0+$/, '$1');
  out = out.replace(/\.0+$/, '');
  return out;
}

/** Короткая подпись количества/суммы в UI (без «4.0000» и без 0.30000000000000004). */
export function formatQuantityDisplay(value) {
  if (value === '' || value == null || value === undefined) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const cleaned = Math.round(value * 1e9) / 1e9;
    const f = formatNumberForInput(cleaned);
    return f === '' ? '—' : f;
  }
  const f = formatNumberForInput(value);
  return f === '' ? '—' : f;
}
