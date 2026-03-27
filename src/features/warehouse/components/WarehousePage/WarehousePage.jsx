import React, { useState } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatNumberForInput,
  parseLocaleNumber,
  resolveInventoryForm,
  inventoryFormLabel,
  inventoryFormBadgeModifier,
  warehouseStockStatusRu,
  getWarehouseQuantityPresentation,
} from '../../../../shared/lib';
import { buildWarehouseBatchCardRows } from '../warehouseBatchCard';
import { EmptyState, ErrorState, Loading, useToast, DecimalInput, ConfirmModal, ActionMenu } from '../../../../shared/ui';
import Select from '../../../../shared/ui/Select/Select';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import PackFromOtkModal from '../PackFromOtkModal';
import './WarehousePage.scss';

const statusLabel = (status) => warehouseStockStatusRu(status);

const WarehouseBatchDetailModal = ({ batch, onClose }) => {
  if (!batch) return null;
  const rows = buildWarehouseBatchCardRows(batch);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide warehouse-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Партия</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="warehouse-detail-modal__grid">
          {rows.map(({ label, value }, i) => (
            <React.Fragment key={`${label}-${i}`}>
              <div className="warehouse-detail-modal__label">{label}</div>
              <div className="warehouse-detail-modal__value">{value}</div>
            </React.Fragment>
          ))}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
};

const WarehousePage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    status: '',
    search: '',
    inventory_form: '',
  });
  const [reserveTarget, setReserveTarget] = useState(null);
  const [detailBatch, setDetailBatch] = useState(null);
  const [packOpen, setPackOpen] = useState(false);
  const [packError, setPackError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { items, loading, error, refetch } = useServerQuery('warehouse/batches/', queryState, { enabled: true });

  useOperationalRefetch('warehouse_batch', refetch, true);

  const rows = items || [];

  const handleReserve = async (batchId, quantity, saleId) => {
    setSubmitError('');
    try {
      await apiClient.post('warehouse/batches/reserve/', {
        batch_id: Number(batchId),
        quantity: Number(quantity),
        ...(saleId ? { sale_id: Number(saleId) } : {}),
      });
      setReserveTarget(null);
      refetch();
      toast.show('Успешно зарезервировано');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || data?.message || 'Ошибка';
      setSubmitError(msg);
    }
  };

  return (
    <div className="page page--warehouse">
      <div className="page--warehouse__toolbar ds-toolbar ds-toolbar--page-head">
        <div className="ds-toolbar__start page--warehouse__filters">
          <input
            type="text"
            className="ds-toolbar__search page--warehouse__search"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <Select
            className="page--warehouse__select"
            value={queryState.status}
            placeholder="Статус"
            options={[
              { value: '', label: 'Все статусы' },
              { value: 'available', label: 'Доступно' },
              { value: 'reserved', label: 'Резерв' },
              { value: 'shipped', label: 'Продано' },
            ]}
            onChange={(val) => setQueryState((p) => ({ ...p, status: val, page: 1 }))}
          />
          <Select
            className="page--warehouse__select"
            value={queryState.inventory_form}
            placeholder="Форма"
            options={[
              { value: '', label: 'Все формы' },
              { value: 'unpacked', label: 'Не упаковано' },
              { value: 'packed', label: 'Упаковано' },
              { value: 'open_package', label: 'Открытая упаковка' },
            ]}
            onChange={(val) => setQueryState((p) => ({ ...p, inventory_form: val, page: 1 }))}
          />
        </div>
        <div className="ds-toolbar__end">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => { setPackError(''); setPackOpen(true); }}
          >
            Упаковать
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && rows.length === 0 && (
        <EmptyState title="Нет партий" />
      )}
      {!loading && (!error || error.status === 404) && rows.length > 0 && (
        <table className="data-table data-table--fixed data-table--warehouse data-table--row-actions data-table--clickable">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Продукт</th>
              <th>Количество</th>
              <th>Партия</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const qty = b.quantity ?? b.available_quantity ?? 0;
              const canReserve = String(b.status || '').toLowerCase() === 'available';
              const productLabel = (b.product_name && String(b.product_name).trim()) || b.product?.name || b.product || '—';
              const inv = resolveInventoryForm(b);
              const invMod = inventoryFormBadgeModifier(inv);
              const qtyPres = getWarehouseQuantityPresentation(b);
              return (
                <tr
                  key={b.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => setDetailBatch(b)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailBatch(b);
                    }
                  }}
                >
                  <td>
                    <div className="warehouse-table__status-stack">
                      <span className={`badge badge--${String(b.status || '').toLowerCase()}`}>
                        {statusLabel(b.status)}
                      </span>
                      <span className={`warehouse-inv-badge warehouse-inv-badge--${invMod} warehouse-inv-badge--inline`}>
                        {inventoryFormLabel(inv)}
                      </span>
                    </div>
                  </td>
                  <td className="data-table__cell--lead">{productLabel}</td>
                  <td
                    className="data-table__qty-cell data-table__cell--num"
                    title={qtyPres.title || undefined}
                  >
                    <div className="warehouse-qty-cell">
                      <span className="warehouse-qty-cell__primary">{qtyPres.primary}</span>
                      {qtyPres.secondary && (
                        <span className="warehouse-qty-cell__secondary">{qtyPres.secondary}</span>
                      )}
                    </div>
                  </td>
                  <td className="warehouse-table__batch data-table__cell--muted data-table__cell--num">{b.batch || b.lot || `#${b.id}`}</td>
                  <td>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        {
                          label: 'Резерв',
                          disabled: !canReserve,
                          onClick: () => setReserveTarget({
                            id: b.id,
                            quantity: qty,
                            product: productLabel,
                          }),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {reserveTarget && (
        <ReserveModal
          batch={reserveTarget}
          onClose={() => { setReserveTarget(null); setSubmitError(''); }}
          onSubmit={handleReserve}
          error={submitError}
        />
      )}

      {detailBatch && (
        <WarehouseBatchDetailModal
          batch={detailBatch}
          onClose={() => setDetailBatch(null)}
        />
      )}

      <PackFromOtkModal
        open={packOpen}
        onClose={() => { setPackOpen(false); setPackError(''); }}
        onSuccess={() => {
          refetch();
          toast.show('Упаковка выполнена');
        }}
        error={packError}
        setExternalError={setPackError}
      />
    </div>
  );
};

const ReserveModal = ({ batch, onClose, onSubmit, error }) => {
  const [quantity, setQuantity] = useState(
    batch?.quantity != null && batch?.quantity !== ''
      ? formatNumberForInput(batch.quantity)
      : '1',
  );
  const [saleId, setSaleId] = useState('');

  const isDirty = useDirtyFromBaseline(String(batch?.id ?? ''), false, {
    quantity: String(quantity ?? '').trim(),
    saleId: String(saleId ?? '').trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Резерв</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(
              batch.id,
              parseLocaleNumber(quantity),
              saleId ? Number(saleId) : undefined,
            );
          }}
        >
          <div className="modal__field">
            <label>Продукт</label>
            <input value={batch.product} readOnly />
          </div>
          <div className="modal__field">
            <label>Количество *</label>
            <DecimalInput min={1} value={quantity} onChange={setQuantity} required />
          </div>
          <details className="warehouse-reserve__more">
            <summary>Дополнительно</summary>
            <div className="modal__field">
              <label>№ продажи</label>
              <input
                type="number"
                min="1"
                placeholder="Необязательно"
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
              />
            </div>
          </details>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Зарезервировать</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarehousePage;
