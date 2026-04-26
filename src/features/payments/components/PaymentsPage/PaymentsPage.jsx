import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDate } from '../../../../shared/constants/common';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, SearchableSelect, useToast } from '../../../../shared/ui';
import {
  cancelPayment,
  createPayment,
  getPayment,
  getPaymentsSummary,
  getPaymentSelectSources,
} from '../../api/paymentsApi';
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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активна' },
  { value: 'canceled', label: 'Отменена' },
];

const typeLabel = (v) => PAYMENT_TYPES.find((x) => x.value === String(v || '').toLowerCase())?.label || '—';
const methodLabel = (v) => PAYMENT_METHODS.find((x) => x.value === String(v || '').toLowerCase())?.label || '—';

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'active') return 'Активна';
  if (k === 'canceled' || k === 'cancelled') return 'Отменена';
  return '—';
};

const paymentSummaryStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'unpaid') return 'Не оплачено';
  if (k === 'partially_paid') return 'Частично оплачено';
  if (k === 'paid') return 'Оплачено';
  if (k === 'overpaid') return 'Переплата';
  if (k === 'refunded') return 'Возврат денег';
  return '—';
};

const toMoney = (v) => (v != null && v !== '' ? `${formatQuantityDisplay(v)} сом` : '—');
const textOrDash = (v) => (v == null || v === '' ? '—' : String(v));

const PAYMENT_ERROR_TEXT = {
  missing_client: 'Выберите клиента.',
  inactive_client: 'Клиент неактивен.',
  invalid_amount: 'Сумма должна быть больше 0.',
  invalid_payment_type: 'Выберите корректный тип оплаты.',
  invalid_payment_method: 'Выберите корректный способ оплаты.',
  missing_linked_entity: 'Выберите продажу, заявку или возврат.',
  client_mismatch: 'Клиент не совпадает со связанным документом.',
  refund_reason_required: 'Укажите причину ручного возврата.',
  refund_return_required: 'Выберите возврат для возврата денег.',
  refund_return_not_completed: 'Возврат товара еще не проведен.',
  refund_amount_exceeded: 'Сумма возврата денег превышает доступную.',
  payment_status_update_forbidden: 'Статус оплаты нельзя менять вручную.',
  payment_already_canceled: 'Оплата уже отменена.',
  delete_disabled: 'Удаление оплат отключено.',
  not_found: 'Клиент не найден.',
};

const paymentErrorMessage = (err, fallback) => {
  const code = String(err?.response?.data?.code || '').toLowerCase();
  if (PAYMENT_ERROR_TEXT[code]) return PAYMENT_ERROR_TEXT[code];
  return getApiErrorMessage(err, fallback);
};

const clientFilterLabel = (c) => {
  const n = (c?.name || '').trim();
  return n || '—';
};

const paymentSaleCol = (p) => textOrDash(p?.linked_sale_number || p?.sale_number || p?.sale?.sale_number || p?.sale?.order_number);

const paymentOrderCol = (p) => textOrDash(p?.linked_order_number || p?.order_number || p?.linked_order?.order_number);
const paymentReturnCol = (p) => textOrDash(p?.linked_return_number || p?.return_number || p?.linked_return?.return_number);

const saleOptionLabel = (x) => textOrDash(x.label || x.sale_number || x.order_number);
const orderOptionLabel = (x) => textOrDash(x.label || x.order_number);
const returnOptionLabel = (x) => textOrDash(x.label || x.return_number);

const PaymentsPage = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    payment_method: '',
    status: '',
    payment_type: '',
    client_id: '',
  });
  const [selectSources, setSelectSources] = useState({ clients: [], orders: [], sales: [], returns: [] });
  const [createOpen, setCreateOpen] = useState(false);
  const [detailPaymentId, setDetailPaymentId] = useState(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [urlPreset, setUrlPreset] = useState(null);

  const { items, meta, loading, error, refetch } = useServerQuery('payments/', queryState, { enabled: true });

  const loadSelectSources = useCallback(async (params = {}) => {
    try {
      const res = await getPaymentSelectSources(params);
      const d = res.data || {};
      setSelectSources({
        clients: Array.isArray(d.clients) ? d.clients : [],
        orders: Array.isArray(d.orders) ? d.orders : [],
        sales: Array.isArray(d.sales) ? d.sales : [],
        returns: Array.isArray(d.returns) ? d.returns : [],
      });
    } catch {
      setSelectSources({ clients: [], orders: [], sales: [], returns: [] });
    }
  }, []);

  const loadSummary = useCallback(async (clientId) => {
    if (!clientId) {
      setSummary(null);
      setSummaryError('');
      return;
    }
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const r = await getPaymentsSummary(clientId);
      setSummary(r.data || null);
    } catch (e) {
      setSummary(null);
      setSummaryError(paymentErrorMessage(e, 'Клиент не найден.'));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const reloadOperational = useCallback(() => {
    refetch();
    loadSummary(queryState.client_id);
  }, [refetch, loadSummary, queryState.client_id]);

  useOperationalRefetch(['payment', 'sale', 'order', 'return'], reloadOperational, true);

  useEffect(() => {
    loadSelectSources();
  }, [loadSelectSources]);

  useEffect(() => {
    const sid = searchParams.get('sale_id');
    const oid = searchParams.get('order_id');
    const rid = searchParams.get('return_id');
    if (createOpen || detailPaymentId != null) return;
    if (!sid && !oid && !rid) return;
    const preset = {};
    const next = new URLSearchParams(searchParams);
    if (sid) {
      preset.sale_id = sid;
      next.delete('sale_id');
    }
    if (oid) {
      preset.order_id = oid;
      next.delete('order_id');
    }
    if (rid) {
      preset.return_id = rid;
      next.delete('return_id');
    }
    setUrlPreset(preset);
    setCreateOpen(true);
    setSearchParams(next, { replace: true });
  }, [searchParams, createOpen, detailPaymentId, setSearchParams]);

  useEffect(() => {
    loadSummary(queryState.client_id);
  }, [loadSummary, queryState.client_id]);

  const onCreateSubmit = async (payload) => {
    setSubmitError('');
    try {
      await createPayment(payload);
      setCreateOpen(false);
      setUrlPreset(null);
      refetch();
      loadSummary(payload.client);
      toast.show('Оплата сохранена');
    } catch (e) {
      setSubmitError(paymentErrorMessage(e, 'Ошибка сохранения оплаты'));
    }
  };

  const onCancelPayment = async () => {
    if (!cancelTarget?.id) return;
    setSubmitError('');
    try {
      await cancelPayment(cancelTarget.id);
      setCancelTarget(null);
      setDetailPaymentId(null);
      setDetailRefreshKey((x) => x + 1);
      refetch();
      if (queryState.client_id) loadSummary(queryState.client_id);
      toast.show('Платёж отменён');
    } catch (e) {
      setSubmitError(paymentErrorMessage(e, 'Ошибка отмены'));
    }
  };

  const clients = selectSources.clients;

  return (
    <div className="page commercial-page page--payments">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <input
            type="text"
            className="ds-toolbar__search"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <SearchableSelect
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: clientFilterLabel(c) }))]}
          />
          <SearchableSelect
            value={queryState.payment_type}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_type: v, page: 1 }))}
            placeholder="Тип оплаты"
            options={[{ value: '', label: 'Все типы' }, ...PAYMENT_TYPES]}
          />
          <SearchableSelect
            value={queryState.payment_method}
            onChange={(v) => setQueryState((p) => ({ ...p, payment_method: v, page: 1 }))}
            placeholder="Способ оплаты"
            options={[{ value: '', label: 'Все способы' }, ...PAYMENT_METHODS]}
          />
          <SearchableSelect
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            placeholder="Статус"
            options={[{ value: '', label: 'Все' }, ...STATUS_OPTIONS]}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--secondary" onClick={() => setSummaryOpen(true)} disabled={!queryState.client_id}>
            Сводка клиента
          </button>
          <button type="button" className="btn btn--primary" onClick={() => { setUrlPreset(null); setCreateOpen(true); }}>
            Создать оплату
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет оплат" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--fixed data-table--row-actions data-table--payments">
            <thead>
              <tr>
                <th>№ оплаты</th>
                <th>Клиент</th>
                <th>Продажа</th>
                <th>Заявка</th>
                <th>Возврат</th>
                <th>Дата</th>
                <th>Тип</th>
                <th>Способ</th>
                <th className="data-table__cell--num">Сумма</th>
                <th>Статус</th>
                <th className="data-table__cell--actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_number || '—'}</td>
                  <td>{p.client_name || p.client?.name || '—'}</td>
                  <td>{paymentSaleCol(p)}</td>
                  <td>{paymentOrderCol(p)}</td>
                  <td>{paymentReturnCol(p)}</td>
                  <td>{formatDate(p.date || p.created_at)}</td>
                  <td>{typeLabel(p.payment_type)}</td>
                  <td>{methodLabel(p.payment_method)}</td>
                  <td className="data-table__cell--num">{toMoney(p.amount)}</td>
                  <td>
                    <Badge variant={String(p.status || '').toLowerCase() === 'active' ? 'success' : 'default'}>
                      {paymentStatusLabel(p.status)}
                    </Badge>
                  </td>
                  <td>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        { label: 'Открыть', onClick: () => setDetailPaymentId(p.id) },
                        ...(p.status === 'active'
                          ? [{ label: 'Отменить', danger: true, onClick: () => setCancelTarget(p) }]
                          : []),
                        ...(p.client || p.client_id
                          ? [{ label: 'Финсводка клиента', onClick: () => setQueryState((s) => ({ ...s, client_id: String(p.client_id || p.client?.id || s.client_id) })) }]
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

      {createOpen && (
        <PaymentCreateModal
          defaults={urlPreset || {}}
          onSubmit={onCreateSubmit}
          onClose={() => { setCreateOpen(false); setSubmitError(''); setUrlPreset(null); }}
          error={submitError}
        />
      )}
      {detailPaymentId && (
        <PaymentDetailModal
          paymentId={detailPaymentId}
          refreshKey={detailRefreshKey}
          onClose={() => setDetailPaymentId(null)}
          onRequestCancel={(p) => {
            setDetailPaymentId(null);
            setCancelTarget(p);
          }}
        />
      )}
      <PaymentSummaryModal
        open={summaryOpen}
        summary={summary}
        loading={summaryLoading}
        error={summaryError}
        clientId={queryState.client_id}
        onClose={() => setSummaryOpen(false)}
      />
      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить платёж?"
        message={cancelTarget ? `Отменить платёж${cancelTarget.payment_number ? ` «${cancelTarget.payment_number}»` : ''}?` : ''}
        confirmText="Отменить"
        onConfirm={onCancelPayment}
        onCancel={() => { setCancelTarget(null); setSubmitError(''); }}
        error={cancelTarget ? submitError : undefined}
      />
    </div>
  );
};

const PaymentDetailModal = ({ paymentId, refreshKey, onClose, onRequestCancel }) => {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getPayment(paymentId);
        if (!alive) return;
        setPayment(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(paymentErrorMessage(e, 'Не удалось загрузить оплату.'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [paymentId, refreshKey]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal--wide payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Оплата</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          <div className="payment-modal__scroll"><Loading /></div>
        </div>
      </div>
    );
  }
  if (error || !payment) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal--wide payment-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Оплата</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          <div className="payment-modal__scroll"><ErrorState error={{ userMessage: error || 'Оплата не найдена' }} /></div>
          <div className="modal__actions"><button type="button" className="btn btn--primary" onClick={onClose}>Закрыть</button></div>
        </div>
      </div>
    );
  }

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
              <div className="payment-modal__dl-row"><dt>Сумма</dt><dd>{toMoney(payment.amount)}</dd></div>
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
              <div className="payment-modal__dl-row"><dt>Статус</dt><dd>{paymentStatusLabel(payment.status)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Комментарий</dt><dd>{payment.comment && String(payment.comment).trim() ? payment.comment : '—'}</dd></div>
            </dl>
          </section>
          <section className="payment-modal__section">
            <h4 className="payment-modal__section-title">Связь</h4>
            <dl className="payment-modal__dl">
              <div className="payment-modal__dl-row"><dt>Связанная продажа</dt><dd>{paymentSaleCol(payment)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Связанная заявка</dt><dd>{paymentOrderCol(payment)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Связанный возврат</dt><dd>{paymentReturnCol(payment)}</dd></div>
            </dl>
          </section>
          <section className="payment-modal__section">
            <h4 className="payment-modal__section-title">Оплата</h4>
            <dl className="payment-modal__dl">
              <div className="payment-modal__dl-row"><dt>Тип</dt><dd>{typeLabel(payment.payment_type)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Способ</dt><dd>{methodLabel(payment.payment_method)}</dd></div>
              <div className="payment-modal__dl-row"><dt>Сумма</dt><dd>{toMoney(payment.amount)}</dd></div>
              {payment.payment_type === 'refund' && (
                <>
                  {payment.manual_refund_reason ? (
                    <div className="payment-modal__dl-row"><dt>Причина возврата денег</dt><dd>{payment.manual_refund_reason}</dd></div>
                  ) : null}
                </>
              )}
            </dl>
          </section>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
          {payment.status === 'active' && (
            <button type="button" className="btn btn--danger" onClick={() => onRequestCancel(payment)}>Отменить</button>
          )}
        </div>
      </div>
    </div>
  );
};

const PaymentCreateModal = ({ defaults = {}, onSubmit, onClose, error }) => {
  const [localError, setLocalError] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState('');
  const [linkedOrder, setLinkedOrder] = useState(defaults.order_id != null ? String(defaults.order_id) : '');
  const [linkedSale, setLinkedSale] = useState(defaults.sale_id != null ? String(defaults.sale_id) : '');
  const [linkedReturn, setLinkedReturn] = useState(defaults.return_id != null ? String(defaults.return_id) : '');
  const [manualRefundReason, setManualRefundReason] = useState('');
  const [type, setType] = useState('payment');
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [selectSources, setSelectSources] = useState({ clients: [], orders: [], sales: [], returns: [] });

  const loadSources = useCallback(async (params = {}) => {
    try {
      const res = await getPaymentSelectSources(params);
      const d = res.data || {};
      setSelectSources({
        clients: Array.isArray(d.clients) ? d.clients : [],
        orders: Array.isArray(d.orders) ? d.orders : [],
        sales: Array.isArray(d.sales) ? d.sales : [],
        returns: Array.isArray(d.returns) ? d.returns : [],
      });
      return d;
    } catch {
      setSelectSources({ clients: [], orders: [], sales: [], returns: [] });
      return {};
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    const run = async () => {
      if (defaults.sale_id) {
        const d = await loadSources({ sale_id: defaults.sale_id });
        const s = Array.isArray(d.sales) ? d.sales.find((x) => String(x.id) === String(defaults.sale_id)) : null;
        if (s?.client_id != null) setClient(String(s.client_id));
        setLinkedSale(String(defaults.sale_id));
        setType('payment');
        if (s?.debt_amount != null) setAmount(String(s.debt_amount));
      } else if (defaults.order_id) {
        const d = await loadSources({ order_id: defaults.order_id });
        const o = Array.isArray(d.orders) ? d.orders.find((x) => String(x.id) === String(defaults.order_id)) : null;
        if (o?.client_id != null) setClient(String(o.client_id));
        setLinkedOrder(String(defaults.order_id));
        setType('prepayment');
        if (o?.debt_amount != null) setAmount(String(o.debt_amount));
      } else if (defaults.return_id) {
        const d = await loadSources({ return_id: defaults.return_id });
        const r = Array.isArray(d.returns) ? d.returns.find((x) => String(x.id) === String(defaults.return_id)) : null;
        if (r?.client_id != null) setClient(String(r.client_id));
        setLinkedReturn(String(defaults.return_id));
        setType('refund');
        if (r?.return_amount != null) setAmount(String(r.return_amount));
      }
    };
    run();
  }, [defaults.order_id, defaults.return_id, defaults.sale_id, loadSources]);

  useEffect(() => {
    if (!client) return;
    loadSources({ client_id: client });
  }, [client, loadSources]);

  const canSubmit = useMemo(() => {
    const amt = parseLocaleNumber(amount);
    if (!client) return false;
    if (!(amt > 0)) return false;
    if (!type || !method) return false;
    if (type === 'prepayment') return Boolean(linkedOrder);
    if (type === 'payment' || type === 'surcharge') return Boolean(linkedSale || linkedOrder);
    if (type === 'refund') return Boolean(linkedReturn || manualRefundReason.trim());
    return false;
  }, [amount, client, linkedOrder, linkedReturn, linkedSale, manualRefundReason, method, type]);

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
              <label className="payment-modal__label">Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <label className="payment-modal__label">Клиент *</label>
              <SearchableSelect
                value={client}
                onChange={setClient}
                options={[{ value: '', label: 'Выберите клиента' }, ...selectSources.clients.map((x) => ({ value: String(x.id), label: clientFilterLabel(x) }))]}
              />
            </section>
            <section className="payment-modal__section">
              <h4 className="payment-modal__section-title">Связь</h4>
              <label className="payment-modal__label">Продажа</label>
              <SearchableSelect
                value={linkedSale}
                onChange={setLinkedSale}
                options={[{ value: '', label: 'Не выбрана' }, ...selectSources.sales.map((x) => ({ value: String(x.id), label: saleOptionLabel(x) }))]}
              />
              <label className="payment-modal__label">Заявка</label>
              <SearchableSelect
                value={linkedOrder}
                onChange={setLinkedOrder}
                options={[{ value: '', label: 'Не выбрана' }, ...selectSources.orders.map((x) => ({ value: String(x.id), label: orderOptionLabel(x) }))]}
              />
              <label className="payment-modal__label">Возврат</label>
              <SearchableSelect
                value={linkedReturn}
                onChange={setLinkedReturn}
                options={[{ value: '', label: 'Не выбран' }, ...selectSources.returns.map((x) => ({ value: String(x.id), label: returnOptionLabel(x) }))]}
              />
            </section>
            <section className="payment-modal__section">
              <h4 className="payment-modal__section-title">Оплата</h4>
              <label className="payment-modal__label">Тип оплаты *</label>
              <SearchableSelect value={type} onChange={setType} options={PAYMENT_TYPES} />
              <label className="payment-modal__label">Сумма *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              <label className="payment-modal__label">Способ оплаты *</label>
              <SearchableSelect value={method} onChange={setMethod} options={PAYMENT_METHODS} />
              <label className="payment-modal__label">Комментарий</label>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              {type === 'refund' && (
                <>
                  <label className="payment-modal__label">Причина ручного возврата денег</label>
                  <textarea rows={2} value={manualRefundReason} onChange={(e) => setManualRefundReason(e.target.value)} placeholder="Если возврат не привязан к документу" />
                </>
              )}
            </section>
            {(error || localError) ? <p className="modal__error">{localError || error}</p> : null}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>Сохранить оплату</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PaymentSummaryModal = ({ open, summary, loading, error, clientId, onClose }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Сводка клиента</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="payment-modal__scroll">
          {!clientId && <EmptyState title="Выберите клиента в фильтре" />}
          {loading && <Loading />}
          {!loading && error && <ErrorState error={{ userMessage: error }} />}
          {!loading && !error && summary && (
            <section className="payment-modal__section">
              <dl className="payment-modal__dl">
                <div className="payment-modal__dl-row"><dt>Выручка</dt><dd>{toMoney(summary.total_revenue)}</dd></div>
                <div className="payment-modal__dl-row"><dt>Оплачено</dt><dd>{toMoney(summary.total_paid_net)}</dd></div>
                <div className="payment-modal__dl-row"><dt>Возвращено</dt><dd>{toMoney(summary.total_refunded)}</dd></div>
                <div className="payment-modal__dl-row"><dt>Долг</dt><dd>{toMoney(summary.client_debt_money)}</dd></div>
                <div className="payment-modal__dl-row"><dt>Аванс</dt><dd>{toMoney(summary.client_advance_amount)}</dd></div>
                <div className="payment-modal__dl-row"><dt>Статус оплаты</dt><dd>{paymentSummaryStatusLabel(summary.payment_status)}</dd></div>
              </dl>
            </section>
          )}
        </div>
        <div className="modal__actions"><button type="button" className="btn btn--primary" onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
};

export default PaymentsPage;
