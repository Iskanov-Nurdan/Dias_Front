import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, IntegerInput, Loading, Select, useToast } from '../../../../shared/ui';
import { createReturn, deleteReturn, downloadReturnWaybill, updateReturn } from '../../api/returnsApi';

const TARGETS = [
  { value: 'warehouse', label: 'На склад' },
  { value: 'defect', label: 'В брак' },
  { value: 'rework', label: 'На переделку' },
];
const CONDITIONS = [
  { value: 'good', label: 'Годный' },
  { value: 'damaged', label: 'Поврежден' },
  { value: 'defect', label: 'Брак' },
];

const ReturnsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, sale_id: '' });
  const [sales, setSales] = useState([]);
  const [modalDoc, setModalDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const { items, loading, error, refetch } = useServerQuery('returns/', queryState, { enabled: true });
  useOperationalRefetch(['return', 'defect_record', 'rework_request', 'sale'], refetch, true);

  useEffect(() => {
    apiClient.get('sales/', { params: { page_size: 500 } }).then((r) => setSales(r.data?.items || [])).catch(() => setSales([]));
  }, []);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReturn(modalDoc.id, payload);
      else await createReturn(payload);
      setModalDoc(null);
      refetch();
      toast.show('Возврат сохранен');
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
      toast.show('Возврат удален');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления возврата'));
    }
  };

  return (
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.sale_id}
            onChange={(v) => setQueryState((p) => ({ ...p, sale_id: v, page: 1 }))}
            options={[{ value: '', label: 'Все продажи' }, ...sales.map((s) => ({ value: String(s.id), label: s.sale_number || `#${s.id}` }))]}
            placeholder="Продажа"
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
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Возврат</th>
              <th>Дата</th>
              <th>Продажа</th>
              <th>Основание</th>
              <th>Комментарий</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.return_number || `#${r.id}`}</td>
                <td>{(r.date || r.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td>{r.sale_number || r.sale_id || r.sale || '—'}</td>
                <td>{r.return_reason || '—'}</td>
                <td>{r.comment || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalDoc(r) },
                      { label: 'Накладная', onClick: () => downloadReturnWaybill(r.id) },
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(r) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        message={deleteTarget ? `Удалить "${deleteTarget.return_number || `#${deleteTarget.id}`}"?` : ''}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const ReturnModal = ({ doc, sales, onSubmit, onClose, error }) => {
  const [sale, setSale] = useState(doc?.sale_id != null ? String(doc.sale_id) : '');
  const [date, setDate] = useState((doc?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(doc?.return_reason || '');
  const [comment, setComment] = useState(doc?.comment || '');
  const [saleLines, setSaleLines] = useState([]);
  const [lines, setLines] = useState(
    Array.isArray(doc?.lines) && doc.lines.length
      ? doc.lines.map((x) => ({
        sale_line: x.sale_line_id ? String(x.sale_line_id) : '',
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
      setSaleLines([]);
      return;
    }
    apiClient.get(`sales/${sale}/`).then((r) => setSaleLines(r.data?.lines || [])).catch(() => setSaleLines([]));
  }, [sale]);

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
            const payloadLines = lines
              .map((l) => ({
                ...(l.sale_line ? { sale_line: Number(l.sale_line) } : {}),
                product: String(l.product || '').trim(),
                quantity: parseLocaleNumber(l.quantity) || 0,
                return_target: l.return_target,
                condition_type: l.condition_type,
                comment: String(l.comment || '').trim() || undefined,
              }))
              .filter((l) => l.product && l.quantity > 0);
            if (!sale || payloadLines.length === 0) return;
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
          <Select value={sale} onChange={setSale} options={[{ value: '', label: 'Выберите продажу' }, ...sales.map((s) => ({ value: String(s.id), label: s.sale_number || `#${s.id}` }))]} />
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label>Причина возврата</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

          <div style={{ marginTop: 12 }}>
            <strong>Строки возврата</strong>
            {lines.map((line, idx) => (
              <div key={idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                <label>Строка продажи</label>
                <Select
                  value={line.sale_line}
                  onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, sale_line: v } : x)))}
                  options={[
                    { value: '', label: 'Не выбрана' },
                    ...saleLines.map((x) => ({
                      value: String(x.id),
                      label: `${x.product || 'Товар'} · ${formatQuantityDisplay(x.quantity || 0)}`,
                    })),
                  ]}
                />
                <label>Товар *</label>
                <input value={line.product} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)))} />
                <label>Количество *</label>
                <IntegerInput min={1} value={line.quantity} onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)))} />
                <label>Куда вернуть</label>
                <Select value={line.return_target} onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, return_target: v } : x)))} options={TARGETS} />
                <label>Состояние</label>
                <Select value={line.condition_type} onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, condition_type: v } : x)))} options={CONDITIONS} />
                <label>Комментарий</label>
                <input value={line.comment} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))} />
                <button type="button" className="btn btn--secondary" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>Удалить строку</button>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => setLines((prev) => [...prev, { sale_line: '', product: '', quantity: '', return_target: 'warehouse', condition_type: 'good', comment: '' }])}>
              Добавить строку
            </button>
          </div>
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

export default ReturnsPage;
