import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
} from '../../../../shared/lib';
import {
  ActionMenu,
  Badge,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  Select,
  useToast,
} from '../../../../shared/ui';
import { apiClient } from '../../../../shared/api';
import { useAuth } from '../../../auth/model/AuthProvider';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { downloadSaleReceipt, getSalesSelectSources } from '../../api/salesApi';
import WaybillPreviewModal from './WaybillPreviewModal';
import './SalesPage.scss';

const SALE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'partially_shipped', label: 'Частично отгружена' },
  { value: 'shipped', label: 'Отгружена' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

const statusLabel = (v) => SALE_STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';
const statusVariant = (v) => {
  const map = {
    draft: 'default',
    confirmed: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[v] || 'default';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => (v != null ? `${formatQuantityDisplay(v)} сом` : '—');

const saleClientIdFromRow = (sale) => (sale?.client_id != null ? String(sale.client_id) : '');
const saleLinkedOrderIdFromRow = (sale) => (sale?.linked_order_id != null ? String(sale.linked_order_id) : '');

const formatApiErrorDetail = (data, fallback) => {
  let msg = fallback;
  if (data?.credit_limit) {
    msg = `Кредитный лимит: ${Array.isArray(data.credit_limit) ? data.credit_limit.join(', ') : data.credit_limit}`;
  } else if (typeof data?.detail === 'string' && data.detail) {
    msg = data.detail;
  } else if (data?.code === 'CREDIT_LIMIT_BLOCKED' && typeof data?.error === 'string') {
    msg = data.error;
  } else if (typeof data?.error === 'string' && data.error) {
    msg = data.error;
  }
  return msg;
};

const isCreditLimitError = (err) => {
  const d = err?.response?.data;
  if (!d) return false;
  if (d.credit_limit) return true;
  if (d.code === 'CREDIT_LIMIT_BLOCKED') return true;
  return false;
};

/** По BACKEND_MASTER: право override — credit_limit_override и/или is_staff. */
const canForceCreditOverride = (user) => {
  if (!user) return false;
  if (user.is_staff === true || user.is_superuser === true) return true;
  if (user.credit_limit_override === true) return true;
  const acc = user.accesses;
  return Array.isArray(acc) && acc.includes('credit_limit_override');
};

const SalesPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    sale_status: '',
    client: '',
    date_from: '',
    date_to: '',
  });
  const [clients, setClients] = useState([]);
  const [modalSale, setModalSale] = useState(null);
  const [detailSaleId, setDetailSaleId] = useState(null);
  const [waybillPreviewSaleId, setWaybillPreviewSaleId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [creditOverride, setCreditOverride] = useState(null);
  const [creditOverrideBusy, setCreditOverrideBusy] = useState(false);
  const [creditOverrideError, setCreditOverrideError] = useState('');

  const { items, meta, loading, error, refetch } = useServerQuery('sales/', queryState, { enabled: true });

  const loadSelectSources = useCallback((clientId = '') => {
    getSalesSelectSources(clientId)
      .then((res) => {
        const data = res.data || {};
        setClients(Array.isArray(data.clients) ? data.clients : []);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => { loadSelectSources(); }, [loadSelectSources]);

  const reloadOperational = useCallback(() => {
    refetch();
    loadSelectSources(queryState.client);
  }, [refetch, loadSelectSources, queryState.client]);

  useOperationalRefetch(['sale', 'warehouse_batch', 'order', 'payment', 'return'], reloadOperational, true);

  const handleSubmit = async (payload, options = {}) => {
    const { forceCreditOverride = false } = options;
    setSubmitError('');
    try {
      const res = modalSale?.id
        ? await apiClient.patch(`sales/${modalSale.id}/`, payload)
        : await apiClient.post(
          'sales/',
          forceCreditOverride ? { ...payload, force_credit_override: true } : payload,
        );
      refetch();
      toast.show('Сохранено');
      return { id: res.data?.id || modalSale?.id };
    } catch (err) {
      const data = err.response?.data;
      if (
        !modalSale?.id
        && !forceCreditOverride
        && isCreditLimitError(err)
        && canForceCreditOverride(user)
      ) {
        setCreditOverride({
          mode: 'create',
          payload,
          message: formatApiErrorDetail(data, getApiErrorMessage(err, 'Превышен кредитный лимит')),
        });
        setSubmitError('');
        return null;
      }
      let msg = getApiErrorMessage(err, 'Ошибка сохранения');
      msg = formatApiErrorDetail(data, msg);
      if (data?.details && typeof data.details === 'object' && typeof msg === 'string') {
        const details = Object.entries(data.details)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
        if (details) msg = [msg, details].filter(Boolean).join('. ');
      }
      setSubmitError(msg);
      return null;
    }
  };

  const handleChangeStatus = async (sale, status, options = {}) => {
    const { forceCreditOverride = false } = options;
    setBusyId(sale.id);
    setSubmitError('');
    try {
      await apiClient.patch(`sales/${sale.id}/status/`, {
        status,
        ...(forceCreditOverride ? { force_credit_override: true } : {}),
      });
      refetch();
      toast.show('Статус обновлён');
    } catch (err) {
      const data = err.response?.data;
      if (!forceCreditOverride && isCreditLimitError(err) && canForceCreditOverride(user)) {
        setCreditOverride({
          mode: 'status',
          saleId: sale.id,
          status,
          message: formatApiErrorDetail(data, getApiErrorMessage(err, 'Превышен кредитный лимит')),
        });
      } else {
        const msg = formatApiErrorDetail(data, getApiErrorMessage(err, 'Ошибка смены статуса'));
        toast.show(msg, 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmCreditOverride = async () => {
    if (!creditOverride || creditOverrideBusy) return;
    setCreditOverrideError('');
    setCreditOverrideBusy(true);
    try {
      if (creditOverride.mode === 'create') {
        await apiClient.post('sales/', { ...creditOverride.payload, force_credit_override: true });
        setCreditOverride(null);
        setModalSale(null);
        refetch();
        toast.show('Продажа создана');
      } else {
        await apiClient.patch(`sales/${creditOverride.saleId}/status/`, {
          status: creditOverride.status,
          force_credit_override: true,
        });
        setCreditOverride(null);
        refetch();
        toast.show('Статус обновлён');
      }
    } catch (err) {
      setCreditOverrideError(getApiErrorMessage(err, 'Операция не выполнена'));
    } finally {
      setCreditOverrideBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await apiClient.delete(`sales/${deleteTarget.id}/`);
      setDeleteTarget(null);
      refetch();
      toast.show('Удалено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка удаления'));
    }
  };

  const onOpenWaybillPreview = (saleRow) => {
    if (!saleRow?.id) return;
    setWaybillPreviewSaleId(saleRow.id);
  };

  const onDownloadReceipt = async (saleRow) => {
    if (!saleRow?.id) return;
    setBusyId(saleRow.id);
    try {
      await downloadSaleReceipt(saleRow.id);
      toast.show('Квитанция скачана');
    } catch (e) {
      toast.show(e?.userMessage || e?.message || 'Не удалось скачать квитанцию', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page page--sales commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <Select
            value={queryState.sale_status}
            onChange={(v) => setQueryState((p) => ({ ...p, sale_status: v, page: 1 }))}
            placeholder="Статус"
            options={[{ value: '', label: 'Все статусы' }, ...SALE_STATUS_OPTIONS]}
          />
          <Select
            value={queryState.client}
            onChange={(v) => setQueryState((p) => ({ ...p, client: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || `Клиент #${c.id}` }))]}
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
          <button type="button" className="btn btn--primary" onClick={() => setModalSale({})}>
            Создать продажу
          </button>
        </div>
      </div>
      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет продаж" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--fixed data-table--sales data-table--row-actions">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Номер</th>
              <th>Заявка</th>
              <th>Статус</th>
              <th className="data-table__cell--num">Выручка</th>
              <th className="data-table__cell--num">Оплачено</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const allowedNext = Array.isArray(s.available_status_transitions) ? s.available_status_transitions : [];
              const availableActions = Array.isArray(s.available_actions) ? s.available_actions : [];
              return (
                <tr key={s.id}>
                  <td>
                    <button type="button" className="btn btn--ghost" onClick={() => setDetailSaleId(s.id)}>
                      {formatDate(s.date || s.created_at)}
                    </button>
                  </td>
                  <td>{s.client_name || '—'}</td>
                  <td>{s.order_number || s.sale_number || `#${s.id}`}</td>
                  <td>{s.linked_order_number || '—'}</td>
                  <td><Badge variant={statusVariant(s.sale_status)}>{statusLabel(s.sale_status)}</Badge></td>
                  <td className="data-table__cell--num">{toMoney(s.revenue)}</td>
                  <td className="data-table__cell--num">{toMoney(s.paid_amount)}</td>
                  <td>
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        {
                          label: 'Открыть',
                          onClick: () => setDetailSaleId(s.id),
                        },
                        {
                          label: 'Редактировать',
                          disabled: !availableActions.includes('edit'),
                          onClick: () => setModalSale(s),
                        },
                        {
                          label: 'Накладная',
                          disabled: busyId === s.id,
                          onClick: () => onOpenWaybillPreview(s),
                        },
                        {
                          label: 'Квитанция',
                          disabled: busyId === s.id,
                          onClick: () => onDownloadReceipt(s),
                        },
                        ...allowedNext.map((st) => {
                          const nextStatus = st?.status || st;
                          return ({
                          label: `→ ${statusLabel(nextStatus)}`,
                          disabled: busyId === s.id,
                          onClick: () => handleChangeStatus(s, nextStatus),
                        });
                        }),
                        {
                          label: 'Удалить',
                          danger: true,
                          onClick: () => setDeleteTarget({ id: s.id, name: s.order_number || s.sale_number || `Продажа #${s.id}` }),
                        },
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

      {submitError && !modalSale && !deleteTarget && (
        <p className="modal__error sales-page__error">{submitError}</p>
      )}

      {modalSale !== null && (
        <SaleModal
          sale={modalSale?.id ? modalSale : null}
          clients={clients}
          onSubmit={handleSubmit}
          onClose={() => { setModalSale(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {detailSaleId && (
        <SaleDetailModal
          saleId={detailSaleId}
          onClose={() => setDetailSaleId(null)}
          onEdit={(sale) => {
            setDetailSaleId(null);
            setModalSale(sale);
          }}
          onOpenWaybillPreview={(sale) => onOpenWaybillPreview(sale)}
          onDownloadReceipt={(sale) => onDownloadReceipt(sale)}
          onChangeStatus={(sale, status) => handleChangeStatus(sale, status)}
          busyId={busyId}
        />
      )}

      {waybillPreviewSaleId && (
        <WaybillPreviewModal
          saleId={waybillPreviewSaleId}
          onClose={() => setWaybillPreviewSaleId(null)}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить продажу?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!creditOverride}
        title="Кредитный лимит"
        message={
          creditOverride
            ? (
              creditOverride.mode === 'create'
                ? `${creditOverride.message || 'Превышен кредитный лимит.'} Создать продажу с превышением лимита?`
                : `${creditOverride.message || 'Превышен кредитный лимит.'} Подтвердить смену статуса с превышением лимита?`
            )
            : ''
        }
        confirmText={creditOverride?.mode === 'create' ? 'Создать с превышением лимита' : 'Отгрузить с превышением лимита'}
        cancelText="Отмена"
        onConfirm={onConfirmCreditOverride}
        onCancel={() => { setCreditOverride(null); setCreditOverrideError(''); }}
        error={creditOverrideError || undefined}
      />
    </div>
  );
};

const SaleModal = ({ sale, clients, onSubmit, onClose, error }) => {
  const isEdit = Boolean(sale?.id);
  const [sourceClients, setSourceClients] = useState(clients || []);
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [date, setDate] = useState(
    (sale?.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10),
  );
  const [client, setClient] = useState(() => (sale ? saleClientIdFromRow(sale) : ''));
  const [linkedOrder, setLinkedOrder] = useState(() => (sale ? saleLinkedOrderIdFromRow(sale) : ''));
  const [comment, setComment] = useState(sale?.comment || '');
  const [lines, setLines] = useState(
    !isEdit
      ? [{ product: '', warehouse_batch_id: '', quantity: '', unit_price: '', comment: '' }]
      : [],
  );

  useEffect(() => {
    getSalesSelectSources(client)
      .then((res) => {
        const data = res.data || {};
        setSourceClients(Array.isArray(data.clients) ? data.clients : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setBatches(Array.isArray(data.warehouse_batches) ? data.warehouse_batches : []);
      })
      .catch(() => {
        setSourceClients([]);
        setOrders([]);
        setBatches([]);
      });
  }, [client]);

  const total = useMemo(
    () => lines.reduce((sum, l) => {
      const q = parseLocaleNumber(l.quantity);
      const p = parseLocaleNumber(l.unit_price);
      if (!(q > 0) || !(p >= 0)) return sum;
      return sum + q * p;
    }, 0),
    [lines],
  );

  const batchOptions = useMemo(() => [
    { value: '', label: 'Не выбрана' },
    ...batches.map((b) => {
      const name = b.product_name || b.product?.name || b.product || 'Партия';
      const avail = b.available_quantity != null ? ` · свободно ${formatQuantityDisplay(b.available_quantity)}` : '';
      const form = b.inventory_form ? ` · ${b.inventory_form}` : '';
      return { value: String(b.id), label: `${name}${avail}${form}` };
    }),
  ], [batches]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Редактировать продажу' : 'Новая продажа'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          id="sales-modal-form"
          className="sales-modal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (isEdit) {
              const payload = {
                date,
                ...(client ? { client: Number(client) } : {}),
                ...(linkedOrder ? { linked_order: Number(linkedOrder) } : {}),
                ...(comment.trim() ? { comment: comment.trim() } : {}),
              };
              const result = await onSubmit(payload);
              if (result?.id) onClose();
            } else {
              const payloadLines = lines
                .map((line) => ({
                  product: String(line.product || '').trim(),
                  ...(line.warehouse_batch_id ? { warehouse_batch: Number(line.warehouse_batch_id) } : {}),
                  quantity: parseLocaleNumber(line.quantity) || 0,
                  ...(line.unit_price ? { unit_price: parseLocaleNumber(line.unit_price) } : {}),
                  ...(String(line.comment || '').trim() ? { comment: String(line.comment).trim() } : {}),
                }))
                .filter((line) => line.warehouse_batch && line.product && line.quantity > 0);
              if (!payloadLines.length) return;
              const payload = {
                date,
                ...(client ? { client: Number(client) } : {}),
                ...(linkedOrder ? { linked_order: Number(linkedOrder) } : {}),
                ...(comment.trim() ? { comment: comment.trim() } : {}),
                lines: payloadLines,
              };
              const result = await onSubmit(payload);
              if (result?.id) onClose();
            }
          }}
        >
          <div className="sales-modal__fields">
            <label className="sales-modal__label" htmlFor="sales-modal-date">Дата продажи</label>
            <input
              id="sales-modal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="sales-modal__date-input"
            />

            <label className="sales-modal__label">Клиент</label>
            <Select
              value={client}
              onChange={setClient}
              options={[
                { value: '', label: 'Без клиента' },
                ...sourceClients.map((c) => ({ value: String(c.id), label: c.name || 'Клиент' })),
              ]}
            />

            <label className="sales-modal__label">Связанная заявка</label>
            <Select
              value={linkedOrder}
              onChange={setLinkedOrder}
              options={[
                { value: '', label: 'Без заявки' },
                ...orders.map((o) => ({ value: String(o.id), label: o.order_number || `Заявка #${o.id}` })),
              ]}
            />

            <label className="sales-modal__label">Комментарий</label>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

            {!isEdit && (
              <div style={{ marginTop: 12 }}>
                <strong>Позиции продажи</strong>
                {lines.map((line, idx) => (
                  <div key={idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                    <label>Товар *</label>
                    <input value={line.product} readOnly />
                    <label>Партия склада</label>
                    <Select
                      value={line.warehouse_batch_id}
                      onChange={(v) => setLines((prev) => prev.map((x, i) => {
                        if (i !== idx) return x;
                        const picked = batches.find((b) => String(b.id) === String(v));
                        const batchProduct = picked ? (picked.product_name || picked.product?.name || picked.product || '') : '';
                        return {
                          ...x,
                          warehouse_batch_id: v,
                          product: batchProduct || x.product,
                        };
                      }))}
                      options={batchOptions}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', opacity: 0.75 }}>
                      Сначала выберите партию, товар подставится автоматически.
                    </p>
                    <label>Количество *</label>
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                    />
                    <label>Цена</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unit_price}
                      onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))}
                    />
                    <label>Комментарий</label>
                    <input
                      value={line.comment}
                      onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))}
                    />
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Удалить строку
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--secondary"
                  style={{ marginTop: 8 }}
                  onClick={() => setLines((prev) => [...prev, { product: '', warehouse_batch_id: '', quantity: '', unit_price: '', comment: '' }])}
                >
                  Добавить строку
                </button>
                {total > 0 && (
                  <p style={{ marginTop: 8 }}>
                    Ориентировочная сумма по введённым ценам: <strong>{formatQuantityDisplay(total)} сом</strong>
                    {' '}
                    <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>(итоговая выручка считается на сервере)</span>
                  </p>
                )}
              </div>
            )}

            {isEdit && sale && (
              <div className="card" style={{ marginTop: 12, padding: 12, borderLeft: '3px solid var(--color-primary, #2563eb)' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Позиции и партия недоступны для правки</p>
                <p style={{ margin: '8px 0 0', fontSize: '0.875rem', opacity: 0.85 }}>
                  После создания продажи изменить строки, количество и партию нельзя (ограничение API).
                  Смена статуса — только через меню «Действия» в списке продаж (отдельный запрос к серверу).
                </p>
              </div>
            )}

            {error ? <p className="modal__error">{error}</p> : null}
          </div>
        </form>
        <div className="modal__actions sales-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          <button type="submit" form="sales-modal-form" className="btn btn--primary">Сохранить</button>
        </div>
      </div>
    </div>
  );
};

const SaleDetailModal = ({
  saleId,
  onClose,
  onEdit,
  onOpenWaybillPreview,
  onDownloadReceipt,
  onChangeStatus,
  busyId,
}) => {
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiClient.get(`sales/${saleId}/`);
        if (!alive) return;
        setSale(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить карточку продажи'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [saleId]);

  const allowedNext = sale && Array.isArray(sale.available_status_transitions)
    ? sale.available_status_transitions
    : [];
  const availableActions = sale && Array.isArray(sale.available_actions) ? sale.available_actions : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка продажи</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && sale && (
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Общее</h4>
              <p><strong>Дата:</strong> {formatDate(sale.date || sale.created_at)}</p>
              <p><strong>Номер:</strong> {sale.order_number || sale.sale_number || `#${sale.id}`}</p>
              <p><strong>Клиент:</strong> {sale.client_name || '—'}</p>
              <p><strong>Связанная заявка:</strong> {sale.linked_order_number || '—'}</p>
              <p><strong>Статус:</strong> <Badge variant={statusVariant(sale.sale_status)}>{statusLabel(sale.sale_status)}</Badge></p>
              <p><strong>Выручка:</strong> {toMoney(sale.revenue)}</p>
              <p><strong>Оплачено:</strong> {toMoney(sale.paid_amount)}</p>
              {sale.comment ? <p><strong>Комментарий:</strong> {sale.comment}</p> : null}
            </section>

            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Строки продажи</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th className="data-table__cell--num">Количество</th>
                    <th className="data-table__cell--num">Цена</th>
                    <th className="data-table__cell--num">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sale.lines) ? sale.lines : []).map((line, idx) => {
                    const qty = parseLocaleNumber(line.quantity ?? 0) || 0;
                    const price = parseLocaleNumber(line.unit_price ?? 0) || 0;
                    const total = Number((qty * price).toFixed(2));
                    return (
                      <tr key={line.id || idx}>
                        <td>{line.product_name || line.product?.name || line.product || '—'}</td>
                        <td className="data-table__cell--num">{formatQuantityDisplay(qty)}</td>
                        <td className="data-table__cell--num">{toMoney(price)}</td>
                        <td className="data-table__cell--num">{toMoney(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={!availableActions.includes('edit')}
                onClick={() => onEdit(sale)}
              >
                Редактировать
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => onOpenWaybillPreview(sale)}>
                Накладная
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => onDownloadReceipt(sale)}>
                Квитанция
              </button>
              {allowedNext.length > 0 ? (
                <Select
                  value=""
                  onChange={(nextStatus) => nextStatus && onChangeStatus(sale, nextStatus)}
                  placeholder={busyId === sale.id ? 'Обновление...' : 'Сменить статус'}
                  options={[
                    { value: '', label: 'Сменить статус' },
                    ...allowedNext.map((st) => {
                      const nextStatus = st?.status || st;
                      return { value: nextStatus, label: statusLabel(nextStatus) };
                    }),
                  ]}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesPage;
