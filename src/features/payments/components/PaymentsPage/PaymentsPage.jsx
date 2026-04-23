import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Select, useToast } from '../../../../shared/ui';
import { createPayment, deletePayment, getPaymentSummary, updatePayment } from '../../api/paymentsApi';

const PAYMENT_TYPES = [
  { value: 'prepayment', label: 'Предоплата' },
  { value: 'payment', label: 'Оплата' },
  { value: 'surcharge', label: 'Доплата' },
  { value: 'refund', label: 'Возврат' },
];
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'card', label: 'Карта' },
  { value: 'other', label: 'Другое' },
];

const typeLabel = (v) => PAYMENT_TYPES.find((x) => x.value === v)?.label || v || '—';
const methodLabel = (v) => PAYMENT_METHODS.find((x) => x.value === v)?.label || v || '—';

const PaymentsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, payment_type: '', client_id: '' });
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [modalPayment, setModalPayment] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items, loading, error, refetch } = useServerQuery('payments/', queryState, { enabled: true });
  useOperationalRefetch(['payment', 'sale', 'order'], refetch, true);

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
    apiClient.get('orders/', { params: { page_size: 500 } }).then((r) => setOrders(r.data?.items || [])).catch(() => setOrders([]));
    apiClient.get('sales/', { params: { page_size: 500 } }).then((r) => setSales(r.data?.items || [])).catch(() => setSales([]));
  }, []);

  useEffect(() => {
    const clientId = queryState.client_id;
    if (!clientId) {
      setSummary(null);
      return;
    }
    getPaymentSummary(clientId).then((r) => setSummary(r.data)).catch(() => setSummary(null));
  }, [queryState.client_id]);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalPayment?.id) await updatePayment(modalPayment.id, payload);
      else await createPayment(payload);
      setModalPayment(null);
      refetch();
      toast.show('Оплата сохранена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения оплаты'));
    }
  };

  const onDelete = async () => {
    if (!deleteTarget?.id) return;
    setSubmitError('');
    try {
      await deletePayment(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Оплата удалена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления'));
    }
  };

  return (
    <div className="page">
      <div className="ds-toolbar ds-toolbar--stack-mobile">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `#${c.id}` }))]}
          />
          <Select
            value={queryState.payment_type}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_type: v, page: 1 }))}
            placeholder="Тип оплаты"
            options={[{ value: '', label: 'Все типы' }, ...PAYMENT_TYPES]}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalPayment({})}>Добавить оплату</button>
        </div>
      </div>

      {summary && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <strong>Сводка клиента:</strong>
          <div>Оплачено нетто: {formatQuantityDisplay(summary.total_paid_net || 0)} сом</div>
          <div>Выручка: {formatQuantityDisplay(summary.total_revenue || 0)} сом</div>
          <div>Долг: {formatQuantityDisplay(summary.client_debt_money || 0)} сом</div>
          <div>Аванс: {formatQuantityDisplay(summary.client_advance_amount || 0)} сом</div>
        </div>
      )}

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет оплат" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--row-actions">
          <thead>
            <tr>
              <th>Платеж</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Тип</th>
              <th>Способ</th>
              <th className="data-table__cell--num">Сумма</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td>{p.payment_number || `#${p.id}`}</td>
                <td>{(p.date || p.created_at || '').toString().slice(0, 10) || '—'}</td>
                <td>{p.client_name || p.client?.name || '—'}</td>
                <td>{typeLabel(p.payment_type)}</td>
                <td>{methodLabel(p.payment_method)}</td>
                <td className="data-table__cell--num">{p.amount != null ? `${formatQuantityDisplay(p.amount)} сом` : '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Редактировать', onClick: () => setModalPayment(p) },
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget(p) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalPayment && (
        <PaymentModal
          payment={modalPayment?.id ? modalPayment : null}
          clients={clients}
          orders={orders}
          sales={sales}
          onSubmit={onSubmit}
          onClose={() => { setModalPayment(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить оплату?"
        message={deleteTarget ? `Удалить "${deleteTarget.payment_number || `#${deleteTarget.id}`}"?` : ''}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const PaymentModal = ({ payment, clients, orders, sales, onSubmit, onClose, error }) => {
  const [date, setDate] = useState((payment?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState(payment?.client_id != null ? String(payment.client_id) : '');
  const [linkedOrder, setLinkedOrder] = useState(payment?.linked_order_id != null ? String(payment.linked_order_id) : '');
  const [linkedSale, setLinkedSale] = useState(payment?.linked_sale_id != null ? String(payment.linked_sale_id) : '');
  const [type, setType] = useState(payment?.payment_type || 'payment');
  const [method, setMethod] = useState(payment?.payment_method || 'cash');
  const [amount, setAmount] = useState(payment?.amount != null ? String(payment.amount) : '');
  const [comment, setComment] = useState(payment?.comment || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{payment ? 'Оплата' : 'Новая оплата'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amt = parseLocaleNumber(amount);
            if (!(amt > 0)) return;
            onSubmit({
              date,
              ...(client ? { client: Number(client) } : {}),
              ...(linkedOrder ? { linked_order: Number(linkedOrder) } : {}),
              ...(linkedSale ? { linked_sale: Number(linkedSale) } : {}),
              payment_type: type,
              payment_method: method,
              amount: amt,
              comment: comment.trim() || undefined,
            });
          }}
        >
          <label>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label>Клиент</label>
          <Select value={client} onChange={setClient} options={[{ value: '', label: 'Не выбран' }, ...clients.map((x) => ({ value: String(x.id), label: x.name || `#${x.id}` }))]} />
          <label>Связанная заявка</label>
          <Select value={linkedOrder} onChange={setLinkedOrder} options={[{ value: '', label: 'Нет' }, ...orders.map((x) => ({ value: String(x.id), label: x.order_number || `#${x.id}` }))]} />
          <label>Связанная продажа</label>
          <Select value={linkedSale} onChange={setLinkedSale} options={[{ value: '', label: 'Нет' }, ...sales.map((x) => ({ value: String(x.id), label: x.sale_number || `#${x.id}` }))]} />
          <label>Тип оплаты</label>
          <Select value={type} onChange={setType} options={PAYMENT_TYPES} />
          <label>Способ оплаты</label>
          <Select value={method} onChange={setMethod} options={PAYMENT_METHODS} />
          <label>Сумма *</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
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

export default PaymentsPage;
