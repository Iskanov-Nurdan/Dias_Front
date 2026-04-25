import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import { cancelPayment, createPayment, getPaymentSummary } from '../../api/paymentsApi';
import './PaymentsPage.scss';

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

const typeLabel = (v) => PAYMENT_TYPES.find((x) => x.value === v)?.label || '—';
const methodLabel = (v) => PAYMENT_METHODS.find((x) => x.value === v)?.label || '—';

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'active') return 'Активна';
  if (k === 'canceled' || k === 'cancelled') return 'Отменена';
  return '—';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');

const clientFilterLabel = (c) => {
  const n = (c?.name || '').trim();
  return n || '—';
};

const paymentSaleCol = (p) => {
  const n = (p?.linked_sale_number || p?.sale_number || p?.sale?.sale_number || p?.sale?.order_number || '').trim();
  return n || '—';
};

const paymentOrderCol = (p) => {
  const n = (p?.linked_order_number || p?.order_number || p?.linked_order?.order_number || '').trim();
  return n || '—';
};

const saleOptionLabel = (x) => {
  const a = (x.sale_number || '').trim();
  const b = (x.order_number || '').trim();
  const parts = [a, b].filter(Boolean);
  return parts.length ? parts.join(' — ') : '—';
};

const orderOptionLabel = (x) => ((x.order_number || '').trim() || '—');

const returnOptionLabel = (x) => (x.return_number || '').trim() || '—';

const PaymentsPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    payment_type: '',
    client_id: '',
    date_from: '',
    date_to: '',
  });
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [createPreset, setCreatePreset] = useState(null);
  const [detailPayment, setDetailPayment] = useState(null);
  const [summary, setSummary] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items, meta, loading, error, refetch } = useServerQuery('payments/', queryState, { enabled: true });

  const loadSummary = useCallback(() => {
    const clientId = queryState.client_id;
    if (!clientId) {
      setSummary(null);
      return;
    }
    getPaymentSummary(clientId)
      .then((r) => setSummary(r.data || null))
      .catch(() => setSummary(null));
  }, [queryState.client_id]);

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
    const sid = searchParams.get('sale_id');
    const oid = searchParams.get('order_id');
    if (createPreset != null || detailPayment != null) return;
    if (!sid && !oid) return;
    const preset = {};
    const next = new URLSearchParams(searchParams);
    if (sid) {
      preset.linked_sale_id = sid;
      next.delete('sale_id');
    }
    if (oid) {
      preset.linked_order_id = oid;
      next.delete('order_id');
    }
    setCreatePreset(preset);
    setSearchParams(next, { replace: true });
  }, [searchParams, createPreset, detailPayment, setSearchParams]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const onCreateSubmit = async (payload) => {
    setSubmitError('');
    try {
      await createPayment(payload);
      setCreatePreset(null);
      refetch();
      loadSummary();
      toast.show('Оплата сохранена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения оплаты'));
    }
  };

  const onCancelPayment = async () => {
    if (!cancelTarget?.id) return;
    setSubmitError('');
    try {
      await cancelPayment(cancelTarget.id);
      setCancelTarget(null);
      setDetailPayment(null);
      refetch();
      loadSummary();
      toast.show('Платёж отменён');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка отмены'));
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <Select
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: clientFilterLabel(c) }))]}
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
          <button type="button" className="btn btn--primary" onClick={() => setCreatePreset({})}>Добавить оплату</button>
        </div>
      </div>

      {summary && queryState.client_id && (
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
                <th>№ оплаты</th>
                <th>Клиент</th>
                <th>Продажа</th>
                <th>Заявка</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Способ</th>
                <th className="data-table__cell--num">Сумма</th>
                <th>Статус</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_number || '—'}</td>
                  <td>{p.client_name || p.client?.name || '—'}</td>
                  <td>{paymentSaleCol(p)}</td>
                  <td>{paymentOrderCol(p)}</td>
                  <td>{formatDate(p.date || p.created_at)}</td>
                  <td>{typeLabel(p.payment_type)}</td>
                  <td>{methodLabel(p.payment_method)}</td>
                  <td className="data-table__cell--num">{p.amount != null ? `${formatQuantityDisplay(p.amount)} сом` : '—'}</td>
                  <td>{paymentStatusLabel(p.status)}</td>
                  <td>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        { label: 'Открыть', onClick: () => setDetailPayment(p) },
                        ...(p.status === 'active'
                          ? [{ label: 'Отменить платёж', danger: true, onClick: () => setCancelTarget(p) }]
                          : []),
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

      {createPreset !== null && (
        <PaymentCreateModal
          defaults={createPreset}
          clients={clients}
          orders={orders}
          sales={sales}
          onSubmit={onCreateSubmit}
          onClose={() => { setCreatePreset(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
      {detailPayment && (
        <PaymentDetailModal
          payment={detailPayment}
          onClose={() => setDetailPayment(null)}
          onRequestCancel={(p) => {
            setDetailPayment(null);
            setCancelTarget(p);
          }}
        />
      )}
      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить платёж?"
        message={cancelTarget ? `Отменить платёж${cancelTarget.payment_number ? ` «${cancelTarget.payment_number}»` : ''}? Сумму и привязки менять нельзя — только отмена записи.` : ''}
        confirmText="Отменить"
        onConfirm={onCancelPayment}
        onCancel={() => { setCancelTarget(null); setSubmitError(''); }}
        error={cancelTarget ? submitError : undefined}
      />
    </div>
  );
};

const PaymentDetailModal = ({ payment, onClose, onRequestCancel }) => {
  if (payment.status === 'canceled' || payment.status === 'cancelled') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal--wide payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Оплата</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          <div className="payment-modal__scroll">
            <p className="payment-modal__lede">Платёж отменён. Просмотр только для справки.</p>
            <dl className="payment-modal__dl">
              <div className="payment-modal__dl-row"><dt>№ оплаты</dt><dd>{payment.payment_number || '—'}</dd></div>
              <div className="payment-modal__dl-row"><dt>Дата</dt><dd>{formatDate(payment.date || payment.created_at)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Сумма</dt><dd>{payment.amount != null ? `${formatQuantityDisplay(payment.amount)} сом` : '—'}</dd></div>
            </dl>
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--primary" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Оплата</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="payment-modal__scroll">
          <section className="payment-modal__section">
            <h4 className="payment-modal__section-title">Документ</h4>
            <dl className="payment-modal__dl">
              <div className="payment-modal__dl-row"><dt>№ оплаты</dt><dd>{payment.payment_number || '—'}</dd></div>
              <div className="payment-modal__dl-row"><dt>Дата</dt><dd>{formatDate(payment.date || payment.created_at)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Клиент</dt><dd>{payment.client_name || payment.client?.name || '—'}</dd></div>
              <div className="payment-modal__dl-row"><dt>Связанная продажа</dt><dd>{paymentSaleCol(payment)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Связанная заявка</dt><dd>{paymentOrderCol(payment)}</dd></div>
            </dl>
          </section>
          <section className="payment-modal__section">
            <h4 className="payment-modal__section-title">Оплата</h4>
            <dl className="payment-modal__dl">
              <div className="payment-modal__dl-row"><dt>Тип</dt><dd>{typeLabel(payment.payment_type)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Способ</dt><dd>{methodLabel(payment.payment_method)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Сумма</dt><dd>{payment.amount != null ? `${formatQuantityDisplay(payment.amount)} сом` : '—'}</dd></div>
              <div className="payment-modal__dl-row"><dt>Статус</dt><dd>{paymentStatusLabel(payment.status)}</dd></div>
              {payment.payment_type === 'refund' && (
                <>
                  <div className="payment-modal__dl-row"><dt>Связанный возврат</dt><dd>{(payment.linked_return_number || '').trim() || '—'}</dd></div>
                  {payment.manual_refund_reason ? (
                    <div className="payment-modal__dl-row"><dt>Причина возврата денег</dt><dd>{payment.manual_refund_reason}</dd></div>
                  ) : null}
                </>
              )}
              <div className="payment-modal__dl-row"><dt>Комментарий</dt><dd>{payment.comment && String(payment.comment).trim() ? payment.comment : '—'}</dd></div>
            </dl>
          </section>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
          {payment.status === 'active' && (
            <button type="button" className="btn btn--danger" onClick={() => onRequestCancel(payment)}>Отменить платёж</button>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentCreateModal = ({ defaults = {}, clients, orders, sales, onSubmit, onClose, error }) => {
  const [localError, setLocalError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState('');
  const [linkedOrder, setLinkedOrder] = useState(defaults.linked_order_id != null ? String(defaults.linked_order_id) : '');
  const [linkedSale, setLinkedSale] = useState(defaults.linked_sale_id != null ? String(defaults.linked_sale_id) : '');
  const [linkedReturn, setLinkedReturn] = useState('');
  const [manualRefundReason, setManualRefundReason] = useState('');
  const [type, setType] = useState('payment');
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [returns, setReturns] = useState([]);

  useEffect(() => {
    const sid = defaults.linked_sale_id;
    if (!sid) return undefined;
    let alive = true;
    apiClient.get(`sales/${sid}/`)
      .then((r) => {
        if (!alive) return;
        const s = r.data || {};
        const cid = s.client_id ?? s.client?.id;
        if (cid != null) setClient(String(cid));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [defaults.linked_sale_id]);

  useEffect(() => {
    const oid = defaults.linked_order_id;
    if (!oid) return undefined;
    let alive = true;
    apiClient.get(`orders/${oid}/`)
      .then((r) => {
        if (!alive) return;
        const o = r.data || {};
        const cid = o.client_id ?? o.client?.id;
        if (cid != null) setClient(String(cid));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [defaults.linked_order_id]);

  useEffect(() => {
    if (type !== 'refund' || !client) {
      setReturns([]);
      return undefined;
    }
    let alive = true;
    apiClient.get('returns/', { params: { client_id: client, page_size: 200 } })
      .then((r) => {
        if (!alive) return;
        setReturns(Array.isArray(r.data?.items) ? r.data.items : []);
      })
      .catch(() => {
        if (!alive) return;
        setReturns([]);
      });
    return () => { alive = false; };
  }, [type, client]);

  const saleLocked = Boolean(defaults.linked_sale_id);
  const orderLocked = Boolean(defaults.linked_order_id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая оплата</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="payment-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            setLocalError('');
            if (!client) {
              setLocalError('Выберите клиента');
              return;
            }
            const amt = parseLocaleNumber(amount);
            if (!(amt > 0)) {
              setLocalError('Укажите сумму больше нуля');
              return;
            }
            if (type === 'refund' && !linkedReturn && !manualRefundReason.trim()) {
              setLocalError('Для возврата денег укажите связанный возврат или причину вручную');
              return;
            }
            const payload = {
              date,
              client: Number(client),
              payment_type: type,
              payment_method: method,
              amount: String(amt),
            };
            if (linkedOrder) payload.linked_order = Number(linkedOrder);
            if (linkedSale) payload.linked_sale = Number(linkedSale);
            const c = comment.trim();
            if (c) payload.comment = c;
            if (type === 'refund') {
              if (linkedReturn) payload.linked_return = Number(linkedReturn);
              if (manualRefundReason.trim()) payload.manual_refund_reason = manualRefundReason.trim();
            }
            onSubmit(payload);
          }}
        >
          <div className="payment-modal__scroll">
            <section className="payment-modal__section">
              <h4 className="payment-modal__section-title">Документ</h4>
              <label className="payment-modal__label">Клиент *</label>
              <Select
                value={client}
                onChange={setClient}
                options={[{ value: '', label: 'Выберите клиента' }, ...clients.map((x) => ({ value: String(x.id), label: clientFilterLabel(x) }))]}
              />
              <label className="payment-modal__label">Связанная продажа</label>
              <Select
                value={linkedSale}
                onChange={setLinkedSale}
                disabled={saleLocked}
                options={[{ value: '', label: 'Не выбрана' }, ...sales.map((x) => ({ value: String(x.id), label: saleOptionLabel(x) }))]}
              />
              <label className="payment-modal__label">Связанная заявка</label>
              <Select
                value={linkedOrder}
                onChange={setLinkedOrder}
                disabled={orderLocked}
                options={[{ value: '', label: 'Не выбрана' }, ...orders.map((x) => ({ value: String(x.id), label: orderOptionLabel(x) }))]}
              />
              <label className="payment-modal__label">Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </section>
            <section className="payment-modal__section">
              <h4 className="payment-modal__section-title">Оплата</h4>
              <label className="payment-modal__label">Тип оплаты *</label>
              <Select value={type} onChange={setType} options={PAYMENT_TYPES} />
              <label className="payment-modal__label">Сумма *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              <label className="payment-modal__label">Способ оплаты *</label>
              <Select value={method} onChange={setMethod} options={PAYMENT_METHODS} />
              <label className="payment-modal__label">Комментарий</label>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              {type === 'refund' && (
                <>
                  <label className="payment-modal__label">Связанный возврат</label>
                  <Select
                    value={linkedReturn}
                    onChange={setLinkedReturn}
                    options={[
                      { value: '', label: 'Не выбран' },
                      ...returns.map((x) => ({
                        value: String(x.id),
                        label: returnOptionLabel(x),
                      })),
                    ]}
                  />
                  <label className="payment-modal__label">Причина ручного возврата денег</label>
                  <textarea rows={2} value={manualRefundReason} onChange={(e) => setManualRefundReason(e.target.value)} placeholder="Если возврат не привязан к документу" />
                </>
              )}
            </section>
            {(error || localError) ? <p className="modal__error">{localError || error}</p> : null}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить оплату</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentsPage;
