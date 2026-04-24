import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import { createPayment, deletePayment, getPaymentSummary, updatePayment } from '../../api/paymentsApi';

const PAYMENT_TYPES = [
  { value: 'prepayment', label: 'Предоплата' },
  { value: 'payment', label: 'Оплата' },
  { value: 'surcharge', label: 'Доплата' },
  { value: 'refund', label: 'Возврат денег' },
];
const PAYMENT_METHODS = [
  { value: 'cash', label: 'Наличные' },
  { value: 'transfer', label: 'Перевод' },
  { value: 'card', label: 'Карта' },
  { value: 'other', label: 'Другое' },
];

const typeLabel = (v) => PAYMENT_TYPES.find((x) => x.value === v)?.label || v || '—';
const methodLabel = (v) => PAYMENT_METHODS.find((x) => x.value === v)?.label || v || '—';

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');

const PaymentsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    payment_type: '',
    client: '',
    date_from: '',
    date_to: '',
  });
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [modalPayment, setModalPayment] = useState(null);
  const [summary, setSummary] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items, meta, loading, error, refetch } = useServerQuery('payments/', queryState, { enabled: true });

  const loadSummary = useCallback(() => {
    const clientId = queryState.client;
    if (!clientId) {
      setSummary(null);
      return;
    }
    getPaymentSummary(clientId)
      .then((r) => setSummary(r.data || null))
      .catch(() => setSummary(null));
  }, [queryState.client]);

  const reloadOperational = useCallback(() => {
    refetch();
    loadSummary();
  }, [refetch, loadSummary]);

  useOperationalRefetch(['payment', 'sale', 'order', 'return'], reloadOperational, true);

  useEffect(() => {
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
    apiClient.get('orders/', { params: { page_size: 500 } }).then((r) => setOrders(r.data?.items || [])).catch(() => setOrders([]));
    apiClient.get('sales/', { params: { page_size: 500 } }).then((r) => setSales(r.data?.items || [])).catch(() => setSales([]));
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalPayment?.id) await updatePayment(modalPayment.id, payload);
      else await createPayment(payload);
      setModalPayment(null);
      refetch();
      loadSummary();
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
      loadSummary();
      toast.show('Оплата удалена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка удаления'));
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <Select
            value={queryState.client}
            onChange={(v) => setQueryState((p) => ({ ...p, client: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `#${c.id}` }))]}
          />
          <Select
            value={queryState.payment_type}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_type: v, page: 1 }))}
            placeholder="Тип оплаты"
            options={[{ value: '', label: 'Все типы' }, ...PAYMENT_TYPES]}
          />
          <label className="commercial-date-filter">
            <span className="commercial-date-filter__label">С</span>
            <input
              type="date"
              value={queryState.date_from}
              onChange={(e) => setQueryState((p) => ({ ...p, date_from: e.target.value, page: 1 }))}
            />
          </label>
          <label className="commercial-date-filter">
            <span className="commercial-date-filter__label">По</span>
            <input
              type="date"
              value={queryState.date_to}
              onChange={(e) => setQueryState((p) => ({ ...p, date_to: e.target.value, page: 1 }))}
            />
          </label>
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalPayment({})}>Добавить оплату</button>
        </div>
      </div>

      {summary && queryState.client && (
        <div className="commercial-summary">
          <p className="commercial-summary__title">Сводка по клиенту</p>
          {summary.client_name && (
            <div style={{ marginTop: 6 }}>{summary.client_name}</div>
          )}
          <div className="commercial-summary__grid" style={{ marginTop: 8 }}>
            <div>Оплачено (брутто): {formatQuantityDisplay(summary.total_paid_gross ?? 0)} сом</div>
            <div>Возвратов денег: {formatQuantityDisplay(summary.total_refunded ?? 0)} сом</div>
            <div>Оплачено (нетто): {formatQuantityDisplay(summary.total_paid_net ?? 0)} сом</div>
            <div>Выручка: {formatQuantityDisplay(summary.total_revenue ?? 0)} сом</div>
            <div>Долг: {formatQuantityDisplay(summary.client_debt_money ?? 0)} сом</div>
            <div>Аванс: {formatQuantityDisplay(summary.client_advance_amount ?? 0)} сом</div>
          </div>
        </div>
      )}

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет оплат" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
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
                <td>{p.payment_number || '—'}</td>
                <td>{formatDate(p.date || p.created_at)}</td>
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
        </div>
      )}

      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
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
        message={deleteTarget ? `Удалить платёж${deleteTarget.payment_number ? ` «${deleteTarget.payment_number}»` : ''}?` : ''}
        confirmText="Удалить"
        onConfirm={onDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const saleOptionLabel = (x) => x.order_number || x.sale_number || `Продажа #${x.id}`;

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
          <Select value={linkedOrder} onChange={setLinkedOrder} options={[{ value: '', label: 'Нет' }, ...orders.map((x) => ({ value: String(x.id), label: x.order_number || `Заявка #${x.id}` }))]} />
          <label>Связанная продажа</label>
          <Select value={linkedSale} onChange={setLinkedSale} options={[{ value: '', label: 'Нет' }, ...sales.map((x) => ({ value: String(x.id), label: saleOptionLabel(x) }))]} />
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
