import React, { useMemo, useState } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { EmptyState, ErrorState, Loading, useToast } from '../../../../shared/ui';
import Select from '../../../../shared/ui/Select/Select';
import { apiClient } from '../../../../shared/api';
import './WarehousePage.scss';

const statusLabel = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'available') return 'Доступна';
  if (s === 'reserved') return 'В резерве';
  if (s === 'shipped') return 'Отгружена';
  return status || '—';
};

const WarehousePage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '', search: '' });
  const [reserveTarget, setReserveTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items, loading, error, refetch } = useServerQuery('warehouse/batches/', queryState, { enabled: true });

  const rows = useMemo(() => items || [], [items]);

  const handleReserve = async (batchId, quantity, saleId) => {
    setSubmitError('');
    try {
      await apiClient.post('warehouse/batches/reserve/', {
        batchId: Number(batchId),
        quantity: Number(quantity),
        ...(saleId ? { saleId: Number(saleId) } : {}),
      });
      setReserveTarget(null);
      refetch();
      toast.show('Успешно зарезервировано');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.code ? `[${data.code}] ${data.error || 'Ошибка'}` : (data?.error || 'Ошибка');
      setSubmitError(msg);
    }
  };

  return (
    <div className="page page--warehouse">
      <div className="page__filters">
        <input
          type="text"
          className="page__filters-search"
          placeholder="Поиск по продукту..."
          value={queryState.search}
          onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={queryState.status}
          placeholder="Все статусы"
          options={[
            { value: '', label: 'Все статусы' },
            { value: 'available', label: 'Доступна' },
            { value: 'reserved', label: 'В резерве' },
            { value: 'shipped', label: 'Отгружена' },
          ]}
          onChange={(val) => setQueryState((p) => ({ ...p, status: val, page: 1 }))}
        />
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && rows.length === 0 && (
        <EmptyState title="Нет партий" />
      )}
      {!loading && (!error || error.status === 404) && rows.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Статус</th>
              <th>Продукт</th>
              <th>Кол-во</th>
              <th>Партия</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const qty = b.quantity ?? b.available_quantity ?? 0;
              const canReserve = String(b.status || '').toLowerCase() === 'available';
              return (
                <tr key={b.id}>
                  <td>
                    <span className={`badge badge--${String(b.status || '').toLowerCase()}`}>
                      {statusLabel(b.status)}
                    </span>
                  </td>
                  <td>{b.product_name || b.product?.name || b.product || '—'}</td>
                  <td>{qty}</td>
                  <td>{b.batch || b.lot || `#${b.id}`}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={!canReserve}
                      onClick={() => setReserveTarget({ id: b.id, quantity: qty, product: b.product_name || b.product || `#${b.id}` })}
                    >
                      Резерв
                    </button>
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
    </div>
  );
};

const ReserveModal = ({ batch, onClose, onSubmit, error }) => {
  const [quantity, setQuantity] = useState(batch?.quantity ? String(batch.quantity) : '1');
  const [saleId, setSaleId] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Резерв</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(batch.id, Number(quantity), saleId ? Number(saleId) : undefined);
          }}
        >
          <label>Продукт</label>
          <input value={batch.product} readOnly />
          <label>Количество *</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <label>ID продажи</label>
          <input
            type="number"
            min="1"
            placeholder="Опционально"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
          />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Зарезервировать</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WarehousePage;
