import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  cancelReturn,
  completeReturn,
  createReturn,
  downloadReturnWaybill,
  getReturnSelectSources,
  updateReturn,
} from '../../api/returnsApi';
import { getClients } from '../../../clients/api/clientsApi';

const TARGETS = [
  { value: 'warehouse', label: 'На склад' },
  { value: 'defect', label: 'В брак' },
  { value: 'rework', label: 'На переделку' },
];

const CONDITIONS = [
  { value: 'good', label: 'Годный' },
  { value: 'damaged', label: 'Повреждён' },
  { value: 'defect', label: 'Брак' },
];

const targetLabel = (code) => TARGETS.find((t) => t.value === code)?.label || code || '—';

const saleListLabel = (s) => s.order_number || s.sale_number || 'Продажа';

const returnTableSaleLabel = (r) => r.sale_order_number || r.order_number || '—';

const returnTableClientLabel = (r) => r.client_name || '—';

const initialSaleIdFromDoc = (doc) => {
  if (!doc?.id) return '';
  if (doc.sale != null) return String(typeof doc.sale === 'object' ? doc.sale.id : doc.sale);
  if (doc.sale_id != null) return String(doc.sale_id);
  return '';
};

/**
 * Верхняя граница количества к возврату по строке: только поля ответа API (без выдуманных формул).
 * Если бэкенд отдаёт только quantity строки продажи — это ориентир; учёт уже возвращённого — на сервере.
 */
const saleLineReturnableCap = (sl) => {
  if (!sl) return null;
  const keys = [
    'returnable_quantity',
    'remaining_return_quantity',
    'available_for_return',
    'max_return_quantity',
  ];
  for (const k of keys) {
    if (sl[k] != null && sl[k] !== '') {
      const n = Number(sl[k]);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  if (sl.already_returned_quantity != null && sl.quantity != null) {
    const q = Number(sl.quantity);
    const ar = Number(sl.already_returned_quantity);
    if (Number.isFinite(q) && Number.isFinite(ar)) return Math.max(0, q - ar);
  }
  if (sl.quantity != null) {
    const q = Number(sl.quantity);
    if (Number.isFinite(q) && q >= 0) return q;
  }
  return null;
};

const ReturnsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    client_id: '',
    date_from: '',
    date_to: '',
  });
  const [sales, setSales] = useState([]);
  const [filterClients, setFilterClients] = useState([]);
  const [modalDoc, setModalDoc] = useState(null);
  const [detailDocId, setDetailDocId] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [cancelDocTarget, setCancelDocTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [waybillBusyId, setWaybillBusyId] = useState(null);

  const { items, meta, loading, error, refetch } = useServerQuery('returns/', queryState, { enabled: true });
  useOperationalRefetch(['return', 'defect_record', 'rework_request', 'sale'], refetch, true);

  const loadRefs = useCallback(() => {
    getReturnSelectSources()
      .then((res) => {
        const data = res.data || {};
        setSales(Array.isArray(data.sales) ? data.sales : []);
      })
      .catch(() => setSales([]));
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  useEffect(() => {
    getClients({ page_size: 500 })
      .then((r) => setFilterClients(Array.isArray(r.data?.items) ? r.data.items : []))
      .catch(() => setFilterClients([]));
  }, []);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReturn(modalDoc.id, payload);
      else await createReturn(payload);
      setModalDoc(null);
      refetch();
      loadRefs();
      toast.show('Возврат сохранён');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения возврата'));
    }
  };

  const onComplete = async () => {
    if (!completeTarget?.id) return;
    setSubmitError('');
    try {
      await completeReturn(completeTarget.id);
      setCompleteTarget(null);
      refetch();
      loadRefs();
      toast.show('Возврат проведён');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка проведения'));
    }
  };

  const onCancelDoc = async () => {
    if (!cancelDocTarget?.id) return;
    setSubmitError('');
    try {
      await cancelReturn(cancelDocTarget.id);
      setCancelDocTarget(null);
      refetch();
      loadRefs();
      toast.show('Возврат отменён');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка отмены'));
    }
  };

  const onDownloadWaybill = async (row) => {
    if (!row?.id) return;
    setWaybillBusyId(row.id);
    try {
      await downloadReturnWaybill(row.id);
      toast.show('Акт скачан');
    } catch (e) {
      toast.show(e?.message || 'Не удалось скачать акт', 'error');
    } finally {
      setWaybillBusyId(null);
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <Select
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[
              { value: '', label: 'Все клиенты' },
              ...filterClients.map((c) => ({ value: String(c.id), label: c.name || 'Клиент' })),
            ]}
          />
          <label className="commercial-date-filter">
            <span className="commercial-date-filter__label">С</span>
            <input
              type="date"
              value={queryState.date_from}
              onChange={(e) => setQueryState((p) => ({ ...p, date_from: e.target.value, page: 1 }))}
            />
          </label>
          <label className="commercial-date-filter">
            <span className="commercial-date-filter__label">По</span>
            <input
              type="date"
              value={queryState.date_to}
              onChange={(e) => setQueryState((p) => ({ ...p, date_to: e.target.value, page: 1 }))}
            />
          </label>
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
          <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Дата</th>
              <th>Продажа</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Причина</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <button type="button" className="btn btn--ghost" onClick={() => setDetailDocId(r.id)}>
                    {r.return_number || '—'}
                  </button>
                </td>
                <td>{(r.date || r.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td>{returnTableSaleLabel(r)}</td>
                <td>{returnTableClientLabel(r)}</td>
                <td>{r.status === 'completed' ? 'Проведён' : r.status === 'canceled' ? 'Отменён' : r.status === 'draft' ? 'Черновик' : (r.status || '—')}</td>
                <td>{r.return_reason || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={(() => {
                      const menu = [{ label: 'Открыть', onClick: () => setDetailDocId(r.id) }];
                      if (r.status === 'draft') {
                        menu.push(
                          { label: 'Редактировать', onClick: () => setModalDoc(r) },
                          { label: 'Провести', onClick: () => { setCompleteTarget(r); setSubmitError(''); } },
                          { label: 'Отменить', danger: true, onClick: () => { setCancelDocTarget(r); setSubmitError(''); } },
                        );
                      }
                      if (r.status === 'completed') {
                        menu.push(
                          { label: 'Редактировать реквизиты', onClick: () => setModalDoc(r) },
                          { label: 'Отменить возврат', danger: true, onClick: () => { setCancelDocTarget(r); setSubmitError(''); } },
                        );
                      }
                      if (r.status !== 'canceled') {
                        menu.push({
                          label: 'Накладная',
                          disabled: waybillBusyId === r.id,
                          onClick: () => onDownloadWaybill(r),
                        });
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
          sales={sales}
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
          onDownloadWaybill={onDownloadWaybill}
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
        onConfirm={onComplete}
        onCancel={() => { setCompleteTarget(null); setSubmitError(''); }}
        error={completeTarget ? submitError : undefined}
      />
      <ConfirmModal
        open={!!cancelDocTarget}
        title="Отменить возврат?"
        message={cancelDocTarget ? `Отменить возврат${cancelDocTarget.return_number ? ` «${cancelDocTarget.return_number}»` : ''}?` : ''}
        confirmText="Отменить"
        onConfirm={onCancelDoc}
        onCancel={() => { setCancelDocTarget(null); setSubmitError(''); }}
        error={cancelDocTarget ? submitError : undefined}
      />
    </div>
  );
};

const ReturnModal = ({ doc, sales, onSubmit, onClose, error }) => {
  const isCompletedLimited = doc?.status === 'completed';
  const [sale, setSale] = useState(() => initialSaleIdFromDoc(doc));
  const [date, setDate] = useState((doc?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(doc?.return_reason || '');
  const [comment, setComment] = useState(doc?.comment || '');
  const [invoiceNumber, setInvoiceNumber] = useState(doc?.invoice_number || '');
  const [lineError, setLineError] = useState('');
  const [saleDetail, setSaleDetail] = useState(null);
  const [saleLines, setSaleLines] = useState([]);
  const [lines, setLines] = useState(
    Array.isArray(doc?.lines) && doc.lines.length
      ? doc.lines.map((x) => ({
        sale_line: x.sale_line_id != null ? String(x.sale_line_id) : (x.sale_line != null ? String(typeof x.sale_line === 'object' ? x.sale_line.id : x.sale_line) : ''),
        product: x.product || '',
        quantity: x.quantity != null ? String(x.quantity) : '',
        return_target: x.return_target || 'warehouse',
        condition_type: x.condition_type || 'good',
        comment: x.comment || '',
      }))
      : [{ sale_line: '', product: '', quantity: '', return_target: 'warehouse', condition_type: 'good', comment: '' }],
  );

  useEffect(() => {
    if (!sale) {
      setSaleDetail(null);
      setSaleLines([]);
      return;
    }
    getReturnSelectSources(sale)
      .then((res) => {
        const data = res.data || {};
        setSaleDetail((Array.isArray(data.sales) ? data.sales.find((x) => String(x.id) === String(sale)) : null) || null);
        setSaleLines(Array.isArray(data.sale_lines) ? data.sale_lines : []);
      })
      .catch(() => {
        setSaleDetail(null);
        setSaleLines([]);
      });
    return undefined;
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
      return {
        ...x,
        sale_line: saleLineId,
        product: sl ? (sl.product || sl.sale_line_label || x.product) : x.product,
        quantity: cap != null && (!x.quantity || Number(parseLocaleNumber(x.quantity)) > cap) ? String(cap) : x.quantity,
      };
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isCompletedLimited ? 'Реквизиты возврата' : doc ? 'Возврат' : 'Новый возврат'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLineError('');
            if (isCompletedLimited) {
              onSubmit({
                return_reason: reason.trim() || undefined,
                comment: comment.trim() || undefined,
                invoice_number: invoiceNumber.trim() || undefined,
              });
              return;
            }
            if (!sale) return;
            const payloadLines = [];
            for (let i = 0; i < lines.length; i += 1) {
              const l = lines[i];
              const qty = parseLocaleNumber(l.quantity);
              if (!(qty > 0)) continue;
              if (!l.sale_line) {
                setLineError(`Строка ${i + 1}: выберите строку продажи.`);
                return;
              }
              const sl = l.sale_line ? lineById.get(String(l.sale_line)) : null;
              const cap = saleLineReturnableCap(sl);
              if (cap != null && qty > cap) {
                setLineError(`Строка ${i + 1}: не больше ${formatQuantityDisplay(cap)} по данным строки продажи.`);
                return;
              }
              payloadLines.push({
                sale_line: Number(l.sale_line),
                quantity: String(qty),
                return_target: l.return_target,
                condition_type: l.condition_type,
                comment: String(l.comment || '').trim() || undefined,
              });
            }
            if (payloadLines.length === 0) return;
            onSubmit({
              sale: Number(sale),
              date,
              return_reason: reason.trim() || undefined,
              comment: comment.trim() || undefined,
              lines: payloadLines,
            });
          }}
        >
          {!isCompletedLimited && (
            <>
              <label>Продажа *</label>
              <Select
                value={sale}
                onChange={(v) => { setLineError(''); setSale(v); }}
                options={[
                  { value: '', label: 'Выберите продажу' },
                  ...sales.map((s) => ({ value: String(s.id), label: saleListLabel(s) })),
                ]}
              />
              {saleDetail && (
                <p style={{ margin: '6px 0 0', fontSize: '0.875rem', opacity: 0.85 }}>
                  {saleDetail.client_name || saleDetail.client?.name
                    ? `Клиент: ${saleDetail.client_name || saleDetail.client?.name}`
                    : null}
                </p>
              )}

              <label>Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </>
          )}
          <label>Причина возврата</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          <label>Номер счёта / накладной</label>
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Необязательно" />

          {!isCompletedLimited && (
          <div style={{ marginTop: 12 }}>
            <strong>Строки возврата</strong>
            {lines.map((line, idx) => {
              const sl = line.sale_line ? lineById.get(String(line.sale_line)) : null;
              const cap = saleLineReturnableCap(sl);
              return (
                <div key={idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                  <label>Строка продажи</label>
                  <Select
                    value={line.sale_line}
                    onChange={(v) => applySaleLineSelection(idx, v)}
                    options={[
                      { value: '', label: 'Не выбрана' },
                      ...saleLines.map((x) => {
                        const c = saleLineReturnableCap(x);
                        const capLabel = c != null ? ` · макс. ${formatQuantityDisplay(c)}` : '';
                        return {
                          value: String(x.id),
                          label: `${x.sale_line_label || x.product || 'Позиция'}${capLabel}`,
                        };
                      }),
                    ]}
                  />
                  {cap != null && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', opacity: 0.85 }}>
                      Не больше {formatQuantityDisplay(cap)} по данным строки продажи
                      {sl?.already_returned_quantity != null
                        ? ' (учтено уже возвращённое, если отдал бэкенд).'
                        : '; окончательная проверка с учётом других возвратов — при сохранении на сервере.'}
                    </p>
                  )}
                  <label>Товар</label>
                  <input
                    value={line.product}
                    disabled
                    readOnly
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', opacity: 0.75 }}>
                    Подставляется из строки продажи.
                  </p>
                  <label>Количество *</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <label>Куда вернуть</label>
                  <Select
                    value={line.return_target}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, return_target: v } : x)))}
                    options={TARGETS}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', opacity: 0.8 }}>
                    Маршрут: {targetLabel(line.return_target)}
                  </p>
                  <label>Состояние</label>
                  <Select
                    value={line.condition_type}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, condition_type: v } : x)))}
                    options={CONDITIONS}
                  />
                  <label>Комментарий</label>
                  <input
                    value={line.comment}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))}
                  />
                  <button type="button" className="btn btn--secondary" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                    Удалить строку
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="btn btn--secondary"
              style={{ marginTop: 8 }}
              onClick={() => setLines((prev) => [...prev, {
                sale_line: '',
                product: '',
                quantity: '',
                return_target: 'warehouse',
                condition_type: 'good',
                comment: '',
              }])}
            >
              Добавить строку
            </button>
          </div>
          )}
          {(lineError || error) && <p className="modal__error">{lineError || error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReturnDetailModal = ({ returnId, onClose, onEdit, onDownloadWaybill, onMutate }) => {
  const toast = useToast();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const reloadDoc = () => {
    apiClient.get(`returns/${returnId}/`)
      .then((res) => setDoc(res.data || null))
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get(`returns/${returnId}/`);
        if (!alive) return;
        setDoc(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить карточку возврата'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [returnId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка возврата</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && doc && (
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Общее</h4>
              <p><strong>Номер:</strong> {doc.return_number || '—'}</p>
              <p><strong>Дата:</strong> {(doc.date || doc.created_at || '').toString().slice(0, 10) || '—'}</p>
              <p><strong>Продажа:</strong> {returnTableSaleLabel(doc)}</p>
              <p><strong>Клиент:</strong> {returnTableClientLabel(doc)}</p>
              <p><strong>Статус:</strong> {doc.status === 'completed' ? 'Проведён' : doc.status === 'canceled' ? 'Отменён' : doc.status === 'draft' ? 'Черновик' : (doc.status || '—')}</p>
              <p><strong>Причина:</strong> {doc.return_reason || '—'}</p>
              {doc.invoice_number ? <p><strong>Номер счёта / накладной:</strong> {doc.invoice_number}</p> : null}
              {doc.comment ? <p><strong>Комментарий:</strong> {doc.comment}</p> : null}
            </section>
            {Array.isArray(doc.downstream_links) && doc.downstream_links.length > 0 ? (
              <section className="card" style={{ padding: 12, marginBottom: 12 }}>
                <h4>Создано по возврату</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Номер</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.downstream_links.map((x, idx) => (
                      <tr key={x.id || idx}>
                        <td>{x.type || '—'}</td>
                        <td>{x.label || x.number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Строки возврата</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th className="data-table__cell--num">Количество</th>
                    <th>Маршрут</th>
                    <th>Состояние</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(doc.lines) ? doc.lines : []).map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td>{line.product || '—'}</td>
                      <td className="data-table__cell--num">{formatQuantityDisplay(line.quantity)}</td>
                      <td>{targetLabel(line.return_target)}</td>
                      <td>{CONDITIONS.find((x) => x.value === line.condition_type)?.label || line.condition_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <div className="modal__actions">
              {doc.status === 'draft' && (
                <>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={actionBusy}
                    onClick={async () => {
                      setActionBusy(true);
                      try {
                        await completeReturn(doc.id);
                        toast.show('Возврат проведён');
                        onMutate?.();
                        reloadDoc();
                      } catch (e) {
                        toast.show(getApiErrorMessage(e, 'Не удалось провести'), 'error');
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    Провести
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={actionBusy}
                    onClick={() => onEdit(doc)}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={actionBusy}
                    onClick={async () => {
                      setActionBusy(true);
                      try {
                        await cancelReturn(doc.id);
                        toast.show('Возврат отменён');
                        onMutate?.();
                        reloadDoc();
                      } catch (e) {
                        toast.show(getApiErrorMessage(e, 'Не удалось отменить'), 'error');
                      } finally {
                        setActionBusy(false);
                      }
                    }}
                  >
                    Отменить
                  </button>
                </>
              )}
              {doc.status === 'completed' && (
                <button type="button" className="btn btn--secondary" onClick={() => onEdit(doc)}>
                  Редактировать реквизиты
                </button>
              )}
              {doc.status === 'completed' && (
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={actionBusy}
                  onClick={async () => {
                    setActionBusy(true);
                    try {
                      await cancelReturn(doc.id);
                      toast.show('Возврат отменён');
                      onMutate?.();
                      reloadDoc();
                    } catch (e) {
                      toast.show(getApiErrorMessage(e, 'Не удалось отменить'), 'error');
                    } finally {
                      setActionBusy(false);
                    }
                  }}
                >
                  Отменить возврат
                </button>
              )}
              {doc.status !== 'canceled' && (
                <button type="button" className="btn btn--primary" onClick={() => onDownloadWaybill(doc)}>Накладная</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnsPage;
