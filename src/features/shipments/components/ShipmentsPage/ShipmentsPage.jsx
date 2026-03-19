import React, { useState, useCallback, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { ServerList, FilterBar, ConfirmModal, useToast } from '../../../../shared/ui';
import {
  createShipment,
  updateShipment,
  deleteShipment,
  shipShipment,
  deliverShipment,
} from '../../api/shipmentsApi';
import { apiClient } from '../../../../shared/api';
import './ShipmentsPage.scss';

const SHIPMENTS_FILTERS = [
  { key: 'status', type: 'select', placeholder: 'Статус', options: [
    { value: 'pending', label: 'Ожидает' },
    { value: 'shipped', label: 'Отгружено' },
    { value: 'delivered', label: 'Доставлено' },
  ]},
  { key: 'client', type: 'select', placeholder: 'Клиент', options: [] },
  {
    key: 'ordering',
    type: 'ordering',
    placeholder: 'Сортировка',
    options: [
      { value: 'id', label: 'По ID' },
      { value: '-id', label: 'По ID (убыв.)' },
    ],
  },
];

const cleanQuery = (q) => {
  const copy = { ...q };
  Object.keys(copy).forEach((k) => {
    if (copy[k] === '' || copy[k] == null) delete copy[k];
  });
  return copy;
};

const statusLabel = (s) => ({ pending: 'Ожидает', shipped: 'Отгружено', delivered: 'Доставлено' }[s] ?? s);

const ShipmentsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    status: '',
    client: '',
    ordering: '',
  });
  const [shipmentModal, setShipmentModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [sales, setSales] = useState([]);

  const { items, meta, loading, error, refetch } = useServerQuery('shipments/', queryState);

  useEffect(() => {
    apiClient.get('sales/', { params: { page_size: 500 } })
      .then((res) => setSales(res.data?.items || []))
      .catch(() => setSales([]));
  }, []);

  const handleFilterChange = useCallback((patch) => {
    setQueryState((prev) => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page) => {
    setQueryState((prev) => ({ ...prev, page }));
  }, []);

  const handleShipmentSubmit = async (data) => {
    setSubmitError('');
    try {
      if (shipmentModal?.id) {
        await updateShipment(shipmentModal.id, data);
      } else {
        await createShipment(data);
      }
      setShipmentModal(null);
      refetch();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleStatusChange = async (shipmentId, action, date) => {
    setSubmitError('');
    try {
      if (action === 'ship') {
        await shipShipment(shipmentId, date ? { shipment_date: date } : {});
      } else if (action === 'deliver') {
        await deliverShipment(shipmentId, date ? { delivery_date: date } : {});
      }
      setStatusModal(null);
      refetch();
      toast.show('Статус обновлён');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await deleteShipment(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  return (
    <div className="page page--shipments">
      <ServerList
        loading={loading}
        error={error}
        items={items}
        meta={meta}
        onRetry={refetch}
        renderFilters={() => (
          <div className="shipments-toolbar">
            <FilterBar
              filters={SHIPMENTS_FILTERS}
              queryState={cleanQuery(queryState)}
              onChange={handleFilterChange}
            />
            <button type="button" className="btn btn--primary shipments-toolbar__create" onClick={() => setShipmentModal({})}>
              + Создать отгрузку
            </button>
          </div>
        )}
        renderTable={(listItems) => (
          <table className="data-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Продукт</th>
                <th>Кол-во</th>
                <th>Статус</th>
                <th>Адрес</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listItems.map((s) => (
                <tr key={s.id}>
                  <td>{s.client_name ?? '—'}</td>
                  <td>{s.product_name ?? '—'}</td>
                  <td>{s.quantity}</td>
                  <td>
                    <span className={`badge badge--${s.status}`}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                  <td>{s.address || '—'}</td>
                  <td>
                    {s.status === 'pending' && (
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => setStatusModal({ id: s.id, action: 'ship' })}
                      >
                        Отгрузить
                      </button>
                    )}
                    {s.status === 'shipped' && (
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        onClick={() => setStatusModal({ id: s.id, action: 'deliver' })}
                      >
                        Доставлено
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setShipmentModal(s)}
                    >
                      Ред.
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setDeleteTarget({ id: s.id, name: `#${s.id}` })}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        renderPagination={(m) => (
          <>
            {m.page > 1 && <button onClick={() => handlePageChange(m.page - 1)}>← Назад</button>}
            <span>Страница {m.page} из {m.total_pages}</span>
            {m.page < m.total_pages && <button onClick={() => handlePageChange(m.page + 1)}>Вперёд →</button>}
          </>
        )}
      />

      {shipmentModal !== null && (
        <ShipmentModal
          shipment={shipmentModal?.id ? shipmentModal : null}
          sales={sales}
          onSubmit={handleShipmentSubmit}
          onClose={() => { setShipmentModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {statusModal && (
        <StatusModal
          shipment={statusModal}
          onSubmit={handleStatusChange}
          onClose={() => { setStatusModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить отгрузку?"
        message={deleteTarget ? `Удалить отгрузку ${deleteTarget.name}?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const ShipmentModal = ({ shipment, sales, onSubmit, onClose, error }) => {
  const [saleId, setSaleId] = useState(shipment?.sale_id ?? '');
  const [quantity, setQuantity] = useState(shipment?.quantity ?? '');
  const [address, setAddress] = useState(shipment?.address ?? '');
  const [comment, setComment] = useState(shipment?.comment ?? '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{shipment ? 'Редактировать отгрузку' : 'Создать отгрузку'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              sale_id: Number(saleId),
              quantity: Number(quantity),
              address: address || undefined,
              comment: comment || undefined,
            });
          }}
        >
          <label>Продажа *</label>
          <select value={saleId} onChange={(e) => setSaleId(e.target.value)} required>
            <option value="">— Выберите продажу —</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} - {s.client_name ?? '—'} - {s.product_name ?? '—'} ({s.quantity ?? 0} шт)
              </option>
            ))}
          </select>
          <label>Количество *</label>
          <input
            type="number"
            min="1"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <label>Адрес доставки</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="г. Москва, ул. Ленина, 1"
          />
          <label>Комментарий</label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Опционально"
          />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StatusModal = ({ shipment, onSubmit, onClose, error }) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const isShip = shipment.action === 'ship';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isShip ? 'Отгрузить' : 'Доставлено'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(shipment.id, shipment.action, date);
          }}
        >
          <label>{isShip ? 'Дата отгрузки' : 'Дата доставки'}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary">
              {isShip ? 'Отгрузить' : 'Доставлено'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShipmentsPage;
