import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './ReturnsPage.scss';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, SearchableSelect, useToast } from '../../../../shared/ui';
import {
  completeReturn,
  createReturn,
  getReturn,
  getReturnSelectSources,
  updateReturn,
} from '../../api/returnsApi';

const TARGETS = [
  { value: 'warehouse', label: 'Склад ГП' },
  { value: 'rework', label: 'На переделку' },
];

const defaultConditionForTarget = (t) => {
  if (t === 'rework') return 'damaged';
  return 'good';
};

/** Нормализация черновых строк после старых значений API */
const normalizeReturnLineFromDoc = (x) => {
  let rt = x.return_target || 'warehouse';
  if (rt === 'defect') rt = 'rework';
  if (!['warehouse', 'rework'].includes(rt)) rt = 'warehouse';
  let ct = x.condition_type || defaultConditionForTarget(rt);
  if (ct === 'defect') ct = 'damaged';
  if (!['good', 'damaged'].includes(ct)) ct = defaultConditionForTarget(rt);
  return { rt, ct };
};

const targetLabel = (code) => TARGETS.find((t) => t.value === code)?.label || code || '—';
const returnStatusLabel = (s) => (s === 'completed' ? 'Проведён' : s === 'canceled' ? 'Отменён' : s === 'draft' ? 'Черновик' : '—');
const returnStatusVariant = (s) => (s === 'completed' ? 'success' : s === 'canceled' ? 'default' : 'warning');

const RETURN_STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'draft', label: 'Черновик' },
  { value: 'completed', label: 'Проведён' },
  { value: 'canceled', label: 'Отменён' },
];

const RETURN_ERROR_TEXT = {
  missing_sale: 'Выберите продажу.',
  invalid_sale_status: 'Продажа недоступна для возврата.',
  missing_lines: 'Добавьте хотя бы одну строку возврата.',
  missing_sale_line: 'Выберите строку продажи.',
  sale_line_not_in_sale: 'Строка продажи не относится к выбранной продаже.',
  invalid_quantity: 'Количество должно быть больше 0.',
  return_quantity_exceeded: 'Количество превышает доступное к возврату.',
  invalid_return_target: 'Выберите корректное направление возврата.',
  invalid_condition_type: 'Выберите корректное состояние.',
  return_status_create_forbidden: 'Нельзя создать возврат сразу в этом статусе.',
  return_status_update_forbidden: 'Статус возврата меняется только действиями.',
  return_update_forbidden: 'Редактирование этого возврата запрещено.',
  return_line_update_forbidden: 'Строки возврата нельзя редактировать.',
  return_already_completed: 'Возврат уже проведён.',
  return_already_canceled: 'Возврат уже отменён.',
  return_complete_failed: 'Не удалось провести возврат.',
  return_rollback_failed: 'Не удалось откатить возврат.',
  warehouse_rollback_negative: 'Отмена невозможна: отрицательный остаток на складе.',
  downstream_used: 'Нельзя отменить возврат: downstream-операции уже использованы.',
  refund_payment_exists: 'Нельзя отменить возврат: уже есть активный возврат денег.',
  no_lines: 'Добавьте строки возврата.',
  delete_disabled: 'Удаление возвратов отключено.',
};

const returnErrorMessage = (e, fallback) => {
  const code = String(e?.response?.data?.code || '').toLowerCase();
  if (RETURN_ERROR_TEXT[code]) return RETURN_ERROR_TEXT[code];
  return getApiErrorMessage(e, fallback);
};

const downstreamTypeLabel = (raw) => {
  const k = String(raw || '').toLowerCase().replace(/-/g, '_');
  const map = {
    warehouse_batch: 'Склад',
    rework_warehouse_batch: 'Переделанные (склад)',
    defect_record: 'Брак',
    rework_request: 'Переделка',
    return: 'Возврат',
    sale: 'Продажа',
    payment: 'Оплата',
  };
  return map[k] || '—';
};

const selectSourcesBucket = (res) => {
  const bucket = res.data?.items;
  if (bucket != null && typeof bucket === 'object' && !Array.isArray(bucket)) return bucket;
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
  return {};
};

const sourceArray = (data, keys) => {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const firstText = (...values) => {
  for (const v of values) {
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

const saleProductsText = (s) => {
  const direct = firstText(s?.product_name, s?.product, s?.primary_product);
  if (direct) return direct;
  const lines = Array.isArray(s?.sale_lines) ? s.sale_lines : Array.isArray(s?.lines) ? s.lines : [];
  return lines
    .map((ln) => firstText(ln?.product_name, ln?.product, ln?.profile_name, ln?.warehouse_batch_display))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
};

const saleListLabel = (s) => {
  if (!s) return '—';
  const fallback = firstText(s.label, s.display, s.sale_display, s.number);
  const saleNo = firstText(s.sale_number, s.number, s.id);
  const date = firstText(s.date, s.created_at).slice(0, 10);
  const client = firstText(s.client_name, s.client?.name);
  const total = s.total_amount ?? s.total ?? s.amount ?? s.sum;
  const totalPart = total != null && total !== '' ? `${formatQuantityDisplay(total)} сом` : '';
  const prod = saleProductsText(s);
  const parts = [];
  if (saleNo) parts.push(`№${saleNo}`);
  if (date) parts.push(date);
  if (client) parts.push(client);
  if (totalPart) parts.push(totalPart);
  if (prod) parts.push(prod);
  return parts.length ? `Продажа ${parts.join(' — ')}` : (fallback || '—');
};

const saleSearchText = (s) => [
  saleListLabel(s),
  s?.label,
  s?.display,
  s?.sale_display,
  s?.sale_number,
  s?.number,
  s?.id,
  s?.date,
  s?.created_at,
  s?.client_name,
  s?.client?.name,
  saleProductsText(s),
  s?.total_amount,
  s?.total,
  s?.amount,
  s?.sum,
].filter((v) => v != null && String(v).trim() !== '').join(' ');

const saleSelectOptions = (sales, salesLoading) => [
  { value: '', label: salesLoading ? 'Загрузка…' : 'Выберите продажу' },
  ...sales.map((s) => ({
    value: String(s.id),
    label: saleListLabel(s),
    searchText: saleSearchText(s),
  })),
];

const findSaleById = (sales, id) => sales.find((s) => String(s.id) === String(id));

const returnTableSaleLabel = (r) => r.sale_display || r.display_sale || '—';

const returnTableClientLabel = (r) => r.client_name || '—';

const returnDisplayLabel = (r) => {
  const raw = r?.display || r?.return_display || r?.return_number || '—';
  return String(raw).replace(/^Возврат\s*/i, '').trim() || '—';
};

const returnRowTargetsLabel = (r) => {
  const lines = Array.isArray(r.lines) ? r.lines : [];
  const codes = [...new Set(lines.map((l) => l.return_target).filter(Boolean))];
  if (codes.length === 0) return '—';
  return codes.map((c) => targetLabel(c)).join(', ');
};

const initialSaleIdFromDoc = (doc) => {
  if (!doc?.id) return '';
  if (doc.sale != null) return String(typeof doc.sale === 'object' ? doc.sale.id : doc.sale);
  if (doc.sale_id != null) return String(doc.sale_id);
  return '';
};

/** Доступно к возврату (шт) — только `returnable_quantity` из ответа API. */
const saleLineReturnableCap = (sl) => {
  if (!sl || sl.returnable_quantity == null || sl.returnable_quantity === '') return null;
  const n = Number(sl.returnable_quantity);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const saleLineSoldQty = (sl) => {
  if (!sl) return null;
  const v = sl.quantity ?? sl.quantity_sold;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const saleLineSelectLabel = (x) => {
  if (!x) return '—';
  if (x.label != null && String(x.label).trim() !== '') return String(x.label).trim();
  const prod = (x.product || x.product_name || '').trim() || '—';
  const sold = saleLineSoldQty(x);
  const cap = saleLineReturnableCap(x);
  const parts = [prod];
  if (sold != null) parts.push(`заказано ${formatQuantityDisplay(sold)}`);
  if (cap != null) parts.push(`доступно ${formatQuantityDisplay(cap)}`);
  return parts.join(' — ');
};

const saleLineProductName = (x) => {
  if (!x) return '';
  return (x.product || x.product_name || x.profile_name || '').trim();
};

const ReturnsPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    client_id: '',
    status: '',
    date_from: '',
    date_to: '',
  });
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [filterClients, setFilterClients] = useState([]);
  const [modalDoc, setModalDoc] = useState(null);
  const [detailDocId, setDetailDocId] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [completeBusy, setCompleteBusy] = useState(false);

  const { items, meta, loading, error, refetch } = useServerQuery('returns/', queryState, { enabled: true });
  useOperationalRefetch(['return', 'defect_record', 'rework_request', 'sale', 'warehouse_batch'], refetch, true);

  const loadRefs = useCallback(() => {
    setSalesLoading(true);
    getReturnSelectSources()
      .then((res) => {
        const data = selectSourcesBucket(res);
        const sourceSales = sourceArray(data, ['sales', 'available_sales', 'returnable_sales', 'items', 'results']);
        setSales(sourceSales);
        setFilterClients(
          sourceSales.length
            ? [...new Map(sourceSales.map((s) => [String(s.client), { id: s.client, name: s.client_name || '—' }])).values()]
            : [],
        );
      })
      .catch(() => setSales([]))
      .finally(() => setSalesLoading(false));
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  useEffect(() => {
    const sid = searchParams.get('sale_id');
    if (!sid || modalDoc != null) return;
    setModalDoc({ initial_sale_id: sid });
    const next = new URLSearchParams(searchParams);
    next.delete('sale_id');
    setSearchParams(next, { replace: true });
  }, [searchParams, modalDoc, setSearchParams]);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReturn(modalDoc.id, payload);
      else await createReturn(payload);
      setModalDoc(null);
      refetch();
      loadRefs();
      toast.show(modalDoc?.id ? 'Возврат обновлён' : 'Черновик сохранён');
    } catch (e) {
      setSubmitError(returnErrorMessage(e, 'Ошибка сохранения возврата'));
    }
  };

  const onComplete = async () => {
    if (!completeTarget?.id || completeBusy) return;
    setSubmitError('');
    setCompleteBusy(true);
    try {
      await completeReturn(completeTarget.id);
      setCompleteTarget(null);
      refetch();
      loadRefs();
      toast.show('Возврат проведён');
    } catch (e) {
      setSubmitError(returnErrorMessage(e, 'Ошибка проведения'));
    } finally {
      setCompleteBusy(false);
    }
  };

  return (
    <div className="page commercial-page page--returns">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <input
            type="text"
            className="ds-toolbar__search"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <SearchableSelect
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[
              { value: '', label: 'Все клиенты' },
              ...filterClients.map((c) => ({ value: String(c.id), label: (c.name || '').trim() || '—' })),
            ]}
          />
          <SearchableSelect
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            placeholder="Статус"
            options={RETURN_STATUS_OPTIONS}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDoc({})}>Создать возврат</button>
        </div>
      </div>
      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет возвратов" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--fixed data-table--row-actions data-table--returns">
          <thead>
            <tr>
              <th>Возврат</th>
              <th>Клиент</th>
              <th>Продажа</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Причина</th>
              <th>Куда вернули</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <button type="button" className="btn btn--ghost" onClick={() => setDetailDocId(r.id)}>
                    {returnDisplayLabel(r)}
                  </button>
                </td>
                <td>{returnTableClientLabel(r)}</td>
                <td>{returnTableSaleLabel(r)}</td>
                <td>{(r.date || r.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td><Badge variant={returnStatusVariant(r.status)}>{returnStatusLabel(r.status)}</Badge></td>
                <td>{r.return_reason || '—'}</td>
                <td>{returnRowTargetsLabel(r)}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={(() => {
                      const menu = [{ label: 'Открыть', onClick: () => setDetailDocId(r.id) }];
                      if (r.status === 'draft') {
                        menu.push(
                          { label: 'Редактировать', onClick: () => setModalDoc(r) },
                          { label: 'Провести', onClick: () => { setCompleteTarget(r); setSubmitError(''); } },
                        );
                      }
                      if (r.status === 'completed') {
                        menu.push(
                          { label: 'Редактировать реквизиты', onClick: () => setModalDoc(r) },
                        );
                      }
                      return menu;
                    })()}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}

      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {modalDoc && (
        <ReturnModal
          doc={modalDoc?.id ? modalDoc : null}
          initialSaleId={modalDoc?.id ? '' : (modalDoc.initial_sale_id || '')}
          sales={sales}
          salesLoading={salesLoading}
          onSubmit={onSubmit}
          onClose={() => { setModalDoc(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
      {detailDocId && (
        <ReturnDetailModal
          returnId={detailDocId}
          onClose={() => setDetailDocId(null)}
          onEdit={(doc) => {
            setDetailDocId(null);
            setModalDoc(doc);
          }}
          onMutate={() => {
            refetch();
            loadRefs();
          }}
        />
      )}
      <ConfirmModal
        open={!!completeTarget}
        title="Провести возврат?"
        message={completeTarget ? `Провести возврат${completeTarget.return_number ? ` «${completeTarget.return_number}»` : ''}? Склад и связанные движения выполнит сервер.` : ''}
        confirmText="Провести"
        confirmBusy={completeBusy}
        onConfirm={onComplete}
        onCancel={() => { if (!completeBusy) { setCompleteTarget(null); setSubmitError(''); } }}
        error={completeTarget ? submitError : undefined}
      />
    </div>
  );
};

const emptyReturnLine = () => ({
  sale_line: '',
  product: '',
  quantity: '',
  return_target: 'warehouse',
  condition_type: 'good',
});

const ReturnModal = ({ doc, initialSaleId = '', sales, salesLoading, onSubmit, onClose, error }) => {
  const isCompletedLimited = doc?.status === 'completed';
  const isDraftEdit = Boolean(doc?.id) && doc?.status === 'draft';
  const saleLocked = isDraftEdit;
  const [sale, setSale] = useState(() => initialSaleIdFromDoc(doc) || (initialSaleId ? String(initialSaleId) : ''));
  const returnDate = (doc?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState(doc?.return_reason || '');
  const [invoiceNumber, setInvoiceNumber] = useState(doc?.invoice_number || '');
  const [lineError, setLineError] = useState('');
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [saleLines, setSaleLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [lines, setLines] = useState(
    Array.isArray(doc?.lines) && doc.lines.length
      ? doc.lines.map((x) => {
        const { rt, ct } = normalizeReturnLineFromDoc(x);
        return {
          sale_line: x.sale_line_id != null ? String(x.sale_line_id) : (x.sale_line != null ? String(typeof x.sale_line === 'object' ? x.sale_line.id : x.sale_line) : ''),
          product: x.product || '',
          quantity: x.quantity != null ? String(x.quantity) : '',
          return_target: rt,
          condition_type: ct,
        };
      })
      : [emptyReturnLine()],
  );

  useEffect(() => {
    if (!sale) {
      setSaleLines([]);
      setLinesLoading(false);
      return undefined;
    }
    let alive = true;
    setLinesLoading(true);
    getReturnSelectSources({ sale_id: sale })
      .then((res) => {
        if (!alive) return;
        const data = selectSourcesBucket(res);
        setSaleLines(sourceArray(data, ['sale_lines', 'lines', 'items', 'results']));
      })
      .catch(() => {
        if (!alive) return;
        setSaleLines([]);
      })
      .finally(() => {
        if (alive) setLinesLoading(false);
      });
    return () => { alive = false; };
  }, [sale]);

  const lineById = useMemo(() => {
    const m = new Map();
    saleLines.forEach((sl) => {
      if (sl?.id != null) m.set(String(sl.id), sl);
    });
    return m;
  }, [saleLines]);

  const applySaleLineSelection = (idx, saleLineId) => {
    const sl = saleLineId ? lineById.get(String(saleLineId)) : null;
    const cap = saleLineReturnableCap(sl);
    setLines((prev) => prev.map((x, i) => {
      if (i !== idx) return x;
      const prod = saleLineProductName(sl);
      const qtyParsed = parseLocaleNumber(x.quantity);
      const qtyNext = cap != null && (!x.quantity || !Number.isFinite(qtyParsed) || qtyParsed > cap)
        ? String(cap)
        : x.quantity;
      return {
        ...x,
        sale_line: saleLineId,
        product: prod,
        quantity: qtyNext,
      };
    }));
  };

  const handleSaleChange = (v) => {
    setLineError('');
    setSale(v);
    setActiveLineIdx(0);
    setLines([emptyReturnLine()]);
  };

  const setReturnTargetAt = (idx, v) => {
    setLines((prev) => prev.map((x, i) => (i === idx
      ? { ...x, return_target: v, condition_type: defaultConditionForTarget(v) }
      : x)));
  };

  useEffect(() => {
    setActiveLineIdx((i) => (lines.length === 0 ? 0 : Math.min(i, Math.max(0, lines.length - 1))));
  }, [lines.length]);

  const selectedSaleLineIds = useMemo(
    () => lines.map((l) => String(l.sale_line || '')).filter(Boolean),
    [lines],
  );
  const hasEmptyCartLine = lines.some((l) => !l.sale_line);
  const hasUnusedSaleLine = saleLines.some((sl) => sl?.id != null && !selectedSaleLineIds.includes(String(sl.id)));

  const hasValidDraftLines = useMemo(() => {
    if (isCompletedLimited) return true;
    const used = new Set();
    return lines.length > 0 && lines.every((l) => {
      const qty = parseLocaleNumber(l.quantity);
      if (!l.sale_line || !l.return_target || !l.condition_type) return false;
      const key = String(l.sale_line);
      if (used.has(key)) return false;
      used.add(key);
      if (!(Number.isFinite(qty) && qty > 0)) return false;
      const sl = lineById.get(String(l.sale_line));
      const cap = saleLineReturnableCap(sl);
      if (cap != null && qty > cap) return false;
      return true;
    });
  }, [lines, isCompletedLimited, lineById]);

  const submitDisabled = isCompletedLimited
    ? false
    : (!sale || salesLoading || linesLoading || !hasValidDraftLines);

  const selectedLine = lines.length > 0 ? lines[Math.min(activeLineIdx, lines.length - 1)] : null;
  const selectedSale = sale ? findSaleById(sales, sale) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide return-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isCompletedLimited ? 'Реквизиты возврата' : doc ? 'Возврат' : 'Новый возврат'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="return-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            setLineError('');
            if (isCompletedLimited) {
              onSubmit({
                return_reason: reason.trim() || undefined,
                invoice_number: invoiceNumber.trim() || undefined,
              });
              return;
            }
            if (!sale) return;
            const payloadLines = [];
            const usedSaleLineIds = new Set();
            for (let i = 0; i < lines.length; i += 1) {
              const l = lines[i];
              const qty = parseLocaleNumber(l.quantity);
              if (!(qty > 0)) continue;
              if (!l.sale_line) {
                setLineError(`Товар ${i + 1}: выберите строку продажи.`);
                return;
              }
              const lineKey = String(l.sale_line);
              if (usedSaleLineIds.has(lineKey)) {
                setLineError(`Товар ${i + 1}: этот товар уже есть в корзине.`);
                return;
              }
              usedSaleLineIds.add(lineKey);
              const sl = l.sale_line ? lineById.get(String(l.sale_line)) : null;
              const cap = saleLineReturnableCap(sl);
              if (cap != null && qty > cap) {
                setLineError(`Товар ${i + 1}: не больше ${formatQuantityDisplay(cap)} шт.`);
                return;
              }
              payloadLines.push({
                sale_line: Number(l.sale_line),
                quantity: String(qty),
                return_target: l.return_target,
                condition_type: l.condition_type,
              });
            }
            if (payloadLines.length === 0) return;
            onSubmit({
              sale: Number(sale),
              date: returnDate,
              return_reason: reason.trim() || undefined,
              invoice_number: invoiceNumber.trim() || undefined,
              lines: payloadLines,
            });
          }}
        >
          <div className="return-modal__scroll">
            {!isCompletedLimited && (
              <section className="return-modal__section return-modal__section--sale">
                <h4 className="return-modal__section-title">Документ</h4>
                <label>Продажа *</label>
                <SearchableSelect
                  value={sale}
                  onChange={handleSaleChange}
                  disabled={saleLocked || salesLoading}
                  options={saleSelectOptions(sales, salesLoading)}
                />
                <p className="return-modal__hint">
                  Ищите по номеру продажи, клиенту, дате, сумме или товару.
                </p>
                {selectedSale ? (
                  <div className="return-modal__selected-sale">
                    {saleListLabel(selectedSale)}
                  </div>
                ) : null}
              </section>
            )}

            {!isCompletedLimited && (
              <section className="return-modal__section return-modal__section--cart">
                <h4 className="return-modal__section-title">Корзина возврата</h4>
                {!sale ? <p className="return-modal__hint">Сначала выберите продажу. Потом добавьте товары, количество и место возврата.</p> : null}
                {linesLoading && sale ? <p className="return-modal__hint">Загрузка товаров продажи…</p> : null}
                {sale ? (
                  <div className="return-modal__cart-layout">
                    <div className="return-modal__cart-panel">
                      <div className="return-modal__cart-head">
                        <span>Товары</span>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          disabled={!sale || linesLoading || hasEmptyCartLine || !hasUnusedSaleLine}
                          onClick={() => {
                            setLines((prev) => {
                              const next = [...prev, emptyReturnLine()];
                              setActiveLineIdx(next.length - 1);
                              return next;
                            });
                          }}
                        >
                          + Добавить
                        </button>
                      </div>
                      <div className="return-modal__cart-list">
                        {lines.map((line, idx) => {
                          const qty = parseLocaleNumber(line.quantity);
                          const qtyPart = Number.isFinite(qty) && qty > 0 ? `${formatQuantityDisplay(qty)} шт` : 'кол-во не указано';
                          const title = (line.product || saleLineProductName(lineById.get(String(line.sale_line))) || '').trim() || `Товар ${idx + 1}`;
                          return (
                            <button
                              key={`ret-cart-${idx}`}
                              type="button"
                              className={`return-modal__cart-item${activeLineIdx === idx ? ' is-active' : ''}`}
                              onClick={() => setActiveLineIdx(idx)}
                            >
                              <span className="return-modal__cart-item-title">{title}</span>
                              <span className="return-modal__cart-item-meta">{targetLabel(line.return_target)} · {qtyPart}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {selectedLine ? (() => {
                      const idx = Math.min(activeLineIdx, lines.length - 1);
                      const line = lines[idx];
                      const sl = line.sale_line ? lineById.get(String(line.sale_line)) : null;
                      const cap = saleLineReturnableCap(sl);
                      const selectedInOtherLines = new Set(
                        lines
                          .map((l, i) => (i === idx ? '' : String(l.sale_line || '')))
                          .filter(Boolean),
                      );
                      const selectableSaleLines = saleLines.filter((x) => !selectedInOtherLines.has(String(x.id)));
                      return (
                        <div className="return-modal__line-detail">
                          <div className="return-modal__line-detail-head">
                            <span className="return-modal__line-detail-title">Товар {idx + 1}</span>
                            {lines.length > 1 ? (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm return-modal__line-remove"
                                onClick={() => {
                                  setLines((prev) => {
                                    const next = prev.filter((_, i) => i !== idx);
                                    setActiveLineIdx((cur) => {
                                      if (next.length === 0) return 0;
                                      if (cur >= idx && cur > 0) return cur - 1;
                                      return Math.min(cur, next.length - 1);
                                    });
                                    return next.length > 0 ? next : [emptyReturnLine()];
                                  });
                                }}
                              >
                                Удалить
                              </button>
                            ) : null}
                          </div>
                          <label>Товар из продажи *</label>
                          <SearchableSelect
                            value={line.sale_line}
                            onChange={(v) => applySaleLineSelection(idx, v)}
                            disabled={linesLoading}
                            options={[
                              { value: '', label: 'Выберите товар' },
                              ...selectableSaleLines.map((x) => ({
                                value: String(x.id),
                                label: saleLineSelectLabel(x),
                              })),
                            ]}
                          />
                          {cap != null ? (
                            <>
                              <label>Доступно к возврату</label>
                              <div className="return-modal__readonly">{`${formatQuantityDisplay(cap)} шт`}</div>
                            </>
                          ) : null}
                          <label>Количество *</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                            placeholder="Сколько вернуть"
                          />
                          <label>Куда вернуть *</label>
                          <SearchableSelect
                            value={line.return_target}
                            onChange={(v) => setReturnTargetAt(idx, v)}
                            options={TARGETS}
                          />
                        </div>
                      );
                    })() : null}
                  </div>
                ) : null}
              </section>
            )}

            <section className="return-modal__section return-modal__section--details">
              <h4 className="return-modal__section-title">Детали</h4>
              <label>Причина возврата</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
              <label>Номер счёта / накладной</label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Необязательно" />
            </section>
            {(lineError || error) ? <p className="modal__error">{lineError || error}</p> : null}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={submitDisabled}>
              {isCompletedLimited ? 'Сохранить' : (doc?.id ? 'Сохранить черновик' : 'Создать черновик')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReturnDetailModal = ({ returnId, onClose, onEdit, onMutate }) => {
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [detailConfirm, setDetailConfirm] = useState(null);
  const [detailConfirmError, setDetailConfirmError] = useState('');

  const reloadDoc = () => {
    getReturn(returnId)
      .then((res) => setDoc(res.data || null))
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getReturn(returnId);
        if (!alive) return;
        setDoc(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(returnErrorMessage(e, 'Не удалось загрузить карточку возврата'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [returnId]);

  const runDetailConfirm = async () => {
    if (!doc || !detailConfirm || actionBusy) return;
    setDetailConfirmError('');
    setActionBusy(true);
    try {
      await completeReturn(doc.id);
      toast.show('Возврат проведён');
      setDetailConfirm(null);
      onMutate?.();
      reloadDoc();
    } catch (e) {
      setDetailConfirmError(returnErrorMessage(e, 'Не удалось провести'));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide return-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка возврата</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error return-detail-modal__error">{error}</p>}
        {!loading && !error && doc && (
          <>
            <div className="return-detail-modal__body">
              <section className="return-detail-modal__section">
                <h4 className="return-detail-modal__section-title">Документ</h4>
                <dl className="return-detail-modal__dl">
                  <div className="return-detail-modal__dl-row"><dt>Номер</dt><dd>{doc.return_number || '—'}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Дата</dt><dd>{(doc.date || doc.created_at || '').toString().slice(0, 10) || '—'}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Клиент</dt><dd>{returnTableClientLabel(doc)}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Продажа</dt><dd>{returnTableSaleLabel(doc)}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Статус</dt><dd>{doc.status === 'completed' ? 'Проведён' : doc.status === 'canceled' ? 'Отменён' : doc.status === 'draft' ? 'Черновик' : '—'}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Причина</dt><dd>{doc.return_reason || '—'}</dd></div>
                  <div className="return-detail-modal__dl-row"><dt>Номер счёта / накладной</dt><dd>{doc.invoice_number && String(doc.invoice_number).trim() ? doc.invoice_number : '—'}</dd></div>
                </dl>
              </section>
              <section className="return-detail-modal__section">
                <h4 className="return-detail-modal__section-title">Последствия</h4>
                {Array.isArray(doc.downstream_links) && doc.downstream_links.length > 0 ? (
                  <div className="commercial-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Тип</th>
                          <th>Номер / описание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.downstream_links.map((x, idx) => (
                          <tr key={x.id || idx}>
                            <td>{downstreamTypeLabel(x.type)}</td>
                            <td>{x.label || x.number || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="return-detail-modal__empty">Последствий пока нет.</p>
                )}
              </section>
              <section className="return-detail-modal__section">
                <h4 className="return-detail-modal__section-title">Строки возврата</h4>
                <div className="commercial-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th className="data-table__cell--num">Количество</th>
                        <th>Куда вернули</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(doc.lines) ? doc.lines : []).map((line, idx) => (
                        <tr key={line.id || idx}>
                          <td>{line.product || '—'}</td>
                          <td className="data-table__cell--num">{formatQuantityDisplay(line.quantity)}</td>
                          <td>{targetLabel(line.return_target)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="return-detail-modal__section">
                <h4 className="return-detail-modal__section-title">Связанные документы</h4>
                {Array.isArray(doc.downstream_links) && doc.downstream_links.some((x) => String(x.type || '').toLowerCase() === 'payment') ? (
                  <div className="commercial-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Тип</th>
                          <th>Документ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.downstream_links
                          .filter((x) => String(x.type || '').toLowerCase() === 'payment')
                          .map((x, idx) => (
                            <tr key={`p-${x.id || idx}`}>
                              <td>Возврат денег</td>
                              <td>{x.label || x.number || '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="return-detail-modal__empty">Нет связанных документов.</p>
                )}
              </section>
            </div>
            <div className="modal__actions">
              {doc.status === 'draft' && (
                <>
                  <button type="button" className="btn btn--primary" disabled={actionBusy} onClick={() => { setDetailConfirmError(''); setDetailConfirm('complete'); }}>
                    Провести
                  </button>
                  <button type="button" className="btn btn--secondary" disabled={actionBusy} onClick={() => onEdit(doc)}>
                    Редактировать
                  </button>
                </>
              )}
              {doc.status === 'completed' && (
                <button type="button" className="btn btn--secondary" disabled={actionBusy} onClick={() => onEdit(doc)}>
                  Редактировать реквизиты
                </button>
              )}
              <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
            </div>
          </>
        )}
        <ConfirmModal
          open={!!detailConfirm}
          title="Провести возврат?"
          message={`Провести возврат${doc?.return_number ? ` «${doc.return_number}»` : ''}? Склад и связанные движения выполнит сервер.`}
          confirmText="Провести"
          confirmBusy={actionBusy}
          onConfirm={runDetailConfirm}
          onCancel={() => { if (!actionBusy) { setDetailConfirm(null); setDetailConfirmError(''); } }}
          error={detailConfirm ? detailConfirmError : undefined}
        />
      </div>
    </div>
  );
};

export default ReturnsPage;
