import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useServerQuery,
  parseLocaleNumber,
  formatQuantityDisplay,
  formatNumberForInput,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
  extractOrderLines,
  orderLineApiId,
} from '../../../../shared/lib';
import { resolveBatchUnitSalePrice } from '../../../production/lib/plasticProfilePricing';
import { useProductLine, PRODUCT_LINE } from '../../../../shared/hooks';
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
  ProductLineTabs,
} from '../../../../shared/ui';
import { useOperationalRefetch, WS_CASH } from '../../../../shared/realtime';
import {
  createSale,
  getSale,
  getSaleSelectSources,
  getSaleWaybillData,
  previewSale,
} from '../../api/salesApi';
import { getClients } from '../../../clients/api/clientsApi';
import SalesFoamTab from '../SalesFoamTab/SalesFoamTab';
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

const parsePayAmount = (raw) => {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) ? n : 0;
};

const appendPayAmountStr = (current, delta) => {
  const next = Math.max(0, parseLocaleNumber(current) + delta);
  return next > 0 ? formatNumberForInput(next) : '';
};

const padPayDigit = (current, key) => {
  const s = String(current ?? '');
  if (key === 'back') return s.length <= 1 ? '' : s.slice(0, -1);
  if (key === 'clear') return '';
  if (key === '.') {
    if (!s) return '0.';
    if (s.includes('.')) return s;
    return `${s}.`;
  }
  if (s === '0') return key;
  return s + key;
};

const HELD_SALES_STORAGE_KEY = 'dias-sale-held-drafts';

const loadHeldSales = () => {
  try {
    const raw = sessionStorage.getItem(HELD_SALES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistHeldSales = (list) => {
  try {
    sessionStorage.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
};

const computeSaleChange = ({ payTab, amountDue, cashReceived, cardReceived }) => {
  const due = toNumber(amountDue);
  const cash = parsePayAmount(cashReceived);
  const card = parsePayAmount(cardReceived);
  if (payTab === 'debt' || due <= 0) return 0;
  if (payTab === 'cash') return Math.max(0, cash - due);
  if (payTab === 'cashless') return 0;
  const cardApplied = Math.min(card, due);
  const cashNeeded = Math.max(0, due - cardApplied);
  return Math.max(0, cash - cashNeeded);
};

const deriveSalePaymentFromCheckout = ({
  payTab,
  cashReceived,
  cardReceived,
  amountDue,
}) => {
  const due = toNumber(amountDue);
  const cash = parsePayAmount(cashReceived);
  const card = parsePayAmount(cardReceived);
  if (payTab === 'debt') {
    return { paymentType: 'debt', paymentMethod: 'cash', paidAmount: 0, received: 0 };
  }
  let received = 0;
  if (payTab === 'cash') received = cash;
  else if (payTab === 'cashless') received = card;
  else received = cash + card;

  let paymentMethod = 'cash';
  if (payTab === 'cashless') paymentMethod = 'card';
  else if (payTab === 'mixed') {
    if (card > 0 && cash <= 0) paymentMethod = 'card';
    else if (cash > 0 && card <= 0) paymentMethod = 'cash';
    else paymentMethod = 'card';
  }

  const paidAmount = due > 0 ? Math.min(received, due) : 0;
  const paymentType = received >= due && due > 0 ? 'full' : 'partial';
  return { paymentType, paymentMethod, paidAmount, received };
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
const cartLineTitle = (line, stockRow, idx) => {
  const pn = String(
    stockRow?.product_name ?? stockRow?.productName ?? line?.profile_name ?? '',
  ).trim();
  if (pn) return pn;
  return `Товар ${idx + 1}`;
};

const mapProfileStockToSaleRow = (row) => {
  if (!row || typeof row !== 'object') return null;
  const batchId = row.warehouse_batch_id ?? row.warehouse_batch ?? row.batch_id;
  if (batchId == null || batchId === '') return null;
  const pieces = Number(row.available_pieces ?? row.pieces) || 0;
  if (pieces <= 0) return null;
  return {
    id: String(batchId),
    profile_id: row.profile_id ?? row.profileId,
    product_name: row.product_name ?? row.profile_name ?? row.name,
    productName: row.product_name ?? row.profile_name ?? row.name,
    available_pieces: pieces,
    unit_sale_price: row.unit_sale_price ?? row.unitSalePrice,
    sale_unit_price: row.unit_sale_price ?? row.unitSalePrice,
  };
};

const normalizeProfileStock = (data) => {
  const raw = data?.profile_stock ?? data?.profileStock;
  if (!Array.isArray(raw)) return [];
  return raw.map(mapProfileStockToSaleRow).filter(Boolean);
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
  return resolveUnpackedPiecesForSale(batch);
};

const formatLineUnitPrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return null;
  return formatNumberForInput(n);
};

const applyAutoUnitPrice = (line, batch, profilesById) => {
  const fromBatch = batch?.unit_sale_price ?? batch?.sale_unit_price;
  if (fromBatch != null && fromBatch !== '') {
    const n = parseLocaleNumber(fromBatch);
    if (Number.isFinite(n) && n > 0) return { ...line, unit_price: String(n) };
  }
  const computed = resolveBatchUnitSalePrice(batch, profilesById);
  if (computed != null && computed > 0) {
    return { ...line, unit_price: formatLineUnitPrice(computed) };
  }
  return { ...line, unit_price: '' };
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

const enrichCartLinesFromOrder = (lines, batches, profilesById) =>
  (lines || []).map((ln) => {
    const batch =
      ln.warehouse_batch && batches?.length
        ? batches.find((b) => String(b.id) === String(ln.warehouse_batch))
        : null;
    const orderQty = ln.quantity != null && ln.quantity !== '' ? String(ln.quantity) : '';
    let next = {
      ...ln,
      unit_type: 'pieces',
      order_quantity: orderQty,
      quantity: capQuantityForOrderLine({ ...ln, order_quantity: orderQty, unit_type: 'pieces' }, batch),
    };
    return applyAutoUnitPrice(next, batch, profilesById);
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
  const [line, setLine] = useProductLine();
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

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="page page--sales commercial-page">
        <ProductLineTabs value={line} onChange={setLine} />
        <SalesFoamTab />
      </div>
    );
  }

  return (
    <div className="page page--sales commercial-page">
      <ProductLineTabs value={line} onChange={setLine} />
      <div className="ds-list-card">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <h2 className="ds-list-card__title">Продажи</h2>
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
                const saleTypeText = 'Штуки';
                return (
                  <tr key={s.id}>
                    <td>{clientText || '—'}</td>
                    <td>{formatDate(s.date || s.created_at)}</td>
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
      </div>

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
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [lineErrors, setLineErrors] = useState({});
  const [clientError, setClientError] = useState('');
  const [paymentMethodError, setPaymentMethodError] = useState('');
  const [paidAmountError, setPaidAmountError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [profileStock, setProfileStock] = useState([]);

  const { items: profileItems } = useServerQuery(
    'plastic-profiles/',
    { page: 1, page_size: 500, ordering: 'name' },
    { enabled: true },
  );
  const profilesById = useMemo(() => {
    const m = new Map();
    (profileItems || []).forEach((p) => m.set(String(p.id), p));
    return m;
  }, [profileItems]);
  const [client, setClient] = useState('');
  const [order, setOrder] = useState('');
  const [saleStep, setSaleStep] = useState('goods');
  const [heldSales, setHeldSales] = useState(loadHeldSales);
  const [payTab, setPayTab] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [cardReceived, setCardReceived] = useState('');
  const [cardRef, setCardRef] = useState('');
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
    const n = typeof v === 'number' ? v : parsePayAmount(v);
    return `${n > 0 ? formatQuantityDisplay(n) : '0'} сом`;
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
    const params = {};
    if (client) params.client = client;
    getSaleSelectSources(params)
      .then((mainRes) => {
        if (!alive) return;
        const mainData = mainRes.data || {};
        const ord = mainData.available_orders ?? mainData.orders;
        const bat = mainData.available_warehouse_batches ?? mainData.warehouse_batches;
        setOrders(Array.isArray(ord) ? ord : []);
        setBatches(Array.isArray(bat) ? bat : []);
        setProfileStock(normalizeProfileStock(mainData));
      })
      .catch(() => {
        if (!alive) return;
        setOrders([]);
        setBatches([]);
        setProfileStock([]);
      })
      .finally(() => {
        if (alive) setLoadingSelect(false);
      });
    return () => { alive = false; };
  }, [client, inventoryRefreshNonce]);

  useEffect(() => {
    if (payTab === 'debt') {
      setCashReceived('');
      setCardReceived('');
    }
  }, [payTab]);

  const reloadClients = useCallback(async () => {
    try {
      const res = await getClients({ page: 1, page_size: 500 });
      const data = res.data || {};
      setClients(Array.isArray(data.items) ? data.items : []);
    } catch {
      setClients([]);
    }
  }, []);

  const resetSaleForm = useCallback(() => {
    setSaleLines([newEmptySaleLine()]);
    setActiveLineIdx(0);
    setBatchStockSearch('');
    setPayTab('cash');
    setCashReceived('');
    setCardReceived('');
    setCardRef('');
    setClient('');
    setOrder('');
    setOrderPrepaid(0);
    setOrderPaymentSnap(null);
    setSaleStep('goods');
    setLineErrors({});
    setPaidAmountError('');
    setSubmitError('');
  }, []);

  const snapshotSaleDraft = useCallback(() => ({
    saleDate,
    saleStep,
    client,
    order,
    saleLines,
    activeLineIdx,
    payTab,
    cashReceived,
    cardReceived,
    cardRef,
    orderPrepaid,
    batchStockSearch,
  }), [
    saleDate,
    saleStep,
    client,
    order,
    saleLines,
    activeLineIdx,
    payTab,
    cashReceived,
    cardReceived,
    cardRef,
    orderPrepaid,
    batchStockSearch,
  ]);

  const applySaleDraft = useCallback((draft) => {
    if (!draft) return;
    setSaleDate(draft.saleDate || new Date().toISOString().slice(0, 10));
    setClient(draft.client != null ? String(draft.client) : '');
    setOrder(draft.order != null ? String(draft.order) : '');
    setSaleLines(Array.isArray(draft.saleLines) && draft.saleLines.length
      ? draft.saleLines
      : [newEmptySaleLine()]);
    setActiveLineIdx(Number.isFinite(draft.activeLineIdx) ? draft.activeLineIdx : 0);
    setPayTab(draft.payTab || 'cash');
    setCashReceived(draft.cashReceived || '');
    setCardReceived(draft.cardReceived || draft.nonCashReceived || '');
    setCardRef(draft.cardRef || '');
    setOrderPrepaid(toNumber(draft.orderPrepaid));
    setBatchStockSearch(draft.batchStockSearch || '');
    setSaleStep(draft.saleStep === 'pay' ? 'pay' : 'goods');
  }, []);

  const hasValidSaleLines = useMemo(
    () => saleLines.some((ln) => (
      ln.warehouse_batch
      && parseLocaleNumber(ln.quantity) > 0
      && parseLocaleNumber(ln.unit_price) > 0
    )),
    [saleLines],
  );

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
        if (!wb || !(qty > 0)) return null;
        const linePayload = {
          warehouse_batch: wb,
          quantity: String(qty),
          unit_type: 'pieces',
          ...(ln.order_line_id ? { order_line: Number(ln.order_line_id) } : {}),
        };
        if (Number.isFinite(price) && price > 0) linePayload.unit_price = String(price);
        cleanLines.push(linePayload);
      }
      const lineTotal = cleanLines.reduce(
        (acc, ln) => acc + parseLocaleNumber(ln.quantity) * parseLocaleNumber(ln.unit_price),
        0,
      );
      const amountDue = Math.max(0, lineTotal - resolveOrderAppliedAmount(orderPrepaid, lineTotal));
      const pay = deriveSalePaymentFromCheckout({
        payTab,
        cashReceived,
        cardReceived,
        amountDue,
      });
      if (payTab !== 'debt' && !(pay.received > 0) && amountDue > 0) return null;

      const payload = {
        client: Number(client),
        sale_date: saleDate,
        unit_type: 'pieces',
        sale_lines: cleanLines,
        payment_type: pay.paymentType,
        payment_method: pay.paymentMethod,
        paid_amount: String(pay.paidAmount),
      };
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
  }, [client, order, saleLines, payTab, cashReceived, cardReceived, orderPrepaid, saleDate]);

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

  const saleStockRows = useMemo(() => {
    if (profileStock.length) return profileStock;
    return saleAvailableBatches;
  }, [profileStock, saleAvailableBatches]);

  const filteredBatchesByUnitType = useCallback(
    () => saleStockRows,
    [saleStockRows],
  );
  const pickBatchForOrderLine = useCallback((orderLine) => {
    const list = filteredBatchesByUnitType();
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
      const wb = pickBatchForOrderLine(ln);
      const batch = wb
        ? saleStockRows.find((b) => String(b.id) === String(wb))
        : null;
      let line = {
        warehouse_batch: wb,
        quantity: ln.quantity,
        unit_price: '',
        unit_type: 'pieces',
        profile_id: ln.profile_id,
        profile_name: ln.profile_name,
        ...(lineId != null ? { order_line_id: lineId } : {}),
        from_order: true,
      };
      return applyAutoUnitPrice(line, batch, profilesById);
    });
  }, [pickBatchForOrderLine, saleStockRows, profilesById]);

  const applyOrderPaymentDefaults = useCallback((snap, saleTotal) => {
    if (!snap) return;
    setOrderPrepaid(snap.paid);
    const total = toNumber(saleTotal);
    const dueAtSale = total > 0 ? Math.max(0, total - snap.paid) : 0;
    const dueStr = dueAtSale > 0 ? formatNumberForInput(dueAtSale) : '';

    if (snap.type === 'debt' && snap.paid <= 0) {
      setPayTab('debt');
      setCashReceived('');
      setCardReceived('');
      return;
    }
    if (snap.method === 'card') {
      setPayTab('cashless');
      setCardReceived(dueStr);
      setCashReceived('');
      return;
    }
    setPayTab('cash');
    setCashReceived(dueStr);
    setCardReceived('');
  }, []);

  const applyCartFromOrder = useCallback((orderDetail) => {
    const autoCart = buildCartFromOrder(orderDetail);
    if (!autoCart?.length) {
      setOrderCartError('В заявке нет позиций для продажи.');
      setAutoFilledFromOrder(false);
      return false;
    }
    setSaleLines(enrichCartLinesFromOrder(autoCart, saleStockRows, profilesById));
    setActiveLineIdx(0);
    setAutoFilledFromOrder(true);
    setOrderCartError('');
    return true;
  }, [buildCartFromOrder, saleStockRows, profilesById]);

  useEffect(() => {
    if (!profilesById.size || !saleStockRows.length) return;
    setSaleLines((prev) => prev.map((ln) => {
      if (!ln.warehouse_batch) return ln;
      const batch = saleStockRows.find((b) => String(b.id) === String(ln.warehouse_batch));
      return applyAutoUnitPrice(ln, batch, profilesById);
    }));
  }, [profileItems, saleStockRows, profilesById]);

  useEffect(() => {
    setActiveLineIdx((prev) => {
      if (!saleLines.length) return 0;
      if (prev < 0) return 0;
      if (prev >= saleLines.length) return saleLines.length - 1;
      return prev;
    });
  }, [saleLines]);
  useEffect(() => {
    setSaleLines((prev) =>
      prev.map((line) => {
        const lineBatches = filteredBatchesByUnitType();
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
    e?.preventDefault?.();
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
    const cleanLines = [];
    const nextLineErrors = {};
    for (let i = 0; i < saleLines.length; i += 1) {
      const ln = saleLines[i];
      const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
      const qty = parseLocaleNumber(ln.quantity);
      const price = parseLocaleNumber(ln.unit_price);
      const batch = saleStockRows.find((b) => String(b.id) === String(ln.warehouse_batch));
      const maxQ = maxSaleQtyForBatch(ln, batch);
      if (!wb || !(qty > 0) || !Number.isFinite(price) || !(price > 0)) {
        nextLineErrors[i] = {
          warehouse_batch: !wb ? 'Выберите товар' : '',
          quantity: !(qty > 0) ? 'Введите количество' : '',
          unit_price: !(price > 0) ? 'Нет цены — задайте наценку у профиля' : '',
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
      const linePayload = {
        warehouse_batch: wb,
        quantity: String(qty),
        unit_type: 'pieces',
        ...(ln.order_line_id ? { order_line: Number(ln.order_line_id) } : {}),
      };
      if (Number.isFinite(price) && price > 0) linePayload.unit_price = String(price);
      cleanLines.push(linePayload);
    }
    if (Object.keys(nextLineErrors).length > 0) {
      setLineErrors(nextLineErrors);
      return;
    }

    const saleTotal = toNumber(preview?.total_amount) > 0
      ? toNumber(preview.total_amount)
      : cleanLines.reduce((acc, ln) => acc + parseLocaleNumber(ln.quantity) * parseLocaleNumber(ln.unit_price), 0);
    const amountDue = Math.max(0, saleTotal - resolveOrderAppliedAmount(orderPrepaid, saleTotal));
    const pay = deriveSalePaymentFromCheckout({
      payTab,
      cashReceived,
      cardReceived,
      amountDue,
    });
    if (payTab !== 'debt' && amountDue > 0 && !(pay.received > 0)) {
      setPaidAmountError('Укажите полученную сумму');
      return;
    }
    if ((payTab === 'cashless' || payTab === 'mixed') && !cardRef.trim()) {
      setPaidAmountError('Укажите номер карты или телефон');
      return;
    }
    const payload = {
      client: Number(client),
      sale_date: saleDate,
      unit_type: 'pieces',
      sale_lines: cleanLines,
      payment_type: pay.paymentType,
      payment_method: pay.paymentMethod,
      paid_amount: String(pay.paidAmount),
    };
    if (payTab === 'mixed' && (parsePayAmount(cashReceived) > 0 || parsePayAmount(cardReceived) > 0)) {
      const splits = [];
      if (parsePayAmount(cashReceived) > 0) {
        splits.push({ payment_method: 'cash', amount: String(parsePayAmount(cashReceived)) });
      }
      if (parsePayAmount(cardReceived) > 0) {
        splits.push({ payment_method: 'card', amount: String(parsePayAmount(cardReceived)) });
      }
      if (splits.length) payload.payment_splits = splits;
    }
    if (cardRef.trim()) payload.payment_reference = cardRef.trim();
    if (order) payload.order = Number(order);
    const appliedFromOrder = resolveOrderAppliedAmount(orderPrepaid, saleTotal);
    if (order && appliedFromOrder > 0) {
      payload.order_paid_amount_applied = String(appliedFromOrder);
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
  const amountDue = Math.max(0, totalAmount - resolveOrderAppliedAmount(orderPrepaid, totalAmount));
  const checkoutPay = useMemo(
    () => deriveSalePaymentFromCheckout({
      payTab,
      cashReceived,
      cardReceived,
      amountDue,
    }),
    [payTab, cashReceived, cardReceived, amountDue],
  );
  const totalReceived = checkoutPay.received;
  const remainingPay = Math.max(0, amountDue - totalReceived);
  const changeAmount = computeSaleChange({
    payTab,
    amountDue,
    cashReceived,
    cardReceived,
  });
  const selectedLine = saleLines[activeLineIdx] || null;

  const holdCurrentSale = useCallback(() => {
    if (!hasValidSaleLines) {
      toast.error('Добавьте хотя бы один товар с количеством');
      return;
    }
    const linesCount = saleLines.filter((ln) => ln.warehouse_batch).length;
    const c = clients.find((x) => String(x.id) === String(client));
    const label = `${linesCount} поз. · ${moneySafe(totalAmount)}${c ? ` · ${clientLabel(c)}` : ''}`;
    const entry = { id: Date.now(), label, draft: snapshotSaleDraft() };
    setHeldSales((prev) => {
      const next = [...prev, entry];
      persistHeldSales(next);
      return next;
    });
    toast.success('Продажа отложена');
    resetSaleForm();
  }, [
    hasValidSaleLines,
    saleLines,
    clients,
    client,
    moneySafe,
    totalAmount,
    snapshotSaleDraft,
    resetSaleForm,
    toast,
  ]);

  const restoreHeldSale = useCallback((heldId) => {
    const entry = heldSales.find((h) => h.id === heldId);
    if (!entry) return;
    applySaleDraft(entry.draft);
    setHeldSales((prev) => {
      const next = prev.filter((h) => h.id !== heldId);
      persistHeldSales(next);
      return next;
    });
    toast.success('Отложка восстановлена');
  }, [heldSales, applySaleDraft, toast]);

  const discardHeldSale = useCallback((heldId, e) => {
    e?.stopPropagation();
    setHeldSales((prev) => {
      const next = prev.filter((h) => h.id !== heldId);
      persistHeldSales(next);
      return next;
    });
  }, []);
  const activeLineTitle = selectedLine
    ? cartLineTitle(
      selectedLine,
      saleStockRows.find((b) => String(b.id) === String(selectedLine.warehouse_batch)),
      activeLineIdx,
    )
    : '';
  const selectedBatchMeta = useMemo(() => {
    if (!selectedLine?.warehouse_batch) return null;
    return saleStockRows.find((b) => String(b.id) === String(selectedLine.warehouse_batch)) || null;
  }, [selectedLine, saleStockRows]);
  const batchesFilteredForDetail = useMemo(() => {
    if (!selectedLine) return [];
    return filteredBatchesByUnitType().filter((b) => batchMatchesStockFilter(batchStockSearch, b));
  }, [selectedLine, batchStockSearch, filteredBatchesByUnitType]);

  const stockPickerRows = useMemo(() => {
    const map = new Map();
    batchesFilteredForDetail.forEach((b) => {
      const profileKey = String(b.profile_id ?? b.product_id ?? b.id);
      const pcs = resolveUnpackedPiecesForSale(b);
      if (pcs <= 0) return;
      const name = String(b.product_name ?? b.productName ?? '').trim() || '—';
      const prev = map.get(profileKey);
      if (!prev) {
        map.set(profileKey, { profileKey, name, totalPieces: pcs, pickBatch: b });
        return;
      }
      prev.totalPieces += pcs;
      const prevPcs = resolveUnpackedPiecesForSale(prev.pickBatch);
      if (pcs > prevPcs) prev.pickBatch = b;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [batchesFilteredForDetail]);

  const adjustActiveLineQty = useCallback((delta) => {
    setSaleLines((prev) => prev.map((x, i) => {
      if (i !== activeLineIdx) return x;
      const batch = saleStockRows.find((b) => String(b.id) === String(x.warehouse_batch));
      const maxQ = maxSaleQtyForBatch(x, batch);
      const cur = Math.floor(parseLocaleNumber(x.quantity)) || 0;
      let next = (cur || 0) + delta;
      if (next < 1) next = 1;
      if (maxQ > 0 && next > maxQ) next = maxQ;
      return { ...x, quantity: String(next) };
    }));
  }, [activeLineIdx, saleStockRows]);

  const selectedLineQty = Math.floor(parseLocaleNumber(selectedLine?.quantity)) || 0;

  const selectedLineMaxQty = useMemo(
    () => maxSaleQtyForBatch(selectedLine, selectedBatchMeta),
    [selectedLine, selectedBatchMeta],
  );

  const isFormSubmittable = client
    && saleDate
    && saleLines.length > 0
    && saleLines.every((ln) => {
      if (!(
        ln.warehouse_batch
        && parseLocaleNumber(ln.quantity) > 0
        && parseLocaleNumber(ln.unit_price) > 0
      )) return false;
      const b = saleStockRows.find((x) => String(x.id) === String(ln.warehouse_batch));
      const maxQ = maxSaleQtyForBatch(ln, b);
      if (maxQ > 0 && parseLocaleNumber(ln.quantity) > maxQ) return false;
      return true;
    })
    && (payTab === 'debt' || amountDue === 0 || totalReceived > 0)
    && (payTab === 'cash' || payTab === 'debt' || cardRef.trim());

  const modalContent = (
    <div className="sales-screen-overlay" onClick={onClose}>
      <div className="sales-screen" onClick={(ev) => ev.stopPropagation()}>
        <header className="sales-screen__head sales-screen__head--slim">
          <h1 className="sales-screen__title">Новая продажа</h1>
          <nav className="sale-wizard__steps" aria-label="Этапы">
            <button
              type="button"
              className={`sale-wizard__step${saleStep === 'goods' ? ' is-active' : ''}${hasValidSaleLines ? ' is-done' : ''}`}
              onClick={() => setSaleStep('goods')}
            >
              1. Товары
            </button>
            <button
              type="button"
              className={`sale-wizard__step${saleStep === 'pay' ? ' is-active' : ''}`}
              disabled={!hasValidSaleLines}
              onClick={() => hasValidSaleLines && setSaleStep('pay')}
            >
              2. Оплата
            </button>
            {heldSales.length > 0 && (
              <span className="sale-wizard__held-badge">{heldSales.length} отлож.</span>
            )}
          </nav>
          <label className="sales-screen__date-wrap" htmlFor="sale-date-input">
            <span className="sales-screen__date-label">Дата</span>
            <input
              id="sale-date-input"
              type="date"
              className="sales-modal__date-input"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="sales-screen__close"
            onClick={onClose}
            aria-label="Закрыть"
            disabled={saving}
          >
            ×
          </button>
        </header>

        <div className="sales-screen__form sales-modal__form">
          {saleStep === 'goods' && (
          <div className="sales-workspace">
            {(loadingClients || loadingSelect) && <Loading />}
            <aside className="sales-cart">
              <div className="sales-cart__head">
                <span className="sales-cart__title">Товары</span>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={addLine}
                  disabled={saving}
                >
                  +
                </button>
              </div>
              {saleLines.length === 0 ? (
                <p className="sales-cart__empty">+ добавить товар</p>
              ) : (
                <div className="sales-cart__list">
                  {saleLines.map((line, idx) => {
                    const selectedBatch = filteredBatchesByUnitType()
                      .find((b) => String(b.id) === String(line.warehouse_batch));
                    const title = cartLineTitle(line, selectedBatch, idx);
                    const lineTotal = parseLocaleNumber(line.quantity) * parseLocaleNumber(line.unit_price);
                    const unitP = parseLocaleNumber(line.unit_price);
                    return (
                      <button
                        key={`line-row-${idx}`}
                        type="button"
                        className={`sales-cart__item${idx === activeLineIdx ? ' is-active' : ''}${lineErrors[idx] ? ' is-error' : ''}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <span className="sales-cart__item-name">
                          {line.from_order ? '● ' : ''}{title}
                        </span>
                        <span className="sales-cart__item-meta">
                          {line.quantity || '0'} шт · {moneySafe(lineTotal)}
                          {unitP > 0 ? ` · ${formatNumberForInput(unitP)}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="sales-editor">
              <div className="sales-editor__toolbar">
                <div className="sales-editor__toolbar-main">
                  <span className="sales-editor__toolbar-label">Позиция</span>
                  <strong className="sales-editor__toolbar-title">
                    {activeLineTitle || '—'}
                  </strong>
                  {selectedLine?.from_order && <span className="sales-modal__tag">Заявка</span>}
                </div>
                {selectedLine && (
                  <button
                    type="button"
                    className="sales-editor__remove"
                    onClick={() => {
                      setSaleLines((prev) => {
                        const next = prev.filter((_, i) => i !== activeLineIdx);
                        return next.length ? next : [newEmptySaleLine()];
                      });
                    }}
                    disabled={saving}
                  >
                    Удалить
                  </button>
                )}
              </div>

              {!selectedLine ? (
                <p className="sales-editor__placeholder">Выберите позицию слева</p>
              ) : (
                <>
                  <input
                    type="search"
                    className="sales-editor__search"
                    value={batchStockSearch}
                    onChange={(e) => setBatchStockSearch(e.target.value)}
                    placeholder="Поиск по товару…"
                  />
                  <div className="sales-editor__stock">
                    {stockPickerRows.map((row) => {
                      const b = row.pickBatch;
                      const isSelected = String(b.id) === String(selectedLine.warehouse_batch);
                      const displayPcs = isSelected
                        ? resolveUnpackedPiecesForSale(b)
                        : row.totalPieces;
                      return (
                        <button
                          key={row.profileKey}
                          type="button"
                          className={`sales-stock-card${isSelected ? ' is-selected' : ''}`}
                          onClick={() => setSaleLines((prev) => prev.map((x, i) => {
                            if (i !== activeLineIdx) return x;
                            let next = {
                              ...x,
                              unit_type: 'pieces',
                              warehouse_batch: String(b.id),
                              gp_package_id: undefined,
                            };
                            next = applyAutoUnitPrice(next, b, profilesById);
                            return {
                              ...next,
                              quantity: capQuantityForOrderLine(next, b),
                            };
                          }))}
                        >
                          <span className="sales-stock-card__name">{row.name}</span>
                          <span className="sales-stock-card__qty">{formatQuantityDisplay(displayPcs)} шт</span>
                        </button>
                      );
                    })}
                    {stockPickerRows.length === 0 && (
                      <p className="sales-editor__placeholder">
                        {batchStockSearch.trim() ? 'Нет совпадений' : 'Нет товара на складе'}
                      </p>
                    )}
                  </div>
                  {lineErrors[activeLineIdx]?.warehouse_batch && (
                    <p className="sales-modal__field-error">{lineErrors[activeLineIdx].warehouse_batch}</p>
                  )}

                  {selectedLine.warehouse_batch && (
                    <div className="sales-editor__qtybar">
                      <div className="sales-editor__qtybar-field">
                        <span className="sales-editor__qtybar-label">Кол-во</span>
                        <div className="sales-qty-stepper sales-qty-stepper--touch">
                          <button
                            type="button"
                            className="sales-qty-stepper__btn"
                            aria-label="Уменьшить"
                            onClick={() => adjustActiveLineQty(-1)}
                            disabled={saving || selectedLineQty <= 1}
                          >
                            −
                          </button>
                          <IntegerInput
                            className="sales-qty-stepper__input"
                            min={1}
                            max={selectedLineMaxQty > 0 ? selectedLineMaxQty : undefined}
                            value={selectedLine.quantity}
                            onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (
                              i === activeLineIdx ? { ...x, quantity: v } : x
                            )))}
                          />
                          <button
                            type="button"
                            className="sales-qty-stepper__btn"
                            aria-label="Увеличить"
                            onClick={() => adjustActiveLineQty(1)}
                            disabled={
                              saving
                              || (selectedLineMaxQty > 0 && selectedLineQty >= selectedLineMaxQty)
                            }
                          >
                            +
                          </button>
                        </div>
                        {selectedLineMaxQty > 0 && (
                          <span className="sales-editor__qtybar-max">
                            макс {formatQuantityDisplay(selectedLineMaxQty)}
                          </span>
                        )}
                      </div>
                      <div className="sales-editor__qtybar-sum">
                        <span className="sales-editor__qtybar-label">Сумма</span>
                        <strong>
                          {moneySafe(parseLocaleNumber(selectedLine.quantity) * parseLocaleNumber(selectedLine.unit_price))}
                        </strong>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
          )}

          {saleStep === 'goods' && (
            <div className="sale-wizard__bar">
              {heldSales.length > 0 && (
                <div className="sale-wizard__held-list">
                  {heldSales.map((h) => (
                    <div key={h.id} className="sale-wizard__held-chip">
                      <button type="button" onClick={() => restoreHeldSale(h.id)}>
                        {h.label}
                      </button>
                      <button
                        type="button"
                        className="sale-wizard__held-discard"
                        aria-label="Удалить отложку"
                        onClick={(e) => discardHeldSale(h.id, e)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="sale-wizard__bar-actions">
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={holdCurrentSale}
                  disabled={saving || !hasValidSaleLines}
                >
                  Отложить
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving || !hasValidSaleLines}
                  onClick={() => setSaleStep('pay')}
                >
                  К оплате →
                </button>
              </div>
            </div>
          )}

          {saleStep === 'pay' && (
          <section className="sale-pay">
            <div className="sale-pay__body">
            <div className="sale-pay__meter">
              <div className="sale-pay__meter-item">
                <span>К оплате</span>
                <strong>{moneySafe(amountDue)}</strong>
              </div>
              <div className="sale-pay__meter-item">
                <span>Получено</span>
                <strong>{moneySafe(totalReceived)}</strong>
              </div>
              <div className="sale-pay__meter-item">
                <span>Осталось</span>
                <strong className={remainingPay > 0 ? 'is-warn' : ''}>{moneySafe(remainingPay)}</strong>
              </div>
              <div className="sale-pay__meter-item">
                <span>Сдача</span>
                <strong className={changeAmount > 0 ? 'is-ok' : ''}>{moneySafe(changeAmount)}</strong>
              </div>
            </div>

            <div className="sale-pay__client-block">
              <label className="sale-pay__input-label">Клиент *</label>
              <SearchableSelect
                value={client}
                onChange={(v) => setClient(v != null ? String(v) : '')}
                options={clientOptions.filter((o) => o.value !== '')}
                placeholder="Выберите клиента"
              />
              {clientError && <p className="sales-modal__field-error">{clientError}</p>}
            </div>

            <div className="sale-pay__tabs" role="tablist">
              {[
                { id: 'cash', label: 'Наличная' },
                { id: 'cashless', label: 'Безналичная' },
                { id: 'mixed', label: 'Смешанная' },
                { id: 'debt', label: 'В долг' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={payTab === tab.id}
                  className={`sale-pay__tab${payTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setPayTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {payTab === 'cash' && (
              <div className="sale-pay__panel sale-pay__panel--cash">
                <div className="sale-pay__col">
                  <label className="sale-pay__input-label">Наличные</label>
                  <input
                    inputMode="decimal"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                  />
                  <div className="sale-pay__numpad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="sale-pay__numpad-key"
                        onClick={() => setCashReceived((v) => padPayDigit(v, k === 'back' ? 'back' : k))}
                      >
                        {k === 'back' ? '⌫' : k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {payTab === 'cashless' && (
              <div className="sale-pay__panel sale-pay__panel--card">
                <div className="sale-pay__col">
                  <label className="sale-pay__input-label">Сумма по карте</label>
                  <input
                    inputMode="decimal"
                    value={cardReceived}
                    onChange={(e) => setCardReceived(e.target.value)}
                    placeholder="0"
                  />
                  <label className="sale-pay__input-label">Карта или телефон *</label>
                  <input
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Номер карты или +996 …"
                  />
                </div>
              </div>
            )}

            {payTab === 'mixed' && (
              <div className="sale-pay__panel sale-pay__panel--mixed">
                <div className="sale-pay__col">
                  <label className="sale-pay__input-label">Наличные</label>
                  <input
                    inputMode="decimal"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="sale-pay__col">
                  <label className="sale-pay__input-label">По карте</label>
                  <input
                    inputMode="decimal"
                    value={cardReceived}
                    onChange={(e) => setCardReceived(e.target.value)}
                    placeholder="0"
                  />
                  <label className="sale-pay__input-label">Карта или телефон *</label>
                  <input
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Номер карты или +996 …"
                  />
                </div>
              </div>
            )}

            {payTab === 'debt' && (
              <p className="sale-pay__debt-hint">
                Вся сумма {moneySafe(amountDue)} уйдёт в долг клиента. Оплата сейчас не принимается.
              </p>
            )}

            {paidAmountError && <p className="sales-modal__field-error">{paidAmountError}</p>}
            {submitError && <p className="modal__error">{submitError}</p>}
            </div>

            <div className="sale-pay__foot">
              {heldSales.length > 0 && (
                <div className="sale-wizard__held-list sale-pay__held-list">
                  {heldSales.map((h) => (
                    <div key={h.id} className="sale-wizard__held-chip">
                      <button type="button" onClick={() => restoreHeldSale(h.id)}>
                        {h.label}
                      </button>
                      <button
                        type="button"
                        className="sale-wizard__held-discard"
                        aria-label="Удалить отложку"
                        onClick={(e) => discardHeldSale(h.id, e)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="sale-pay__actions">
                <button type="button" className="btn btn--secondary" onClick={() => setSaleStep('goods')} disabled={saving}>
                  ← Товары
                </button>
                <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={holdCurrentSale}
                  disabled={saving || !hasValidSaleLines}
                >
                  Отложить
                </button>
                {payTab !== 'debt' && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={saving || amountDue <= 0}
                    onClick={() => {
                      const exact = formatNumberForInput(amountDue);
                      if (payTab === 'cash') {
                        setCashReceived(exact);
                      } else if (payTab === 'cashless') {
                        setCardReceived(exact);
                      } else {
                        const cardPart = parsePayAmount(cardReceived);
                        const cashPart = Math.max(0, amountDue - cardPart);
                        setCashReceived(cashPart > 0 ? formatNumberForInput(cashPart) : '');
                        if (cardPart <= 0) setCardReceived(exact);
                      }
                    }}
                  >
                    Без сдачи
                  </button>
                )}
                <button
                  type="button"
                  className="btn sale-pay__submit"
                  disabled={saving || !isFormSubmittable || previewLoading}
                  onClick={submit}
                >
                  {saving ? 'Сохранение…' : 'Оплата'}
                </button>
              </div>
            </div>
          </section>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
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
