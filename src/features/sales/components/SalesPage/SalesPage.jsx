import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  getApiErrorMessage,
  resolveInventoryForm,
  inventoryFormLabel,
} from '../../../../shared/lib';
import {
  ActionMenu,
  Badge,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  SearchableSelect,
  useToast,
} from '../../../../shared/ui';
import { useAuth } from '../../../auth/model/AuthProvider';
import { useOperationalRefetch } from '../../../../shared/realtime';
import {
  cancelSale,
  createSale,
  getSale,
  getSaleCreditCheck,
  getSaleReceiptUrl,
  getSaleSelectSources,
  getSaleWaybillUrl,
  patchSaleStatus,
  updateSale,
} from '../../api/salesApi';
import './SalesPage.scss';

const SALE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'partially_shipped', label: 'Частично продана' },
  { value: 'shipped', label: 'Продана' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

const saleStatusKey = (v) => String(v || '').toLowerCase();

const statusLabel = (v) => {
  const k = saleStatusKey(v);
  return SALE_STATUS_OPTIONS.find((x) => x.value === k)?.label || v || '—';
};

const statusVariant = (v) => {
  const k = saleStatusKey(v);
  const map = {
    draft: 'default',
    confirmed: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[k] || 'default';
};

const isBadClientToken = (s) => {
  const t = String(s || '').trim().toLowerCase();
  return !t || t === 'клиент' || t === 'client' || t === 'без клиента';
};

const clientOptionLabel = (c) => {
  if (c == null) return '—';
  const rawLabel = typeof c.label === 'string' ? c.label.trim() : '';
  if (rawLabel && !isBadClientToken(rawLabel)) return rawLabel;
  const nameCandidates = [c.name, c.client_name, c.title].filter((x) => x != null && String(x).trim());
  const name = nameCandidates.map((x) => String(x).trim()).find((s) => !isBadClientToken(s)) || '';
  const phone = (c.phone || c.phone_number || '').toString().trim();
  const parts = [name, phone].filter((x) => x && String(x).trim());
  if (parts.length) return parts.join(' · ');
  return c.id != null ? String(c.id) : '—';
};

const saleDebtMoney = (s) => {
  if (s?.debt != null && s.debt !== '') return s.debt;
  if (s?.debt_amount != null && s.debt_amount !== '') return s.debt_amount;
  const rev = parseLocaleNumber(s?.revenue);
  const paid = parseLocaleNumber(s?.paid_amount);
  if (Number.isFinite(rev) && Number.isFinite(paid)) return Math.max(0, rev - paid);
  return null;
};

const saleIsDefectSale = (s) => Boolean(
  s?.defect_flag
  || s?.is_defect_sale
  || s?.defect_sale
  || (Array.isArray(s?.sale_lines) && s.sale_lines.some((l) => l.defect_flag)),
);

const paymentStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  const map = {
    unpaid: 'Не оплачено',
    partially_paid: 'Частично оплачено',
    paid: 'Оплачено',
    overpaid: 'Переплата',
    refunded: 'Возврат денег',
  };
  return map[k] || '—';
};

const paymentDocStatusLabel = (v) => {
  const k = String(v || '').toLowerCase();
  if (k === 'active') return 'Активен';
  if (k === 'canceled') return 'Отменен';
  return '—';
};

const formatDate = (v) => (v ? String(v).slice(0, 10) : '—');
const toMoney = (v) => (v != null ? `${formatQuantityDisplay(v)} сом` : '—');

const saleClientIdFromRow = (sale) => {
  if (sale?.client_id != null) return String(sale.client_id);
  const c = sale?.client;
  if (c != null && typeof c === 'object' && c.id != null) return String(c.id);
  if (c != null && (typeof c === 'number' || typeof c === 'string')) return String(c);
  return '';
};
const saleLinkedOrderIdFromRow = (sale) => {
  if (sale?.linked_order_id != null) return String(sale.linked_order_id);
  const lo = sale?.linked_order;
  if (lo != null && typeof lo === 'object' && lo.id != null) return String(lo.id);
  if (lo != null && (typeof lo === 'number' || typeof lo === 'string')) return String(lo);
  return '';
};

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

const SALE_ERROR_TEXT = {
  sale_status_update_forbidden: 'Статус продажи меняется только через действия.',
  sale_update_forbidden: 'Эту продажу нельзя редактировать.',
  sale_lines_update_forbidden: 'Позиции продажи нельзя редактировать.',
  sale_locked_by_payment: 'Продажа заблокирована оплатой.',
  sale_locked_by_return: 'Продажа заблокирована возвратом.',
  sale_locked_by_warehouse: 'Продажа заблокирована складской операцией.',
  missing_client: 'Выберите клиента.',
  inactive_client: 'Клиент неактивен.',
  missing_sale_lines: 'Добавьте хотя бы одну позицию продажи.',
  product_or_order_line_required: 'Укажите товар или строку заявки.',
  sale_quantity_required: 'Укажите количество.',
  sale_quantity_invalid: 'Количество должно быть больше 0.',
  unit_price_negative: 'Цена не может быть отрицательной.',
  closed_create_forbidden: 'Нельзя создавать продажу сразу в статусе "Закрыта".',
  missing_warehouse_batch: 'Выберите партию склада.',
  defect_batch_forbidden: 'Продажа брака оформляется отдельным сценарием.',
  insufficient_stock: 'Недостаточно остатка на складе.',
  order_line_quantity_exceeded: 'Количество больше остатка по заявке.',
  missing_status: 'Укажите статус для действия.',
  invalid_status_transition: 'Недопустимый переход статуса.',
  ship_blocked: 'Продажа не может быть проведена в текущем состоянии.',
  credit_limit_blocked: 'Превышен кредитный лимит.',
  warehouse_apply: 'Ошибка проведения складской операции.',
  has_payments: 'Продажа заблокирована оплатами.',
  has_returns: 'Продажа заблокирована возвратами.',
  warehouse_rollback: 'Ошибка отката складской операции.',
  delete_disabled: 'Удаление продаж отключено.',
};

const saleErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  const code = String(data?.code || '').toLowerCase();
  if (SALE_ERROR_TEXT[code]) return SALE_ERROR_TEXT[code];
  return formatApiErrorDetail(data, getApiErrorMessage(err, fallback));
};

const apiActionEnabled = (availableActions, key) => {
  if (availableActions == null) return false;
  if (Array.isArray(availableActions)) return availableActions.includes(key);
  if (typeof availableActions === 'object') return Boolean(availableActions[key]);
  return false;
};

const saleEditableByStatus = (saleStatus) => {
  const k = saleStatusKey(saleStatus);
  return k === 'draft' || k === 'confirmed';
};

const saleTransitionMenuLabel = (fromStatus, toStatus) => {
  const f = saleStatusKey(fromStatus);
  const t = saleStatusKey(toStatus);
  if (t === 'shipped' && (f === 'draft' || f === 'confirmed')) return 'Продать';
  if (t === 'closed') return 'Закрыть';
  if (t === 'canceled') return 'Отменить';
  return `→ ${statusLabel(toStatus)}`;
};

const saleAllowsReturnAction = (availableActions) => (
  apiActionEnabled(availableActions, 'return')
  || apiActionEnabled(availableActions, 'create_return')
);

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queryState, setQueryState] = useState({
    page: 1,
    page_size: 20,
    search: '',
    sale_status: '',
    client_id: '',
  });
  const [clients, setClients] = useState([]);
  const [modalSale, setModalSale] = useState(null);
  const [detailSaleId, setDetailSaleId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [creditOverride, setCreditOverride] = useState(null);
  const [creditOverrideBusy, setCreditOverrideBusy] = useState(false);
  const [creditOverrideError, setCreditOverrideError] = useState('');

  const { items, meta, loading, error, refetch } = useServerQuery('sales/', queryState, { enabled: true });

  const loadSelectSources = useCallback((clientId = '') => {
    getSaleSelectSources(clientId ? { client_id: clientId } : {})
      .then((res) => {
        const data = res.data || {};
        setClients(Array.isArray(data.clients) ? data.clients : []);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => { loadSelectSources(); }, [loadSelectSources]);

  const reloadOperational = useCallback(() => {
    refetch();
    loadSelectSources(queryState.client_id);
  }, [refetch, loadSelectSources, queryState.client_id]);

  useOperationalRefetch(['sale', 'warehouse_batch', 'order', 'payment', 'return'], reloadOperational, true);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalSale?.id) {
        const res = await updateSale(modalSale.id, payload);
        refetch();
        toast.show('Сохранено');
        return { id: res.data?.id || modalSale.id };
      }
      try {
        const res = await createSale(payload);
        refetch();
        toast.show('Сохранено');
        return { id: res.data?.id };
      } catch (err) {
        const data = err.response?.data;
        if (isCreditLimitError(err)) {
          setSubmitError(saleErrorMessage(err, 'Превышен кредитный лимит'));
          return null;
        }
        let msg = saleErrorMessage(err, 'Ошибка сохранения');
        if (data?.details && typeof data.details === 'object' && typeof msg === 'string') {
          const details = Object.entries(data.details)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('; ');
          if (details) msg = [msg, details].filter(Boolean).join('. ');
        }
        setSubmitError(msg);
        return null;
      }
    } catch (err) {
      setSubmitError(saleErrorMessage(err, 'Ошибка сохранения'));
      return null;
    }
  };

  const openHtmlDocument = async (url, fallbackError) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      let message = fallbackError;
      try {
        const data = await res.json();
        message = saleErrorMessage({ response: { status: res.status, data } }, fallbackError);
      } catch {
        message = fallbackError;
      }
      throw new Error(message);
    }
    const html = await res.text();
    const blobUrl = window.URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
  };

  const handleChangeStatus = async (sale, status, options = {}) => {
    const { forceCreditOverride = false } = options;
    setBusyId(sale.id);
    setSubmitError('');
    try {
      await patchSaleStatus(sale.id, status, forceCreditOverride ? { force_credit_override: true } : {});
      refetch();
      toast.show('Статус обновлён');
    } catch (err) {
      if (!forceCreditOverride && isCreditLimitError(err) && canForceCreditOverride(user)) {
        setCreditOverride({
          mode: 'status',
          saleId: sale.id,
          status,
          message: formatApiErrorDetail(err.response?.data, getApiErrorMessage(err, 'Превышен кредитный лимит')),
        });
      } else {
        const msg = saleErrorMessage(err, 'Ошибка смены статуса');
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
      await patchSaleStatus(creditOverride.saleId, creditOverride.status, { force_credit_override: true });
      try {
        await getSaleCreditCheck(creditOverride.saleId);
      } catch {
        // дополнительная проверка не должна ломать основной сценарий
      }
      setCreditOverride(null);
      refetch();
      toast.show('Статус обновлён');
    } catch (err) {
      setCreditOverrideError(saleErrorMessage(err, 'Операция не выполнена'));
    } finally {
      setCreditOverrideBusy(false);
    }
  };

  const handleCancelSale = async () => {
    if (!cancelTarget) return;
    setSubmitError('');
    try {
      await cancelSale(cancelTarget.id);
      setCancelTarget(null);
      refetch();
      toast.show('Продажа отменена');
    } catch (err) {
      setSubmitError(saleErrorMessage(err, 'Ошибка отмены'));
    }
  };

  const onOpenWaybill = async (saleRow) => {
    if (!saleRow?.id) return;
    setBusyId(saleRow.id);
    try {
      await openHtmlDocument(getSaleWaybillUrl(saleRow.id), 'Не удалось открыть накладную');
    } catch (e) {
      toast.show(e?.message || 'Не удалось открыть накладную', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onDownloadReceipt = async (saleRow) => {
    if (!saleRow?.id) return;
    setBusyId(saleRow.id);
    try {
      await openHtmlDocument(getSaleReceiptUrl(saleRow.id), 'Не удалось открыть квитанцию');
    } catch (e) {
      toast.show(e?.userMessage || e?.message || 'Не удалось открыть квитанцию', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page page--sales commercial-page">
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
            value={queryState.sale_status}
            onChange={(v) => setQueryState((p) => ({ ...p, sale_status: v, page: 1 }))}
            placeholder="Статус"
            options={[{ value: '', label: 'Все' }, ...SALE_STATUS_OPTIONS]}
          />
          <SearchableSelect
            value={queryState.client_id}
            onChange={(v) => setQueryState((p) => ({ ...p, client_id: v, page: 1 }))}
            placeholder="Клиент"
            options={[{ value: '', label: 'Все клиенты' }, ...clients.map((c) => ({ value: String(c.id), label: clientOptionLabel(c) }))]}
          />
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
              <th>№ продажи</th>
              <th>Клиент</th>
              <th>Заявка</th>
              <th>Дата</th>
              <th>Статус</th>
              <th className="data-table__cell--num">Сумма</th>
              <th className="data-table__cell--num">Оплачено</th>
              <th className="data-table__cell--num">Долг</th>
              <th className="data-table__cell--actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const allowedNext = Array.isArray(s.available_status_transitions) ? s.available_status_transitions : [];
              const availableActions = s.available_actions;
              const sk = saleStatusKey(s.sale_status);
              const debt = saleDebtMoney(s);
              const defect = saleIsDefectSale(s);
              const menu = [{ label: 'Открыть', onClick: () => setDetailSaleId(s.id) }];
              const canShip = allowedNext.some((st) => saleStatusKey(st?.status || st) === 'shipped');
              const canClose = allowedNext.some((st) => saleStatusKey(st?.status || st) === 'closed');
              if ((sk === 'draft' || sk === 'confirmed') && !defect && saleEditableByStatus(s.sale_status)) {
                menu.push({ label: 'Редактировать', onClick: () => setModalSale(s) });
              }
              if ((sk === 'draft' || sk === 'confirmed') && canShip) {
                menu.push({ label: 'Продать', disabled: busyId === s.id, onClick: () => handleChangeStatus(s, 'shipped') });
              }
              if (sk === 'partially_shipped' && canClose) {
                menu.push({ label: 'Закрыть', disabled: busyId === s.id, onClick: () => handleChangeStatus(s, 'closed') });
              }
              if (sk === 'shipped' && canClose) {
                menu.push({ label: 'Закрыть', disabled: busyId === s.id, onClick: () => handleChangeStatus(s, 'closed') });
              }
              if (sk === 'shipped' || sk === 'partially_shipped' || (defect && sk !== 'canceled')) {
                menu.push({ label: 'Принять оплату', onClick: () => navigate(`/payments?sale_id=${s.id}`) });
                menu.push({ label: 'Возврат', onClick: () => navigate(`/returns?sale_id=${s.id}`) });
              }
              if (sk !== 'canceled') {
                menu.push(
                  { label: 'Накладная', disabled: busyId === s.id, onClick: () => onOpenWaybill(s) },
                  { label: 'Квитанция', disabled: busyId === s.id, onClick: () => onDownloadReceipt(s) },
                );
              }
              if (apiActionEnabled(availableActions, 'cancel')) {
                menu.push({
                  label: 'Отменить',
                  danger: true,
                  onClick: () => setCancelTarget({
                    id: s.id,
                    name: s.order_number || s.sale_number || `Продажа #${s.id}`,
                  }),
                });
              }
              return (
                <tr key={s.id}>
                  <td>
                    <div className="sales-table__num-cell">
                      <button type="button" className="btn btn--ghost" onClick={() => setDetailSaleId(s.id)}>
                        {s.order_number || s.sale_number || `#${s.id}`}
                      </button>
                      {defect ? <Badge variant="warning" className="sales-table__defect-badge">Продажа брака</Badge> : null}
                    </div>
                  </td>
                  <td>{s.client_name || '—'}</td>
                  <td>{s.linked_order_number || '—'}</td>
                  <td className="sales-table__date-cell">{formatDate(s.date || s.created_at)}</td>
                  <td><Badge variant={statusVariant(s.sale_status)}>{statusLabel(s.sale_status)}</Badge></td>
                  <td className="data-table__cell--num">{toMoney(s.revenue)}</td>
                  <td className="data-table__cell--num">{toMoney(s.paid_amount)}</td>
                  <td className="data-table__cell--num">{debt != null ? toMoney(debt) : '—'}</td>
                  <td className="data-table__cell--actions">
                    <ActionMenu ariaLabel="Действия" items={menu} />
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

      {submitError && !modalSale && !cancelTarget && (
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
          onOpenWaybillPreview={(sale) => onOpenWaybill(sale)}
          onDownloadReceipt={(sale) => onDownloadReceipt(sale)}
          onChangeStatus={(sale, status) => handleChangeStatus(sale, status)}
          onAcceptPayment={(sale) => { setDetailSaleId(null); navigate(`/payments?sale_id=${sale.id}`); }}
          onReturn={(sale) => { setDetailSaleId(null); navigate(`/returns?sale_id=${sale.id}`); }}
          onCancelRequest={(s) => setCancelTarget({
            id: s.id,
            name: s.order_number || s.sale_number || `Продажа #${s.id}`,
          })}
          busyId={busyId}
        />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить продажу?"
        message={cancelTarget ? `Отменить «${cancelTarget.name}»?` : ''}
        confirmText="Отменить"
        onConfirm={handleCancelSale}
        onCancel={() => { setCancelTarget(null); setSubmitError(''); }}
        error={cancelTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!creditOverride}
        title="Кредитный лимит"
        message={
          creditOverride
            ? `${creditOverride.message || 'Превышен кредитный лимит.'} Подтвердить смену статуса с превышением лимита?`
            : ''
        }
        confirmText="Провести с превышением лимита"
        cancelText="Отмена"
        onConfirm={onConfirmCreditOverride}
        onCancel={() => { setCreditOverride(null); setCreditOverrideError(''); }}
        error={creditOverrideError || undefined}
      />
    </div>
  );
};

const batchFreeQty = (b) => {
  const fq = parseLocaleNumber(b?.free_quantity);
  if (Number.isFinite(fq) && fq >= 0) return fq;
  return parseLocaleNumber(b?.available_quantity);
};

const isBatchSelectableForSale = (b) => {
  if (String(b?.quality || '').toLowerCase() !== 'good') return false;
  if (String(b?.status || '').toLowerCase() !== 'available') return false;
  return batchFreeQty(b) > 0;
};

const warehouseBatchOptionLabel = (b) => {
  const id = b?.id != null ? `#${b.id}` : '—';
  const product = b.product_name || b.product?.name || b.product || '—';
  const free = batchFreeQty(b);
  const freeStr = Number.isFinite(free) ? formatQuantityDisplay(free) : '—';
  const qual = String(b?.quality || 'good').toLowerCase() === 'good' ? 'Годный' : 'Брак';
  const pack = inventoryFormLabel(resolveInventoryForm(b));
  return `${id} — ${product} — свободно ${freeStr} шт — ${qual} — ${pack}`;
};

const getOrderLineRemaining = (ol) => {
  if (!ol) return null;
  const r = parseLocaleNumber(ol.remaining_quantity);
  if (Number.isFinite(r) && r >= 0) return r;
  const ordered = parseLocaleNumber(ol.ordered_quantity);
  const shipped = parseLocaleNumber(ol.shipped_quantity);
  if (Number.isFinite(ordered)) {
    const sh = Number.isFinite(shipped) ? shipped : 0;
    return Math.max(0, ordered - sh);
  }
  return null;
};

const orderLineOptionLabel = (ol) => {
  const p = String(ol.product || '').trim() || '—';
  const oq = ol.ordered_quantity;
  const orderedStr = oq != null && oq !== '' ? formatQuantityDisplay(oq) : '—';
  const rem = getOrderLineRemaining(ol);
  const remStr = rem != null ? formatQuantityDisplay(rem) : '—';
  return `${p} — заказано ${orderedStr} — осталось ${remStr}`;
};

const orderOptionLabel = (o) => {
  const num = (o.order_number || '').trim() || '—';
  const cn = (o.client_name || '').trim();
  const lines = Array.isArray(o.lines) ? o.lines : [];
  let mid = '';
  if (lines.length) {
    const first = lines[0];
    const p = String(first.product || '').trim();
    const rem = getOrderLineRemaining(first);
    mid = [p, rem != null ? `осталось ${formatQuantityDisplay(rem)}` : ''].filter(Boolean).join(' — ');
  }
  const parts = [num, cn, mid].filter((x) => x && String(x).trim() && x !== '—');
  return parts.length ? parts.join(' — ') : num;
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
  const [orderLinesFromOrder, setOrderLinesFromOrder] = useState([]);
  const [lineError, setLineError] = useState('');
  const [lines, setLines] = useState(
    !isEdit
      ? [{
        order_line: '',
        product: '',
        warehouse_batch_id: '',
        quantity: '',
        unit_price: '',
        comment: '',
      }]
      : [],
  );

  useEffect(() => {
    if (!linkedOrder) {
      setOrderLinesFromOrder([]);
      return undefined;
    }
    let alive = true;
    getSaleSelectSources(client ? { client_id: client, order_id: linkedOrder } : { order_id: linkedOrder })
      .then((res) => {
        if (!alive) return;
        const data = res.data || {};
        setOrderLinesFromOrder(Array.isArray(data.order_lines) ? data.order_lines : []);
      })
      .catch(() => {
        if (!alive) return;
        setOrderLinesFromOrder([]);
      });
    return () => { alive = false; };
  }, [linkedOrder, client]);

  useEffect(() => {
    setSourceClients(Array.isArray(clients) ? clients : []);
  }, [clients]);

  useEffect(() => {
    getSaleSelectSources(client ? { client_id: client } : {})
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

  const selectableBatches = useMemo(
    () => (Array.isArray(batches) ? batches.filter(isBatchSelectableForSale) : []),
    [batches],
  );

  const batchSelectOptions = useMemo(() => {
    if (!selectableBatches.length) {
      return [{ value: '', label: 'Нет доступных партий на складе' }];
    }
    return [
      { value: '', label: 'Выберите партию' },
      ...selectableBatches.map((b) => ({ value: String(b.id), label: warehouseBatchOptionLabel(b) })),
    ];
  }, [selectableBatches]);

  const canCreate = useMemo(() => {
    if (isEdit) return true;
    if (!client) return false;
    if (!lines.length) return false;
    for (const line of lines) {
      const product = String(line.product || '').trim();
      const wb = line.warehouse_batch_id ? Number(line.warehouse_batch_id) : null;
      const qty = parseLocaleNumber(line.quantity);
      const up = parseLocaleNumber(line.unit_price);
      if (!product) return false;
      if (!wb) return false;
      if (!(qty > 0)) return false;
      if (!Number.isFinite(up) || up < 0) return false;
      const picked = selectableBatches.find((b) => Number(b.id) === wb);
      if (!picked) return false;
      const free = batchFreeQty(picked);
      if (Number.isFinite(free) && qty > free) return false;
      if (linkedOrder && line.order_line) {
        const ol = orderLinesFromOrder.find((o) => String(o.id) === String(line.order_line));
        const rem = getOrderLineRemaining(ol);
        if (rem != null && qty > rem) return false;
      }
    }
    return true;
  }, [client, isEdit, lines, linkedOrder, orderLinesFromOrder, selectableBatches]);

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
            setLineError('');
            if (isEdit) {
              const payload = {
                date,
                ...(comment.trim() ? { comment: comment.trim() } : {}),
              };
              const result = await onSubmit(payload);
              if (result?.id) onClose();
            } else {
              if (!client) {
                setLineError('Выберите клиента.');
                return;
              }
              const payloadLines = [];
              for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i];
                const wb = line.warehouse_batch_id ? Number(line.warehouse_batch_id) : null;
                const qty = parseLocaleNumber(line.quantity);
                const up = parseLocaleNumber(line.unit_price);
                if (!wb) {
                  setLineError(`Позиция ${i + 1}: выберите партию склада.`);
                  return;
                }
                if (!(qty > 0)) {
                  setLineError(`Позиция ${i + 1}: количество должно быть больше 0.`);
                  return;
                }
                if (!Number.isFinite(up) || !(up >= 0)) {
                  setLineError(`Позиция ${i + 1}: цена не может быть отрицательной.`);
                  return;
                }
                const picked = selectableBatches.find((b) => Number(b.id) === wb);
                if (!picked) {
                  setLineError(`Позиция ${i + 1}: выберите доступную партию.`);
                  return;
                }
                const free = batchFreeQty(picked);
                if (Number.isFinite(free) && qty > free) {
                  setLineError(`Позиция ${i + 1}: не больше ${formatQuantityDisplay(free)} шт по партии.`);
                  return;
                }
                if (linkedOrder) {
                  if (!line.order_line) {
                    setLineError(`Позиция ${i + 1}: выберите строку заявки.`);
                    return;
                  }
                  const ol = orderLinesFromOrder.find((o) => String(o.id) === String(line.order_line));
                  const rem = getOrderLineRemaining(ol);
                  if (rem != null && qty > rem) {
                    setLineError(`Позиция ${i + 1}: не больше ${formatQuantityDisplay(rem)} шт по заявке.`);
                    return;
                  }
                }
                const product = String(line.product || '').trim();
                if (!product) {
                  setLineError(`Позиция ${i + 1}: укажите товар.`);
                  return;
                }
                const row = {
                  product,
                  warehouse_batch: wb,
                  quantity: String(qty),
                  unit_price: String(up),
                  defect_flag: false,
                  comment: String(line.comment ?? '').trim(),
                };
                if (line.order_line) row.order_line = Number(line.order_line);
                payloadLines.push(row);
              }
              if (!payloadLines.length) {
                setLineError('Добавьте хотя бы одну позицию с партией и количеством.');
                return;
              }
              const payload = {
                client: Number(client),
                date,
                sale_status: 'shipped',
                sale_lines: payloadLines,
                ...(linkedOrder ? { linked_order: Number(linkedOrder) } : {}),
                comment: String(comment ?? '').trim(),
              };
              const result = await onSubmit(payload);
              if (result?.id) onClose();
            }
          }}
        >
          <div className="sales-modal__scroll">
            {!isEdit && (
              <>
                <section className="sales-modal__section">
                <h4 className="sales-modal__section-title">Документ</h4>
                <label className="sales-modal__label" htmlFor="sales-modal-date">Дата продажи</label>
                <input
                  id="sales-modal-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="sales-modal__date-input"
                />
                <label className="sales-modal__label">Клиент *</label>
                <SearchableSelect
                  value={client}
                  onChange={(v) => { setLineError(''); setClient(v); }}
                  options={[
                    { value: '', label: 'Выберите клиента' },
                    ...sourceClients.map((c) => ({ value: String(c.id), label: clientOptionLabel(c) })),
                  ]}
                />
                <label className="sales-modal__label">Комментарий</label>
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                </section>

                <section className="sales-modal__section">
                  <h4 className="sales-modal__section-title">Заявка</h4>
                  <label className="sales-modal__label">Связанная заявка</label>
                  <SearchableSelect
                    value={linkedOrder}
                    onChange={(v) => { setLineError(''); setLinkedOrder(v); }}
                    disabled={!client}
                    options={[
                      { value: '', label: client ? 'Не выбрана' : 'Сначала выберите клиента' },
                      ...orders.map((o) => ({ value: String(o.id), label: orderOptionLabel(o) })),
                    ]}
                  />
                </section>
              </>
            )}

            {isEdit && (
              <>
                <section className="sales-modal__section">
                  <h4 className="sales-modal__section-title">Документ</h4>
                  <label className="sales-modal__label" htmlFor="sales-modal-date-edit">Дата продажи</label>
                  <input
                    id="sales-modal-date-edit"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="sales-modal__date-input"
                  />
                  <label className="sales-modal__label">Клиент</label>
                  <input className="sales-modal__readonly" value={sale?.client_name || clientOptionLabel(sourceClients.find((c) => String(c.id) === String(client))) || '—'} readOnly />
                  <label className="sales-modal__label">Заявка</label>
                  <input className="sales-modal__readonly" value={sale?.linked_order_number || (linkedOrder ? `№ ${linkedOrder}` : '—')} readOnly />
                  <label className="sales-modal__label">Комментарий</label>
                  <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                </section>
                {sale && (
                  <div className="sales-modal__note card">
                    <p className="sales-modal__note-title">Строки и партии</p>
                    <p className="sales-modal__note-text">
                      Изменить состав продажи после проведения нельзя. Статус меняется в карточке продажи.
                    </p>
                  </div>
                )}
              </>
            )}

            {!isEdit && (
              <section className="sales-modal__section">
                <h4 className="sales-modal__section-title">Позиции продажи</h4>
                {lines.map((line, idx) => {
                  const ol = orderLinesFromOrder.find((o) => String(o.id) === String(line.order_line));
                  const picked = selectableBatches.find((b) => String(b.id) === String(line.warehouse_batch_id));
                  const rem = getOrderLineRemaining(ol);
                  const free = picked ? batchFreeQty(picked) : null;
                  let maxQty = null;
                  if (Number.isFinite(rem) && Number.isFinite(free)) maxQty = Math.min(rem, free);
                  else if (Number.isFinite(rem)) maxQty = rem;
                  else if (Number.isFinite(free)) maxQty = free;
                  return (
                    <div key={idx} className="sales-modal__line-card card">
                      {linkedOrder ? (
                        <>
                          <label className="sales-modal__label">Строка заявки</label>
                          <SearchableSelect
                            value={line.order_line}
                            onChange={(v) => setLines((prev) => prev.map((x, i) => {
                              if (i !== idx) return x;
                              const oln = orderLinesFromOrder.find((o) => String(o.id) === String(v));
                              const remN = getOrderLineRemaining(oln);
                              const priceRaw = oln?.unit_price ?? oln?.line_unit_price ?? oln?.price;
                              const priceStr = priceRaw != null && priceRaw !== '' ? String(priceRaw) : x.unit_price;
                              return {
                                ...x,
                                order_line: v,
                                product: oln ? String(oln.product || '').trim() : '',
                                quantity: remN != null ? String(remN) : x.quantity,
                                unit_price: priceStr,
                              };
                            }))}
                            options={[
                              { value: '', label: 'Выберите строку' },
                              ...orderLinesFromOrder.map((o) => ({
                                value: String(o.id),
                                label: orderLineOptionLabel(o),
                              })),
                            ]}
                          />
                        </>
                      ) : null}
                      <label className="sales-modal__label">Товар</label>
                      <input className="sales-modal__readonly" value={line.product || '—'} readOnly />
                      <label className="sales-modal__label">Партия склада *</label>
                      <SearchableSelect
                        value={line.warehouse_batch_id}
                        onChange={(v) => setLines((prev) => prev.map((x, i) => {
                          if (i !== idx) return x;
                          if (!linkedOrder) {
                            const b = selectableBatches.find((bb) => String(bb.id) === String(v));
                            const nm = b ? String(b.product_name || b.product?.name || b.product || '').trim() : '';
                            return { ...x, warehouse_batch_id: v, product: nm };
                          }
                          return { ...x, warehouse_batch_id: v };
                        }))}
                        options={batchSelectOptions}
                      />
                      <label className="sales-modal__label">Количество *</label>
                      <input
                        type="number"
                        min="0.0001"
                        max={maxQty != null ? maxQty : undefined}
                        step="any"
                        value={line.quantity}
                        onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))}
                      />
                      <p className="sales-modal__hint-line">
                        Доступно:
                        {' '}
                        {maxQty != null ? `${formatQuantityDisplay(maxQty)} шт` : '—'}
                      </p>
                      <label className="sales-modal__label">Цена *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.unit_price}
                        onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))}
                      />
                      <label className="sales-modal__label">Комментарий</label>
                      <input
                        value={line.comment}
                        onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))}
                      />
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn--secondary sales-modal__remove-line"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Удалить строку
                        </button>
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="btn btn--secondary sales-modal__add-line"
                  onClick={() => setLines((prev) => [...prev, {
                    order_line: '',
                    product: '',
                    warehouse_batch_id: '',
                    quantity: '',
                    unit_price: '',
                    comment: '',
                  }])}
                >
                  Добавить строку
                </button>
                {total > 0 ? (
                  <p className="sales-modal__total-hint">
                    Ориентировочно: <strong>{formatQuantityDisplay(total)} сом</strong>
                    {' '}
                    <span className="sales-modal__total-hint-sub">(итог на сервере)</span>
                  </p>
                ) : null}
              </section>
            )}

            {lineError ? <p className="modal__error">{lineError}</p> : null}
            {error ? <p className="modal__error">{error}</p> : null}
          </div>
          <div className="modal__actions sales-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!canCreate}>
              {isEdit ? 'Сохранить' : 'Создать продажу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const saleLineBatchLabel = (line) => {
  const b = line?.warehouse_batch;
  if (b && typeof b === 'object') {
    return warehouseBatchOptionLabel(b);
  }
  if (line?.warehouse_batch_label || line?.batch_label) {
    return line.warehouse_batch_label || line.batch_label;
  }
  return '—';
};

const SaleDetailModal = ({
  saleId,
  onClose,
  onEdit,
  onOpenWaybillPreview,
  onDownloadReceipt,
  onChangeStatus,
  onAcceptPayment,
  onReturn,
  onCancelRequest,
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
        const res = await getSale(saleId);
        if (!alive) return;
        setSale(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(saleErrorMessage(e, 'Не удалось загрузить карточку продажи'));
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
  const availableActions = sale?.available_actions;
  const sk = sale ? saleStatusKey(sale.sale_status) : '';
  const defectDoc = sale ? saleIsDefectSale(sale) : false;
  const relatedPayments = Array.isArray(sale?.linked_entities?.payments) ? sale.linked_entities.payments : [];
  const relatedReturns = Array.isArray(sale?.linked_entities?.returns) ? sale.linked_entities.returns : [];
  const debt = sale ? saleDebtMoney(sale) : null;

  const renderFooter = () => {
    if (!sale) return null;
    if (defectDoc) {
      const actions = [];
      if (sk !== 'canceled') {
        actions.push(
          <button key="pay" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onAcceptPayment(sale)}>Принять оплату</button>,
        );
      }
      if ((sk === 'shipped' || sk === 'partially_shipped') && saleAllowsReturnAction(availableActions)) {
        actions.push(
          <button key="ret" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onReturn(sale)}>Возврат</button>,
        );
      }
      if (sk !== 'canceled') {
        actions.push(
          <button key="wb" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onOpenWaybillPreview(sale)}>Накладная</button>,
          <button key="rc" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onDownloadReceipt(sale)}>Квитанция</button>,
        );
      }
      if (apiActionEnabled(availableActions, 'cancel') && onCancelRequest) {
        actions.push(
          <button key="cx" type="button" className="btn btn--danger" disabled={busyId === sale.id} onClick={() => onCancelRequest(sale)}>Отменить</button>,
        );
      }
      actions.push(
        <button key="close" type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>,
      );
      if (!actions.length) return null;
      return <div className="modal__actions sales-detail-modal__footer">{actions}</div>;
    }
    if (sk === 'canceled') {
      return null;
    }
    const actions = [];
    if (sk === 'draft' && saleEditableByStatus(sale.sale_status)) {
      actions.push(
        <button key="edit" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onEdit(sale)}>Редактировать</button>,
      );
    }
    allowedNext
      .filter((st) => saleStatusKey(st?.status || st) !== 'canceled' && saleStatusKey(st?.status || st) !== 'cancelled')
      .forEach((st, i) => {
        const nextStatus = st?.status || st;
        actions.push(
          <button
            key={`tr-${i}`}
            type="button"
            className="btn btn--secondary"
            disabled={busyId === sale.id}
            onClick={() => onChangeStatus(sale, nextStatus)}
          >
            {saleTransitionMenuLabel(sale.sale_status, nextStatus)}
          </button>,
        );
      });
    if (sk === 'shipped' || sk === 'partially_shipped') {
      actions.push(
        <button key="pay" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onAcceptPayment(sale)}>Принять оплату</button>,
        <button key="ret" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onReturn(sale)}>Возврат</button>,
      );
    }
    if (sk !== 'canceled') {
      actions.push(
        <button key="wb" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onOpenWaybillPreview(sale)}>Накладная</button>,
        <button key="rc" type="button" className="btn btn--secondary" disabled={busyId === sale.id} onClick={() => onDownloadReceipt(sale)}>Квитанция</button>,
      );
    }
    if (apiActionEnabled(availableActions, 'cancel') && onCancelRequest) {
      actions.push(
        <button key="cx" type="button" className="btn btn--danger" disabled={busyId === sale.id} onClick={() => onCancelRequest(sale)}>Отменить</button>,
      );
    }
    actions.push(
      <button key="close" type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>,
    );
    if (!actions.length) return null;
    return <div className="modal__actions sales-detail-modal__footer">{actions}</div>;
  };

  const detailDl = (label, value) => (
    <div className="sales-detail__dl-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide sales-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head sales-detail-modal__head">
          <div>
            <h3>Карточка продажи</h3>
            {!loading && !error && sale && (
              <div className="sales-detail-modal__head-meta">
                <span className="sales-detail-modal__number">{sale.order_number || sale.sale_number || `#${sale.id}`}</span>
                <Badge variant={statusVariant(sale.sale_status)}>{statusLabel(sale.sale_status)}</Badge>
                {defectDoc ? <Badge variant="warning">Продажа брака</Badge> : null}
              </div>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="sales-detail-modal__body">
          {loading && <Loading />}
          {!loading && error && <p className="modal__error">{error}</p>}
          {!loading && !error && sale && (
            <>
              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Документ</h4>
                <dl className="sales-detail__dl">
                  {detailDl('Номер продажи', sale.order_number || sale.sale_number || `№ ${sale.id}`)}
                  {detailDl('Дата', formatDate(sale.date || sale.created_at))}
                  {detailDl('Клиент', sale.client_name || '—')}
                  {detailDl('Заявка', sale.linked_order_number || '—')}
                  {detailDl('Статус', statusLabel(sale.sale_status))}
                  {detailDl('Комментарий', sale.comment && String(sale.comment).trim() ? sale.comment : '—')}
                </dl>
              </section>

              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Финансы</h4>
                <dl className="sales-detail__dl">
                  {detailDl('Выручка', toMoney(sale.revenue))}
                  {detailDl('Оплачено', toMoney(sale.paid_amount))}
                  {detailDl('Долг', debt != null ? toMoney(debt) : '—')}
                  {detailDl('Возврат денег', toMoney(sale.refund_amount))}
                  {detailDl('Статус оплаты', paymentStatusLabel(sale.payment_status))}
                </dl>
              </section>

              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Строки продажи</h4>
                <div className="commercial-table-wrap">
                  <table className="data-table data-table--order-detail-lines">
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th>Партия</th>
                        <th className="data-table__cell--num">Количество</th>
                        <th className="data-table__cell--num">Цена</th>
                        <th className="data-table__cell--num">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(sale.sale_lines) ? sale.sale_lines : []).map((line, idx) => {
                        const qty = parseLocaleNumber(line.quantity ?? 0) || 0;
                        const price = parseLocaleNumber(line.unit_price ?? 0) || 0;
                        const sum = Number((qty * price).toFixed(2));
                        return (
                          <tr key={line.id || idx}>
                            <td>{line.product_name || line.product?.name || line.product || '—'}</td>
                            <td>{saleLineBatchLabel(line)}</td>
                            <td className="data-table__cell--num">{formatQuantityDisplay(qty)}</td>
                            <td className="data-table__cell--num">{toMoney(price)}</td>
                            <td className="data-table__cell--num">{toMoney(sum)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="sales-detail__block">
                <h4 className="sales-detail__block-title">Связанные документы</h4>
                <div className="sales-detail__sub">
                  <strong className="sales-detail__sub-title">Оплаты</strong>
                  {relatedPayments.length === 0 ? (
                    <p className="sales-detail__muted">Нет.</p>
                  ) : (
                    <div className="commercial-table-wrap">
                      <table className="data-table data-table--order-detail-lines">
                        <thead>
                          <tr>
                            <th>Дата</th>
                            <th>Статус</th>
                            <th className="data-table__cell--num">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedPayments.map((p) => (
                            <tr key={p.id}>
                              <td>{formatDate(p.date || p.created_at)}</td>
                              <td>{paymentDocStatusLabel(p.status)}</td>
                              <td className="data-table__cell--num">{toMoney(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="sales-detail__sub">
                  <strong className="sales-detail__sub-title">Возвраты</strong>
                  {relatedReturns.length === 0 ? (
                    <p className="sales-detail__muted">Нет.</p>
                  ) : (
                    <div className="commercial-table-wrap">
                      <table className="data-table data-table--order-detail-lines">
                        <thead>
                          <tr>
                            <th>Номер</th>
                            <th>Дата</th>
                            <th>Статус</th>
                            <th>Причина</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedReturns.map((r) => (
                            <tr key={r.id}>
                              <td>{r.return_number || r.number || `№ ${r.id}`}</td>
                              <td>{formatDate(r.date || r.created_at)}</td>
                              <td>{statusLabel(r.status)}</td>
                              <td>{r.return_reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
        {!loading && !error && sale ? renderFooter() : null}
      </div>
    </div>
  );
};

export default SalesPage;
