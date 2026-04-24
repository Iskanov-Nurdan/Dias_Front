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
  { value: 'completed', label: 'Завершена' },
  { value: 'canceled', label: 'Отменена' },
];

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

const defectRefLabel = (d) => {
  if (!d) return '';
  const name = d.product || 'Позиция';
  if (d.quantity_pcs != null) return `${name} · ${formatQuantityDisplay(d.quantity_pcs)} шт`;
  return name;
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
    const parts = [name, form, qty ? `${qty} кг` : null].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  const bid = row.result_warehouse_batch_id;
  if (bid != null && batchById?.has(String(bid))) {
    return warehouseBatchShortLabel(batchById.get(String(bid)));
  }
  return '—';
};

const canEditRework = (s) => s === 'pending';
const canStartRework = (s) => s === 'pending';
const canCompleteRework = (s) => s === 'in_progress';
const canCancelRework = (s) => s === 'pending' || s === 'in_progress';

const reworkActionOn = (actions, key) => {
  if (actions == null) return false;
  if (Array.isArray(actions)) return actions.includes(key);
  if (typeof actions === 'object') return Boolean(actions[key]);
  return false;
};

const ReworkRequestsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDoc, setModalDoc] = useState(null);
  const [detailDocId, setDetailDocId] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeOutputQty, setCompleteOutputQty] = useState('');
  const [completeLossQty, setCompleteLossQty] = useState('');
  const [completeQuality, setCompleteQuality] = useState('');
  const [startTarget, setStartTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [warehouseBatches, setWarehouseBatches] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [defectsList, setDefectsList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [submitError, setSubmitError] = useState('');
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

  const loadRefs = () => {
    getReworkSelectSources()
      .then((res) => {
        const data = res.data || {};
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

  const runAction = async (fn, okText) => {
    setSubmitError('');
    try {
      await fn();
      refetch();
      loadRefs();
      toast.show(okText);
      return true;
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
      return false;
    }
  };

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReworkRequest(modalDoc.id, payload);
      else await createReworkRequest(payload);
      setModalDoc(null);
      refetch();
      loadRefs();
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
      setSubmitError('Укажите выход (output_quantity)');
      return;
    }
    if (!Number.isFinite(loss) || loss < 0) {
      setSubmitError('Укажите потери (loss_quantity)');
      return;
    }
    setSubmitError('');
    try {
      await completeReworkRequest(completeTarget.id, {
        output_quantity: String(out),
        loss_quantity: String(loss),
        ...(completeQuality === 'good' || completeQuality === 'defect' ? { quality: completeQuality } : {}),
      });
      setCompleteTarget(null);
      setCompleteOutputQty('');
      setCompleteLossQty('');
      setCompleteQuality('');
      refetch();
      loadRefs();
      toast.show('Переделка завершена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка завершения переделки'));
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
                <th>Номер</th>
                <th>Продукт</th>
                <th className="data-table__cell--num">Количество, кг</th>
                <th>Статус</th>
                <th>Результат</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const st = r.status;
                const availableActions = r.available_actions;
                const menuItems = [{ label: 'Открыть', onClick: () => setDetailDocId(r.id) }];
                if (canEditRework(st) && reworkActionOn(availableActions, 'edit')) {
                  menuItems.push({ label: 'Редактировать', onClick: () => setModalDoc(r) });
                }
                if (canStartRework(st) && reworkActionOn(availableActions, 'start')) {
                  menuItems.push({
                    label: 'Начать',
                    onClick: () => { setStartTarget(r); setSubmitError(''); },
                  });
                }
                if (canCompleteRework(st) && reworkActionOn(availableActions, 'complete')) {
                  menuItems.push({
                    label: 'Завершить',
                    onClick: () => {
                      setCompleteTarget(r);
                      setCompleteOutputQty('');
                      setCompleteLossQty('');
                      setCompleteQuality('');
                      setSubmitError('');
                    },
                  });
                }
                if (canCancelRework(st) && reworkActionOn(availableActions, 'cancel')) {
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
                    <td className="data-table__cell--num">{r.quantity_kg != null ? formatQuantityDisplay(r.quantity_kg) : '—'}</td>
                    <td><Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></td>
                    <td>{reworkResultLabel(r, batchById)}</td>
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
          onEdit={(doc) => {
            setDetailDocId(null);
            setModalDoc(doc);
          }}
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
            setCompleteQuality('');
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
        onConfirm={async () => {
          if (!startTarget?.id) return;
          const ok = await runAction(() => startReworkRequest(startTarget.id), 'Переделка начата');
          if (ok) setStartTarget(null);
        }}
        onCancel={() => { setStartTarget(null); setSubmitError(''); }}
        error={startTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить переделку"
        message="Отменить этот запрос на сервере?"
        confirmText="Отменить"
        onConfirm={async () => {
          if (!cancelTarget?.id) return;
          const ok = await runAction(() => cancelReworkRequest(cancelTarget.id), 'Запрос отменён');
          if (ok) setCancelTarget(null);
        }}
        onCancel={() => { setCancelTarget(null); setSubmitError(''); }}
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
            <label>Выход (output_quantity) *</label>
            <input
              value={completeOutputQty}
              onChange={(e) => { setCompleteOutputQty(e.target.value); setSubmitError(''); }}
            />
            <label>Потери (loss_quantity) *</label>
            <input
              value={completeLossQty}
              onChange={(e) => { setCompleteLossQty(e.target.value); setSubmitError(''); }}
            />
            <label>Качество результата</label>
            <Select
              value={completeQuality}
              onChange={(v) => setCompleteQuality(v)}
              options={[
                { value: '', label: 'По умолчанию (сервер)' },
                { value: 'good', label: 'Годные' },
                { value: 'defect', label: 'Брак' },
              ]}
            />
            {submitError && <p className="modal__error">{submitError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => { setCompleteTarget(null); setSubmitError(''); }}>Отмена</button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onComplete}
              >
                Завершить
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
  const [quantityKg, setQuantityKg] = useState(doc?.quantity_kg != null ? String(doc.quantity_kg) : '');
  const [comment, setComment] = useState(doc?.comment || '');

  const returnOptions = useMemo(() => returnsList.map((r) => ({
    value: String(r.id),
    label: returnRefLabel(r) || 'Возврат',
  })), [returnsList]);

  const defectOptions = useMemo(() => defectsList.map((d) => ({
    value: String(d.id),
    label: defectRefLabel(d),
  })), [defectsList]);

  const saleOptions = useMemo(() => salesList.map((s) => ({
    value: String(s.id),
    label: saleRefLabel(s) || 'Продажа',
  })), [salesList]);

  useEffect(() => {
    const fromDefect = defectRecord ? defectsList.find((x) => String(x.id) === String(defectRecord)) : null;
    if (!product.trim()) {
      const nextProduct = fromDefect?.product || '';
      if (nextProduct) setProduct(nextProduct);
    }
    if ((!quantityKg || String(quantityKg).trim() === '') && fromDefect?.quantity_pcs != null) {
      setQuantityKg(String(fromDefect.quantity_pcs));
    }
  }, [defectRecord, defectsList, product, quantityKg]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{doc ? 'Переделка' : 'Новая переделка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!defectRecord) return;
            const q = parseLocaleNumber(quantityKg);
            const payload = {
              product: product.trim() || undefined,
              ...(Number.isFinite(q) ? { quantity_kg: q } : {}),
              comment: comment.trim() || undefined,
            };
            if (returnDoc) payload.return_doc = Number(returnDoc);
            payload.defect_record = Number(defectRecord);
            if (originalSale) payload.original_sale = Number(originalSale);
            onSubmit(payload);
          }}
        >
          <label>Связанный возврат</label>
          <Select
            value={returnDoc}
            onChange={setReturnDoc}
            options={[{ value: '', label: 'Нет' }, ...returnOptions]}
          />
          <label>Связанный брак</label>
          <Select
            value={defectRecord}
            onChange={setDefectRecord}
            options={[{ value: '', label: 'Нет' }, ...defectOptions]}
          />
          <label>Связанная продажа</label>
          <Select
            value={originalSale}
            onChange={setOriginalSale}
            options={[{ value: '', label: 'Необязательно' }, ...saleOptions]}
          />
          <label>Продукт *</label>
          <input value={product} onChange={(e) => setProduct(e.target.value)} readOnly required />
          <label>Количество, кг {!doc ? '*' : ''}</label>
          <input value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} required={!doc} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="modal__error">{error}</p>}
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
  onEdit,
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
              <p><strong>Продукт:</strong> {doc.product || '—'}</p>
              <p><strong>Количество:</strong> {doc.quantity_kg != null ? `${formatQuantityDisplay(doc.quantity_kg)} кг` : '—'}</p>
              <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
              <p><strong>Результат:</strong> {reworkResultLabel(doc, batchById)}</p>
              {doc.comment ? <p><strong>Комментарий:</strong> {doc.comment}</p> : null}
            </section>
            <div className="modal__actions">
              {canEditRework(st) ? <button type="button" className="btn btn--secondary" onClick={() => onEdit(doc)}>Редактировать</button> : null}
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
