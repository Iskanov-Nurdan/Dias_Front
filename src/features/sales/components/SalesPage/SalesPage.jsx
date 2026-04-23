import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
} from '../../../../shared/lib';
import {
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  ActionMenu,
  useToast,
  Select,
} from '../../../../shared/ui';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { downloadSaleReceipt, downloadSaleWaybill } from '../../api/salesApi';
import './SalesPage.scss';

const statusLabel = (v) => {
  const map = {
    draft: 'Черновик',
    confirmed: 'Подтверждена',
    partially_shipped: 'Частично отгружена',
    shipped: 'Отгружена',
    closed: 'Закрыта',
    canceled: 'Отменена',
  };
  return map[v] || v || '—';
};

const SalesPage = () => {
  const toast = useToast();
  const [queryState] = useState({ page: 1, page_size: 20 });
  const [clients, setClients] = useState([]);
  const [modalSale, setModalSale] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { items, loading, error, refetch } = useServerQuery('sales/', queryState, {
    enabled: true,
  });

  const loadClientsAndProducts = useCallback(() => {
    apiClient
      .get('clients/', { params: { page_size: 500 } })
      .then((res) => {
        setClients(res.data?.items || []);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    loadClientsAndProducts();
  }, [loadClientsAndProducts]);

  const reloadSalesOperational = useCallback(() => {
    refetch();
    loadClientsAndProducts();
  }, [refetch, loadClientsAndProducts]);

  useOperationalRefetch(['sale', 'warehouse_batch', 'order', 'payment', 'return'], reloadSalesOperational, true);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      const res = modalSale?.id
        ? await apiClient.patch(`sales/${modalSale.id}/`, payload)
        : await apiClient.post('sales/', payload);
      refetch();
      toast.show('Сохранено');
      setSubmitError('');
      return { id: res.data?.id || modalSale?.id };
    } catch (err) {
      const data = err.response?.data;
      let msg = getApiErrorMessage(err, 'Ошибка');
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

  const onDownloadWaybill = async (saleRow) => {
    if (!saleRow?.id) return;
    setBusyId(saleRow.id);
    try {
      await downloadSaleWaybill(saleRow.id);
      toast.show('Накладная скачана');
    } catch (e) {
      toast.show(e?.userMessage || e?.message || 'Не удалось скачать накладную', 'error');
    } finally {
      setBusyId(null);
    }
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
    <div className="page page--sales">
      <div className="ds-toolbar ds-toolbar--page-head ds-toolbar--stack-mobile">
        <div className="ds-toolbar__end" style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn--primary ds-hide-mobile"
            onClick={() => {
              setModalSale({});
            }}
          >
            Создать
          </button>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setModalSale({});
          }}
        >
          Создать
        </button>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет продаж" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table data-table--fixed data-table--sales data-table--row-actions data-table--clickable">
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
            {items.map((s) => (
              <tr key={s.id}>
                <td className="data-table__cell--muted sales-table__date-cell">
                  {(s.sale_date || s.date || s.created_at || '').toString().slice(0, 10) || '—'}
                </td>
                <td className="data-table__cell--lead">{s.client_name || s.client?.name || s.client || '—'}</td>
                <td>{s.sale_number || `#${s.id}`}</td>
                <td>{s.linked_order_number || s.linked_order_id || '—'}</td>
                <td>{statusLabel(s.sale_status)}</td>
                <td className="data-table__cell--num">{s.revenue != null ? `${formatQuantityDisplay(s.revenue)} сом` : '—'}</td>
                <td className="data-table__cell--num">{s.paid_amount != null ? `${formatQuantityDisplay(s.paid_amount)} сом` : '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      {
                        label: 'Редактировать',
                        onClick: () => {
                          setModalSale(s);
                        },
                      },
                      {
                        label: 'Накладная',
                        disabled: busyId === s.id,
                        onClick: () => onDownloadWaybill(s),
                      },
                      {
                        label: 'Квитанция',
                        disabled: busyId === s.id,
                        onClick: () => onDownloadReceipt(s),
                      },
                      {
                        label: 'Удалить',
                        danger: true,
                        onClick: () =>
                          setDeleteTarget({ id: s.id, name: s.product_name || s.product || 'Продажа' }),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {submitError && !modalSale && !deleteTarget && (
        <p className="modal__error sales-page__error">{submitError}</p>
      )}

      {modalSale !== null && (
        <SaleModal
          sale={modalSale?.id ? modalSale : null}
          clients={clients}
          onSubmit={handleSubmit}
          onClose={() => {
            setModalSale(null);
            setSubmitError('');
          }}
          error={submitError}
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
    </div>
  );
};

const SaleModal = ({ sale, clients, onSubmit, onClose, error }) => {
  const [orders, setOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [date, setDate] = useState((sale?.date || sale?.sale_date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [client, setClient] = useState(sale?.client_id != null ? String(sale.client_id) : '');
  const [linkedOrder, setLinkedOrder] = useState(sale?.linked_order_id != null ? String(sale.linked_order_id) : '');
  const [saleStatus, setSaleStatus] = useState(sale?.sale_status || 'draft');
  const [invoiceNumber, setInvoiceNumber] = useState(sale?.invoice_number || '');
  const [receiptNumber, setReceiptNumber] = useState(sale?.receipt_number || '');
  const [comment, setComment] = useState(sale?.comment || '');
  const [isDefectSale, setIsDefectSale] = useState(Boolean(sale?.is_defect_sale));
  const [lines, setLines] = useState(
    Array.isArray(sale?.lines) && sale.lines.length
      ? sale.lines.map((x) => ({
        id: x.id,
        order_line_id: x.order_line_id ? String(x.order_line_id) : '',
        product: x.product || '',
        warehouse_batch_id: x.warehouse_batch_id ? String(x.warehouse_batch_id) : '',
        stock_form: x.stock_form || '',
        quantity: x.quantity != null ? String(x.quantity) : '',
        unit_price: x.unit_price != null ? String(x.unit_price) : '',
        comment: x.comment || '',
      }))
      : [{ order_line_id: '', product: '', warehouse_batch_id: '', stock_form: '', quantity: '', unit_price: '', comment: '' }],
  );

  useEffect(() => {
    apiClient.get('orders/', { params: { page_size: 500 } }).then((r) => setOrders(r.data?.items || [])).catch(() => setOrders([]));
    apiClient.get('warehouse/batches/', { params: { page_size: 500, status: 'available' } }).then((r) => setBatches(r.data?.items || [])).catch(() => setBatches([]));
  }, []);

  const total = useMemo(
    () => lines.reduce((sum, l) => {
      const q = parseLocaleNumber(l.quantity);
      const p = parseLocaleNumber(l.unit_price);
      if (!(q > 0) || !(p >= 0)) return sum;
      return sum + q * p;
    }, 0),
    [lines],
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Продажа</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          id="sales-modal-form"
          className="sales-modal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            const payloadLines = lines
              .map((line) => ({
                ...(line.id ? { id: line.id } : {}),
                ...(line.order_line_id ? { order_line: Number(line.order_line_id) } : {}),
                product: String(line.product || '').trim(),
                ...(line.warehouse_batch_id ? { warehouse_batch: Number(line.warehouse_batch_id) } : {}),
                stock_form: String(line.stock_form || '').trim() || undefined,
                quantity: parseLocaleNumber(line.quantity) || 0,
                ...(line.unit_price ? { unit_price: parseLocaleNumber(line.unit_price) } : {}),
                comment: String(line.comment || '').trim() || undefined,
              }))
              .filter((line) => line.product && line.quantity > 0);
            if (!payloadLines.length) return;
            const payload = {
              date,
              sale_date: date,
              sale_status: saleStatus,
              ...(client ? { client: Number(client) } : {}),
              ...(linkedOrder ? { linked_order: Number(linkedOrder) } : {}),
              ...(invoiceNumber.trim() ? { invoice_number: invoiceNumber.trim() } : {}),
              ...(receiptNumber.trim() ? { receipt_number: receiptNumber.trim() } : {}),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
              is_defect_sale: isDefectSale,
              lines: payloadLines,
            };
            const result = await onSubmit(payload);
            if (result?.id) onClose();
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
                ...clients.map((c) => ({
                  value: String(c.id),
                  label: c.name || 'Клиент',
                })),
              ]}
            />

            <label className="sales-modal__label">Связанная заявка</label>
            <Select
              value={linkedOrder}
              onChange={setLinkedOrder}
              options={[
                { value: '', label: 'Без заявки' },
                ...orders.map((o) => ({ value: String(o.id), label: o.order_number || `#${o.id}` })),
              ]}
            />

            <label className="sales-modal__label">Статус продажи</label>
            <Select
              value={saleStatus}
              onChange={setSaleStatus}
              options={[
                { value: 'draft', label: 'Черновик' },
                { value: 'confirmed', label: 'Подтверждена' },
                { value: 'partially_shipped', label: 'Частично отгружена' },
                { value: 'shipped', label: 'Отгружена' },
                { value: 'closed', label: 'Закрыта' },
                { value: 'canceled', label: 'Отменена' },
              ]}
            />
            <label className="sales-modal__label">Номер накладной</label>
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            <label className="sales-modal__label">Номер квитанции</label>
            <input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} />
            <label className="sales-modal__label">Продажа брака</label>
            <input type="checkbox" checked={isDefectSale} onChange={(e) => setIsDefectSale(e.target.checked)} />
            <label className="sales-modal__label">Комментарий</label>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

            <div style={{ marginTop: 12 }}>
              <strong>Строки продажи (SaleLine)</strong>
              {lines.map((line, idx) => (
                <div key={line.id || idx} className="card" style={{ marginTop: 8, padding: 8 }}>
                  <label>OrderLine ID</label>
                  <input
                    value={line.order_line_id}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, order_line_id: e.target.value } : x)))}
                  />
                  <label>Товар *</label>
                  <input
                    value={line.product}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)))}
                  />
                  <label>Партия склада</label>
                  <Select
                    value={line.warehouse_batch_id}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, warehouse_batch_id: v } : x)))}
                    options={[
                      { value: '', label: 'Не выбрана' },
                      ...batches.map((b) => ({ value: String(b.id), label: `${b.id} · ${b.product_name || b.product?.name || 'Партия'}` })),
                    ]}
                  />
                  <label>Форма склада</label>
                  <input
                    value={line.stock_form}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, stock_form: e.target.value } : x)))}
                  />
                  <label>Количество *</label>
                  <input
                    value={line.quantity}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                  />
                  <label>Цена</label>
                  <input
                    value={line.unit_price}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))}
                  />
                  <label>Комментарий</label>
                  <input
                    value={line.comment}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Удалить строку
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn--secondary"
                style={{ marginTop: 8 }}
                onClick={() => setLines((prev) => [...prev, {
                  order_line_id: '',
                  product: '',
                  warehouse_batch_id: '',
                  stock_form: '',
                  quantity: '',
                  unit_price: '',
                  comment: '',
                }])}
              >
                Добавить строку
              </button>
              <p style={{ marginTop: 8 }}>Итого по продаже: <strong>{formatQuantityDisplay(total)} сом</strong></p>
            </div>

            {error ? <p className="modal__error">{error}</p> : null}
          </div>
        </form>
        <div className="modal__actions sales-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Отмена
          </button>
          <button
            type="submit"
            form="sales-modal-form"
            className="btn btn--primary"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesPage;
