import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useServerQuery,
  parseLocaleNumber,
  formatQuantityDisplay,
  getApiErrorMessage,
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
} from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
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
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'Оплачено';
  if (k === 'partially_paid') return 'Частично оплачено';
  if (k === 'unpaid') return 'Долг';
  return v || '—';
};

const paymentStatusVariant = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'paid') return 'success';
  if (k === 'partially_paid') return 'warning';
  if (k === 'unpaid') return 'danger';
  return 'default';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => (v != null && v !== '' ? `${formatQuantityDisplay(v)} сом` : '—');
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

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
    o.prepaid_amount,
    o.paid_amount,
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
const resolveOrderAppliedAmount = (orderPrepaid, previewTotal) => {
  const prepaid = toNumber(orderPrepaid);
  const total = toNumber(previewTotal);
  if (!(prepaid > 0) || !(total > 0)) return 0;
  return Math.min(prepaid, total);
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

const batchLabel = (b) => {
  if (!b) return '—';
  const t = (typeof b.display === 'string' && b.display.trim())
    || (typeof b.warehouse_batch_display === 'string' && b.warehouse_batch_display.trim());
  return t || '—';
};
const isGoodBatchForSale = (b) => {
  const quality = String(b?.quality || '').toLowerCase();
  if (quality === 'defect' || quality === 'bad') return false;
  const status = String(b?.status || '').toLowerCase();
  if (status && status !== 'available') return false;
  if (status === 'shipped' || status === 'sold' || status === 'closed') return false;
  return true;
};

const qtyUnitLabel = (unitType) => (unitType === 'packages' ? 'уп.' : 'шт.');
const paymentTypeLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'full') return 'Полная';
  if (k === 'partial') return 'Частичная';
  if (k === 'debt') return 'В долг';
  return v || '—';
};
const paymentMethodLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'cash') return 'Наличные';
  if (k === 'card') return 'Карта';
  if (k === 'transfer') return 'Перевод';
  return v || '—';
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
  if (pieces != null && pieces !== '' && lengthPerPiece != null && lengthPerPiece !== '') {
    details.push(`${formatQuantityDisplay(pieces)} шт × ${formatQuantityDisplay(lengthPerPiece)} м`);
  } else {
    if (lengthPerPiece != null && lengthPerPiece !== '') details.push(`${formatQuantityDisplay(lengthPerPiece)} м`);
    if (pieces != null && pieces !== '') details.push(`${formatQuantityDisplay(pieces)} шт`);
  }
  if (packages != null && packages !== '') details.push(`${formatQuantityDisplay(packages)} упак`);
  return details.length ? `${base} (${details.join(', ')})` : base;
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
const extractOrderProductLines = (orderDetail) => {
  const source = orderDetail || {};
  const buckets = [
    source.order_lines,
    source.lines,
    source.items,
    source.products,
    source.request_lines,
    source.positions,
  ];
  const raw = buckets.find((x) => Array.isArray(x) && x.length) || [];
  return raw.map((ln, idx) => {
    const profileId = ln?.profile_id ?? ln?.profile?.id ?? ln?.profile ?? null;
    const profileName = ln?.profile_name || ln?.profile_display || ln?.display || '';
    const qty = ln?.quantity ?? ln?.qty ?? ln?.required_quantity ?? '';
    const price = ln?.unit_price ?? ln?.price ?? ln?.sale_price ?? '';
    const unitType = normalizeUnitType(ln?.unit_type || source?.unit_type);
    return {
      id: ln?.id ?? `order-line-${idx}`,
      profile_id: profileId,
      profile_name: profileName,
      quantity: qty != null && qty !== '' ? String(qty) : '',
      unit_price: price != null && price !== '' ? String(price) : '',
      unit_type: unitType,
    };
  });
};

const SalesPage = () => {
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, payment_filter: '' });
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleDetailsId, setSaleDetailsId] = useState(null);

  const apiQuery = useMemo(() => {
    const q = { page: queryState.page, page_size: queryState.page_size };
    if (queryState.payment_filter === 'paid') q.payment_status = 'paid';
    if (queryState.payment_filter === 'debt') q.payment_status = 'unpaid';
    return q;
  }, [queryState]);

  const { items, meta, loading, error, refetch } = useServerQuery('sales/', apiQuery, { enabled: true });
  useOperationalRefetch(['sale', 'payment', 'return', 'order'], refetch, true);

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

      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--sales data-table--row-actions">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Дата</th>
                <th className="data-table__cell--num">Сумма</th>
                <th className="data-table__cell--num">Оплачено</th>
                <th className="data-table__cell--num">Долг</th>
                <th>Статус оплаты</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const clientText = s.client_name || clientLabel(s.client) || s.display;
                return (
                  <tr key={s.id}>
                    <td>{clientText || '—'}</td>
                    <td>{formatDate(s.date || s.created_at)}</td>
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

const CreateSaleModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSelect, setLoadingSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [client, setClient] = useState('');
  const [order, setOrder] = useState('');
  const [paymentType, setPaymentType] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [orderPrepaid, setOrderPrepaid] = useState(0);
  const [saleLines, setSaleLines] = useState([{ warehouse_batch: '', quantity: '', unit_price: '', unit_type: 'pieces' }]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [orderCartLoading, setOrderCartLoading] = useState(false);
  const [orderCartError, setOrderCartError] = useState('');
  const [autoFilledFromOrder, setAutoFilledFromOrder] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
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

  useEffect(() => {
    let alive = true;
    setLoadingSelect(true);
    const params = {};
    if (client) params.client = client;
    if (order) params.order = order;
    getSaleSelectSources(params)
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        const ord = data.available_orders ?? data.orders;
        const bat = data.available_warehouse_batches ?? data.warehouse_batches;
        setOrders(Array.isArray(ord) ? ord : []);
        setBatches(Array.isArray(bat) ? bat : []);
      })
      .catch(() => {
        if (!alive) return;
        setOrders([]);
        setBatches([]);
      })
      .finally(() => {
        if (alive) setLoadingSelect(false);
      });
    return () => { alive = false; };
  }, [client, order]);

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
        cleanLines.push({
          warehouse_batch: wb,
          quantity: String(qty),
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
      if (paymentType === 'partial') {
        const p = parseLocaleNumber(paidAmount);
        if (!(p > 0)) return null;
        payload.paid_amount = String(p);
      }
      if (paymentType === 'debt') payload.paid_amount = '0';
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
  }, [client, order, saleLines, paymentType, paymentMethod, paidAmount]);

  useEffect(() => {
    if (!(orderPrepaid > 0) || !preview) return;
    const total = toNumber(preview.total_amount);
    if (!(total > 0)) return;
    if (orderPrepaid >= total) {
      setPaymentType('full');
      setPaidAmount('');
    } else if (paymentType !== 'partial') {
      setPaymentType('partial');
      setPaidAmount(String(orderPrepaid));
    }
  }, [orderPrepaid, preview, paymentType]);

  const filteredOrders = useMemo(() => {
    if (!client) return [];
    return orders.filter((o) => {
      if (isClosedOrder(o)) return false;
      const oid = o?.client_id ?? o?.client?.id ?? o?.client;
      if (oid == null || oid === '') return true;
      return String(oid) === String(client);
    });
  }, [orders, client]);
  const orderOptions = useMemo(
    () => [{ value: '', label: 'Не выбрана' }, ...filteredOrders.map((o) => ({ value: String(o.id), label: orderLabel(o) }))],
    [filteredOrders],
  );
  const clientOptions = useMemo(
    () => [{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: clientLabel(c) }))],
    [clients],
  );
  const saleAvailableBatches = useMemo(() => {
    const source = batches.filter(isGoodBatchForSale);
    return source
      .filter((b) => toNumber(b.available_pieces) > 0 || toNumber(b.available_packages) > 0)
      .sort((a, b) => {
        const ap = toNumber(a.available_pieces) + toNumber(a.available_packages);
        const bp = toNumber(b.available_pieces) + toNumber(b.available_packages);
        return bp - ap;
      });
  }, [batches]);
  const filteredBatchesByUnitType = useCallback((lineUnitType) => {
    if (lineUnitType === 'packages') {
      return saleAvailableBatches.filter((b) => toNumber(b.available_packages) > 0);
    }
    return saleAvailableBatches.filter((b) => toNumber(b.available_pieces) > 0 || toNumber(b.available_packages) > 0);
  }, [saleAvailableBatches]);
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
    return orderLines.map((ln) => ({
      warehouse_batch: pickBatchForOrderLine(ln, ln.unit_type),
      quantity: ln.quantity,
      unit_price: ln.unit_price,
      unit_type: ln.unit_type || 'pieces',
      order_line_id: ln.id,
      from_order: true,
    }));
  }, [pickBatchForOrderLine]);
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
      setOrderCartLoading(false);
      setOrderCartError('');
      setAutoFilledFromOrder(false);
      return;
    }
    const selected = filteredOrders.find((o) => String(o.id) === String(order));
    const prepaid = orderPrepaidAmount(selected);
    setOrderPrepaid(prepaid);
    if (prepaid > 0) {
      setPaymentType('partial');
      setPaidAmount(String(prepaid));
    }
    setOrderCartLoading(true);
    setOrderCartError('');
    getOrder(order)
      .then((res) => {
        const detail = res?.data || {};
        const autoCart = buildCartFromOrder(detail);
        if (!autoCart || !autoCart.length) {
          setOrderCartError('В заявке нет товарных строк для автокорзины.');
          setAutoFilledFromOrder(false);
          return;
        }
        setSaleLines((prev) => {
          const manualLines = prev.filter((x) => !x.from_order && !isLineEmpty(x));
          return [...autoCart, ...manualLines];
        });
        setActiveLineIdx(0);
        setAutoFilledFromOrder(true);
      })
      .catch((err) => {
        setOrderCartError(getApiErrorMessage(err, 'Не удалось загрузить товары из заявки'));
        setAutoFilledFromOrder(false);
      })
      .finally(() => {
        setOrderCartLoading(false);
      });
  }, [order, filteredOrders, buildCartFromOrder, isLineEmpty]);
  useEffect(() => {
    setSaleLines((prev) => prev.map((line) => {
      const lineBatches = filteredBatchesByUnitType(line.unit_type || 'pieces');
      const allowedBatchIds = new Set(lineBatches.map((b) => String(b.id)));
      if (!line.warehouse_batch) return line;
      return allowedBatchIds.has(String(line.warehouse_batch))
        ? line
        : { ...line, warehouse_batch: '' };
    }));
  }, [filteredBatchesByUnitType]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!client) {
      setFormError('Выберите клиента.');
      return;
    }
    if (!saleLines.length) {
      setFormError('Добавьте хотя бы одну строку.');
      return;
    }

    const cleanLines = [];
    for (let i = 0; i < saleLines.length; i += 1) {
      const ln = saleLines[i];
      const wb = ln.warehouse_batch ? Number(ln.warehouse_batch) : null;
      const qty = parseLocaleNumber(ln.quantity);
      const price = parseLocaleNumber(ln.unit_price);
      if (!wb || !(qty > 0) || !Number.isFinite(price)) {
        setFormError(`Проверьте строку ${i + 1}.`);
        return;
      }
      cleanLines.push({
        warehouse_batch: wb,
        quantity: String(qty),
        unit_price: String(price),
        unit_type: ln.unit_type === 'packages' ? 'packages' : 'pieces',
        ...(ln.order_line_id ? { order_line: Number(ln.order_line_id) } : {}),
      });
    }

    const topLevelUnitType = cleanLines.length > 0
      ? (cleanLines[0].unit_type === 'packages' ? 'packages' : 'pieces')
      : 'pieces';
    const payload = {
      client: Number(client),
      unit_type: topLevelUnitType,
      sale_lines: cleanLines,
      payment_type: paymentType,
      payment_method: paymentMethod,
      paid_amount: paymentType === 'debt' ? '0' : String(paidAmount || ''),
    };
    if (order) payload.order = Number(order);
    const appliedFromOrder = resolveOrderAppliedAmount(orderPrepaid, preview?.total_amount);
    if (order && appliedFromOrder > 0) {
      payload.order_paid_amount_applied = String(appliedFromOrder);
    }
    if (paymentType === 'full') {
      if (preview?.total_amount != null && preview.total_amount !== '') {
        payload.paid_amount = String(preview.total_amount);
      } else {
        delete payload.paid_amount;
      }
    }
    if (paymentType === 'partial' && !(parseLocaleNumber(paidAmount) > 0)) {
      setFormError('Укажите сумму оплаты для частичной оплаты.');
      return;
    }

    setSaving(true);
    try {
      await createSale(payload);
      toast.show('Продажа создана');
      onSaved();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Ошибка создания продажи'));
    } finally {
      setSaving(false);
    }
  };

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
            <section className="sales-modal__section">
              <label className="sales-modal__label">Клиент *</label>
              <SearchableSelect
                value={client}
                onChange={(v) => {
                  setClient(v != null ? String(v) : '');
                  setOrder('');
                  setSaleLines([{ warehouse_batch: '', quantity: '', unit_price: '', unit_type: 'pieces' }]);
                  setActiveLineIdx(0);
                  setOrderCartError('');
                  setAutoFilledFromOrder(false);
                }}
                options={clientOptions}
                placeholder="Выберите клиента"
              />
              <label className="sales-modal__label">Заявка</label>
              <SearchableSelect
                value={order}
                onChange={(v) => {
                  const nextOrder = v != null ? String(v) : '';
                  setOrder(nextOrder);
                  if (!nextOrder) {
                    setSaleLines((prev) => {
                      const lines = prev.filter((x) => !x.from_order);
                      return lines.length ? lines : [{ warehouse_batch: '', quantity: '', unit_price: '', unit_type: 'pieces' }];
                    });
                    setActiveLineIdx(0);
                    setOrderCartError('');
                    setAutoFilledFromOrder(false);
                  }
                }}
                options={orderOptions}
                disabled={!client}
                placeholder={client ? 'Выберите заявку' : 'Сначала выберите клиента'}
              />
              {orderPrepaid > 0 && (
                <p className="sales-modal__hint-line">
                  В заявке уже оплачено: {toMoney(orderPrepaid)}. Тип оплаты и сумма подставлены автоматически.
                </p>
              )}
              {orderCartLoading && <p className="sales-modal__hint-line">Подтягиваем товары из заявки...</p>}
              {!orderCartLoading && orderCartError && <p className="sales-modal__hint-line">{orderCartError}</p>}
              {!orderCartLoading && autoFilledFromOrder && (
                <p className="sales-modal__hint-line">
                  Товары из заявки добавлены в корзину автоматически. Можно добавить свои строки вручную.
                </p>
              )}
            </section>
            <section className="sales-modal__section">
              <h4 className="sales-modal__section-title">Товары</h4>
              <div className="sales-modal__line-actions">
                <button
                  type="button"
                  className="btn btn--secondary sales-modal__add-line"
                  onClick={() => {
                    setSaleLines((prev) => [...prev, { warehouse_batch: '', quantity: '', unit_price: '', unit_type: 'pieces' }]);
                    setActiveLineIdx(saleLines.length);
                  }}
                  disabled={saving}
                >
                  + Товар
                </button>
              </div>
              <div className="sales-modal__cart-layout">
                <div className="sales-modal__cart-list">
                  {saleLines.map((line, idx) => {
                    const title = line.warehouse_batch
                      ? (filteredBatchesByUnitType(line.unit_type || 'pieces')
                        .find((b) => String(b.id) === String(line.warehouse_batch))?.display || `Товар ${idx + 1}`)
                      : `Товар ${idx + 1}`;
                    return (
                      <button
                        key={`line-row-${idx}`}
                        type="button"
                        className={`sales-modal__cart-item ${idx === activeLineIdx ? 'is-active' : ''}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <span>{line.from_order ? '● ' : ''}{title}</span>
                        <span>{line.quantity ? `${line.quantity} ${qtyUnitLabel(line.unit_type || 'pieces')}` : '—'}</span>
                      </button>
                    );
                  })}
                </div>
                {saleLines[activeLineIdx] && (
                  <div className="sales-modal__line-card card">
                    <div className="sales-modal__line-head">
                      {saleLines[activeLineIdx].from_order && <span className="sales-modal__tag">Из заявки</span>}
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          setSaleLines((prev) => {
                            const next = prev.filter((_, i) => i !== activeLineIdx);
                            return next.length ? next : [{ warehouse_batch: '', quantity: '', unit_price: '', unit_type: 'pieces' }];
                          });
                        }}
                        disabled={saving}
                      >
                        ✕
                      </button>
                    </div>
                    <label className="sales-modal__label">Тип продажи</label>
                    <SearchableSelect
                      value={saleLines[activeLineIdx].unit_type || 'pieces'}
                      onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (
                        i === activeLineIdx ? { ...x, unit_type: v != null ? String(v) : 'pieces', warehouse_batch: '' } : x
                      )))}
                      options={[
                        { value: 'pieces', label: 'Штуки' },
                        { value: 'packages', label: 'Упаковки' },
                      ]}
                    />
                    <label className="sales-modal__label">Партия склада</label>
                    <SearchableSelect
                      value={saleLines[activeLineIdx].warehouse_batch}
                      onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (
                        i === activeLineIdx ? { ...x, warehouse_batch: v != null ? String(v) : '' } : x
                      )))}
                      options={[
                        { value: '', label: 'Выберите партию' },
                        ...filteredBatchesByUnitType(saleLines[activeLineIdx].unit_type || 'pieces')
                          .map((b) => ({ value: String(b.id), label: batchLabel(b) })),
                      ]}
                    />
                    <label className="sales-modal__label">Количество</label>
                    <IntegerInput
                      min={1}
                      value={saleLines[activeLineIdx].quantity}
                      onChange={(v) => setSaleLines((prev) => prev.map((x, i) => (
                        i === activeLineIdx ? { ...x, quantity: v } : x
                      )))}
                    />
                    <label className="sales-modal__label">Цена за единицу</label>
                    <input
                      inputMode="decimal"
                      value={saleLines[activeLineIdx].unit_price}
                      onChange={(e) => setSaleLines((prev) => prev.map((x, i) => (
                        i === activeLineIdx ? { ...x, unit_price: e.target.value } : x
                      )))}
                    />
                  </div>
                )}
              </div>
            </section>
            <section className="sales-modal__section">
              <h4 className="sales-modal__section-title">Оплата</h4>
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
              <label className="sales-modal__label">Сумма оплаты</label>
              <input
                inputMode="decimal"
                value={paymentType === 'debt' ? '0' : paidAmount}
                disabled={paymentType === 'full' || paymentType === 'debt'}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder={paymentType === 'full' ? 'Автоматически из общей суммы' : ''}
              />
              {previewLoading && <p className="sales-modal__hint-line">Расчет...</p>}
              {!previewLoading && preview && (
                <p className="sales-modal__hint-line">
                  Итого: {toMoney(preview.total_amount)} | Оплачено: {toMoney(preview.paid_amount)} | Долг: {toMoney(preview.debt_amount)}
                </p>
              )}
              {!previewLoading && previewError && <p className="sales-modal__hint-line">{previewError}</p>}
            </section>
            {formError && <p className="modal__error">{formError}</p>}
          </div>
          <div className="modal__actions sales-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Создать продажу'}
            </button>
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
  const paymentMethodText = sale?.payment_method_label
    || paymentMethodLabel(sale?.payment_method || sale?.last_payment_method || sale?.method);

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
                          const lineBatchLabel = ln.warehouse_batch_display
                            || ln.display
                            || ln.batch_display
                            || ln.product_name
                            || ln.profile_name
                            || (ln.length_per_piece != null && ln.length_per_piece !== '' && ln.profile_name
                              ? `${ln.profile_name} — ${formatQuantityDisplay(ln.length_per_piece)} м`
                              : '')
                            || batchLabel(ln.warehouse_batch);
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
  const supplierLine = waybillData?.supplier_line || '_______________________';
  const phoneLine = waybillData?.phone_line || '_______________________';
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
        <p><strong>Поставщик:</strong> {supplierLine}, тел: {phoneLine}</p>
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
