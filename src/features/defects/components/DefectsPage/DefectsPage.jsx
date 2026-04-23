import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Select, useToast } from '../../../../shared/ui';
import {
  createDefect,
  deleteDefect,
  sellDefect,
  sendDefectToRework,
  updateDefect,
  writeoffDefect,
} from '../../api/defectsApi';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'on_stock', label: 'На складе брака' },
  { value: 'sent_to_rework', label: 'На переработке' },
  { value: 'reworked', label: 'Переработан' },
  { value: 'sold', label: 'Продан' },
  { value: 'written_off', label: 'Списан' },
];

const statusLabel = (v) => STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';

const DefectsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDefect, setModalDefect] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [writeoffTarget, setWriteoffTarget] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [sellClient, setSellClient] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [clients, setClients] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const { items, loading, error, refetch } = useServerQuery('defects/', queryState, { enabled: true });
  useOperationalRefetch(['defect_record', 'sale', 'rework_request'], refetch, true);

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
  }, []);

  const onSubmitDefect = async (payload) => {
    setSubmitError('');
    try {
      if (modalDefect?.id) await updateDefect(modalDefect.id, payload);
      else await createDefect(payload);
      setModalDefect(null);
      refetch();
      toast.show('Запись брака сохранена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения записи брака'));
    }
  };
  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setSubmitError('');
    try {
      await deleteDefect(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Запись брака удалена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления'));
    }
  };

  const runAction = async (fn, okText) => {
    setSubmitError('');
    try {
      await fn();
      refetch();
      toast.show(okText);
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
    }
  };

  return (
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]}
            placeholder="Статус"
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDefect({})}>Создать брак</button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет записей брака" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>ID</th>
              <th>Продукт</th>
              <th className="data-table__cell--num">Количество</th>
              <th>Источник</th>
              <th>Статус</th>
              <th>Причина</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>#{d.id}</td>
                <td>{d.product || '—'}</td>
                <td className="data-table__cell--num">{d.quantity_pcs != null ? formatQuantityDisplay(d.quantity_pcs) : '—'}</td>
                <td>{d.source_type || '—'}</td>
                <td>{statusLabel(d.status)}</td>
                <td>{d.defect_reason || d.writeoff_reason || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalDefect(d) },
                      { label: 'Передать на переработку', onClick: () => runAction(() => sendDefectToRework(d.id), 'Передано на переработку') },
                      { label: 'Продать брак', onClick: () => { setSellTarget(d); setSellQty(String(d.quantity_pcs || '')); setSellClient(''); setSellPrice(''); } },
                      { label: 'Списать', danger: true, onClick: () => { setWriteoffTarget(d); setWriteoffReason(''); } },
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(d) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalDefect && (
        <DefectModal
          defect={modalDefect?.id ? modalDefect : null}
          onClose={() => { setModalDefect(null); setSubmitError(''); }}
          onSubmit={onSubmitDefect}
          error={submitError}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить запись брака?"
        message={deleteTarget ? `Удалить запись #${deleteTarget.id}?` : ''}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
      <ConfirmModal
        open={!!writeoffTarget}
        title="Списать брак"
        message={
          <div>
            <p>Укажите причину списания:</p>
            <textarea rows={3} value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} />
          </div>
        }
        confirmText="Списать"
        onConfirm={() => runAction(() => writeoffDefect(writeoffTarget.id, writeoffReason.trim()), 'Брак списан')}
        onCancel={() => { setWriteoffTarget(null); setWriteoffReason(''); setSubmitError(''); }}
        error={writeoffTarget ? submitError : undefined}
      />
      <ConfirmModal
        open={!!sellTarget}
        title="Продать брак"
        message={
          <div>
            <label>Клиент</label>
            <Select value={sellClient} onChange={setSellClient} options={[{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `#${c.id}` }))]} />
            <label>Цена</label>
            <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            <label>Количество</label>
            <input value={sellQty} onChange={(e) => setSellQty(e.target.value)} />
          </div>
        }
        confirmText="Продать"
        onConfirm={() => runAction(
          () => sellDefect(sellTarget.id, {
            client_id: Number(sellClient),
            price: parseLocaleNumber(sellPrice),
            quantity: parseLocaleNumber(sellQty),
            date: new Date().toISOString().slice(0, 10),
          }),
          'Продажа брака создана',
        )}
        onCancel={() => { setSellTarget(null); setSubmitError(''); }}
        error={sellTarget ? submitError : undefined}
      />
    </div>
  );
};

const DefectModal = ({ defect, onClose, onSubmit, error }) => {
  const [sourceType, setSourceType] = useState(defect?.source_type || 'return');
  const [sourceId, setSourceId] = useState(defect?.source_id != null ? String(defect.source_id) : '');
  const [product, setProduct] = useState(defect?.product || '');
  const [quantityPcs, setQuantityPcs] = useState(defect?.quantity_pcs != null ? String(defect.quantity_pcs) : '');
  const [kgCoeff, setKgCoeff] = useState(defect?.kg_coefficient != null ? String(defect.kg_coefficient) : '');
  const [reason, setReason] = useState(defect?.defect_reason || '');
  const [status, setStatus] = useState(defect?.status || 'new');
  const [comment, setComment] = useState(defect?.comment || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{defect ? 'Брак' : 'Новая запись брака'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              source_type: sourceType,
              ...(sourceId ? { source_id: Number(sourceId) } : {}),
              product: product.trim(),
              quantity_pcs: parseLocaleNumber(quantityPcs) || 0,
              ...(kgCoeff ? { kg_coefficient: parseLocaleNumber(kgCoeff) } : {}),
              defect_reason: reason.trim() || undefined,
              status,
              comment: comment.trim() || undefined,
            });
          }}
        >
          <label>Источник</label>
          <Select value={sourceType} onChange={setSourceType} options={[{ value: 'otk', label: 'ОТК' }, { value: 'return', label: 'Возврат' }]} />
          <label>ID источника</label>
          <input value={sourceId} onChange={(e) => setSourceId(e.target.value)} />
          <label>Продукт *</label>
          <input value={product} onChange={(e) => setProduct(e.target.value)} required />
          <label>Количество (шт) *</label>
          <input value={quantityPcs} onChange={(e) => setQuantityPcs(e.target.value)} required />
          <label>Коэффициент кг/ед.</label>
          <input value={kgCoeff} onChange={(e) => setKgCoeff(e.target.value)} />
          <label>Причина брака</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
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

export default DefectsPage;
