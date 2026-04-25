import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  cancelReworkRequest,
  completeReworkRequest,
  createReworkRequest,
  getReworkSelectSources,
  startReworkRequest,
  updateReworkRequest,
} from '../../api/reworkRequestsApi';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершено' },
  { value: 'canceled', label: 'Отменено' },
];

const REWORK_DEFECT_SOURCE_LABELS = {
  warehouse: 'Склад',
  return: 'Возврат',
  otk: 'ОТК',
  qc: 'Контроль качества',
  manual: 'Вручную',
};

const isDefectSelectableForRework = (d) => {
  if (!d || typeof d !== 'object') return false;
  if (String(d.status) === 'closed') return false;
  const avail = d.available_quantity_pcs != null && d.available_quantity_pcs !== ''
    ? Number(d.available_quantity_pcs)
    : Number(d.quantity_pcs ?? NaN);
  const qp = Number(d.quantity_pcs ?? 0);
  if (!Number.isFinite(avail) || avail <= 0) return false;
  if (!Number.isFinite(qp) || qp <= 0) return false;
  return true;
};

const defectRecordSelectLabel = (d) => {
  if (!d) return '';
  const name = (d.product || d.profile_name || '').trim() || '—';
  const reason = (d.defect_reason || '').trim() || '—';
  const src = REWORK_DEFECT_SOURCE_LABELS[d.source_type] || d.source_type || '—';
  const pcs = d.available_quantity_pcs ?? d.quantity_pcs;
  if (pcs != null && pcs !== '') {
    return `${name} — ${formatQuantityDisplay(pcs)} шт — ${reason} — ${src}`;
  }
  if (d.quantity_kg != null && d.quantity_kg !== '') {
    return `${name} — ${formatQuantityDisplay(d.quantity_kg)} — ${reason} — ${src}`;
  }
  return `${name} — ${reason} — ${src}`;
};

const statusLabel = (v) => STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';

const statusVariant = (v) => {
  switch (v) {
    case 'pending': return 'warning';
    case 'in_progress': return 'primary';
    case 'completed': return 'success';
    case 'canceled': return 'danger';
    default: return 'default';
  }
};

const pickNestedId = (row, objectKey, idKey) => {
  if (!row) return '';
  if (row[idKey] != null) return String(row[idKey]);
  return '';
};

const returnRefLabel = (r) => {
  if (!r) return '';
  if (r.return_number) return String(r.return_number);
  const parts = [r.date, r.client_name].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return '';
};

const saleRefLabel = (s) => {
  if (!s) return '';
  if (typeof s === 'object') return s.order_number || s.sale_number || '';
  return '';
};

const warehouseBatchShortLabel = (b) => {
  if (!b || typeof b !== 'object') return '—';
  const name = b.product_name || b.product?.name;
  const form = b.inventory_form;
  const parts = [name, form].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
};

const reworkResultLabel = (row, batchById) => {
  const nested = row.result_warehouse_batch;
  if (nested && typeof nested === 'object') {
    const name = nested.product_name || nested.product?.name;
    const form = nested.inventory_form;
    const qty = nested.available_quantity != null ? formatQuantityDisplay(nested.available_quantity) : null;
    const parts = [name, form, qty ? `остаток ${qty}` : null].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  const bid = row.result_warehouse_batch_id;
  if (bid != null && batchById?.has(String(bid))) {
    return warehouseBatchShortLabel(batchById.get(String(bid)));
  }
  return '—';
};

const canStartRework = (s) => s === 'pending';
const canCompleteRework = (s) => s === 'in_progress';
const canCancelRework = (s) => s === 'pending' || s === 'in_progress';

const positiveQuantity = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseLocaleNumber(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const resolveReworkDefectRef = (r, defectById) => {
  if (r.defect_record && typeof r.defect_record === 'object') return r.defect_record;
  const id = r.defect_record_id;
  if (id != null && defectById?.has(String(id))) return defectById.get(String(id));
  return null;
};

/** Количество строки переделки: сначала quantity / quantity_kg > 0, иначе из связанного брака (шт без «кг», если брак в штуках). */
const reworkRowQuantityLabel = (r, defectById) => {
  const def = resolveReworkDefectRef(r, defectById);
  const defPcsRaw = def?.available_quantity_pcs ?? def?.quantity_pcs;
  const defPcs = defPcsRaw != null && defPcsRaw !== '' ? defPcsRaw : null;
  const usesPieces = defPcs != null;

  const rowPcs = positiveQuantity(r.quantity_pcs);
  if (rowPcs != null) {
    return `${formatQuantityDisplay(rowPcs)} шт`;
  }
  const q = positiveQuantity(r.quantity);
  const qKg = positiveQuantity(r.quantity_kg);

  if (q != null) {
    return usesPieces ? `${formatQuantityDisplay(q)} шт` : formatQuantityDisplay(q);
  }
  if (qKg != null) {
    if (usesPieces) {
      return `${formatQuantityDisplay(defPcs)} шт`;
    }
    return formatQuantityDisplay(qKg);
  }
  if (defPcs != null) {
    return `${formatQuantityDisplay(defPcs)} шт`;
  }
  if (def?.quantity_kg != null && def.quantity_kg !== '') {
    return formatQuantityDisplay(def.quantity_kg);
  }
  return '—';
};

const ReworkRequestsPage = ({ onAfterMutation }) => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDoc, setModalDoc] = useState(null);
  const [detailDocId, setDetailDocId] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeOutputQty, setCompleteOutputQty] = useState('');
  const [completeLossQty, setCompleteLossQty] = useState('');
  const [completeQuality, setCompleteQuality] = useState('good');
  const [startTarget, setStartTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [warehouseBatches, setWarehouseBatches] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [defectsList, setDefectsList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [startBusy, setStartBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const { items, meta, raw, loading, error, refetch } = useServerQuery('rework-requests/', queryState, { enabled: true });
  useOperationalRefetch(['rework_request', 'defect_record', 'warehouse_batch'], refetch, true);

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const r = raw;
    const ps = Number(queryState.page_size) || 20;
    if (r && typeof r.count === 'number' && ps > 0) {
      const pages = Math.max(1, Math.ceil(r.count / ps));
      return { page: queryState.page, pages, total: r.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  const batchById = useMemo(() => {
    const m = new Map();
    warehouseBatches.forEach((b) => {
      if (b?.id != null) m.set(String(b.id), b);
    });
    return m;
  }, [warehouseBatches]);

  const defectByIdForReworkQty = useMemo(() => {
    const m = new Map();
    defectsList.forEach((d) => {
      if (d?.id != null) m.set(String(d.id), d);
    });
    return m;
  }, [defectsList]);

  const loadRefs = () => {
    getReworkSelectSources()
      .then((res) => {
        const bucket = res.data?.items;
        const data = bucket != null && typeof bucket === 'object' && !Array.isArray(bucket) ? bucket : null;
        if (!data) {
          setWarehouseBatches([]);
          setReturnsList([]);
          setDefectsList([]);
          setSalesList([]);
          return;
        }
        setWarehouseBatches(Array.isArray(data.result_warehouse_batches) ? data.result_warehouse_batches : []);
        setReturnsList(Array.isArray(data.returns) ? data.returns : []);
        setDefectsList(Array.isArray(data.defect_records) ? data.defect_records : []);
        setSalesList(Array.isArray(data.original_sales) ? data.original_sales : []);
      })
      .catch(() => {
        setWarehouseBatches([]);
        setReturnsList([]);
        setDefectsList([]);
        setSalesList([]);
      });
  };

  useEffect(() => { loadRefs(); }, []);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReworkRequest(modalDoc.id, payload);
      else await createReworkRequest(payload);
      setModalDoc(null);
      await refetch();
      loadRefs();
      onAfterMutation?.();
      toast.show('Запрос переделки сохранен');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения'));
    }
  };

  const onComplete = async () => {
    if (!completeTarget?.id) return;
    const out = parseLocaleNumber(completeOutputQty);
    const loss = parseLocaleNumber(completeLossQty);
    if (!Number.isFinite(out) || out < 0) {
      setSubmitError('Укажите выходное количество');
      return;
    }
    if (!Number.isFinite(loss) || loss < 0) {
      setSubmitError('Укажите количество потерь');
      return;
    }
    setSubmitError('');
    try {
      if (completeQuality !== 'good' && completeQuality !== 'defect') {
        setSubmitError('Выберите качество результата');
        return;
      }
      setCompleteBusy(true);
      await completeReworkRequest(completeTarget.id, {
        output_quantity: String(out),
        loss_quantity: String(loss),
        quality: completeQuality,
      });
      setCompleteTarget(null);
      setCompleteOutputQty('');
      setCompleteLossQty('');
      setCompleteQuality('good');
      await refetch();
      loadRefs();
      onAfterMutation?.();
      toast.show('Переделка завершена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка завершения переделки'));
    } finally {
      setCompleteBusy(false);
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDoc({})}>Создать переделку</button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет запросов переделки" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <>
          <div className="commercial-table-wrap">
            <table className="data-table data-table--fixed data-table--row-actions">
            <thead>
              <tr>
                <th>Номер переделки</th>
                <th>Брак / продукт</th>
                <th className="data-table__cell--num">Количество</th>
                <th>Статус</th>
                <th>Результат</th>
                <th>Комментарий</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const st = r.status;
                const menuItems = [{ label: 'Открыть', onClick: () => setDetailDocId(r.id) }];
                if (canStartRework(st)) {
                  menuItems.push({
                    label: 'Начать',
                    onClick: () => { setStartTarget(r); setSubmitError(''); },
                  });
                  menuItems.push({
                    label: 'Отменить',
                    danger: true,
                    onClick: () => { setCancelTarget(r); setSubmitError(''); },
                  });
                }
                if (canCompleteRework(st)) {
                  menuItems.push({
                    label: 'Завершить',
                    onClick: () => {
                      setCompleteTarget(r);
                      setCompleteOutputQty('');
                      setCompleteLossQty('');
                      setCompleteQuality('good');
                      setSubmitError('');
                    },
                  });
                  menuItems.push({
                    label: 'Отменить',
                    danger: true,
                    onClick: () => { setCancelTarget(r); setSubmitError(''); },
                  });
                }

                return (
                  <tr key={r.id}>
                    <td>
                      <button type="button" className="btn btn--ghost" onClick={() => setDetailDocId(r.id)}>
                        {r.rework_number || '—'}
                      </button>
                    </td>
                    <td>{r.product || '—'}</td>
                    <td className="data-table__cell--num">{reworkRowQuantityLabel(r, defectByIdForReworkQty)}</td>
                    <td><Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></td>
                    <td>{reworkResultLabel(r, batchById)}</td>
                    <td>{r.comment ? String(r.comment) : '—'}</td>
                    <td>
                      {menuItems.length ? (
                        <ActionMenu ariaLabel="Действия" items={menuItems} />
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
        </>
      )}

      {modalDoc && (
        <ReworkModal
          key={modalDoc.id || 'new'}
          doc={modalDoc?.id ? modalDoc : null}
          returnsList={returnsList}
          defectsList={defectsList}
          salesList={salesList}
          onSubmit={onSubmit}
          onClose={() => { setModalDoc(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
      {detailDocId && (
        <ReworkDetailModal
          reworkId={detailDocId}
          batchById={batchById}
          onClose={() => setDetailDocId(null)}
          onStart={(doc) => {
            setDetailDocId(null);
            setStartTarget(doc);
            setSubmitError('');
          }}
          onComplete={(doc) => {
            setDetailDocId(null);
            setCompleteTarget(doc);
            setCompleteOutputQty('');
            setCompleteLossQty('');
            setCompleteQuality('good');
            setSubmitError('');
          }}
          onCancel={(doc) => {
            setDetailDocId(null);
            setCancelTarget(doc);
            setSubmitError('');
          }}
        />
      )}

      <ConfirmModal
        open={!!startTarget}
        title="Начать переделку"
        message="Статус запроса изменится на «В работе». Продолжить?"
        confirmText="Начать"
        confirmBusy={startBusy}
        onConfirm={async () => {
          if (!startTarget?.id || startBusy) return;
          setStartBusy(true);
          setSubmitError('');
          try {
            await startReworkRequest(startTarget.id);
            await refetch();
            loadRefs();
            onAfterMutation?.();
            toast.show('Переделка начата');
            setStartTarget(null);
          } catch (e) {
            setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
          } finally {
            setStartBusy(false);
          }
        }}
        onCancel={() => { if (!startBusy) { setStartTarget(null); setSubmitError(''); } }}
        error={startTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить переделку"
        message="Отменить этот запрос на сервере?"
        confirmText="Отменить"
        confirmBusy={cancelBusy}
        onConfirm={async () => {
          if (!cancelTarget?.id || cancelBusy) return;
          setCancelBusy(true);
          setSubmitError('');
          try {
            await cancelReworkRequest(cancelTarget.id);
            await refetch();
            loadRefs();
            onAfterMutation?.();
            toast.show('Запрос отменён');
            setCancelTarget(null);
          } catch (e) {
            setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
          } finally {
            setCancelBusy(false);
          }
        }}
        onCancel={() => { if (!cancelBusy) { setCancelTarget(null); setSubmitError(''); } }}
        error={cancelTarget ? submitError : undefined}
      />

      {completeTarget && (
        <div className="modal-overlay" onClick={() => { setCompleteTarget(null); setSubmitError(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Завершить переделку</h3>
              <button
                type="button"
                className="modal__close"
                onClick={() => { setCompleteTarget(null); setSubmitError(''); }}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="commercial-note">
              Укажите выход и потери по факту переработки (создание партии на складе выполняет сервер).
            </p>
            <label>Выходное количество *</label>
            <input
              value={completeOutputQty}
              onChange={(e) => { setCompleteOutputQty(e.target.value); setSubmitError(''); }}
              disabled={completeBusy}
            />
            <label>Потери *</label>
            <input
              value={completeLossQty}
              onChange={(e) => { setCompleteLossQty(e.target.value); setSubmitError(''); }}
              disabled={completeBusy}
            />
            <label>Качество результата *</label>
            <Select
              value={completeQuality}
              onChange={(v) => setCompleteQuality(v)}
              options={[
                { value: 'good', label: 'Годный' },
                { value: 'defect', label: 'Брак' },
              ]}
              disabled={completeBusy}
            />
            {submitError && <p className="modal__error">{submitError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" disabled={completeBusy} onClick={() => { if (!completeBusy) { setCompleteTarget(null); setSubmitError(''); } }}>Отмена</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={completeBusy}
                onClick={onComplete}
              >
                {completeBusy ? 'Подождите…' : 'Завершить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReworkModal = ({
  doc,
  returnsList,
  defectsList,
  salesList,
  onSubmit,
  onClose,
  error,
}) => {
  const [returnDoc, setReturnDoc] = useState(() => pickNestedId(doc, 'return_doc', 'return_doc_id'));
  const [defectRecord, setDefectRecord] = useState(() => pickNestedId(doc, 'defect_record', 'defect_record_id'));
  const [originalSale, setOriginalSale] = useState(() => pickNestedId(doc, 'original_sale', 'original_sale_id'));
  const [product, setProduct] = useState(doc?.product || '');
  const [quantityKg, setQuantityKg] = useState(() => {
    if (doc?.quantity_kg != null) return String(doc.quantity_kg);
    return '';
  });
  const [comment, setComment] = useState(doc?.comment || '');
  const [localError, setLocalError] = useState('');

  const pickedDefect = useMemo(() => (
    defectRecord ? defectsList.find((x) => String(x.id) === String(defectRecord)) : null
  ), [defectRecord, defectsList]);

  const returnOptions = useMemo(() => returnsList.map((r) => ({
    value: String(r.id),
    label: returnRefLabel(r) || 'Возврат',
  })), [returnsList]);

  const defectOptions = useMemo(() => defectsList
    .filter(isDefectSelectableForRework)
    .map((d) => ({
      value: String(d.id),
      label: defectRecordSelectLabel(d),
    })), [defectsList]);

  const saleOptions = useMemo(() => salesList.map((s) => ({
    value: String(s.id),
    label: saleRefLabel(s) || 'Продажа',
  })), [salesList]);

  useEffect(() => {
    const fromDefect = pickedDefect;
    if (fromDefect) {
      const nextProduct = (fromDefect.product || fromDefect.profile_name || '').trim();
      if (nextProduct) setProduct(nextProduct);
      const pcs = fromDefect.available_quantity_pcs ?? fromDefect.quantity_pcs;
      if (pcs != null && pcs !== '') {
        setQuantityKg(String(pcs));
      } else if (fromDefect.quantity_kg != null && fromDefect.quantity_kg !== '') {
        setQuantityKg(String(fromDefect.quantity_kg));
      }
    }
  }, [pickedDefect]);

  const pickedDefectPcs = pickedDefect != null
    ? (pickedDefect.available_quantity_pcs ?? pickedDefect.quantity_pcs)
    : null;
  const qtyIsPcs = pickedDefect != null && pickedDefectPcs != null && pickedDefectPcs !== '';
  const quantityFieldLabel = qtyIsPcs ? 'Количество' : 'Количество брака';
  const defectReasonReadonly = pickedDefect ? (pickedDefect.defect_reason || '').trim() || '—' : '';
  const defectSourceReadonly = pickedDefect
    ? (REWORK_DEFECT_SOURCE_LABELS[pickedDefect.source_type] || pickedDefect.source_type || '—')
    : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{doc ? 'Переделка' : 'Новая переделка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalError('');
            if (!defectRecord) {
              setLocalError('Выберите запись брака');
              return;
            }
            const q = parseLocaleNumber(quantityKg);
            if (!Number.isFinite(q) || q < 0) {
              setLocalError('Некорректное количество');
              return;
            }
            const payload = {
              product: product.trim() || undefined,
              quantity_kg: q,
              comment: comment.trim() || undefined,
            };
            if (returnDoc) payload.return_doc = Number(returnDoc);
            payload.defect_record = Number(defectRecord);
            if (originalSale) payload.original_sale = Number(originalSale);
            await onSubmit(payload);
          }}
        >
          <label>Связанный возврат</label>
          <Select
            value={returnDoc}
            onChange={setReturnDoc}
            options={[{ value: '', label: 'Нет' }, ...returnOptions]}
          />
          <label>Связанный брак *</label>
          <Select
            value={defectRecord}
            onChange={(v) => { setDefectRecord(v); setLocalError(''); }}
            placeholder="Выберите запись брака"
            options={defectOptions}
          />
          <label>Связанная продажа</label>
          <Select
            value={originalSale}
            onChange={setOriginalSale}
            options={[{ value: '', label: 'Необязательно' }, ...saleOptions]}
          />
          <label>Продукт *</label>
          <input value={product} readOnly required />
          {pickedDefect ? (
            <>
              <label>Причина брака</label>
              <input value={defectReasonReadonly} readOnly />
              <label>Источник</label>
              <input value={defectSourceReadonly} readOnly />
            </>
          ) : null}
          <label>{quantityFieldLabel} *</label>
          <input
            value={
              !pickedDefect
                ? quantityKg
                : (qtyIsPcs
                  ? `${formatQuantityDisplay(pickedDefectPcs)} шт`
                  : formatQuantityDisplay(quantityKg))
            }
            onChange={(e) => { if (!pickedDefect) setQuantityKg(e.target.value); }}
            readOnly={Boolean(pickedDefect)}
          />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {(localError || error) && <p className="modal__error">{localError || error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReworkDetailModal = ({
  reworkId,
  batchById,
  onClose,
  onStart,
  onComplete,
  onCancel,
}) => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get(`rework-requests/${reworkId}/`);
        if (!alive) return;
        setDoc(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить карточку переделки'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [reworkId]);

  const st = doc?.status;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка переделки</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && doc && (
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Данные</h4>
              <p><strong>Номер:</strong> {doc.rework_number || '—'}</p>
              <p><strong>Брак / продукт:</strong> {doc.product || '—'}</p>
              <p><strong>Количество:</strong> {reworkRowQuantityLabel(doc, null)}</p>
              <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
              <p><strong>Результат:</strong> {reworkResultLabel(doc, batchById)}</p>
              {doc.comment ? <p><strong>Комментарий:</strong> {doc.comment}</p> : null}
            </section>
            <div className="modal__actions">
              {canStartRework(st) ? <button type="button" className="btn btn--secondary" onClick={() => onStart(doc)}>Начать</button> : null}
              {canCompleteRework(st) ? <button type="button" className="btn btn--primary" onClick={() => onComplete(doc)}>Завершить</button> : null}
              {canCancelRework(st) ? <button type="button" className="btn btn--danger" onClick={() => onCancel(doc)}>Отменить</button> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReworkRequestsPage;
