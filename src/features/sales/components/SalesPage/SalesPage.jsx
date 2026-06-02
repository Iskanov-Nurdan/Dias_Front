import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useServerQuery,
  parseLocaleNumber,
  formatQuantityDisplay,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
  extractOrderLines,
  orderLineApiId,
} from '../../../../shared/lib';
import {
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  SearchableSelect,
  IntegerInput,
  Badge,
  useToast,
  ClientDateFilter,
} from '../../../../shared/ui';
import { useOperationalRefetch, WS_CASH } from '../../../../shared/realtime';
import {
  createSale,
  getSale,
  getSaleSelectSources,
  getSaleWaybillData,
  previewSale,
} from '../../api/salesApi';
import { getOrder } from '../../../orders/api/ordersApi';
import { getClients } from '../../../clients/api/clientsApi';
import './SalesPage.scss';
import './WaybillPreviewModal.scss';
import { WAYBILL_DEFAULT_UNIT } from '../../config/waybillConfig';
import { readPiecesPerPackage, readPackagesCount } from '../../../../shared/lib/warehousePackaging';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'Оплачено';
  if (k === 'partially_paid') return 'Частично оплачено';
  if (k === 'unpaid') return 'Долг';
  if (k === 'overpaid') return 'Переплата';
  return v || '—';
};

const paymentStatusVariant = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'success';
  if (k === 'partially_paid') return 'warning';
  if (k === 'unpaid') return 'danger';
  if (k === 'overpaid') return 'warning';
  return 'default';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => (v != null && v !== '' ? `${formatQuantityDisplay(v)} сом` : '—');
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const WAYBILL_SUPPLIER_NAME = 'ОсОО «Мундуз бий»';
const WAYBILL_SUPPLIER_PHONE = '( 0507 55 06 55 )';

const clientLabel = (c) => {
  if (!c) return '—';
  const name = (typeof c.display === 'string' && c.display.trim())
    || (typeof c.label === 'string' && c.label.trim())
    || (typeof c.name === 'string' && c.name.trim())
    || (typeof c.title === 'string' && c.title.trim());
  return name || '—';
};

const orderLabel = (o) => {
  if (!o) return '—';
  const profile = typeof o.profile_name === 'string' ? o.profile_name.trim() : '';
  const qty = o.quantity != null ? `${formatQuantityDisplay(o.quantity)} шт` : '';
  const len = o.length != null && o.length !== '' ? `${formatQuantityDisplay(o.length)} м` : '';
  const status = typeof o.status_label === 'string' ? o.status_label.trim() : '';
  const manual = [profile, qty && len ? `${qty} × ${len}` : (qty || len), status].filter(Boolean).join(' — ');
  if (manual) return manual;
  const raw = (typeof o.display === 'string' && o.display.trim())
    || (typeof o.order_display === 'string' && o.order_display.trim());
  if (raw) {
    const parts = raw.split('—').map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) return parts.slice(1).join(' — ');
    return raw;
  }
  return '—';
};
const orderPrepaidAmount = (o) => {
  if (!o) return 0;
  const candidates = [
    o.paid_amount,
    o.prepaid_amount,
    o.advance_amount,
    o.prepayment_amount,
    o.order_paid_amount,
    o.order_prepayment_amount,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const n = toNumber(candidates[i]);
    if (n > 0) return n;
  }
  return 0;
};

const normalizePaymentMethod = (raw) => {
  const s = String(raw || 'cash').toLowerCase();
  if (s.includes('card') || s.includes('карт')) return 'card';
  if (s.includes('transfer') || s.includes('перевод')) return 'transfer';
  return 'cash';
};

const orderPaymentTypeLabel = (t) => {
  const k = String(t || '').toLowerCase();
  if (k === 'partial') return 'Частичная';
  if (k === 'debt') return 'В долг';
  return 'Полная';
};

/** Снимок оплаты из заявки (как при создании в Кассе). */
const orderPaymentSnapshot = (o) => {
  if (!o) return null;
  const type = String(o.payment_type || 'full').toLowerCase();
  const method = normalizePaymentMethod(o.payment_method);
  const total = toNumber(o.total_amount ?? o.order_total);
  const paid = orderPrepaidAmount(o);
  const remRaw = toNumber(o.amount_remaining);
  const remainingAtOrder = remRaw > 0 ? remRaw : (total > 0 ? Math.max(0, total - paid) : 0);
  return { type, method, total, paid, remainingAtOrder };
};

const resolveOrderAppliedAmount = (orderPrepaid, previewTotal) => {
  const prepaid = toNumber(orderPrepaid);
  const total = toNumber(previewTotal);
  if (!(prepaid > 0) || !(total > 0)) return 0;
  return Math.min(prepaid, total);
};

/** Доплата при продаже (не аванс заявки). */
const resolveSaleSupplementalPaid = ({ paymentType, paidAmount, saleTotal, orderPrepaid }) => {
  const total = toNumber(saleTotal);
  const applied = resolveOrderAppliedAmount(orderPrepaid, total);
  if (paymentType === 'debt') return 0;
  if (paymentType === 'partial') return parseLocaleNumber(paidAmount);
  return total > 0 ? Math.max(0, total - applied) : 0;
};

const resolveSaleDebtRemaining = ({ paymentType, paidAmount, saleTotal, orderPrepaid }) => {
  const total = toNumber(saleTotal);
  const applied = resolveOrderAppliedAmount(orderPrepaid, total);
  const supplemental = resolveSaleSupplementalPaid({ paymentType, paidAmount, saleTotal, orderPrepaid });
  return Math.max(0, total - applied - supplemental);
};
const isClosedOrder = (o) => {
  const raw = String(o?.request_status || o?.status || o?.status_label || '').toLowerCase();
  return raw.includes('closed')
    || raw.includes('completed')
    || raw.includes('done')
    || raw.includes('rejected')
    || raw.includes('declined')
    || raw.includes('cancelled')
    || raw.includes('canceled')
    || raw.includes('закрыт')
    || raw.includes('заверш')
    || raw.includes('отказ');
};

/** Убирает хвост длины « — 0 м» / «-0м» (нулевая длина не несёт смысла). */
const sanitizeBatchDisplayText = (s) => {
  let t = String(s ?? '').trim();
  if (!t) return '';
  const zeroLenSuffix = /\s*[—–\u2012\u2013\u2014\u2212-]\s*0+(?:[.,]\d+)?\s*(?:м|m)\.?/giu;
  t = t.replace(zeroLenSuffix, '').trim();
  return t;
};

const batchLabel = (b) => {
  if (!b) return '—';
  const t = (typeof b.display === 'string' && b.display.trim())
    || (typeof b.warehouse_batch_display === 'string' && b.warehouse_batch_display.trim());
  if (!t) return '—';
  return sanitizeBatchDisplayText(t) || t;
};

const isGoodBatchForSale = (b) => {
  const quality = String(b?.quality || '').toLowerCase();
  if (quality === 'defect' || quality === 'bad') return false;
  const status = String(b?.status || '').toLowerCase();
  if (status && status !== 'available') return false;
  if (status === 'shipped' || status === 'sold' || status === 'closed') return false;
  return true;
};

const normSaleMultiSearch = (s) => String(s ?? '').trim().toLowerCase();
const rowMatchesSaleMultiTokenQuery = (q, ...fields) => {
  const raw = normSaleMultiSearch(q);
  if (!raw) return true;
  const hay = fields.map((f) => (f == null ? '' : String(f))).join(' ').toLowerCase();
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
};
const batchHaystackFieldsForSearch = (b) => [
  b?.id,
  batchLabel(b),
  b?.profile_name,
  b?.product_name,
  b?.blank_name,
  b?.stock_bucket,
  b?.quality,
  b?.status,
  b?.available_pieces,
  b?.available_packages,
  b?.unpacked_pieces,
  b?.unpacked_kg,
];
const batchMatchesStockFilter = (q, b) => rowMatchesSaleMultiTokenQuery(q, ...batchHaystackFieldsForSearch(b));
const formatBatchOptionLabel = (b) => {
  const base = batchLabel(b);
  const loose = resolveUnpackedPiecesForSale(b);
  const pk = resolveBatchAvailPackages(b);
  const bits = [];
  if (loose > 0) bits.push(`${formatQuantityDisplay(loose)} шт`);
  if (pk > 0) bits.push(`${formatQuantityDisplay(pk)} уп`);
  return bits.length ? `${base} · ${bits.join(' · ')}` : base;
};
const cartLineTitle = (line, batch, idx) => {
  if (batch) {
    const pn = String(batch.product_name ?? batch.productName ?? '').trim();
    const bn = String(batch.blank_name ?? batch.blankName ?? '').trim();
    if (pn || bn) return [pn, bn].filter(Boolean).join(' · ');
    return formatBatchOptionLabel(batch);
  }
  const profile = String(line?.profile_name ?? '').trim();
  if (profile) return profile;
  return `Товар ${idx + 1}`;
};
const resolveBatchAvailPieces = (b) =>
  toNumber(b?.available_pieces ?? b?.unpacked_pieces ?? b?.pieces_available ?? b?.pieces_count ?? b?.qty_pieces);

const resolveBatchAvailPackages = (b) =>
  toNumber(
    b?.available_packages
    ?? b?.packages_count
    ?? b?.pack_count
    ?? b?.packages
    ?? b?.package_count
    ?? b?.available_packs
    ?? b?.packed_count
    ?? b?.qty_packages
  );

const UNPACKED_PIECE_FIELD_KEYS = [
  'unpacked_pieces',
  'unpacked_available',
  'available_unpacked_pieces',
  'loose_pieces',
  'unpackaged_pieces_available',
  'unpackaged_available_pieces',
];

const hasOwnNumericBatchField = (b, keys) =>
  keys.some((k) => {
    if (b == null || typeof b !== 'object' || !Object.prototype.hasOwnProperty.call(b, k)) return false;
    const v = b[k];
    return v != null && v !== '';
  });

/**
 * Штуки для вкладки «Неупакованные»: явное поле с бэка или остаток total − (упаковки × шт/упак),
 * если бэк отдаёт общий available_pieces по партии вместе с упаковками.
 */
const resolveUnpackedPiecesForSale = (b) => {
  if (!b) return 0;
  if (hasOwnNumericBatchField(b, UNPACKED_PIECE_FIELD_KEYS)) {
    for (const k of UNPACKED_PIECE_FIELD_KEYS) {
      const v = toNumber(b[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return 0;
  }
  const ap = resolveBatchAvailPieces(b);
  const pkRead = readPackagesCount(b);
  const pk = pkRead != null && pkRead >= 1 ? pkRead : resolveBatchAvailPackages(b);
  const ipp = readPiecesPerPackage(b);
  if (!(pk >= 1)) return ap;
  if (ipp != null && ipp >= 1) {
    return Math.max(0, Math.floor(ap) - Math.floor(pk) * Math.floor(ipp));
  }
  return 0;
};

const maxSaleQtyForBatch = (line, batch) => {
  if (!batch) return 0;
  if (line?.unit_type === 'packages') return resolveBatchAvailPackages(batch);
  return resolveUnpackedPiecesForSale(batch);
};

/** Кол-во из заявки, не больше остатка на складе. */
const capQuantityForOrderLine = (line, batch) => {
  const orderQty = parseLocaleNumber(line.order_quantity ?? line.quantity);
  if (line?.unit_type === 'packages') {
    return orderQty > 0 ? '1' : (line.quantity || '1');
  }
  if (!(orderQty > 0)) return line.quantity || '';
  const maxQ = maxSaleQtyForBatch(line, batch);
  if (maxQ > 0) return String(Math.min(orderQty, Math.floor(maxQ)));
  return String(Math.floor(orderQty));
};

const enrichCartLinesFromOrder = (lines, batches) =>
  (lines || []).map((ln) => {
    const batch =
      ln.warehouse_batch && batches?.length
        ? batches.find((b) => String(b.id) === String(ln.warehouse_batch))
        : null;
    const orderQty = ln.quantity != null && ln.quantity !== '' ? String(ln.quantity) : '';
    return {
      ...ln,
      order_quantity: orderQty,
      quantity: capQuantityForOrderLine({ ...ln, order_quantity: orderQty }, batch),
    };
  });

/** Штуки внутри одной GP-упаковки (для подписи в UI). */
const gpPackagePiecesInside = (gp) => toNumber(
  gp?.total_pieces ?? gp?.pieces ?? gp?.piece_count ?? gp?.pieces_count ?? gp?.qty,
);

const normalizeGpPackagesPayload = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.available_gp_packages)) return data.available_gp_packages;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
};

const resolvePackageKindLabel = (raw) => {
  const k = String(raw ?? '').toLowerCase().trim();
  if (!k) return '';
  if (k === 'box' || k === 'короб') return 'Короб';
  if (k.includes('pallet') || k.includes('паллет')) return 'Паллета';
  if (k === 'other' || k === 'другое') return 'Другое';
  return raw.charAt(0).toUpperCase() + String(raw).slice(1);
};
const batchPackageKindLabel = (b) => resolvePackageKindLabel(b?.kind ?? b?.package_kind ?? b?.batch_kind ?? '');
const gpPackageKindLabel = resolvePackageKindLabel;

const qtyUnitLabel = (unitType) => (unitType === 'packages' ? 'уп.' : 'шт.');
const paymentTypeLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'full') return 'Полная';
  if (k === 'partial') return 'Частичная';
  if (k === 'debt') return 'В долг';
  return v || '—';
};
const paymentMethodLabel = (v) => {
  const k = String(v ?? '').toLowerCase().trim();
  if (!k || k === 'null' || k === 'undefined') return '—';
  if (k === 'cash') return 'Наличные';
  if (k === 'card') return 'Карта';
  if (k === 'transfer' || k === 'bank_transfer' || k === 'wire') return 'Перевод';
  if (k === 'other') return 'Другое';
  return String(v).trim() || '—';
};

const unwrapPaymentMethodValue = (v) => {
  if (v == null || v === '') return '';
  if (typeof v === 'object') {
    return v.label ?? v.name ?? v.title ?? v.display ?? v.code ?? v.slug ?? v.value ?? '';
  }
  return v;
};

const paymentMethodFromSale = (sale) => {
  const tryList = [
    sale?.payment_method,
    sale?.payment_method_code,
    sale?.payment_method_slug,
    sale?.last_payment_method,
    sale?.method,
    sale?.payments?.[0]?.payment_method,
    sale?.payments?.[0]?.method,
    sale?.latest_payment?.payment_method,
    sale?.latest_payment?.method,
  ];
  for (const x of tryList) {
    const u = unwrapPaymentMethodValue(x);
    if (u !== '' && u != null) return u;
  }
  return '';
};
const inferPaymentType = (sale) => {
  const t = String(sale?.payment_type || '').trim();
  if (t) return t;
  const total = toNumber(sale?.total_amount);
  const paid = toNumber(sale?.paid_amount);
  const debt = toNumber(sale?.debt_amount);
  if (total > 0 && debt === 0) return 'full';
  if (total > 0 && paid === 0) return 'debt';
  if (paid > 0 && debt > 0) return 'partial';
  return '';
};
const toWaybillDate = (v) => {
  const s = String(v || '');
  if (s.length >= 10) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
  return '—';
};
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const PACK_TEXT_CANDIDATES = (sale, ln) => [
  ln?.warehouse_batch_display,
  ln?.display,
  ln?.batch_display,
  ln?.order_display,
  ln?.order_line_display,
  sale?.order_display,
  sale?.request_display,
  sale?.order?.display,
];
const normalizeBatchId = (v) => (v != null && v !== '' ? String(v) : '');
const parsePackFromText = (text) => {
  const s = String(text || '');
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*шт\s*\/\s*(\d+(?:[.,]\d+)?)\s*уп/i);
  if (!m) return null;
  const pieces = toNumber(String(m[1]).replace(',', '.'));
  const packs = toNumber(String(m[2]).replace(',', '.'));
  if (!(pieces > 0) || !(packs > 0)) return null;
  return {
    totalPieces: pieces,
    totalPacks: packs,
    piecesPerPack: pieces / packs,
  };
};
const parsePackagesFromText = (text) => {
  const s = String(text || '');
  if (!s) return 0;
  const patterns = [
    /(?:\/|остаток[:\s]*)\s*(\d+(?:[.,]\d+)?)\s*уп(?:ак)?\.?/i,
    /(\d+(?:[.,]\d+)?)\s*уп(?:ак)?\.?/i,
  ];
  for (let i = 0; i < patterns.length; i += 1) {
    const m = s.match(patterns[i]);
    if (!m) continue;
    const n = toNumber(String(m[1]).replace(',', '.'));
    if (n > 0) return n;
  }
  return 0;
};
const resolvePackagesQty = (sale, ln, batchMeta) => {
  const direct = toNumber(ln?.packages_quantity ?? ln?.quantity_packages ?? ln?.packages);
  if (direct > 0) return direct;
  const fromMeta = toNumber(
    batchMeta?.packages_quantity
    ?? batchMeta?.quantity_packages
    ?? batchMeta?.packages
    ?? batchMeta?.available_packages,
  );
  if (fromMeta > 0) return fromMeta;
  const fromBatchObj = toNumber(
    ln?.warehouse_batch?.packages_quantity
    ?? ln?.warehouse_batch?.quantity_packages
    ?? ln?.warehouse_batch?.packages
    ?? ln?.warehouse_batch?.available_packages,
  );
  if (fromBatchObj > 0) return fromBatchObj;
  const candidates = PACK_TEXT_CANDIDATES(sale, ln);
  for (let i = 0; i < candidates.length; i += 1) {
    const parsedPack = parsePackFromText(candidates[i]);
    if (parsedPack?.totalPacks > 0) return parsedPack.totalPacks;
    const packsOnly = parsePackagesFromText(candidates[i]);
    if (packsOnly > 0) return packsOnly;
  }
  return 0;
};
const resolvePiecesPerPack = (ln, batchMeta) => {
  const direct = toNumber(
    ln?.pieces_per_package
    ?? ln?.pieces_per_pack
    ?? ln?.pack_size
    ?? ln?.package_size
    ?? ln?.pack_qty,
  );
  if (direct > 0) return direct;
  const fromMeta = toNumber(
    batchMeta?.pieces_per_package
    ?? batchMeta?.pieces_per_pack
    ?? batchMeta?.pack_size
    ?? batchMeta?.package_size
    ?? batchMeta?.pack_qty,
  );
  if (fromMeta > 0) return fromMeta;
  const fromBatchObj = toNumber(
    ln?.warehouse_batch?.pieces_per_package
    ?? ln?.warehouse_batch?.pieces_per_pack
    ?? ln?.warehouse_batch?.pack_size
    ?? ln?.warehouse_batch?.package_size
    ?? ln?.warehouse_batch?.pack_qty,
  );
  if (fromBatchObj > 0) return fromBatchObj;
  const fromDisplay = parsePackFromText(ln?.warehouse_batch_display || ln?.display || ln?.batch_display);
  if (fromDisplay?.piecesPerPack > 0) return fromDisplay.piecesPerPack;
  return 0;
};
const parsePiecesPerPackFromText = (text) => {
  const s = String(text || '');
  if (!s) return 0;
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*шт\s*[xх×]/i,
    /[xх×]\s*(\d+(?:[.,]\d+)?)\s*шт/i,
    /по\s*(\d+(?:[.,]\d+)?)\s*шт/i,
  ];
  for (let i = 0; i < patterns.length; i += 1) {
    const m = s.match(patterns[i]);
    if (!m) continue;
    const n = toNumber(String(m[1]).replace(',', '.'));
    if (n > 0) return n;
  }
  return 0;
};
const resolvePiecesPerPackFromSaleContext = (sale, ln) => {
  const candidates = PACK_TEXT_CANDIDATES(sale, ln);
  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = parsePackFromText(candidates[i]);
    if (parsed?.piecesPerPack > 0) return parsed.piecesPerPack;
    const n = parsePiecesPerPackFromText(candidates[i]);
    if (n > 0) return n;
  }
  return 0;
};
const isPackagesSaleLine = (sale, ln) => {
  const raw = String(
    ln?.unit_type
    || ln?.unit_type_display
    || sale?.unit_type
    || sale?.unit_type_display
    || sale?.sale_type
    || sale?.sale_type_display
    || '',
  ).toLowerCase();
  if (
    raw.includes('packages')
    || raw.includes('package')
    || raw.includes('упак')
    || raw.includes('уп.')
  ) return true;
  const packagesQty = resolvePackagesQty(sale, ln);
  return packagesQty > 0;
};
const saleLineQtyText = (sale, ln, batchMetaMap = null) => {
  const batchKey = normalizeBatchId(ln?.warehouse_batch?.id ?? ln?.warehouse_batch);
  const batchMeta = batchMetaMap && batchKey ? batchMetaMap[batchKey] : null;
  const piecesQty = toNumber(ln?.quantity ?? ln?.qty ?? ln?.pieces_quantity ?? ln?.quantity_pieces);
  const packagesQty = resolvePackagesQty(sale, ln, batchMeta);
  if (!(piecesQty > 0) && !(packagesQty > 0)) return '—';
  const packagesSale = isPackagesSaleLine(sale, ln);
  let piecesPerPack = resolvePiecesPerPack(ln, batchMeta);
  if (!(piecesPerPack > 0)) {
    piecesPerPack = resolvePiecesPerPackFromSaleContext(sale, ln);
  }
  if (!(piecesPerPack > 0) && packagesQty > 0 && piecesQty > 0) {
    piecesPerPack = piecesQty / packagesQty;
  }
  if (packagesSale && packagesQty > 0 && piecesPerPack > 0 && piecesQty > 0) {
    return `${formatQuantityDisplay(packagesQty)} упак × ${formatQuantityDisplay(piecesPerPack)} шт = ${formatQuantityDisplay(piecesQty)} шт`;
  }
  if (packagesSale && packagesQty > 0 && piecesQty > 0) {
    return `${formatQuantityDisplay(packagesQty)} упак = ${formatQuantityDisplay(piecesQty)} шт`;
  }
  if (packagesSale && packagesQty > 0) {
    return `${formatQuantityDisplay(packagesQty)} упак`;
  }
  if (packagesSale && piecesPerPack > 0 && piecesQty > 0) {
    const packs = piecesQty / piecesPerPack;
    const roundedPacks = Math.round(packs * 100) / 100;
    const packText = Number.isInteger(roundedPacks)
      ? formatQuantityDisplay(roundedPacks)
      : String(roundedPacks).replace('.', ',');
    return `${packText} упак × ${formatQuantityDisplay(piecesPerPack)} шт = ${formatQuantityDisplay(piecesQty)} шт`;
  }
  return `${formatQuantityDisplay(piecesQty)} шт`;
};
const waybillLineName = (ln) => {
  const base = ln.warehouse_batch_display || ln.display || ln.batch_display || ln.product_name || ln.profile_name || '—';
  const lengthPerPiece = ln.length_per_piece ?? ln.piece_length ?? ln.length;
  const pieces = ln.pieces_quantity ?? ln.quantity_pieces ?? ln.pieces ?? ln.quantity ?? ln.qty ?? null;
  const packages = ln.packages_quantity ?? ln.quantity_packages ?? ln.packages ?? null;
  const details = [];
  const lenNum = lengthPerPiece != null && lengthPerPiece !== '' ? toNumber(lengthPerPiece) : null;
  if (pieces != null && pieces !== '' && lenNum != null && Number.isFinite(lenNum) && lenNum > 0) {
    details.push(`${formatQuantityDisplay(pieces)} шт × ${formatQuantityDisplay(lengthPerPiece)} м`);
  } else {
    if (lenNum != null && Number.isFinite(lenNum) && lenNum > 0) details.push(`${formatQuantityDisplay(lengthPerPiece)} м`);
    if (pieces != null && pieces !== '') details.push(`${formatQuantityDisplay(pieces)} шт`);
  }
  if (packages != null && packages !== '') details.push(`${formatQuantityDisplay(packages)} упак`);
  const full = details.length ? `${base} (${details.join(', ')})` : base;
  return sanitizeBatchDisplayText(full) || full;
};
const waybillLineUnit = (sale, ln) => {
  if (ln.unit_label) return String(ln.unit_label);
  const unitType = String(ln.unit_type || sale?.unit_type || '').toLowerCase();
  if (unitType === 'packages') return 'упак';
  if (unitType === 'pieces') return 'шт';
  return WAYBILL_DEFAULT_UNIT;
};
const normalizeUnitType = (v) => {
  const s = String(v || '').toLowerCase();
  if (s.includes('упак') || s.includes('package')) return 'packages';
  return 'pieces';
};
const rawOrderLinesBucket = (source) => {
  const buckets = [
    source?.order_lines,
    source?.lines,
    source?.items,
    source?.products,
    source?.request_lines,
    source?.positions,
  ];
  return buckets.find((x) => Array.isArray(x) && x.length) || [];
};

const extractOrderProductLines = (orderDetail) => {
  const source = orderDetail || {};
  const raw = rawOrderLinesBucket(source);
  return extractOrderLines(source).map((ln, idx) => {
    const rawLn = raw[idx] || {};
    const price = rawLn?.unit_price ?? rawLn?.price ?? rawLn?.sale_price ?? source?.unit_price ?? '';
    return {
      ...ln,
      unit_price: price != null && price !== '' ? String(price) : '',
      unit_type: normalizeUnitType(rawLn?.unit_type || source?.unit_type),
    };
  });
};

const mergeOrderDetailForCart = (listItem, apiDetail) => {
  const base = { ...(listItem || {}), ...(apiDetail || {}) };
  const fromApi = extractOrderProductLines(apiDetail);
  const fromList = extractOrderProductLines(listItem);
  const lines = fromApi.length >= fromList.length ? fromApi : fromList;
  if (lines.length) return { ...base, order_lines: lines };
  return base;
};

const formatOrderSelectDate = (o) => {
  const iso = pickFirstIsoDate(o, ['date', 'order_date', 'created_at', 'requested_at', 'updated_at']);
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  if (s.length === 10) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
  return s;
};

const orderProfileLinesCount = (o) => {
  const lines = extractOrderProductLines(o);
  if (lines.length) return lines.length;
  const n = o?.lines_count ?? o?.linesCount;
  if (n != null && Number.isFinite(Number(n)) && Number(n) > 0) return Number(n);
  if (o?.profile_id != null || String(o?.profile_name ?? '').trim()) return 1;
  return 0;
};

/** Краткая подпись заявки в селекте продажи: дата — число профилей. */
const orderSelectLabel = (o) => {
  if (!o) return '—';
  const date = formatOrderSelectDate(o);
  const n = orderProfileLinesCount(o);
  if (n > 0) return `${date} — ${n}`;
  return date;
};

/** Один пункт селекта на заявку (бэк иногда отдаёт несколько строк на один id). */
const dedupeOrdersById = (list) => {
  const map = new Map();
  for (const o of list || []) {
    if (o?.id == null) continue;
    const key = String(o.id);
    const incomingLines = extractOrderProductLines(o);
    if (!map.has(key)) {
      map.set(key, incomingLines.length ? { ...o, order_lines: incomingLines } : { ...o });
      continue;
    }
    const prev = map.get(key);
    const prevLines = extractOrderProductLines(prev);
    const merged = [...prevLines, ...incomingLines];
    map.set(key, {
      ...prev,
      ...o,
      ...(merged.length ? { order_lines: merged } : {}),
    });
  }
  return [...map.values()];
};

const SalesPage = () => {
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, payment_filter: '' });
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleDetailsId, setSaleDetailsId] = useState(null);
  const [clientDateFilter, setClientDateFilter] = useState('');

  const apiQuery = useMemo(() => {
    const q = { page: queryState.page, page_size: queryState.page_size };
    if (queryState.payment_filter === 'paid') q.payment_status = 'paid';
    if (queryState.payment_filter === 'debt') q.payment_status = 'unpaid';
    return q;
  }, [queryState]);

  const { items, meta, loading, error, refetch } = useServerQuery('sales/', apiQuery, { enabled: true });
  useOperationalRefetch(WS_CASH, refetch, true);

  const saleDateFields = useMemo(() => ['date', 'created_at', 'updated_at', 'sold_at'], []);
  const visibleSales = useMemo(() => {
    if (!clientDateFilter) return items;
    return (items || []).filter((s) =>
      matchesClientDateFilter(clientDateFilter, pickFirstIsoDate(s, saleDateFields)),
    );
  }, [items, clientDateFilter, saleDateFields]);

  return (
    <div className="page page--sales commercial-page">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <SearchableSelect
            value={queryState.payment_filter}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_filter: v, page: 1 }))}
            placeholder="Фильтр оплаты"
            options={[
              { value: '', label: 'Все' },
              { value: 'paid', label: 'Оплачено' },
              { value: 'debt', label: 'Долг' },
            ]}
          />
          <ClientDateFilter value={clientDateFilter} onChange={setClientDateFilter} id="sales-date-filter" />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setSaleModalOpen(true)}>
            Создать продажу
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет продаж" />}

      {!loading && (!error || error.status === 404) && items.length > 0 && visibleSales.length === 0 && (
        <EmptyState title="На выбранную дату продаж нет (на этой странице)" />
      )}

      {!loading && (!error || error.status === 404) && visibleSales.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--sales data-table--row-actions">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Дата</th>
                <th>Заявка</th>
                <th>Тип продажи</th>
                <th className="data-table__cell--num">Сумма</th>
                <th className="data-table__cell--num">Оплачено</th>
                <th className="data-table__cell--num">Долг</th>
                <th>Статус оплаты</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {visibleSales.map((s) => {
                const clientText = s.client_name || clientLabel(s.client) || s.display;
                const orderText = s.order_display
                  || s.order_name
                  || (typeof s.order === 'object' ? orderLabel(s.order) : '')
                  || '—';
                const saleTypeText = s.unit_type === 'packages' ? 'Упаковки' : 'Штуки';
                return (
                  <tr key={s.id}>
                    <td>{clientText || '—'}</td>
                    <td>{formatDate(s.date || s.created_at)}</td>
                    <td>{orderText}</td>
                    <td>{saleTypeText}</td>
                    <td className="data-table__cell--num">{toMoney(s.total_amount ?? s.revenue)}</td>
                    <td className="data-table__cell--num">{toMoney(s.paid_amount)}</td>
                    <td className="data-table__cell--num">{toMoney(s.debt_amount)}</td>
                    <td><Badge variant={paymentStatusVariant(s.payment_status)}>{paymentStatusLabel(s.payment_status_label || s.payment_status)}</Badge></td>
                    <td>
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSaleDetailsId(s.id)}>
                        Открыть
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {saleModalOpen && (
        <CreateSaleModal
          onClose={() => setSaleModalOpen(false)}
          onSaved={() => {
            setSaleModalOpen(false);
            refetch();
          }}
        />
      )}

      {saleDetailsId != null && (
        <SaleDetailsModal
          saleId={saleDetailsId}
          onClose={() => setSaleDetailsId(null)}
        />
      )}
    </div>
  );
};

const newEmptySaleLine = () => ({
  warehouse_batch: '',
  quantity: '',
  unit_price: '',
  unit_type: 'pieces',
});

const CreateSaleModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSelect, setLoadingSelect] = useState(false);
  const [inventoryRefreshNonce, setInventoryRefreshNonce] = useState(0);
  const [batchStockSearch, setBatchStockSearch] = useState('');
  const [gpSalePackages, setGpSalePackages] = useState([]);
  const [gpPackagesLoading, setGpPackagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState({});
  const [clientError, setClientError] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState('');
  const [paidAmountError, setPaidAmountError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  /** Legacy FIFO: партии без GpPackUnit (unit_type=packages в select-sources). */
  const [legacyPackageBatches, setLegacyPackageBatches] = useState([]);
  const [client, setClient] = useState('');
  const [order, setOrder] = useState('');
  const [paymentType, setPaymentType] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [orderPrepaid, setOrderPrepaid] = useState(0);
  const [orderPaymentSnap, setOrderPaymentSnap] = useState(null);
  const [saleLines, setSaleLines] = useState([newEmptySaleLine()]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [orderCartLoading, setOrderCartLoading] = useState(false);
  const [orderCartError, setOrderCartError] = useState('');
  const [autoFilledFromOrder, setAutoFilledFromOrder] = useState(false);
  const [preview, setPreview] = useState(null);
  const [, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const moneySafe = useCallback((v) => {
    const n = parseLocaleNumber(v);
    return `${Number.isFinite(n) && n > 0 ? formatQuantityDisplay(n) : '0'} сом`;
  }, []);
  const isLineEmpty = useCallback((ln) => {
    if (!ln) return true;
    const wb = String(ln.warehouse_batch || '').trim();
    const q = String(ln.quantity || '').trim();
    const p = String(ln.unit_price || '').trim();
    return !wb && !q && !p;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getClients({ page: 1, page_size: 500 });
        if (!alive) return;
        const data = res.data || {};
        setClients(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (alive) setClients([]);
      } finally {
        if (alive) setLoadingClients(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useOperationalRefetch(
    ['warehouse_package', 'sale', 'payment', 'warehouse_batch', 'return'],
    () => {
      setInventoryRefreshNonce((n) => n + 1);
    },
    true,
  );

  useEffect(() => {
    let alive = true;
    setLoadingSelect(true);
    setGpPackagesLoading(true);
    const params = {};
    if (client) params.client = client;
    if (order) params.order = order;
    Promise.all([
      getSaleSelectSources(params),
      getSaleSelectSources({ ...params, unit_type: 'packages' }),
    ])
      .then(([mainRes, packagesRes]) => {
        if (!alive) return;
        const mainData = mainRes.data || {};
        const pkgData = packagesRes.data || {};
        const ord = mainData.available_orders ?? mainData.orders;
        const bat = mainData.available_warehouse_batches ?? mainData.warehouse_batches;
        const legacyBat = pkgData.available_warehouse_batches ?? pkgData.warehouse_batches;
        setOrders(Array.isArray(ord) ? ord : []);
        setBatches(Array.isArray(bat) ? bat : []);
        setLegacyPackageBatches(Array.isArray(legacyBat) ? legacyBat : []);
        setGpSalePackages(normalizeGpPackagesPayload(pkgData));
      })
      .catch(() => {
        if (!alive) return;
        setOrders([]);
        setBatches([]);
        setLegacyPackageBatches([]);
        setGpSalePackages([]);
      })
      .finally(() => {
        if (alive) {
          setLoadingSelect(false);
          setGpPackagesLoading(false);
        }
      });
    return () => { alive = false; };
  }, [client, order, inventoryRefreshNonce]);

  useEffect(() => {
    if (paymentType === 'debt') setPaidAmount('0');
    if (paymentType === 'full') setPaidAmount('');
  }, [paymentType]);

  useEffect(() => {
    const buildPayloadForPreview = () => {
      if (!client) return null;
      if (!saleLines.length) return null;
      const cleanLines = [];
      for (let i = 0; i < saleLines.length; i += 1) {
        const ln = saleLines[i];
        const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
        const qty = parseLocaleNumber(ln.quantity);
        const price = parseLocaleNumber(ln.unit_price);
        if (!wb || !(qty > 0) || !Number.isFinite(price)) return null;
        const gpId = ln.gp_package_id ? Number(ln.gp_package_id) : null;
        cleanLines.push({
          warehouse_batch: wb,
          ...(gpId ? { gp_package_id: gpId } : {}),
          quantity: String(gpId ? 1 : qty),
          unit_price: String(price),
          unit_type: ln.unit_type === 'packages' ? 'packages' : 'pieces',
          ...(ln.order_line_id ? { order_line: Number(ln.order_line_id) } : {}),
        });
      }
      const payload = {
        client: Number(client),
        sale_lines: cleanLines,
        payment_type: paymentType,
        payment_method: paymentMethod,
      };
      if (order) payload.order = Number(order);
      const lineTotal = cleanLines.reduce(
        (acc, ln) => acc + parseLocaleNumber(ln.quantity) * parseLocaleNumber(ln.unit_price),
        0,
      );
      const applied = order ? resolveOrderAppliedAmount(orderPrepaid, lineTotal) : 0;
      if (applied > 0) payload.order_paid_amount_applied = String(applied);
      if (paymentType === 'partial') {
        const p = parseLocaleNumber(paidAmount);
        if (!(p > 0)) return null;
        payload.paid_amount = String(p);
      } else if (paymentType === 'debt') {
        payload.paid_amount = '0';
      } else {
        payload.paid_amount = String(resolveSaleSupplementalPaid({
          paymentType,
          paidAmount,
          saleTotal: lineTotal,
          orderPrepaid,
        }));
      }
      return payload;
    };

    const payload = buildPayloadForPreview();
    if (!payload) {
      setPreview(null);
      setPreviewError('');
      return undefined;
    }

    let alive = true;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      previewSale(payload)
        .then((res) => {
          if (!alive) return;
          setPreview(res.data || null);
          setPreviewError('');
        })
        .catch((err) => {
          if (!alive) return;
          setPreview(null);
          setPreviewError(getApiErrorMessage(err, 'Не удалось рассчитать предпросмотр продажи'));
        })
        .finally(() => {
          if (alive) setPreviewLoading(false);
        });
    }, 300);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [client, order, saleLines, paymentType, paymentMethod, paidAmount, orderPrepaid]);

  const filteredOrders = useMemo(() => {
    if (!client) return [];
    const scoped = orders.filter((o) => {
      if (isClosedOrder(o)) return false;
      const oid = o?.client_id ?? o?.client?.id ?? o?.client;
      if (oid == null || oid === '') return true;
      return String(oid) === String(client);
    });
    return dedupeOrdersById(scoped);
  }, [orders, client]);
  const orderOptions = useMemo(
    () => [
      { value: '', label: 'Не выбрана' },
      ...filteredOrders.map((o) => ({
        value: String(o.id),
        label: orderSelectLabel(o),
        searchText: [formatOrderSelectDate(o), orderProfileLinesCount(o), o.id].filter((x) => x != null).join(' '),
      })),
    ],
    [filteredOrders],
  );
  const clientOptions = useMemo(
    () => [{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: clientLabel(c) }))],
    [clients],
  );
  const saleAvailableBatches = useMemo(() => {
    const source = batches.filter(isGoodBatchForSale);
    return source
      .filter((b) => resolveUnpackedPiecesForSale(b) > 0)
      .sort((a, b) => resolveUnpackedPiecesForSale(b) - resolveUnpackedPiecesForSale(a));
  }, [batches]);
  const saleAvailableLegacyPackageBatches = useMemo(() => {
    const source = legacyPackageBatches.filter(isGoodBatchForSale);
    return source
      .filter((b) => resolveBatchAvailPackages(b) > 0)
      .sort((a, b) => resolveBatchAvailPackages(b) - resolveBatchAvailPackages(a));
  }, [legacyPackageBatches]);
  const filteredBatchesByUnitType = useCallback((lineUnitType) => {
    if (lineUnitType === 'packages') {
      return saleAvailableLegacyPackageBatches;
    }
    return saleAvailableBatches;
  }, [saleAvailableBatches, saleAvailableLegacyPackageBatches]);
  const pickBatchForOrderLine = useCallback((orderLine, lineUnitType) => {
    const list = filteredBatchesByUnitType(lineUnitType || 'pieces');
    if (!list.length) return '';
    const targetProfileId = orderLine?.profile_id != null ? String(orderLine.profile_id) : '';
    const targetProfileName = String(orderLine?.profile_name || '').toLowerCase();
    const exact = list.filter((b) => {
      const bid = b?.profile_id ?? b?.profile?.id ?? b?.profile ?? null;
      if (targetProfileId && bid != null && String(bid) === targetProfileId) return true;
      if (!targetProfileName) return false;
      const bname = String(b?.profile_name || b?.display || b?.warehouse_batch_display || '').toLowerCase();
      return bname.includes(targetProfileName);
    });
    const source = exact.length ? exact : list;
    return source[0]?.id != null ? String(source[0].id) : '';
  }, [filteredBatchesByUnitType]);
  const buildCartFromOrder = useCallback((orderDetail) => {
    const orderLines = extractOrderProductLines(orderDetail);
    if (!orderLines.length) return null;
    return orderLines.map((ln) => {
      const lineId = orderLineApiId(ln);
      return {
        warehouse_batch: pickBatchForOrderLine(ln, ln.unit_type),
        quantity: ln.quantity,
        unit_price: ln.unit_price,
        unit_type: ln.unit_type || 'pieces',
        profile_id: ln.profile_id,
        profile_name: ln.profile_name,
        ...(lineId != null ? { order_line_id: lineId } : {}),
        from_order: true,
      };
    });
  }, [pickBatchForOrderLine]);

  const applyOrderPaymentDefaults = useCallback((snap, saleTotal) => {
    if (!snap) return;
    setPaymentMethod(snap.method);
    setOrderPrepaid(snap.paid);
    const total = toNumber(saleTotal);
    const dueAtSale = total > 0 ? Math.max(0, total - snap.paid) : 0;
    if (snap.type === 'debt' && snap.paid <= 0) {
      setPaymentType(total > 0 ? 'partial' : 'debt');
      setPaidAmount(total > 0 ? String(total) : '');
      return;
    }
    if (total > 0 && snap.paid >= total) {
      setPaymentType('full');
      setPaidAmount('');
      return;
    }
    if (snap.paid > 0 || snap.type === 'partial' || snap.remainingAtOrder > 0) {
      setPaymentType(dueAtSale > 0 ? 'partial' : 'full');
      setPaidAmount(dueAtSale > 0 ? String(dueAtSale) : '');
      return;
    }
    setPaymentType('full');
    setPaidAmount('');
  }, []);

  const applyCartFromOrder = useCallback((orderDetail) => {
    const autoCart = buildCartFromOrder(orderDetail);
    if (!autoCart?.length) {
      setOrderCartError('В заявке нет позиций для продажи.');
      setAutoFilledFromOrder(false);
      return false;
    }
    setSaleLines(enrichCartLinesFromOrder(autoCart, saleAvailableBatches));
    setActiveLineIdx(0);
    setAutoFilledFromOrder(true);
    setOrderCartError('');
    return true;
  }, [buildCartFromOrder, saleAvailableBatches]);

  useEffect(() => {
    if (!order || !orderPaymentSnap || !autoFilledFromOrder || !preview) return;
    const total = toNumber(preview.total_amount);
    if (!(total > 0)) return;
    applyOrderPaymentDefaults(orderPaymentSnap, total);
  }, [order, orderPaymentSnap, autoFilledFromOrder, preview?.total_amount, applyOrderPaymentDefaults]);

  useEffect(() => {
    setActiveLineIdx((prev) => {
      if (!saleLines.length) return 0;
      if (prev < 0) return 0;
      if (prev >= saleLines.length) return saleLines.length - 1;
      return prev;
    });
  }, [saleLines]);
  useEffect(() => {
    if (!order) {
      setOrderPrepaid(0);
      setOrderPaymentSnap(null);
      setOrderCartLoading(false);
      setOrderCartError('');
      setAutoFilledFromOrder(false);
      return undefined;
    }
    const selected = filteredOrders.find((o) => String(o.id) === String(order));
    const snapFromList = orderPaymentSnapshot(selected);
    setOrderPaymentSnap(snapFromList);
    if (snapFromList) applyOrderPaymentDefaults(snapFromList, 0);
    if (selected) {
      applyCartFromOrder(mergeOrderDetailForCart(selected, {}));
    }
    let cancelled = false;
    setOrderCartLoading(true);
    setOrderCartError('');
    getOrder(order)
      .then((res) => {
        if (cancelled) return;
        const merged = mergeOrderDetailForCart(selected, res?.data || {});
        const snap = orderPaymentSnapshot(merged);
        setOrderPaymentSnap(snap);
        applyCartFromOrder(merged);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!applyCartFromOrder(mergeOrderDetailForCart(selected, {}))) {
          setOrderCartError(getApiErrorMessage(err, 'Не удалось загрузить товары из заявки'));
        }
      })
      .finally(() => {
        if (!cancelled) setOrderCartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order, filteredOrders, applyCartFromOrder, applyOrderPaymentDefaults]);
  useEffect(() => {
    setSaleLines((prev) =>
      prev.map((line) => {
        const lineBatches = filteredBatchesByUnitType(line.unit_type || 'pieces');
        const allowedBatchIds = new Set(lineBatches.map((b) => String(b.id)));
        let next = line;
        if (line.warehouse_batch && !allowedBatchIds.has(String(line.warehouse_batch))) {
          next = { ...next, warehouse_batch: '', quantity: '' };
        }
        if (next.from_order && next.warehouse_batch) {
          const batch = lineBatches.find((b) => String(b.id) === String(next.warehouse_batch));
          const qty = capQuantityForOrderLine(next, batch);
          if (qty && qty !== next.quantity) next = { ...next, quantity: qty };
        }
        return next;
      }),
    );
  }, [filteredBatchesByUnitType]);

  useEffect(() => {
    setBatchStockSearch('');
  }, [activeLineIdx]);

  const submit = async (e) => {
    e.preventDefault();
    setLineErrors({});
    setClientError('');
    setPaymentMethodError('');
    setPaidAmountError('');
    setSubmitError('');
    if (!client) {
      setClientError('Выберите клиента');
      return;
    }
    if (!saleLines.length) {
      setSubmitError('Добавьте хотя бы один товар');
      return;
    }
    if (!paymentMethod) {
      setPaymentMethodError('Выберите способ оплаты');
      return;
    }

    const cleanLines = [];
    const nextLineErrors = {};
    for (let i = 0; i < saleLines.length; i += 1) {
      const ln = saleLines[i];
      const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
      const qty = parseLocaleNumber(ln.quantity);
      const price = parseLocaleNumber(ln.unit_price);
      const batchPool = ln.unit_type === 'packages'
        ? saleAvailableLegacyPackageBatches
        : saleAvailableBatches;
      const batch = batchPool.find((b) => String(b.id) === String(ln.warehouse_batch));
      const gpPkg = ln.gp_package_id
        ? gpSalePackages.find((r) => String(r.id) === String(ln.gp_package_id))
        : null;
      const maxQ = (ln.gp_package_id && gpPkg && ln.unit_type === 'packages')
        ? 1
        : maxSaleQtyForBatch(ln, batch);
      if (!wb || !(qty > 0) || !Number.isFinite(price)) {
        nextLineErrors[i] = {
          warehouse_batch: !wb ? 'Выберите партию' : '',
          quantity: !(qty > 0) ? 'Введите количество' : '',
          unit_price: !Number.isFinite(price) ? 'Введите цену' : '',
        };
        continue;
      }
      if (maxQ > 0 && qty > maxQ) {
        nextLineErrors[i] = {
          ...nextLineErrors[i],
          quantity: `Не больше ${formatQuantityDisplay(maxQ)} ${qtyUnitLabel(ln.unit_type || 'pieces')}`,
        };
        continue;
      }
      const gpId = ln.gp_package_id ? Number(ln.gp_package_id) : null;
      cleanLines.push({
        warehouse_batch: wb,
        ...(gpId ? { gp_package_id: gpId } : {}),
        quantity: String(gpId ? 1 : qty),
        unit_price: String(price),
        unit_type: ln.unit_type === 'packages' ? 'packages' : 'pieces',
        ...(ln.order_line_id ? { order_line: Number(ln.order_line_id) } : {}),
      });
    }
    if (Object.keys(nextLineErrors).length > 0) {
      setLineErrors(nextLineErrors);
      return;
    }

    const topLevelUnitType = cleanLines.length > 0
      ? (cleanLines[0].unit_type === 'packages' ? 'packages' : 'pieces')
      : 'pieces';
    const saleTotal = toNumber(preview?.total_amount) > 0
      ? toNumber(preview.total_amount)
      : cleanLines.reduce((acc, ln) => acc + parseLocaleNumber(ln.quantity) * parseLocaleNumber(ln.unit_price), 0);
    const payload = {
      client: Number(client),
      unit_type: topLevelUnitType,
      sale_lines: cleanLines,
      payment_type: paymentType,
      payment_method: paymentMethod,
      paid_amount: String(resolveSaleSupplementalPaid({
        paymentType,
        paidAmount,
        saleTotal,
        orderPrepaid,
      })),
    };
    if (order) payload.order = Number(order);
    const appliedFromOrder = resolveOrderAppliedAmount(orderPrepaid, saleTotal);
    if (order && appliedFromOrder > 0) {
      payload.order_paid_amount_applied = String(appliedFromOrder);
    }
    if (paymentType === 'partial' && !(parseLocaleNumber(paidAmount) > 0)) {
      setPaidAmountError('Укажите сумму оплаты');
      return;
    }

    setSaving(true);
    try {
      await createSale(payload);
      toast.success('Продажа создана');
      setInventoryRefreshNonce((n) => n + 1);
      onSaved();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка создания продажи'));
    } finally {
      setSaving(false);
    }
  };
  const addLine = useCallback(() => {
    setSaleLines((prev) => {
      const next = [...prev, newEmptySaleLine()];
      setActiveLineIdx(next.length - 1);
      return next;
    });
  }, []);
  const totalFromLines = useMemo(
    () => saleLines.reduce((acc, ln) => acc + (parseLocaleNumber(ln.quantity) * parseLocaleNumber(ln.unit_price)), 0),
    [saleLines],
  );
  const totalAmount = toNumber(preview?.total_amount) > 0 ? toNumber(preview.total_amount) : totalFromLines;
  const paidAmountValue = resolveSaleSupplementalPaid({
    paymentType,
    paidAmount,
    saleTotal: totalAmount,
    orderPrepaid,
  });
  const debtAmountValue = resolveSaleDebtRemaining({
    paymentType,
    paidAmount,
    saleTotal: totalAmount,
    orderPrepaid,
  });
  const saleDate = new Date().toISOString().slice(0, 10);
  const selectedLine = saleLines[activeLineIdx] || null;
  const selectedBatchMeta = useMemo(() => {
    if (!selectedLine?.warehouse_batch || selectedLine.gp_package_id) return null;
    const pool = selectedLine.unit_type === 'packages'
      ? saleAvailableLegacyPackageBatches
      : saleAvailableBatches;
    return pool.find((b) => String(b.id) === String(selectedLine.warehouse_batch)) || null;
  }, [selectedLine, saleAvailableBatches, saleAvailableLegacyPackageBatches]);
  const batchesFilteredForDetail = useMemo(() => {
    if (!selectedLine) return [];
    const base = filteredBatchesByUnitType(selectedLine.unit_type || 'pieces');
    return base.filter((b) => batchMatchesStockFilter(batchStockSearch, b));
  }, [selectedLine, batchStockSearch, filteredBatchesByUnitType]);

  const gpPackagesForDetail = useMemo(() => {
    if (!selectedLine || selectedLine.unit_type !== 'packages') return [];
    const q = batchStockSearch.trim().toLowerCase();
    return gpSalePackages.filter((r) => {
      if (q) {
        const hay = [
          r.product_name, r.productName,
          r.blank_name, r.blankName,
          r.kind, r.package_kind,
          r.label, r.code,
          r.id,
        ].map((x) => (x == null ? '' : String(x))).join(' ').toLowerCase();
        return q.split(/\s+/).every((t) => hay.includes(t));
      }
      return true;
    });
  }, [selectedLine, batchStockSearch, gpSalePackages]);

  const selectedGpPackageMeta = useMemo(() => {
    if (!selectedLine?.gp_package_id) return null;
    return gpSalePackages.find((r) => String(r.id) === String(selectedLine.gp_package_id)) || null;
  }, [selectedLine, gpSalePackages]);

  const selectedLineMaxQty = useMemo(() => {
    if (selectedLine?.gp_package_id && selectedGpPackageMeta && selectedLine.unit_type === 'packages') {
      return 1;
    }
    return maxSaleQtyForBatch(selectedLine, selectedBatchMeta);
  }, [selectedLine, selectedBatchMeta, selectedGpPackageMeta]);

  const selectedGpPiecesInside = useMemo(
    () => (selectedGpPackageMeta ? gpPackagePiecesInside(selectedGpPackageMeta) : 0),
    [selectedGpPackageMeta],
  );

  const isGpSinglePackageLine = Boolean(
    selectedLine?.gp_package_id && selectedLine?.unit_type === 'packages',
  );
  const isFormSubmittable = client
    && saleLines.length > 0
    && saleLines.every((ln) => {
      if (!(
        ln.warehouse_batch
        && parseLocaleNumber(ln.quantity) > 0
        && parseLocaleNumber(ln.unit_price) > 0
      )) return false;
      if (ln.gp_package_id) return true;
      const batchPool = ln.unit_type === 'packages'
        ? saleAvailableLegacyPackageBatches
        : saleAvailableBatches;
      const b = batchPool.find((x) => String(x.id) === String(ln.warehouse_batch));
      const maxQ = maxSaleQtyForBatch(ln, b);
      if (maxQ > 0 && parseLocaleNumber(ln.quantity) > maxQ) return false;
      return true;
    })
    && !!paymentMethod
    && (paymentType !== 'partial' || parseLocaleNumber(paidAmount) > 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sales-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая продажа</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть" disabled={saving}>×</button>
        </div>
        <form className="sales-modal__form" onSubmit={submit}>
          <div className="sales-modal__scroll">
            {(loadingClients || loadingSelect) && <Loading />}
            <section className="sales-modal__section sales-modal__section--top">
              <div>
                <label className="sales-modal__label">Клиент *</label>
                <SearchableSelect
                  value={client}
                  onChange={(v) => {
                    setClient(v != null ? String(v) : '');
                    setOrder('');
                    setSaleLines([newEmptySaleLine()]);
                    setActiveLineIdx(0);
                    setOrderCartError('');
                    setAutoFilledFromOrder(false);
                  }}
                  options={clientOptions}
                  placeholder="Выберите клиента"
                />
                {clientError && <p className="sales-modal__field-error">{clientError}</p>}
              </div>
              <div>
                <label className="sales-modal__label">Заявка</label>
                <SearchableSelect
                  value={order}
                  onChange={(v) => {
                    const nextOrder = v != null ? String(v) : '';
                    setOrder(nextOrder);
                    if (!nextOrder) {
                      setSaleLines((prev) => prev.filter((x) => !x.from_order));
                      setActiveLineIdx(0);
                      setOrderCartError('');
                      setAutoFilledFromOrder(false);
                      setOrderPaymentSnap(null);
                      setOrderPrepaid(0);
                    }
                  }}
                  options={orderOptions}
                  disabled={!client}
                  placeholder={client ? 'Выберите заявку' : 'Сначала выберите клиента'}
                />
                {orderCartLoading && (
                  <p className="sales-modal__hint-line">Загрузка товаров из заявки…</p>
                )}
                {orderCartError && (
                  <p className="sales-modal__field-error">{orderCartError}</p>
                )}
                {autoFilledFromOrder && !orderCartError && (
                  <p className="sales-modal__hint-line">
                    Товары и кол-во из заявки — при необходимости смените партию на складе.
                  </p>
                )}
                {orderPaymentSnap && (
                  <div className="sales-modal__order-pay-banner">
                    <span>
                      Оплата заявки: {orderPaymentTypeLabel(orderPaymentSnap.type)}
                      {orderPaymentSnap.total > 0 ? ` · ${moneySafe(orderPaymentSnap.total)}` : ''}
                    </span>
                    {orderPaymentSnap.paid > 0 && (
                      <span>Уже оплачено: {moneySafe(orderPaymentSnap.paid)}</span>
                    )}
                    {orderPaymentSnap.remainingAtOrder > 0 && (
                      <span>Остаток по заявке: {moneySafe(orderPaymentSnap.remainingAtOrder)}</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="sales-modal__label">Дата</label>
                <input className="sales-modal__readonly" value={saleDate} readOnly />
              </div>
            </section>

            <section className="sales-modal__section sales-modal__section--cart">
              <div className="sales-modal__cart-layout">
                <div className="sales-modal__cart-panel">
                  <div className="sales-modal__line-actions">
                    <h4 className="sales-modal__section-title">Товары</h4>
                    <button
                      type="button"
                      className="btn btn--secondary sales-modal__add-line"
                      onClick={addLine}
                      disabled={saving}
                    >
                      + Добавить
                    </button>
                  </div>
                  {saleLines.length === 0 && (
                    <div className="sales-modal__empty">
                      <p>Добавьте первый товар</p>
                      <button type="button" className="btn btn--secondary" onClick={addLine} disabled={saving}>
                        + Добавить товар
                      </button>
                    </div>
                  )}
                  <div className="sales-modal__cart-list">
                    {saleLines.map((line, idx) => {
                      const selectedBatch = filteredBatchesByUnitType(line.unit_type || 'pieces')
                        .find((b) => String(b.id) === String(line.warehouse_batch));
                      const selectedGpPkg = line.gp_package_id
                        ? gpSalePackages.find((r) => String(r.id) === String(line.gp_package_id))
                        : null;
                      const gpPn = String(selectedGpPkg?.product_name ?? selectedGpPkg?.productName ?? '').trim();
                      const gpLbl = String(selectedGpPkg?.label ?? selectedGpPkg?.code ?? '').trim();
                      const gpKind = selectedGpPkg
                        ? gpPackageKindLabel(selectedGpPkg.kind ?? selectedGpPkg.package_kind ?? '')
                        : '';
                      const gpPkgTitle = selectedGpPkg
                        ? (() => {
                          const parts = [gpPn || null, gpKind || null, (gpLbl && gpLbl !== gpPn) ? gpLbl : null]
                            .filter(Boolean);
                          return parts.length ? parts.join(' · ') : `Упаковка #${selectedGpPkg.id ?? ''}`;
                        })()
                        : null;
                      const title = gpPkgTitle || cartLineTitle(line, selectedBatch, idx);
                      const lineTotal = parseLocaleNumber(line.quantity) * parseLocaleNumber(line.unit_price);
                      const maxL = (line.gp_package_id && selectedGpPkg && line.unit_type === 'packages')
                        ? 1
                        : maxSaleQtyForBatch(line, selectedBatch);
                      const stockHint = (!line.gp_package_id && selectedBatch && maxL > 0)
                        ? `Доступно: ${formatQuantityDisplay(maxL)} ${qtyUnitLabel(line.unit_type || 'pieces')}`
                        : '';
                      const qtyPiecesInside = (line.gp_package_id && selectedGpPkg && line.unit_type === 'packages')
                        ? gpPackagePiecesInside(selectedGpPkg)
                        : 0;
                      return (
                        <button
                          key={`line-row-${idx}`}
                          type="button"
                          className={`sales-modal__cart-item ${idx === activeLineIdx ? 'is-active' : ''} ${lineErrors[idx] ? 'is-error' : ''}`}
                          onClick={() => setActiveLineIdx(idx)}
                        >
                          <div className="sales-modal__cart-item-title">
                            {line.from_order ? '● ' : ''}{title}
                          </div>
                          <div className="sales-modal__cart-item-meta">
                            <div className="sales-modal__cart-item-sub">
                              <span>
                                Кол-во: {(line.gp_package_id && line.unit_type === 'packages')
                                  ? (qtyPiecesInside > 0
                                    ? `1 ${qtyUnitLabel('packages')} (${formatQuantityDisplay(qtyPiecesInside)} шт.)`
                                    : `1 ${qtyUnitLabel('packages')}`)
                                  : `${line.quantity || '0'} ${qtyUnitLabel(line.unit_type || 'pieces')}`}
                              </span>
                              <span>Цена: {moneySafe(line.unit_price)}</span>
                              {stockHint ? (
                                <span className="sales-modal__cart-item-avail">{stockHint}</span>
                              ) : null}
                            </div>
                            <div className="sales-modal__cart-item-total">Итого: {moneySafe(lineTotal)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="sales-modal__line-card">
                  <div className="sales-modal__line-head">
                    <h4 className="sales-modal__section-title">Детали товара</h4>
                  </div>
                  {!selectedLine ? (
                    <p className="sales-modal__hint-line">Выберите позицию из списка слева</p>
                  ) : (
                    <div className="sales-modal__line-editor">
                      {selectedLine.from_order && <span className="sales-modal__tag">Из заявки</span>}

                      {/* Step 1: type toggle */}
                      <div className="sales-modal__type-tabs">
                        <button
                          type="button"
                          className={`sales-modal__type-tab ${(selectedLine.unit_type || 'pieces') === 'pieces' ? 'is-active' : ''}`}
                          onClick={() => setSaleLines((prev) => prev.map((x, i) => (
                            i === activeLineIdx
                              ? { ...x, unit_type: 'pieces', warehouse_batch: '', gp_package_id: undefined, quantity: '' }
                              : x
                          )))}
                        >
                          Неупакованные (штуки)
                        </button>
                        <button
                          type="button"
                          className={`sales-modal__type-tab ${(selectedLine.unit_type || 'pieces') === 'packages' ? 'is-active' : ''}`}
                          onClick={() => setSaleLines((prev) => prev.map((x, i) => (
                            i === activeLineIdx
                              ? { ...x, unit_type: 'packages', warehouse_batch: '', gp_package_id: undefined, quantity: '' }
                              : x
                          )))}
                        >
                          Упакованные (упаковки)
                        </button>
                      </div>

                      {/* Step 2: batch picker */}
                      <input
                        type="search"
                        className="sales-modal__batch-filter-input"
                        value={batchStockSearch}
                        onChange={(e) => setBatchStockSearch(e.target.value)}
                        placeholder="Поиск по товару, заготовке, партии…"
                      />
                      <div className="sales-modal__batch-cards">
                        {/* Legacy FIFO: анонимные упаковки по партии (без GpPackUnit) */}
                        {(selectedLine.unit_type !== 'packages' || batchesFilteredForDetail.length > 0) && batchesFilteredForDetail.map((b) => {
                          const isSelected = String(b.id) === String(selectedLine.warehouse_batch)
                            && !selectedLine.gp_package_id;
                          const avPieces = resolveBatchAvailPieces(b);
                          const avPacks = resolveBatchAvailPackages(b);
                          const kindLabel = batchPackageKindLabel(b?.kind ?? b?.package_kind ?? '');
                          const packCode = b.label ?? b.code ?? '';
                          const pn = String(b.product_name ?? b.productName ?? '').trim();
                          const bn = String(b.blank_name ?? b.blankName ?? b.profile_name ?? '').trim();
                          const displayName = pn || batchLabel(b);
                          return (
                            <button
                              key={String(b.id)}
                              type="button"
                              className={`sales-modal__batch-card${isSelected ? ' is-selected' : ''}`}
                              onClick={() => setSaleLines((prev) => prev.map((x, i) => {
                                if (i !== activeLineIdx) return x;
                                const next = {
                                  ...x,
                                  warehouse_batch: String(b.id),
                                  gp_package_id: undefined,
                                };
                                return {
                                  ...next,
                                  quantity: capQuantityForOrderLine(next, b),
                                };
                              }))}
                            >
                              <div className="sales-modal__batch-card__body">
                                <div className="sales-modal__batch-card__name">{displayName}</div>
                                {bn && <div className="sales-modal__batch-card__sub">{bn}</div>}
                                <div className="sales-modal__batch-card__badges">
                                  {kindLabel && (
                                    <span className="sales-modal__batch-card__badge sales-modal__batch-card__badge--kind">{kindLabel}</span>
                                  )}
                                  {packCode && (
                                    <span className="sales-modal__batch-card__badge">{packCode}</span>
                                  )}
                                </div>
                              </div>
                              <div className="sales-modal__batch-card__stock">
                                {selectedLine.unit_type === 'packages'
                                  ? <><strong>{formatQuantityDisplay(avPacks)}</strong> уп.</>
                                  : <><strong>{formatQuantityDisplay(avPieces)}</strong> шт.</>}
                              </div>
                            </button>
                          );
                        })}

                        {/* GP: available_gp_packages из select-sources */}
                        {selectedLine.unit_type === 'packages' && gpPackagesForDetail.map((r) => {
                          const gpId = String(r.id ?? '');
                          const isSelected = selectedLine.gp_package_id
                            ? String(selectedLine.gp_package_id) === gpId
                            : false;
                          const wbId = r.warehouse_batch_id ?? r.warehouse_batch ?? r.batch_id ?? r.id;
                          const pcs = toNumber(r.total_pieces ?? r.pieces ?? r.piece_count ?? r.pieces_count);
                          const kind = gpPackageKindLabel(r.kind ?? r.package_kind ?? '');
                          const label = r.label ?? r.code ?? '';
                          const productName = String(
                            r.product_name ?? r.productName ?? r.product?.name ?? r.blank_name ?? r.blankName ?? '',
                          ).trim();
                          return (
                            <button
                              key={`gp-${gpId}`}
                              type="button"
                              className={`sales-modal__batch-card sales-modal__batch-card--gp${isSelected ? ' is-selected' : ''}`}
                              onClick={() => setSaleLines((prev) => prev.map((x, i) => (
                                i === activeLineIdx
                                  ? { ...x, warehouse_batch: String(wbId), gp_package_id: gpId, quantity: '1' }
                                  : x
                              )))}
                            >
                              <div className="sales-modal__batch-card__body sales-modal__batch-card__body--row">
                                {kind && (
                                  <span className="sales-modal__batch-card__badge sales-modal__batch-card__badge--kind">{kind}</span>
                                )}
                                {label && (
                                  <span className="sales-modal__batch-card__badge sales-modal__batch-card__badge--label">{label}</span>
                                )}
                                <span className="sales-modal__batch-card__inline-name">{productName || '—'}</span>
                              </div>
                              <div className="sales-modal__batch-card__stock sales-modal__batch-card__stock--gp">
                                <span><strong>1</strong> уп.</span>
                                {pcs > 0 && (
                                  <span className="sales-modal__batch-card__stock-note">{formatQuantityDisplay(pcs)} шт.</span>
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {/* Empty state */}
                        {batchesFilteredForDetail.length === 0
                          && (selectedLine.unit_type !== 'packages' || (gpPackagesForDetail.length === 0 && !gpPackagesLoading)) && (
                          <p className="sales-modal__hint-line">
                            {batchStockSearch.trim()
                              ? 'Нет совпадений — очистите поиск'
                              : selectedLine.unit_type === 'packages'
                                ? 'Нет доступных упаковок'
                                : 'Нет доступных партий'}
                          </p>
                        )}
                        {selectedLine.unit_type === 'packages' && gpPackagesLoading && (
                          <p className="sales-modal__hint-line">Загрузка упаковок…</p>
                        )}
                      </div>
                      {lineErrors[activeLineIdx]?.warehouse_batch && (
                        <p className="sales-modal__field-error">{lineErrors[activeLineIdx].warehouse_batch}</p>
                      )}

                      {/* Step 3: qty + price (shown after batch selected) */}
                      {selectedLine.warehouse_batch && (
                        <div className="sales-modal__qty-price-block">
                          <div className={`sales-modal__qty-price-row${isGpSinglePackageLine ? ' sales-modal__qty-price-row--gp-single' : ''}`}>
                            {isGpSinglePackageLine ? (
                              <div className="sales-modal__qty-price-field">
                                <label className="sales-modal__label">Количество</label>
                                <div className="sales-modal__readonly sales-modal__readonly--qty-fixed">1 уп.</div>
                                {lineErrors[activeLineIdx]?.quantity && (
                                  <p className="sales-modal__field-error">{lineErrors[activeLineIdx].quantity}</p>
                                )}
                              </div>
                            ) : (
                            <div className="sales-modal__qty-price-field">
                              <label className="sales-modal__label">
                                Количество ({qtyUnitLabel(selectedLine.unit_type || 'pieces')})
                              </label>
                              <IntegerInput
                                min={1}
                                max={selectedLineMaxQty > 0 ? selectedLineMaxQty : undefined}
                                value={selectedLine.quantity}
                                onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (
                                  i === activeLineIdx ? { ...x, quantity: v } : x
                                )))}
                              />
                              {selectedLineMaxQty > 0 && (
                                <p className="sales-modal__hint-line sales-modal__hint-line--tight">
                                  Макс: {formatQuantityDisplay(selectedLineMaxQty)} {qtyUnitLabel(selectedLine.unit_type || 'pieces')}
                                </p>
                              )}
                              {lineErrors[activeLineIdx]?.quantity && (
                                <p className="sales-modal__field-error">{lineErrors[activeLineIdx].quantity}</p>
                              )}
                            </div>
                          )}
                          <div className="sales-modal__qty-price-field">
                            <label className="sales-modal__label">Цена за единицу (сом)</label>
                            <input
                              inputMode="decimal"
                              value={selectedLine.unit_price}
                              placeholder="0"
                              onChange={(e) => setSaleLines((prev) => prev.map((x, i) => (
                                i === activeLineIdx ? { ...x, unit_price: e.target.value } : x
                              )))}
                            />
                            {lineErrors[activeLineIdx]?.unit_price && (
                              <p className="sales-modal__field-error">{lineErrors[activeLineIdx].unit_price}</p>
                            )}
                          </div>
                          <div className="sales-modal__qty-price-total">
                            <label className="sales-modal__label">Сумма</label>
                            <span className="sales-modal__qty-price-total__value">
                              {moneySafe(parseLocaleNumber(selectedLine.quantity) * parseLocaleNumber(selectedLine.unit_price))}
                            </span>
                          </div>
                          </div>
                          {isGpSinglePackageLine && selectedGpPiecesInside > 0 && (
                            <p className="sales-modal__hint-line sales-modal__hint-line--below-qty-row">
                              В упаковке: {formatQuantityDisplay(selectedGpPiecesInside)} шт.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedLine && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm sales-modal__delete-btn"
                      onClick={() => {
                        setSaleLines((prev) => prev.filter((_, i) => i !== activeLineIdx));
                      }}
                      disabled={saving}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            </section>
            {submitError && <p className="modal__error">{submitError}</p>}
          </div>
          <div className="modal__actions sales-modal__footer">
            <div className="sales-modal__footer-left">
              <h4 className="sales-modal__footer-title">Оплата</h4>
              <div className="sales-modal__payment-grid">

                {/* Тип + способ — всегда */}
                <div>
                  <label className="sales-modal__label">Тип оплаты</label>
                  <SearchableSelect
                    value={paymentType}
                    onChange={(v) => setPaymentType(v != null ? String(v) : 'full')}
                    options={[
                      { value: 'full', label: 'Полная' },
                      { value: 'partial', label: 'Частичная' },
                      { value: 'debt', label: 'В долг' },
                    ]}
                  />
                </div>
                <div>
                  <label className="sales-modal__label">Способ оплаты</label>
                  <SearchableSelect
                    value={paymentMethod}
                    onChange={(v) => setPaymentMethod(v != null ? String(v) : 'cash')}
                    options={[
                      { value: 'cash', label: 'Наличные' },
                      { value: 'card', label: 'Карта' },
                      { value: 'transfer', label: 'Перевод' },
                    ]}
                  />
                  {paymentMethodError && <p className="sales-modal__field-error">{paymentMethodError}</p>}
                </div>

                {/* Полная: авто, только показываем */}
                {paymentType === 'full' && (
                  <div>
                    <label className="sales-modal__label">Итого к оплате</label>
                    <div className="sales-modal__payment-display">{moneySafe(totalAmount)}</div>
                    <p className="sales-modal__hint-line sales-modal__hint-line--tight">Вся сумма оплачивается сразу</p>
                  </div>
                )}

                {/* Частичная: итого (авто) + оплачено сейчас + остаток */}
                {paymentType === 'partial' && (
                  <>
                    <div>
                      <label className="sales-modal__label">Итого (сумма)</label>
                      <div className="sales-modal__payment-display">{moneySafe(totalAmount)}</div>
                    </div>
                    {orderPaymentSnap && orderPaymentSnap.paid > 0 && (
                      <div>
                        <label className="sales-modal__label">Уже по заявке</label>
                        <div className="sales-modal__payment-display">{moneySafe(orderPaymentSnap.paid)}</div>
                        <p className="sales-modal__hint-line sales-modal__hint-line--tight">
                          К доплате при продаже: {moneySafe(Math.max(0, totalAmount - orderPaymentSnap.paid))}
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="sales-modal__label">Оплачено сейчас</label>
                      <input
                        inputMode="decimal"
                        value={paidAmount}
                        placeholder="0"
                        onChange={(e) => setPaidAmount(e.target.value)}
                      />
                      {paidAmountError && <p className="sales-modal__field-error">{paidAmountError}</p>}
                    </div>
                    <div>
                      <label className="sales-modal__label">Остаток к оплате</label>
                      <div className={`sales-modal__payment-display${debtAmountValue > 0 ? ' is-debt' : ''}`}>
                        {moneySafe(debtAmountValue)}
                      </div>
                    </div>
                  </>
                )}

                {/* В долг: показываем итого как долг */}
                {paymentType === 'debt' && (
                  <div>
                    <label className="sales-modal__label">Сумма долга</label>
                    <div className="sales-modal__payment-display is-debt">{moneySafe(totalAmount)}</div>
                    <p className="sales-modal__hint-line sales-modal__hint-line--tight">Оплата не поступает</p>
                  </div>
                )}
              </div>
            </div>
            <div className="sales-modal__footer-right">
              <div className="sales-modal__summary-card">
                <div className="sales-modal__totals">
                  <div className="sales-modal__totals-count">Товаров: {saleLines.length}</div>
                  <div className="sales-modal__totals-main">{moneySafe(totalAmount)}</div>
                  {paymentType !== 'full' && (
                    <div className="sales-modal__totals-breakdown">
                      <div>
                        <span>Оплачено</span>
                        <span>{moneySafe(paidAmountValue)}</span>
                      </div>
                      <div className={debtAmountValue > 0 ? 'is-debt' : ''}>
                        <span>Долг</span>
                        <span>{moneySafe(debtAmountValue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="sales-modal__buttons-row">
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
                <button type="submit" className="btn btn--primary" disabled={saving || !isFormSubmittable}>
                  {saving ? 'Сохранение…' : 'Создать продажу'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

const SaleDetailsModal = ({ saleId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sale, setSale] = useState(null);
  const [batchMetaMap, setBatchMetaMap] = useState({});
  const [waybillOpen, setWaybillOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getSale(saleId)
      .then((res) => {
        if (!alive) return;
        setSale(res.data || null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getApiErrorMessage(err, 'Не удалось загрузить детали продажи'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [saleId]);

  useEffect(() => {
    let alive = true;
    const lines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];
    if (!sale || lines.length === 0) {
      setBatchMetaMap({});
      return () => { alive = false; };
    }
    getSaleSelectSources({
      unit_type: 'packages',
      client: sale?.client?.id ?? sale?.client ?? undefined,
      page_size: 500,
    })
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        const batches = data.available_warehouse_batches ?? data.warehouse_batches;
        const map = {};
        if (Array.isArray(batches)) {
          batches.forEach((b) => {
            const key = normalizeBatchId(b?.id);
            if (key) map[key] = b;
          });
        }
        setBatchMetaMap(map);
      })
      .catch(() => {
        if (alive) setBatchMetaMap({});
      });
    return () => { alive = false; };
  }, [sale]);

  const lines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];
  const clientName = sale?.client_name || clientLabel(sale?.client);
  const orderText = sale?.order_display
    || (typeof sale?.order === 'object' ? orderLabel(sale.order) : '')
    || '—';
  const paymentStatusText = sale?.payment_status_label || paymentStatusLabel(sale?.payment_status);
  const paymentTypeText = sale?.payment_type_label || paymentTypeLabel(inferPaymentType(sale));
  const paymentMethodText = (() => {
    const lbl = sale?.payment_method_label ?? sale?.payment_method_display;
    if (lbl != null && String(lbl).trim()) return String(lbl).trim();
    return paymentMethodLabel(paymentMethodFromSale(sale));
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide sales-detail-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Детали продажи</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="sales-detail-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && sale && (
            <>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Основа</h4>
                <dl className="sales-detail__dl">
                  <div className="sales-detail__dl-row"><dt>Клиент</dt><dd>{clientName || '—'}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Дата</dt><dd>{formatDate(sale.date || sale.created_at)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Заявка</dt><dd>{orderText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Тип продажи</dt><dd>{sale.unit_type === 'packages' ? 'Упаковки' : 'Штуки'}</dd></div>
                </dl>
              </section>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Оплата</h4>
                <dl className="sales-detail__dl">
                  <div className="sales-detail__dl-row"><dt>Тип оплаты</dt><dd>{paymentTypeText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Способ оплаты</dt><dd>{paymentMethodText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Статус</dt><dd>{paymentStatusText}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Сумма</dt><dd>{toMoney(sale.total_amount)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Оплачено</dt><dd>{toMoney(sale.paid_amount)}</dd></div>
                  <div className="sales-detail__dl-row"><dt>Долг</dt><dd>{toMoney(sale.debt_amount)}</dd></div>
                </dl>
              </section>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Строки продажи</h4>
                {lines.length === 0 ? <p className="sales-detail__muted">Нет строк.</p> : (
                  <div className="commercial-table-wrap">
                    <table className="data-table data-table--order-detail-lines">
                      <thead>
                        <tr>
                          <th>Партия</th>
                          <th className="data-table__cell--num">Количество</th>
                          <th className="data-table__cell--num">Цена</th>
                          <th className="data-table__cell--num">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((ln, i) => {
                          const linePrice = ln.unit_price ?? ln.price;
                          const lineTotal = ln.total_amount ?? ln.line_total;
                          const lineQtyText = saleLineQtyText(sale, ln, batchMetaMap);
                          const rawBatchLabel = ln.warehouse_batch_display
                            || ln.display
                            || ln.batch_display
                            || ln.product_name
                            || ln.profile_name
                            || (ln.length_per_piece != null && ln.length_per_piece !== '' && ln.profile_name
                              && toNumber(ln.length_per_piece) > 0
                              ? `${ln.profile_name} — ${formatQuantityDisplay(ln.length_per_piece)} м`
                              : '')
                            || batchLabel(ln.warehouse_batch);
                          const lineBatchLabel = sanitizeBatchDisplayText(rawBatchLabel) || rawBatchLabel;
                          return (
                            <tr key={ln.id != null ? `ln-${ln.id}` : `ln-${i}`}>
                              <td>{lineBatchLabel || '—'}</td>
                              <td className="data-table__cell--num">{lineQtyText}</td>
                              <td className="data-table__cell--num">{toMoney(linePrice)}</td>
                              <td className="data-table__cell--num">{toMoney(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setWaybillOpen(true)}>Накладная</button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
      {waybillOpen && sale && (
        <WaybillPreviewModal sale={sale} batchMetaMap={batchMetaMap} onClose={() => setWaybillOpen(false)} />
      )}
    </div>
  );
};

const WaybillPreviewModal = ({ sale, batchMetaMap = {}, onClose }) => {
  const printSheetRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waybillData, setWaybillData] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getSaleWaybillData(sale.id)
      .then((res) => {
        if (!alive) return;
        setWaybillData(res.data || null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getApiErrorMessage(err, 'Не удалось загрузить накладную'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [sale.id]);

  const fallbackLines = Array.isArray(sale?.sale_lines) ? sale.sale_lines : [];
  const fallbackBuyer = sale?.client_name || clientLabel(sale?.client) || '—';
  const fallbackTotal = fallbackLines.reduce((acc, ln) => acc + toNumber(ln.total_amount ?? ln.line_total), 0);

  const lines = useMemo(() => {
    if (Array.isArray(waybillData?.sale_lines)) return waybillData.sale_lines;
    return fallbackLines.map((ln) => ({
      name: waybillLineName(ln),
      quantity_display: saleLineQtyText(sale, ln, batchMetaMap),
      unit_price: ln.unit_price ?? ln.price ?? '',
      line_total: ln.total_amount ?? ln.line_total ?? '',
    }));
  }, [waybillData, fallbackLines, sale, batchMetaMap]);

  const buyer = waybillData?.buyer_name || fallbackBuyer;
  const title = waybillData?.title || `Расходная накладная № ${sale.id || '—'} от ________ г.`;
  const total = waybillData?.total ?? formatQuantityDisplay(fallbackTotal);
  const downloadPdf = () => {
    try {
      if (!printSheetRef.current) throw new Error('Нет макета для PDF');
      html2canvas(printSheetRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const renderW = canvas.width * ratio;
        const renderH = canvas.height * ratio;
        const x = (pageWidth - renderW) / 2;
        const y = margin;
        doc.addImage(imgData, 'PNG', x, y, renderW, renderH, undefined, 'FAST');
        doc.save(`nakladnaya-${sale.id}.pdf`);
      }).catch(() => {
        // eslint-disable-next-line no-alert
        alert('Ошибка скачивания PDF');
      });
    } catch {
      // eslint-disable-next-line no-alert
      alert('Ошибка скачивания PDF');
    }
  };

  const renderWaybillCopy = (copyTitle, copyKey) => (
    <section className="waybill-copy" key={copyKey}>
      <h4 className="waybill-copy__title">{title}</h4>
      <p className="waybill-copy__copy-mark">{copyTitle}</p>
      <div className="waybill-copy__meta">
        <p><strong>Поставщик :</strong> {WAYBILL_SUPPLIER_NAME} <strong>тел:</strong> {WAYBILL_SUPPLIER_PHONE}</p>
        <p><strong>Покупатель:</strong> {buyer}</p>
      </div>
      <table className="waybill-copy__table">
        <thead>
          <tr>
            <th>№</th>
            <th>Наименование товара</th>
            <th>Единица измерение</th>
            <th>Цена</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((ln, idx) => {
            const lineTitle = ln?.name || waybillLineName(ln);
            const qtyText = ln?.quantity_display || saleLineQtyText(sale, ln, batchMetaMap);
            const unitPrice = ln?.unit_price ?? ln?.price;
            const lineSum = ln?.line_total ?? ln?.total_amount ?? ln?.line_total;
            return (
              <tr key={`${copyKey}-${ln.id != null ? `wb-line-${ln.id}` : `wb-line-row-${idx}`}`}>
                <td>{idx + 1}</td>
                <td>{lineTitle}</td>
                <td>{qtyText || '—'}</td>
                <td>{unitPrice != null ? formatQuantityDisplay(unitPrice) : '—'}</td>
                <td>{lineSum != null ? formatQuantityDisplay(lineSum) : '—'}</td>
              </tr>
            );
          })}
          <tr className="waybill-copy__total-row">
            <td colSpan={4}>Итого:</td>
            <td>{total != null && total !== '' ? formatQuantityDisplay(total) : '—'}</td>
          </tr>
        </tbody>
      </table>
      <div className="waybill-copy__signatures">
        <div className="waybill-copy__sign-item">
          <span>Отпустил</span>
          <span className="waybill-copy__sign-line" />
        </div>
        <div className="waybill-copy__sign-item">
          <span>Получил</span>
          <span className="waybill-copy__sign-line" />
        </div>
        <div className="waybill-copy__sign-item">
          <span>Место печати</span>
          <span className="waybill-copy__sign-line" />
        </div>
      </div>
    </section>
  );

  return (
    <div className="modal-overlay waybill-preview-modal" onClick={onClose}>
      <div className="modal modal--wide waybill-preview-modal__dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head waybill-preview-modal__head">
          <h3>Накладная</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="waybill-preview-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && (
            <div className="waybill-print-sheet" ref={printSheetRef}>
              {renderWaybillCopy('Экземпляр для клиента', 'client')}
              <div className="waybill-print-sheet__divider" />
              {renderWaybillCopy('Экземпляр для компании', 'company')}
            </div>
          )}
        </div>
        <div className="modal__actions waybill-preview-modal__actions">
          <button type="button" className="btn btn--secondary" onClick={downloadPdf} disabled={loading || !!error}>PDF</button>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>Печать</button>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;
