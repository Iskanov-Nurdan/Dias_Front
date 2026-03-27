import { formatQuantityDisplay, parseLocaleNumber } from './numbers';
import { resolveInventoryForm } from './inventoryForm';

const EPS = 1e-4;

/** Приведение значения с бэка/формы к числу (не использовать строки вида «60×20» — только скаляры). */
export function toPackagingNumber(raw) {
  if (raw == null || raw === '') return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  if (typeof raw === 'boolean') return NaN;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '' || /×|x|х/i.test(t)) return NaN;
    return parseLocaleNumber(t);
  }
  if (typeof raw === 'object' && raw !== null && 'toString' in raw) {
    return toPackagingNumber(String(raw));
  }
  return NaN;
}

export function nearlyEqualAbs(a, b, eps = EPS) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
}

/**
 * Высота штуки с строки склада (только числовые поля, по приоритету).
 */
export function readBatchPackagingHeight(batch) {
  if (!batch || typeof batch !== 'object') return NaN;
  const keys = [
    batch.unit_meters,
    batch.unit_length_m,
    batch.piece_length_m,
    batch.piece_meters,
    batch.shift_height,
    batch.height,
    batch.line_height,
  ];
  for (const v of keys) {
    const n = toPackagingNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export function readBatchPackagingWidth(batch) {
  if (!batch || typeof batch !== 'object') return NaN;
  const keys = [batch.shift_width, batch.width, batch.line_width];
  for (const v of keys) {
    const n = toPackagingNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export function readBatchPackagingAngleDeg(batch) {
  if (!batch || typeof batch !== 'object') return NaN;
  const keys = [batch.shift_angle_deg, batch.angle_deg, batch.line_angle_deg];
  for (const v of keys) {
    const n = toPackagingNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/**
 * Старые строки без тройки чисел — не участвуют в упаковке.
 * Высота > 0; ширина и угол — числа (0 допустимы).
 */
export function batchHasFullPackagingGeometry(batch) {
  const H = readBatchPackagingHeight(batch);
  const W = readBatchPackagingWidth(batch);
  const A = readBatchPackagingAngleDeg(batch);
  return Number.isFinite(H) && H > 0 && Number.isFinite(W) && W >= 0 && Number.isFinite(A);
}

/**
 * Тот же ключ продукта, что на строке склада (число или строка — сравнение после приведения).
 */
function pushProductCandidate(out, v) {
  if (v == null || v === '') return;
  if (typeof v === 'object' && !Array.isArray(v)) return;
  out.push(v);
}

/**
 * ID продукта из справочника на строке склада ГП (не путать с `id` самой строки `warehouse/batches/`).
 * Учитывает варианты бэка: product_id, вложенный product, product_detail (read-only с сериализатора).
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {number|string|null}
 */
export function readCatalogProductIdFromWarehouseBatch(batch) {
  if (!batch || typeof batch !== 'object') return null;

  const pickRaw = () => {
    const pid = batch.product_id;
    if (pid != null && pid !== '') return pid;

    const pr = batch.product;
    if (pr && typeof pr === 'object' && pr !== null) {
      const id = pr.id;
      if (id != null && id !== '') return id;
    } else if (typeof pr === 'string' || typeof pr === 'number') {
      return pr;
    }

    const pd = batch.product_detail;
    if (pd && typeof pd === 'object' && pd !== null) {
      const id = pd.id;
      if (id != null && id !== '') return id;
    }

    const pdi = batch.product_detail_id;
    if (pdi != null && pdi !== '') return pdi;

    return null;
  };

  const raw = pickRaw();
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);

  const s = String(raw).trim();
  if (s === '') return null;
  const n = parseLocaleNumber(s);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  // нечисловой первичный ключ (редко)
  return s;
}

export function sameWarehouseProductKey(selectedKey, batch) {
  if (selectedKey == null || batch == null || typeof batch !== 'object') return false;
  const sel = String(selectedKey).trim();
  if (sel === '') return false;

  const candidates = [];
  pushProductCandidate(candidates, batch.product_id);
  if (batch.product && typeof batch.product === 'object') {
    pushProductCandidate(candidates, batch.product.id);
  }
  pushProductCandidate(candidates, batch.product);
  if (batch.product_detail && typeof batch.product_detail === 'object') {
    pushProductCandidate(candidates, batch.product_detail.id);
  }
  pushProductCandidate(candidates, batch.product_detail_id);

  for (const c of candidates) {
    const cand = String(c).trim();
    if (cand === '') continue;

    const nSel = toPackagingNumber(sel);
    const nCand = toPackagingNumber(cand);
    if (Number.isFinite(nSel) && Number.isFinite(nCand) && nearlyEqualAbs(nSel, nCand, 1e-9)) {
      return true;
    }
    if (sel === cand) return true;
  }
  return false;
}

/** @deprecated см. readBatchPackagingHeight */
export function parsePieceHeightMeters(batch) {
  return readBatchPackagingHeight(batch);
}

/** @deprecated см. readBatchPackagingHeight */
export const parsePieceLengthMeters = parsePieceHeightMeters;

export function parseShiftWidthMeters(batch) {
  return readBatchPackagingWidth(batch);
}

export function parseShiftAngleDeg(batch) {
  return readBatchPackagingAngleDeg(batch);
}

/**
 * Сумма шт: не упаковано, available, тот же продукт, три числа совпали (только числовое сравнение).
 */
export function sumNotPackedQtyMatchingParams(batches, { productId, heightM, widthM, angleDeg }) {
  if (productId == null || String(productId).trim() === '') return 0;

  const targetH = toPackagingNumber(heightM);
  const targetW = toPackagingNumber(widthM);
  const targetA = toPackagingNumber(angleDeg);
  if (!Number.isFinite(targetH) || !Number.isFinite(targetW) || !Number.isFinite(targetA)) return 0;

  let sum = 0;
  for (const b of batches) {
    if (resolveInventoryForm(b) !== 'unpacked') continue;
    const st = String(b.status || '').toLowerCase();
    if (st && st !== 'available') continue;

    if (!sameWarehouseProductKey(productId, b)) continue;
    if (!batchHasFullPackagingGeometry(b)) continue;

    const H = readBatchPackagingHeight(b);
    const W = readBatchPackagingWidth(b);
    const A = readBatchPackagingAngleDeg(b);

    if (!nearlyEqualAbs(H, targetH)) continue;
    if (!nearlyEqualAbs(W, targetW)) continue;
    if (!nearlyEqualAbs(A, targetA)) continue;

    const q = toPackagingNumber(b.quantity ?? b.available_quantity);
    if (Number.isFinite(q) && q > 0) sum += q;
  }
  return sum;
}

/**
 * Штук в одной упаковке (поля с бэка / синонимы).
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {number|null}
 */
export function readPiecesPerPackage(batch) {
  if (!batch || typeof batch !== 'object') return null;
  const n = parseLocaleNumber(
    batch.pieces_per_package ?? batch.pieces_in_package ?? batch.pieces_per_pack ?? batch.piece_count_per_package,
  );
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/**
 * Число упаковок в строке склада (если бэк отдаёт явно).
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {number|null}
 */
export function readPackagesCount(batch) {
  if (!batch || typeof batch !== 'object') return null;
  const n = parseLocaleNumber(
    batch.packages_count
      ?? batch.pack_count
      ?? batch.package_count
      ?? batch.num_packages
      ?? batch.packs_count,
  );
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/** Склонение «упаковка» для целого n ≥ 1. */
export function ruPackagingWord(n) {
  const p = Math.abs(Math.floor(Number(n)));
  if (!Number.isFinite(p) || p < 1) return 'упаковок';
  const mod10 = p % 10;
  const mod100 = p % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'упаковок';
  if (mod10 === 1) return 'упаковка';
  if (mod10 >= 2 && mod10 <= 4) return 'упаковки';
  return 'упаковок';
}

/**
 * Фраза вида «2 упаковки по 3 шт».
 */
export function formatPacksByPiecesPhrase(packs, piecesPerPack) {
  const pk = Math.floor(Number(packs));
  const ipp = Math.floor(Number(piecesPerPack));
  if (!Number.isFinite(pk) || pk < 1 || !Number.isFinite(ipp) || ipp < 1) return null;
  return `${formatQuantityDisplay(pk)} ${ruPackagingWord(pk)} по ${formatQuantityDisplay(ipp)} шт`;
}

/**
 * Для строк «упаковано» / «открытая упаковка»: число упаковок и штук в каждой.
 * Если бэк не прислал `packages_count`, но есть `pieces_per_package` и `quantity` кратен ему — выводим упаковки из остатка.
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {{ piecesPerPack: number, packagesCount: number } | null}
 */
export function resolveWarehousePackStructure(batch) {
  const inv = resolveInventoryForm(batch);
  if (inv !== 'packed' && inv !== 'open_package') return null;

  const ipp = readPiecesPerPackage(batch);
  let pk = readPackagesCount(batch);
  const qtyRaw = batch.quantity ?? batch.available_quantity;
  const qtyNum = parseLocaleNumber(qtyRaw);
  const qtyInt = Number.isFinite(qtyNum) ? Math.round(qtyNum) : null;

  if (pk == null && ipp != null && qtyInt != null && ipp >= 1 && qtyInt > 0 && qtyInt % ipp === 0) {
    pk = qtyInt / ipp;
  }

  if (ipp == null || pk == null || pk < 1 || ipp < 1) return null;
  return { piecesPerPack: ipp, packagesCount: pk };
}

/**
 * Текстовое описание остатка при форме «открытая упаковка»: целые упаковки по M шт + хвост в открытой.
 * Пример: 9 шт, кратность 5 → «1 упаковка по 5 шт; открытая упаковка — 4 шт».
 */
export function describeOpenPackageComposition(batch) {
  const inv = resolveInventoryForm(batch);
  if (inv !== 'open_package') return null;
  const ipp = readPiecesPerPackage(batch);
  const qtyRaw = batch.quantity ?? batch.available_quantity;
  const qtyNum = parseLocaleNumber(qtyRaw);
  const qtyInt = Number.isFinite(qtyNum) ? Math.round(qtyNum) : null;
  if (ipp == null || ipp < 1 || qtyInt == null || qtyInt <= 0) return null;

  const full = Math.floor(qtyInt / ipp);
  const rem = qtyInt % ipp;
  const parts = [];
  if (full > 0) {
    const ph = formatPacksByPiecesPhrase(full, ipp);
    if (ph) parts.push(ph);
  }
  if (rem > 0) {
    parts.push(`открытая упаковка — ${formatQuantityDisplay(rem)} шт`);
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * Колонка «Кол-во» в таблице склада: для упакованного — «N упаковок по M шт» + итого шт.
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {{ primary: string, secondary: string|null, title: string|null }}
 */
export function getWarehouseQuantityPresentation(batch) {
  const inv = resolveInventoryForm(batch);
  const qtyRaw = batch.quantity ?? batch.available_quantity;
  const qtyNum = parseLocaleNumber(qtyRaw);
  const qtyDisplay = Number.isFinite(qtyNum) ? formatQuantityDisplay(qtyNum) : (qtyRaw != null && qtyRaw !== '' ? String(qtyRaw) : '—');
  const qtyInt = Number.isFinite(qtyNum) ? Math.round(qtyNum) : null;

  if (inv !== 'packed' && inv !== 'open_package') {
    return { primary: qtyDisplay, secondary: null, title: null };
  }

  if (inv === 'open_package') {
    const openDesc = describeOpenPackageComposition(batch);
    if (openDesc) {
      const totalStr = qtyInt != null ? `всего ${formatQuantityDisplay(qtyInt)} шт` : `в учёте ${qtyDisplay} шт`;
      return {
        primary: openDesc,
        secondary: totalStr,
        title: `${openDesc}; ${totalStr}`,
      };
    }
  }

  const structure = resolveWarehousePackStructure(batch);
  if (structure) {
    const { piecesPerPack, packagesCount } = structure;
    const phrase = formatPacksByPiecesPhrase(packagesCount, piecesPerPack);
    const totalCheck = packagesCount * piecesPerPack;
    const consistent = qtyInt == null || totalCheck === qtyInt;
    const secondary = consistent
      ? `всего ${formatQuantityDisplay(qtyInt ?? totalCheck)} шт`
      : `в учёте ${qtyDisplay} шт`;
    return {
      primary: phrase || `${formatQuantityDisplay(packagesCount)} × ${formatQuantityDisplay(piecesPerPack)} шт`,
      secondary,
      title: phrase ? `${phrase}; ${secondary}` : null,
    };
  }

  const ippOnly = readPiecesPerPackage(batch);
  if (ippOnly != null && ippOnly >= 1) {
    return {
      primary: `${qtyDisplay} шт`,
      secondary: `кратность ${formatQuantityDisplay(ippOnly)} шт/упак.`,
      title: null,
    };
  }

  return { primary: qtyDisplay, secondary: null, title: null };
}
