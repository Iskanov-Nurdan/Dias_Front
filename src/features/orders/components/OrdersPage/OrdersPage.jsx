import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, parseLocaleNumber, formatQuantityDisplay, getApiErrorMessage } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, IntegerInput, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  createOrder,
  deleteOrder,
  downloadOrderWaybill,
  getOrderReservations,
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

const SALE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'partially_shipped', label: 'Частично отгружена' },
  { value: 'shipped', label: 'Отгружена' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

const RESERVATION_STATUS_LABELS = {
  active: 'Активен',
  released: 'Снят',
  fulfilled: 'Исполнен',
};

const ALLOWED_TRANSITIONS = {
  new: ['confirmed', 'canceled'],
  confirmed: ['in_progress', 'canceled'],
  in_progress: ['partially_shipped', 'shipped', 'canceled'],
  partially_shipped: ['shipped', 'closed', 'canceled'],
  shipped: ['closed'],
  closed: [],
  canceled: [],
};

const SOURCE_TYPE_LABELS = {
  cashier: 'Кассир',
  manager: 'Менеджер',
  boss: 'Руководитель',
  other: 'Другое',
};

const statusLabel = (value) => ORDER_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || '—';
const statusVariant = (value) => {
  const map = {
    new: 'default',
    confirmed: 'primary',
    in_progress: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[value] || 'default';
};

const saleStatusLabel = (value) => SALE_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || '—';
const saleStatusVariant = (value) => {
  const map = {
    draft: 'default',
    confirmed: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[value] || 'default';
};

const reservationStatusVariant = (value) => {
  const map = { active: 'primary', released: 'default', fulfilled: 'success' };
  return map[value] || 'default';
};

const formatDate = (value) => (value ? String(value).slice(0, 10) : '—');
const toMoney = (value) => (value != null ? `${formatQuantityDisplay(value)} сом` : '—');

const normalizeApiList = (data) => {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  return [];
};

const orderClientId = (order) => {
  if (!order) return null;
  if (order.client_id != null) return Number(order.client_id);
  const c = order.client;
  if (c != null && typeof c === 'object' && c.id != null) return Number(c.id);
  if (c != null && (typeof c === 'number' || typeof c === 'string')) return Number(c);
  return null;
};

const formatLineQty = (v) => (v != null && v !== '' ? formatQuantityDisplay(v) : '—');
const formatLineMoneyCell = (v) => (v != null && v !== '' ? toMoney(v) : '—');

const getRemainingToShip = (order) => {
  if (order?.remaining_to_ship != null) return Number(order.remaining_to_ship) || 0;
  const lines = Array.isArray(order?.lines) ? order.lines : [];
  const lineRemaining = lines.reduce((sum, line) => {
    const ordered = Number(line?.ordered_quantity ?? 0);
    const shipped = Number(line?.shipped_quantity ?? line?.shipped ?? 0);
    if (!Number.isFinite(ordered) || !Number.isFinite(shipped)) return sum;
    return sum + Math.max(ordered - shipped, 0);
  }, 0);
  if (lineRemaining > 0) return lineRemaining;
  return 0;
};

const canEditOrder = (status) => !['closed', 'canceled'].includes(status);
const canCreateShipment = (status) => ['new', 'confirmed', 'in_progress', 'partially_shipped'].includes(status);
const canAcceptPayment = (status) => ['new', 'confirmed', 'in_progress', 'partially_shipped', 'shipped'].includes(status);

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
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [shipmentTarget, setShipmentTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { items, meta, loading, error, refetch } = useServerQuery('orders/', queryState, { enabled: true });

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } })
      .then((res) => setClients(res.data?.items || []))
      .catch(() => setClients([]));
  }, []);

  useOperationalRefetch(['order', 'sale', 'payment', 'return'], refetch, true);

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
      toast.show('Статус обновлён');
    } catch (e) {
      setErrorText(getApiErrorMessage(e, 'Ошибка смены статуса'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
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
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setModalOrder({ lines: [{ product: '', product_type: '', ordered_quantity: '', unit_price: '', comment: '' }] })}
          >
            Создать заявку
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет заявок" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th className="data-table__cell--num">Сумма</th>
              <th className="data-table__cell--num">Оплачено</th>
              <th className="data-table__cell--num">Осталось отгрузить</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((o) => {
              const allowedNext = ALLOWED_TRANSITIONS[o.status] || [];
              return (
                <tr key={o.id}>
                  <td>
                    <button type="button" className="btn btn--ghost" onClick={() => setDetailOrderId(o.id)}>
                      {o.order_number || `Заявка ${o.id}`}
                    </button>
                  </td>
                  <td>{formatDate(o.date || o.created_at)}</td>
                  <td>{o.client_name || o.client?.name || '—'}</td>
                  <td><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></td>
                  <td className="data-table__cell--num">{toMoney(o.total_amount)}</td>
                  <td className="data-table__cell--num">{toMoney(o.paid_amount)}</td>
                  <td className="data-table__cell--num">{formatQuantityDisplay(getRemainingToShip(o))}</td>
                  <td>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        { label: 'Открыть', onClick: () => setDetailOrderId(o.id) },
                        { label: 'Редактировать', disabled: !canEditOrder(o.status), onClick: () => setModalOrder(o) },
                        { label: 'Создать отгрузку', disabled: !canCreateShipment(o.status), onClick: () => setShipmentTarget(o) },
                        { label: 'Принять оплату', disabled: !canAcceptPayment(o.status), onClick: () => setPaymentTarget(o) },
                        { label: 'Накладная', onClick: () => downloadOrderWaybill(o.id) },
                        ...allowedNext.map((st) => ({
                          label: `→ ${statusLabel(st)}`,
                          disabled: busyId === o.id,
                          onClick: () => onChangeStatus(o, st),
                        })),
                        { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(o) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
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
      {detailOrderId && (
        <OrderDetailModal
          orderId={detailOrderId}
          onClose={() => setDetailOrderId(null)}
          onEdit={(order) => setModalOrder(order)}
          onCreateShipment={(order) => setShipmentTarget(order)}
          onAcceptPayment={(order) => setPaymentTarget(order)}
          onStatusChange={onChangeStatus}
          busyId={busyId}
        />
      )}
      {shipmentTarget && (
        <CreateShipmentFromOrderModal
          order={shipmentTarget}
          onClose={() => setShipmentTarget(null)}
          onSuccess={() => {
            setShipmentTarget(null);
            refetch();
          }}
        />
      )}
      {paymentTarget && (
        <AcceptPaymentModal
          order={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => {
            setPaymentTarget(null);
            refetch();
          }}
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
            <button
              type="button"
              className="btn btn--secondary"
              style={{ marginTop: 8 }}
              onClick={() => setLines((prev) => [...prev, { product: '', product_type: '', ordered_quantity: '', unit_price: '', comment: '' }])}
            >
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

const OrderDetailModal = ({ orderId, onClose, onEdit, onCreateShipment, onAcceptPayment, onStatusChange, busyId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedSales, setRelatedSales] = useState([]);
  const [relatedPayments, setRelatedPayments] = useState([]);
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [orderRes, salesRes, paymentsRes, reservationsRes] = await Promise.all([
          apiClient.get(`orders/${orderId}/`),
          apiClient.get('sales/', { params: { page_size: 200, linked_order: orderId } }),
          apiClient.get('payments/', { params: { page_size: 200, linked_order: orderId } }),
          getOrderReservations(orderId).catch(() => ({ data: [] })),
        ]);
        if (!alive) return;
        setOrder(orderRes.data || null);
        setRelatedSales(salesRes.data?.items || []);
        setRelatedPayments(paymentsRes.data?.items || []);
        setReservations(normalizeApiList(reservationsRes.data));
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить карточку заявки'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [orderId]);

  const allowedNext = order ? (ALLOWED_TRANSITIONS[order.status] || []) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка заявки</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && order && (
          <div style={{ padding: '0 1.5rem 1.5rem' }}>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Общее</h4>
              <p><strong>Номер:</strong> {order.order_number || `Заявка ${order.id}`}</p>
              <p><strong>Дата:</strong> {formatDate(order.date || order.created_at)}</p>
              <p><strong>Клиент:</strong> {order.client_name || order.client?.name || '—'}</p>
              <p><strong>Источник:</strong> {SOURCE_TYPE_LABELS[order.source_type] || order.source_type || '—'}</p>
              <p><strong>Статус:</strong> <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge></p>
              {order.has_company_debt_by_goods && (
                <p><Badge variant="warning">Есть неотгруженные позиции</Badge></p>
              )}
              <p><strong>Сумма:</strong> {toMoney(order.total_amount)}</p>
              <p><strong>Отгружено:</strong> {toMoney(order.shipped_amount)}</p>
              <p><strong>Осталось отгрузить:</strong> {toMoney(order.remaining_amount)}</p>
              <p><strong>Оплачено:</strong> {toMoney(order.paid_amount)}</p>
              {order.comment && <p><strong>Комментарий:</strong> {order.comment}</p>}
            </section>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Строки заявки</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th className="data-table__cell--num">Заказано</th>
                    <th className="data-table__cell--num">Отгружено</th>
                    <th className="data-table__cell--num">Зарезервировано</th>
                    <th className="data-table__cell--num">Осталось</th>
                    <th className="data-table__cell--num">Доступно</th>
                    <th className="data-table__cell--num">Цена</th>
                    <th className="data-table__cell--num">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(order.lines) ? order.lines : []).map((line, idx) => (
                    <tr key={line.id || idx}>
                      <td>{line.product || '—'}</td>
                      <td className="data-table__cell--num">{formatLineQty(line.ordered_quantity)}</td>
                      <td className="data-table__cell--num">{formatLineQty(line.shipped_quantity)}</td>
                      <td className="data-table__cell--num">{formatLineQty(line.reserved_quantity)}</td>
                      <td className="data-table__cell--num">{formatLineQty(line.remaining_quantity)}</td>
                      <td className="data-table__cell--num">{formatLineQty(line.available_to_ship)}</td>
                      <td className="data-table__cell--num">{formatLineMoneyCell(line.unit_price)}</td>
                      <td className="data-table__cell--num">{formatLineMoneyCell(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Резервы</h4>
              {reservations.length === 0 ? (
                <p style={{ margin: 0, opacity: 0.75 }}>Резервов по заявке нет.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Товар заявки</th>
                      <th>Партия</th>
                      <th className="data-table__cell--num">Кол-во</th>
                      <th className="data-table__cell--num">Исполнено</th>
                      <th>Статус</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((r) => (
                      <tr key={r.id ?? `${r.order_line}-${r.warehouse_batch}-${r.created_at}`}>
                        <td>{r.order_line_product || '—'}</td>
                        <td>{r.warehouse_batch_product || '—'}</td>
                        <td className="data-table__cell--num">{formatQuantityDisplay(r.quantity)}</td>
                        <td className="data-table__cell--num">{formatQuantityDisplay(r.fulfilled_quantity ?? 0)}</td>
                        <td>
                          <Badge variant={reservationStatusVariant(r.status)}>
                            {RESERVATION_STATUS_LABELS[r.status] || r.status || '—'}
                          </Badge>
                        </td>
                        <td>{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Связанные отгрузки</h4>
              {relatedSales.length === 0 ? <p>Нет связанных отгрузок</p> : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Номер</th>
                      <th>Дата</th>
                      <th>Статус</th>
                      <th className="data-table__cell--num">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedSales.map((sale) => (
                      <tr key={sale.id}>
                        <td>{sale.order_number || sale.sale_number || `Отгрузка ${sale.id}`}</td>
                        <td>{formatDate(sale.date || sale.sale_date || sale.created_at)}</td>
                        <td>
                          <Badge variant={saleStatusVariant(sale.sale_status)}>
                            {saleStatusLabel(sale.sale_status)}
                          </Badge>
                        </td>
                        <td className="data-table__cell--num">{toMoney(sale.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Связанные оплаты</h4>
              {relatedPayments.length === 0 ? <p>Нет связанных оплат</p> : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Тип</th>
                      <th>Способ</th>
                      <th className="data-table__cell--num">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatedPayments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.date || payment.created_at)}</td>
                        <td>{PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type || '—'}</td>
                        <td>{PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method || '—'}</td>
                        <td className="data-table__cell--num">{toMoney(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <div className="modal__actions">
              <button type="button" className="btn btn--secondary" onClick={() => onEdit(order)} disabled={!canEditOrder(order.status)}>Редактировать</button>
              <button type="button" className="btn btn--secondary" onClick={() => onCreateShipment(order)} disabled={!canCreateShipment(order.status)}>Создать отгрузку</button>
              <button type="button" className="btn btn--secondary" onClick={() => onAcceptPayment(order)} disabled={!canAcceptPayment(order.status)}>Принять оплату</button>
              {allowedNext.length > 0 && (
                <Select
                  value=""
                  onChange={(nextStatus) => nextStatus && onStatusChange(order, nextStatus)}
                  placeholder={busyId === order.id ? 'Обновление...' : 'Сменить статус'}
                  options={[
                    { value: '', label: 'Сменить статус' },
                    ...allowedNext.map((st) => ({ value: st, label: statusLabel(st) })),
                  ]}
                />
              )}
              <button type="button" className="btn btn--primary" onClick={() => downloadOrderWaybill(order.id)}>Накладная</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PAYMENT_TYPE_LABELS = {
  prepayment: 'Предоплата',
  payment: 'Оплата',
  surcharge: 'Доплата',
  refund: 'Возврат',
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Наличные',
  transfer: 'Перевод',
  card: 'Карта',
  other: 'Другое',
};

const CreateShipmentFromOrderModal = ({ order, onClose, onSuccess }) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState(
    Array.isArray(order?.lines) && order.lines.length
      ? order.lines.map((line) => ({
        order_line: line.id,
        product: line.product || '',
        quantity: String(line.ordered_quantity || ''),
        unit_price: String(line.unit_price || ''),
      }))
      : [],
  );

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payloadLines = lines
        .map((line) => ({
          ...(line.order_line ? { order_line: Number(line.order_line) } : {}),
          product: String(line.product || '').trim(),
          quantity: parseLocaleNumber(line.quantity) || 0,
          ...(line.unit_price ? { unit_price: parseLocaleNumber(line.unit_price) } : {}),
        }))
        .filter((line) => line.product && line.quantity > 0);
      if (payloadLines.length === 0) {
        setError('Добавьте хотя бы одну строку с товаром и количеством.');
        return;
      }
      const cid = orderClientId(order);
      await apiClient.post('sales/', {
        date,
        ...(cid != null ? { client: cid } : {}),
        linked_order: Number(order.id),
        lines: payloadLines,
      });
      toast.show('Отгрузка создана');
      onSuccess();
    } catch (e2) {
      setError(getApiErrorMessage(e2, 'Не удалось создать отгрузку из заявки'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Создать отгрузку из заявки</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={submit}>
          <label>Дата отгрузки</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <label>Клиент</label>
          <input value={order?.client_name || order?.client?.name || 'Без клиента'} disabled />
          <div style={{ marginTop: 12 }}>
            <strong>Строки отгрузки</strong>
            {lines.map((line, idx) => (
              <div key={line.order_line || idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                <label>Товар</label>
                <input value={line.product} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)))} />
                <label>Количество</label>
                <IntegerInput min={1} value={line.quantity} onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: v } : x)))} />
                <label>Цена</label>
                <input value={line.unit_price} onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))} />
              </div>
            ))}
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>{submitting ? 'Создание...' : 'Создать отгрузку'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AcceptPaymentModal = ({ order, onClose, onSuccess }) => {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState('prepayment');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const parsedAmount = parseLocaleNumber(amount);
      if (!(parsedAmount > 0)) {
        setError('Сумма должна быть больше нуля.');
        return;
      }
      const cid = orderClientId(order);
      await apiClient.post('payments/', {
        date,
        ...(cid != null ? { client: cid } : {}),
        linked_order: Number(order.id),
        payment_type: paymentType,
        payment_method: paymentMethod,
        amount: parsedAmount,
      });
      toast.show('Оплата принята');
      onSuccess();
    } catch (e2) {
      setError(getApiErrorMessage(e2, 'Не удалось принять оплату'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Принять оплату по заявке</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form onSubmit={submit}>
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <label>Клиент</label>
          <input value={order?.client_name || order?.client?.name || 'Без клиента'} disabled />
          <label>Тип оплаты</label>
          <Select
            value={paymentType}
            onChange={setPaymentType}
            options={[
              { value: 'prepayment', label: 'Предоплата' },
              { value: 'payment', label: 'Оплата' },
              { value: 'surcharge', label: 'Доплата' },
              { value: 'refund', label: 'Возврат денег' },
            ]}
          />
          <label>Способ оплаты</label>
          <Select
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={[
              { value: 'cash', label: 'Наличные' },
              { value: 'transfer', label: 'Перевод' },
              { value: 'card', label: 'Карта' },
              { value: 'other', label: 'Другое' },
            ]}
          />
          <label>Сумма</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>{submitting ? 'Сохранение...' : 'Принять оплату'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrdersPage;
