import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, parseLocaleNumber, formatQuantityDisplay, getApiErrorMessage } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, IntegerInput, Loading, Select, useToast } from '../../../../shared/ui';
import {
  createOrder,
  deleteOrder,
  downloadOrderWaybill,
  patchOrderStatus,
  updateOrder,
} from '../../api/ordersApi';

const ORDER_STATUS_OPTIONS = [
  { value: 'new', label: 'Новая' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'partially_shipped', label: 'Частично отгружена' },
  { value: 'shipped', label: 'Отгружена' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

const statusLabel = (value) => ORDER_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || '—';

const lineToPayload = (line) => ({
  product: String(line.product || '').trim(),
  product_type: String(line.product_type || '').trim() || undefined,
  ordered_quantity: parseLocaleNumber(line.ordered_quantity) || 0,
  unit_price: parseLocaleNumber(line.unit_price) || undefined,
  comment: String(line.comment || '').trim() || undefined,
});

const OrdersPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '', status: '' });
  const [clients, setClients] = useState([]);
  const [modalOrder, setModalOrder] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { items, loading, error, refetch } = useServerQuery('orders/', queryState, { enabled: true });

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } })
      .then((res) => setClients(res.data?.items || []))
      .catch(() => setClients([]));
  }, []);

  useOperationalRefetch(['order', 'sale', 'payment'], refetch, true);

  const onSubmitOrder = async (payload) => {
    setErrorText('');
    try {
      if (modalOrder?.id) await updateOrder(modalOrder.id, payload);
      else await createOrder(payload);
      setModalOrder(null);
      refetch();
      toast.show('Заявка сохранена');
    } catch (e) {
      setErrorText(getApiErrorMessage(e, 'Ошибка сохранения заявки'));
    }
  };

  const onDeleteOrder = async () => {
    if (!deleteTarget?.id) return;
    setErrorText('');
    try {
      await deleteOrder(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Заявка удалена');
    } catch (e) {
      setErrorText(getApiErrorMessage(e, 'Ошибка удаления'));
    }
  };

  const onChangeStatus = async (order, status) => {
    setErrorText('');
    setBusyId(order.id);
    try {
      await patchOrderStatus(order.id, status);
      refetch();
      toast.show('Статус обновлен');
    } catch (e) {
      setErrorText(getApiErrorMessage(e, 'Ошибка смены статуса'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start">
          <input
            type="text"
            className="ds-toolbar__search ds-toolbar__search--full"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        <div className="ds-toolbar__end">
          <Select
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            placeholder="Статус"
            options={[{ value: '', label: 'Все статусы' }, ...ORDER_STATUS_OPTIONS]}
          />
          <button type="button" className="btn btn--primary" onClick={() => setModalOrder({ lines: [{ product: '', product_type: '', ordered_quantity: '', unit_price: '', comment: '' }] })}>
            Создать заявку
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет заявок" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Заявка</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th className="data-table__cell--num">Сумма</th>
              <th className="data-table__cell--num">Оплачено</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td>{o.order_number || `#${o.id}`}</td>
                <td>{(o.date || o.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td>{o.client_name || o.client?.name || '—'}</td>
                <td>{statusLabel(o.status)}</td>
                <td className="data-table__cell--num">{o.total_amount != null ? `${formatQuantityDisplay(o.total_amount)} сом` : '—'}</td>
                <td className="data-table__cell--num">{o.paid_amount != null ? `${formatQuantityDisplay(o.paid_amount)} сом` : '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalOrder(o) },
                      { label: 'Накладная', onClick: () => downloadOrderWaybill(o.id) },
                      ...ORDER_STATUS_OPTIONS.filter((st) => st.value !== o.status).map((st) => ({
                        label: `Статус: ${st.label}`,
                        disabled: busyId === o.id,
                        onClick: () => onChangeStatus(o, st.value),
                      })),
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(o) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {errorText && !modalOrder && <p className="modal__error">{errorText}</p>}
      {modalOrder && (
        <OrderModal
          order={modalOrder?.id ? modalOrder : null}
          clients={clients}
          onClose={() => { setModalOrder(null); setErrorText(''); }}
          onSubmit={onSubmitOrder}
          error={errorText}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить заявку?"
        message={deleteTarget ? `Удалить "${deleteTarget.order_number || `#${deleteTarget.id}`}"?` : ''}
        confirmText="Удалить"
        onConfirm={onDeleteOrder}
        onCancel={() => { setDeleteTarget(null); setErrorText(''); }}
        error={deleteTarget ? errorText : undefined}
      />
    </div>
  );
};

const OrderModal = ({ order, clients, onClose, onSubmit, error }) => {
  const [saleDate, setSaleDate] = useState((order?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState(order?.client_id != null ? String(order.client_id) : '');
  const [sourceType, setSourceType] = useState(order?.source_type || 'manager');
  const [comment, setComment] = useState(order?.comment || '');
  const [responsibleUser, setResponsibleUser] = useState(order?.responsible_user_id != null ? String(order.responsible_user_id) : '');
  const [lines, setLines] = useState(
    Array.isArray(order?.lines) && order.lines.length
      ? order.lines.map((x) => ({
        id: x.id,
        product: x.product || '',
        product_type: x.product_type || '',
        ordered_quantity: x.ordered_quantity != null ? String(x.ordered_quantity) : '',
        unit_price: x.unit_price != null ? String(x.unit_price) : '',
        comment: x.comment || '',
      }))
      : [{ product: '', product_type: '', ordered_quantity: '', unit_price: '', comment: '' }],
  );

  const total = lines.reduce((sum, line) => {
    const q = parseLocaleNumber(line.ordered_quantity);
    const p = parseLocaleNumber(line.unit_price);
    if (!(q > 0) || !(p >= 0)) return sum;
    return sum + q * p;
  }, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{order ? 'Заявка' : 'Новая заявка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const filteredLines = lines
              .map(lineToPayload)
              .filter((x) => x.product && (parseLocaleNumber(x.ordered_quantity) > 0));
            if (!filteredLines.length) return;
            onSubmit({
              ...(client ? { client: Number(client) } : {}),
              date: saleDate,
              source_type: sourceType,
              comment: comment.trim() || undefined,
              ...(responsibleUser ? { responsible_user_id: Number(responsibleUser) } : {}),
              lines: filteredLines,
            });
          }}
        >
          <label>Дата</label>
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          <label>Клиент</label>
          <Select
            value={client}
            onChange={setClient}
            options={[{ value: '', label: 'Без клиента' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `Клиент #${c.id}` }))]}
          />
          <label>Источник</label>
          <Select
            value={sourceType}
            onChange={setSourceType}
            options={[
              { value: 'cashier', label: 'Кассир' },
              { value: 'manager', label: 'Менеджер' },
              { value: 'boss', label: 'Руководитель' },
              { value: 'other', label: 'Другое' },
            ]}
          />
          <label>Ответственный user_id</label>
          <IntegerInput min={1} value={responsibleUser} onChange={setResponsibleUser} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

          <div style={{ marginTop: 12 }}>
            <strong>Строки заявки</strong>
            {lines.map((line, idx) => (
              <div key={line.id || idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                <label>Товар *</label>
                <input value={line.product} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)))} />
                <label>Тип товара</label>
                <input value={line.product_type} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product_type: e.target.value } : x)))} />
                <label>Количество *</label>
                <IntegerInput min={1} value={line.ordered_quantity} onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ordered_quantity: v } : x)))} />
                <label>Цена</label>
                <input value={line.unit_price} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))} />
                <label>Комментарий</label>
                <input value={line.comment} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))} />
                <button type="button" className="btn btn--secondary" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>Удалить строку</button>
              </div>
            ))}
            <button type="button" className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => setLines((prev) => [...prev, { product: '', product_type: '', ordered_quantity: '', unit_price: '', comment: '' }])}>
              Добавить строку
            </button>
          </div>
          <p style={{ marginTop: 8 }}>Итого: <strong>{formatQuantityDisplay(total)} сом</strong></p>
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

export default OrdersPage;
