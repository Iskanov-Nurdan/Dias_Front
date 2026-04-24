import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import { createReturn, deleteReturn, downloadReturnWaybill, updateReturn } from '../../api/returnsApi';

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

const returnTableSaleLabel = (r) => {
  if (r.sale_order_number) return r.sale_order_number;
  if (r.order_number) return r.order_number;
  const s = r.sale;
  if (s != null && typeof s === 'object') {
    return s.order_number || s.sale_number || saleListLabel(s);
  }
  return '—';
};

const returnTableClientLabel = (r) => r.client_name || r.sale?.client_name || r.sale?.client?.name || '—';

const initialSaleIdFromDoc = (doc) => {
  if (!doc?.id) return '';
  if (doc.sale_id != null) return String(doc.sale_id);
  const s = doc.sale;
  if (s != null && typeof s === 'object' && s.id != null) return String(s.id);
  if (s != null) return String(s);
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
    client: '',
    date_from: '',
    date_to: '',
  });
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);
  const [modalDoc, setModalDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [waybillBusyId, setWaybillBusyId] = useState(null);

  const { items, meta, loading, error, refetch } = useServerQuery('returns/', queryState, { enabled: true });
  useOperationalRefetch(['return', 'defect_record', 'rework_request', 'sale'], refetch, true);

  const loadRefs = useCallback(() => {
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
    apiClient.get('sales/', { params: { page_size: 500 } }).then((r) => setSales(r.data?.items || [])).catch(() => setSales([]));
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

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

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setSubmitError('');
    try {
      await deleteReturn(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      loadRefs();
      toast.show('Возврат удалён');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления возврата'));
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
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            value={queryState.client}
            onChange={(v) => setQueryState((p) => ({ ...p, client: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `Клиент #${c.id}` }))]}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>С</span>
            <input
              type="date"
              value={queryState.date_from}
              onChange={(e) => setQueryState((p) => ({ ...p, date_from: e.target.value, page: 1 }))}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>По</span>
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
      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', opacity: 0.8 }}>
        В контракте GET /api/returns/ нет search и поля статуса возврата в списке — фильтры: клиент, период (date_from / date_to).
      </p>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет возвратов" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Дата</th>
              <th>Продажа</th>
              <th>Клиент</th>
              <th>Причина</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.return_number || '—'}</td>
                <td>{(r.date || r.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td>{returnTableSaleLabel(r)}</td>
                <td>{returnTableClientLabel(r)}</td>
                <td>{r.return_reason || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalDoc(r) },
                      {
                        label: 'Накладная',
                        disabled: waybillBusyId === r.id,
                        onClick: () => onDownloadWaybill(r),
                      },
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(r) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить возврат?"
        message={deleteTarget ? `Удалить возврат${deleteTarget.return_number ? ` «${deleteTarget.return_number}»` : ''}?` : ''}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const ReturnModal = ({ doc, sales, onSubmit, onClose, error }) => {
  const [sale, setSale] = useState(() => initialSaleIdFromDoc(doc));
  const [date, setDate] = useState((doc?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(doc?.return_reason || '');
  const [comment, setComment] = useState(doc?.comment || '');
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
    let alive = true;
    apiClient.get(`sales/${sale}/`)
      .then((r) => {
        if (!alive) return;
        const d = r.data || {};
        setSaleDetail(d);
        setSaleLines(Array.isArray(d.sale_lines) ? d.sale_lines : (Array.isArray(d.lines) ? d.lines : []));
      })
      .catch(() => {
        if (!alive) return;
        setSaleDetail(null);
        setSaleLines([]);
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

  const routeWarnings = useMemo(() => {
    const hasDefect = lines.some((l) => l.return_target === 'defect');
    const hasRework = lines.some((l) => l.return_target === 'rework');
    return { hasDefect, hasRework };
  }, [lines]);

  const applySaleLineSelection = (idx, saleLineId) => {
    const sl = saleLineId ? lineById.get(String(saleLineId)) : null;
    const cap = saleLineReturnableCap(sl);
    setLines((prev) => prev.map((x, i) => {
      if (i !== idx) return x;
      return {
        ...x,
        sale_line: saleLineId,
        product: sl ? (sl.product || x.product) : x.product,
        quantity: cap != null && (!x.quantity || Number(parseLocaleNumber(x.quantity)) > cap) ? String(cap) : x.quantity,
      };
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{doc ? 'Возврат' : 'Новый возврат'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLineError('');
            if (!sale) return;
            const payloadLines = [];
            for (let i = 0; i < lines.length; i += 1) {
              const l = lines[i];
              const qty = parseLocaleNumber(l.quantity);
              if (!(qty > 0)) continue;
              const sl = l.sale_line ? lineById.get(String(l.sale_line)) : null;
              const cap = saleLineReturnableCap(sl);
              if (cap != null && qty > cap) {
                setLineError(`Строка ${i + 1}: не больше ${formatQuantityDisplay(cap)} по данным строки продажи.`);
                return;
              }
              payloadLines.push({
                ...(l.sale_line ? { sale_line: Number(l.sale_line) } : {}),
                product: String(l.product || '').trim(),
                quantity: qty,
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
          <label>Причина возврата</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

          {(routeWarnings.hasDefect || routeWarnings.hasRework) && (
            <div className="card" style={{ marginTop: 12, padding: 12, borderLeft: '3px solid #ca8a04' }}>
              {routeWarnings.hasDefect && (
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  Выбран маршрут «В брак»: на сервере может быть создана запись брака.
                </p>
              )}
              {routeWarnings.hasRework && (
                <p style={{ margin: routeWarnings.hasDefect ? '8px 0 0' : 0, fontSize: '0.9rem' }}>
                  Выбран маршрут «На переделку»: на сервере может быть создана переделка.
                </p>
              )}
            </div>
          )}

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
                          label: `${x.product || 'Позиция'}${capLabel}`,
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
                  <label>Товар *</label>
                  <input
                    value={line.product}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)))}
                  />
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

export default ReturnsPage;
