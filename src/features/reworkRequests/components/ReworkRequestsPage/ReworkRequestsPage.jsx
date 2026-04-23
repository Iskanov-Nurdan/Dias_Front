import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage } from '../../../../shared/lib';
import { ActionMenu, EmptyState, ErrorState, Loading, Select, useToast } from '../../../../shared/ui';
import { completeReworkRequest, createReworkRequest, updateReworkRequest } from '../../api/reworkRequestsApi';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ожидает' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Завершена' },
  { value: 'canceled', label: 'Отменена' },
];
const statusLabel = (v) => STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';

const ReworkRequestsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDoc, setModalDoc] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [resultBatchId, setResultBatchId] = useState('');
  const [warehouseBatches, setWarehouseBatches] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const { items, loading, error, refetch } = useServerQuery('rework-requests/', queryState, { enabled: true });
  useOperationalRefetch(['rework_request', 'defect_record', 'warehouse_batch'], refetch, true);

  useEffect(() => {
    apiClient.get('warehouse/batches/', { params: { page_size: 500 } }).then((r) => setWarehouseBatches(r.data?.items || [])).catch(() => setWarehouseBatches([]));
  }, []);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) await updateReworkRequest(modalDoc.id, payload);
      else await createReworkRequest(payload);
      setModalDoc(null);
      refetch();
      toast.show('Запрос переделки сохранен');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения'));
    }
  };
  const onComplete = async () => {
    if (!completeTarget?.id || !resultBatchId) return;
    setSubmitError('');
    try {
      await completeReworkRequest(completeTarget.id, { result_warehouse_batch_id: Number(resultBatchId) });
      setCompleteTarget(null);
      setResultBatchId('');
      refetch();
      toast.show('Переделка завершена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка завершения переделки'));
    }
  };

  return (
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start">
          <Select value={queryState.status} onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))} options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]} />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDoc({})}>Создать переделку</button>
        </div>
      </div>
      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет запросов переделки" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Переделка</th>
              <th>Продукт</th>
              <th className="data-table__cell--num">Кг</th>
              <th>Статус</th>
              <th>Результат batch</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.rework_number || `#${r.id}`}</td>
                <td>{r.product || '—'}</td>
                <td className="data-table__cell--num">{r.quantity_kg != null ? formatQuantityDisplay(r.quantity_kg) : '—'}</td>
                <td>{statusLabel(r.status)}</td>
                <td>{r.result_warehouse_batch_id || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalDoc(r) },
                      { label: 'Завершить', onClick: () => { setCompleteTarget(r); setResultBatchId(''); } },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalDoc && (
        <ReworkModal
          doc={modalDoc?.id ? modalDoc : null}
          onSubmit={onSubmit}
          onClose={() => { setModalDoc(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {completeTarget && (
        <div className="modal-overlay" onClick={() => setCompleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>Завершить переделку</h3>
              <button type="button" className="modal__close" onClick={() => setCompleteTarget(null)} aria-label="Закрыть">×</button>
            </div>
            <label>Результирующая партия склада *</label>
            <Select
              value={resultBatchId}
              onChange={setResultBatchId}
              options={[
                { value: '', label: 'Выберите партию' },
                ...warehouseBatches.map((b) => ({ value: String(b.id), label: `${b.id} · ${b.product_name || b.product?.name || 'Партия'}` })),
              ]}
            />
            {submitError && <p className="modal__error">{submitError}</p>}
            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setCompleteTarget(null)}>Отмена</button>
              <button type="button" className="btn btn--primary" onClick={onComplete}>Завершить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReworkModal = ({ doc, onSubmit, onClose, error }) => {
  const [returnDocId, setReturnDocId] = useState(doc?.return_doc_id != null ? String(doc.return_doc_id) : '');
  const [defectRecordId, setDefectRecordId] = useState(doc?.defect_record_id != null ? String(doc.defect_record_id) : '');
  const [saleId, setSaleId] = useState(doc?.original_sale_id != null ? String(doc.original_sale_id) : '');
  const [product, setProduct] = useState(doc?.product || '');
  const [quantityKg, setQuantityKg] = useState(doc?.quantity_kg != null ? String(doc.quantity_kg) : '');
  const [status, setStatus] = useState(doc?.status || 'pending');
  const [comment, setComment] = useState(doc?.comment || '');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{doc ? 'Переделка' : 'Новая переделка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              ...(returnDocId ? { return_doc: Number(returnDocId) } : {}),
              ...(defectRecordId ? { defect_record: Number(defectRecordId) } : {}),
              ...(saleId ? { original_sale: Number(saleId) } : {}),
              product: product.trim() || undefined,
              ...(quantityKg ? { quantity_kg: Number(quantityKg) } : {}),
              status,
              comment: comment.trim() || undefined,
            });
          }}
        >
          <label>Return ID</label>
          <input value={returnDocId} onChange={(e) => setReturnDocId(e.target.value)} />
          <label>Defect ID</label>
          <input value={defectRecordId} onChange={(e) => setDefectRecordId(e.target.value)} />
          <label>Sale ID</label>
          <input value={saleId} onChange={(e) => setSaleId(e.target.value)} />
          <label>Продукт</label>
          <input value={product} onChange={(e) => setProduct(e.target.value)} />
          <label>Количество кг</label>
          <input value={quantityKg} onChange={(e) => setQuantityKg(e.target.value)} />
          <label>Статус</label>
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
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

export default ReworkRequestsPage;
