import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, parseLocaleNumber, formatQuantityDisplay, getApiErrorMessage } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, IntegerInput, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  cancelOrder,
  createOrder,
  downloadOrderWaybill,
  getOrderSelectSources,
  patchOrderStatus,
  updateOrder,
} from '../../api/ordersApi';
import './OrdersPage.scss';

const ORDER_STATUS_OPTIONS = [
  { value: 'new', label: 'Новая' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'partially_shipped', label: 'Частично продана' },
  { value: 'shipped', label: 'Продана' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

/** В фильтре списка не предлагаем статусы только из legacy backend. */
const ORDER_STATUS_FILTER_OPTIONS = ORDER_STATUS_OPTIONS.filter(
  (x) => x.value !== 'partially_shipped' && x.value !== 'shipped',
);

const SALE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'confirmed', label: 'Подтверждена' },
  { value: 'partially_shipped', label: 'Частично продана' },
  { value: 'shipped', label: 'Продана' },
  { value: 'closed', label: 'Закрыта' },
  { value: 'canceled', label: 'Отменена' },
];

const SOURCE_TYPE_LABELS = {
  cashier: 'Кассир',
  manager: 'Менеджер',
  boss: 'Руководитель',
  other: 'Другое',
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

const profileOptionLabel = (p) => {
  if (p == null) return '—';
  const id = p.id;
  const isBad = (s) => {
    const t = String(s || '').trim().toLowerCase();
    return !t || /^профиль\s*#?\d*\s*$/i.test(t) || t === `профиль #${id}`.toLowerCase();
  };
  const rawLabel = typeof p.label === 'string' ? p.label.trim() : '';
  if (rawLabel && !isBad(rawLabel)) return rawLabel;
  for (const key of ['name', 'title', 'display_name', 'code']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim() && !isBad(v.trim())) return v.trim();
  }
  const bits = [p.width_mm, p.height_mm, p.color, p.coating, p.material].filter((x) => x != null && String(x).trim() !== '');
  if (bits.length) return bits.map((x) => String(x).trim()).join(' ');
  return `Профиль #${id}`;
};

const normalizeOrderStatus = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'cancelled') return 'canceled';
  return v;
};

const orderStatusKey = (status) => String(normalizeOrderStatus(status) || '').toLowerCase();

const statusLabel = (value) => {
  const key = orderStatusKey(value);
  return ORDER_STATUS_OPTIONS.find((x) => x.value === key)?.label || value || '—';
};

const statusVariant = (value) => {
  const key = orderStatusKey(value);
  const map = {
    new: 'default',
    confirmed: 'primary',
    in_progress: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[key] || 'default';
};

const saleStatusKey = (value) => String(value || '').toLowerCase();

const saleStatusLabel = (value) => {
  const key = saleStatusKey(value);
  return SALE_STATUS_OPTIONS.find((x) => x.value === key)?.label || value || '—';
};

const saleStatusVariant = (value) => {
  const key = saleStatusKey(value);
  const map = {
    draft: 'default',
    confirmed: 'primary',
    partially_shipped: 'warning',
    shipped: 'success',
    closed: 'success',
    canceled: 'danger',
  };
  return map[key] || 'default';
};

const formatDate = (value) => (value ? String(value).slice(0, 10) : '—');
const toMoney = (value) => (value != null ? `${formatQuantityDisplay(value)} сом` : '—');

const apiActionEnabled = (availableActions, key) => {
  if (availableActions == null) return false;
  if (Array.isArray(availableActions)) return availableActions.includes(key);
  if (typeof availableActions === 'object') return Boolean(availableActions[key]);
  return false;
};

const formatLineQty = (v) => (v != null && v !== '' ? formatQuantityDisplay(v) : '—');
const formatLineMoneyCell = (v) => (v != null && v !== '' ? toMoney(v) : '—');

const orderEditableByStatus = (status) => {
  const k = orderStatusKey(status);
  return k === 'new' || k === 'confirmed' || k === 'in_progress';
};

const transitionActionLabel = (fromStatus, toStatus) => {
  const from = orderStatusKey(fromStatus);
  const to = orderStatusKey(toStatus);
  if (to === 'canceled' || to === 'cancelled') return 'Отменить';
  if (to === 'confirmed' && from === 'new') return 'Подтвердить';
  if (to === 'in_progress' && from === 'confirmed') return 'В работу';
  if (to === 'closed') return 'Закрыть';
  return `→ ${statusLabel(toStatus)}`;
};

const isHiddenOrderStatusTransitionTarget = (status) => {
  const k = orderStatusKey(status);
  return k === 'partially_shipped' || k === 'shipped';
};

const orderMenuShowsCancel = (availableActions, allowedNext) => {
  if (apiActionEnabled(availableActions, 'cancel')) return true;
  return allowedNext.some((st) => {
    const k = String(st?.status || st).toLowerCase();
    return k === 'canceled' || k === 'cancelled';
  });
};

const orderShippedMoney = (o) => (o?.shipped_amount != null && o?.shipped_amount !== '' ? o.shipped_amount : null);
const orderRemainingMoney = (o) => (o?.remaining_amount != null && o?.remaining_amount !== '' ? o.remaining_amount : null);

const OrdersPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '', status: '' });
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [modalOrder, setModalOrder] = useState(null);
  const [detailOrderId, setDetailOrderId] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [busyId, setBusyId] = useState(null);
  const { items, meta, loading, error, refetch } = useServerQuery('orders/', queryState, { enabled: true });

  useEffect(() => {
    getOrderSelectSources()
      .then((res) => {
        const data = res.data || {};
        setClients(Array.isArray(data.clients) ? data.clients : []);
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      })
      .catch(() => {
        setClients([]);
        setProfiles([]);
      });
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

  const onCancelOrder = async () => {
    if (!cancelTarget?.id) return;
    setErrorText('');
    try {
      await cancelOrder(cancelTarget.id);
      setCancelTarget(null);
      refetch();
      toast.show('Заявка отменена');
    } catch (e) {
      setErrorText(getApiErrorMessage(e, 'Ошибка отмены заявки'));
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
            options={[{ value: '', label: 'Все статусы' }, ...ORDER_STATUS_FILTER_OPTIONS]}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              setModalOrder({
                _key: Date.now(),
                lines: [{ profile: '', product: '', ordered_quantity: '', unit_price: '0', comment: '' }],
              })}
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
          <table className="data-table data-table--fixed data-table--row-actions data-table--orders">
          <thead>
            <tr>
              <th>№ заявки</th>
              <th>Клиент</th>
              <th>Дата</th>
              <th>Статус</th>
              <th className="data-table__cell--num">Сумма</th>
              <th className="data-table__cell--num">Продано</th>
              <th className="data-table__cell--num">Осталось</th>
              <th className="data-table__cell--actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => {
              const allowedNext = Array.isArray(o.available_status_transitions) ? o.available_status_transitions : [];
              const availableActions = o.available_actions;
              const nextStatuses = allowedNext.map((st) => st?.status || st);
              const nextKey = (s) => String(s || '').toLowerCase();
              const transitionsForMenu = nextStatuses.filter((ns) => {
                const k = nextKey(ns);
                if (k === 'canceled' || k === 'cancelled') return false;
                return !isHiddenOrderStatusTransitionTarget(ns);
              });

              const menuItems = [{ label: 'Открыть', onClick: () => setDetailOrderId(o.id) }];
              if (orderEditableByStatus(o.status)) {
                menuItems.push({
                  label: 'Редактировать',
                  onClick: () => setModalOrder(o),
                });
              }
              transitionsForMenu.forEach((nextStatus) => {
                menuItems.push({
                  label: transitionActionLabel(o.status, nextStatus),
                  onClick: () => onChangeStatus(o, nextStatus),
                });
              });
              if (orderMenuShowsCancel(availableActions, allowedNext)) {
                menuItems.push({
                  label: 'Отменить',
                  danger: true,
                  onClick: () => {
                    if (apiActionEnabled(availableActions, 'cancel')) setCancelTarget(o);
                    else onChangeStatus(o, 'canceled');
                  },
                });
              }
              menuItems.push({
                label: 'Накладная',
                onClick: () => downloadOrderWaybill(o.id),
              });

              return (
                <tr key={o.id}>
                  <td>
                    <button type="button" className="btn btn--ghost" onClick={() => setDetailOrderId(o.id)}>
                      {o.order_number || `Заявка ${o.id}`}
                    </button>
                  </td>
                  <td>{o.client_name || '—'}</td>
                  <td>{formatDate(o.date || o.created_at)}</td>
                  <td><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></td>
                  <td className="data-table__cell--num">{toMoney(o.total_amount)}</td>
                  <td className="data-table__cell--num">{toMoney(orderShippedMoney(o))}</td>
                  <td className="data-table__cell--num">{toMoney(orderRemainingMoney(o))}</td>
                  <td className="data-table__cell--actions">
                    <ActionMenu ariaLabel="Действия" items={menuItems} />
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
          draft={modalOrder}
          clients={clients}
          profiles={profiles}
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
          onStatusChange={onChangeStatus}
          onCancelRequest={(order) => setCancelTarget(order)}
          busyId={busyId}
        />
      )}
      <ConfirmModal
        open={!!cancelTarget}
        title="Отменить заявку?"
        message={cancelTarget ? `Отменить заявку «${cancelTarget.order_number || `#${cancelTarget.id}`}»?` : ''}
        confirmText="Отменить"
        onConfirm={onCancelOrder}
        onCancel={() => { setCancelTarget(null); setErrorText(''); }}
        error={cancelTarget ? errorText : undefined}
      />
    </div>
  );
};

const OrderModal = ({ draft, clients, profiles, onClose, onSubmit, error }) => {
  const isEdit = Boolean(draft?.id);
  const profileList = useMemo(() => (Array.isArray(profiles) ? profiles : []), [profiles]);

  const [saleDate, setSaleDate] = useState('');
  const [client, setClient] = useState('');
  const [sourceType, setSourceType] = useState('manager');
  const [comment, setComment] = useState('');
  const [lines, setLines] = useState([]);

  const draftKey = useMemo(
    () => (draft?.id != null ? `id:${draft.id}` : `new:${draft?._key ?? 0}`),
    [draft?.id, draft?._key],
  );

  const profileLabel = useCallback(
    (profileId) => {
      const p = profileList.find((x) => String(x.id) === String(profileId));
      return p ? profileOptionLabel(p) : '';
    },
    [profileList],
  );

  useEffect(() => {
    const o = draft;
    if (!o) return;
    setSaleDate((o.date || '').toString().slice(0, 10) || new Date().toISOString().slice(0, 10));
    const cid =
      o.client_id != null
        ? String(o.client_id)
        : o.client != null && typeof o.client === 'object' && o.client.id != null
          ? String(o.client.id)
          : '';
    setClient(cid || '');
    setSourceType(o.source_type || 'manager');
    setComment(o.comment || '');
    if (Array.isArray(o.lines) && o.lines.length) {
      setLines(
        o.lines.map((x) => {
          const pid =
            x.profile_id != null
              ? String(x.profile_id)
              : x.profile != null
                ? String(typeof x.profile === 'object' ? x.profile.id : x.profile)
                : '';
          const picked = pid ? profileList.find((p) => String(p.id) === String(pid)) : null;
          const autoName = picked ? profileOptionLabel(picked) : '';
          return {
            id: x.id,
            profile: pid,
            product: x.product || autoName || '',
            ordered_quantity: x.ordered_quantity != null ? String(x.ordered_quantity) : '',
            unit_price: x.unit_price != null ? String(x.unit_price) : '0',
            comment: x.comment || '',
          };
        }),
      );
    } else {
      setLines([{ profile: '', product: '', ordered_quantity: '', unit_price: '0', comment: '' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс формы только при смене заявки / нового черновика
  }, [draftKey]);

  const clientOptions = useMemo(
    () => (clients || []).map((c) => ({ value: String(c.id), label: clientOptionLabel(c) })),
    [clients],
  );

  const lineProductText = useCallback((line) => {
    const manual = String(line.product || '').trim();
    if (manual) return manual;
    if (line.profile) return profileLabel(line.profile) || '';
    return '';
  }, [profileLabel]);

  const canSave = useMemo(() => {
    if (!client) return false;
    if (!lines.length) return false;
    for (const line of lines) {
      if (!lineProductText(line)) return false;
      const q = parseLocaleNumber(line.ordered_quantity);
      if (!(q > 0)) return false;
      const price = parseLocaleNumber(line.unit_price);
      if (Number.isNaN(price) || price < 0) return false;
    }
    return true;
  }, [client, lines, lineProductText]);

  const buildPayloadLines = () =>
    lines
      .map((line) => {
        const profileId = line.profile ? Number(line.profile) : null;
        const product = lineProductText(line);
        const q = parseLocaleNumber(line.ordered_quantity);
        const rawPrice = parseLocaleNumber(line.unit_price);
        const price = Number.isNaN(rawPrice) ? 0 : rawPrice;
        return {
          ...(line.id ? { id: line.id } : {}),
          product,
          product_type: profileId ? 'профиль' : 'товар',
          ...(profileId ? { profile: profileId } : {}),
          ordered_quantity: String(q > 0 ? q : 0),
          unit_price: String(price),
          comment: String(line.comment || '').trim() || undefined,
        };
      })
      .filter((x) => x.product && parseLocaleNumber(x.ordered_quantity) > 0);

  const total = lines.reduce((sum, line) => {
    const q = parseLocaleNumber(line.ordered_quantity);
    const p = parseLocaleNumber(line.unit_price);
    const pr = Number.isNaN(p) ? 0 : p;
    if (!(q > 0) || pr < 0) return sum;
    return sum + q * pr;
  }, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide orders-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Заявка' : 'Новая заявка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          className="orders-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            const payloadLines = buildPayloadLines();
            if (!client || !payloadLines.length) return;
            onSubmit({
              client: Number(client),
              date: saleDate,
              source_type: sourceType,
              comment: comment.trim(),
              lines: payloadLines,
            });
          }}
        >
          <div className="orders-modal__scroll">
            <fieldset className="orders-modal__section">
              <legend className="orders-modal__legend">Документ</legend>
              <label>Дата</label>
              <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required />
              <label>Клиент *</label>
              <Select
                value={client}
                onChange={setClient}
                options={clientOptions}
                placeholder="Выберите клиента"
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
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" />
            </fieldset>

            <fieldset className="orders-modal__section">
              <legend className="orders-modal__legend">Товары</legend>
              {lines.map((line, idx) => (
                <div key={line.id || `line-${idx}`} className="orders-line-card">
                  <div className="orders-line-card__title">Товар {idx + 1}</div>
                  <label>Профиль / товар *</label>
                  <Select
                    value={line.profile}
                    onChange={(v) => {
                      const picked = profileList.find((p) => String(p.id) === String(v));
                      const auto = picked ? profileOptionLabel(picked) : '';
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, profile: v, product: v ? auto : '' } : x)),
                      );
                    }}
                    options={[
                      { value: '', label: '— без профиля (название вручную) —' },
                      ...profileList.map((p) => ({ value: String(p.id), label: profileOptionLabel(p) })),
                    ]}
                  />
                  <input
                    value={line.profile ? (profileLabel(line.profile) || line.product) : line.product}
                    onChange={(e) => {
                      if (line.profile) return;
                      setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product: e.target.value } : x)));
                    }}
                    readOnly={Boolean(line.profile)}
                    placeholder={line.profile ? '' : 'Название, если профиль не выбран'}
                  />
                  <label>Количество *</label>
                  <IntegerInput
                    min={1}
                    value={line.ordered_quantity}
                    onChange={(v) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ordered_quantity: v } : x)))}
                  />
                  <label>Цена *</label>
                  <input
                    inputMode="decimal"
                    value={line.unit_price}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)))}
                    placeholder="0"
                  />
                  <label>Комментарий</label>
                  <input
                    value={line.comment}
                    onChange={(e) => setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, comment: e.target.value } : x)))}
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--secondary orders-line-card__remove"
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
                onClick={() =>
                  setLines((prev) => [...prev, { profile: '', product: '', ordered_quantity: '', unit_price: '0', comment: '' }])
                }
              >
                Добавить строку
              </button>
            </fieldset>
            <p className="orders-modal__total">
              Итого: <strong>{formatQuantityDisplay(total)} сом</strong>
            </p>
            {error && <p className="modal__error">{error}</p>}
          </div>
          <div className="modal__actions orders-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSave}>
              {isEdit ? 'Сохранить' : 'Создать заявку'}
            </button>
          </div>
        </form>
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

const OrderDetailModal = ({
  orderId,
  onClose,
  onEdit,
  onStatusChange,
  onCancelRequest,
  busyId,
}) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const orderRes = await apiClient.get(`orders/${orderId}/`);
        if (!alive) return;
        setOrder(orderRes.data || null);
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

  const allowedNext = order && Array.isArray(order.available_status_transitions)
    ? order.available_status_transitions
    : [];
  const availableActions = order?.available_actions;
  const relatedSales = Array.isArray(order?.linked_entities?.sales) ? order.linked_entities.sales : [];
  const relatedPayments = Array.isArray(order?.linked_entities?.payments) ? order.linked_entities.payments : [];
  const statusTransitionTargets = allowedNext
    .map((st) => st?.status || st)
    .filter((ns) => {
      const k = String(ns).toLowerCase();
      if (k === 'canceled' || k === 'cancelled') return false;
      return !isHiddenOrderStatusTransitionTarget(ns);
    });

  const detailDlRow = (label, value) => (
    <div className="orders-detail__dl-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  const renderFooter = () => {
    if (!order) return null;
    const sk = orderStatusKey(order.status);
    const isTerminal = sk === 'closed' || sk === 'canceled';

    return (
      <div className="modal__actions orders-detail-modal__footer">
        <div className="orders-detail-modal__footer-inner">
          {!isTerminal && (
            <>
              {orderEditableByStatus(order.status) && (
                <button type="button" className="btn btn--secondary" disabled={busyId === order.id} onClick={() => onEdit(order)}>
                  Редактировать
                </button>
              )}
              {statusTransitionTargets.map((nextStatus, ti) => (
                <button
                  key={`${String(nextStatus)}-${ti}`}
                  type="button"
                  className="btn btn--secondary"
                  disabled={busyId === order.id}
                  onClick={() => onStatusChange(order, nextStatus)}
                >
                  {transitionActionLabel(order.status, nextStatus)}
                </button>
              ))}
              {orderMenuShowsCancel(availableActions, allowedNext) && (
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={busyId === order.id}
                  onClick={() => {
                    if (apiActionEnabled(availableActions, 'cancel')) onCancelRequest(order);
                    else onStatusChange(order, 'canceled');
                  }}
                >
                  Отменить
                </button>
              )}
            </>
          )}
          <span className="orders-detail-modal__footer-spacer" aria-hidden />
          <button
            type="button"
            className="btn btn--secondary orders-detail-modal__waybill"
            disabled={busyId === order.id}
            onClick={() => downloadOrderWaybill(order.id)}
          >
            Накладная
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide orders-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head orders-detail-modal__head">
          <div className="orders-detail-modal__head-text">
            <h3>Карточка заявки</h3>
            {!loading && !error && order && (
              <div className="orders-detail-modal__head-meta">
                <span className="orders-detail-modal__number">{order.order_number || `Заявка ${order.id}`}</span>
                <Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
              </div>
            )}
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && order && (
          <>
            <div className="orders-detail-modal__body">
              <section className="orders-detail__block">
                <h4 className="orders-detail__block-title">Документ</h4>
                <dl className="orders-detail__dl">
                  {detailDlRow('Номер', order.order_number || `Заявка ${order.id}`)}
                  {detailDlRow('Дата', formatDate(order.date || order.created_at))}
                  {detailDlRow('Клиент', order.client_name || '—')}
                  {detailDlRow('Источник', SOURCE_TYPE_LABELS[order.source_type] || order.source_type || '—')}
                  {detailDlRow('Комментарий', order.comment && String(order.comment).trim() ? order.comment : '—')}
                </dl>
              </section>

              <section className="orders-detail__block">
                <h4 className="orders-detail__block-title">Финансы</h4>
                <dl className="orders-detail__dl">
                  {detailDlRow('Сумма', toMoney(order.total_amount))}
                  {detailDlRow('Продано', toMoney(order.shipped_amount))}
                  {detailDlRow('Осталось', toMoney(order.remaining_amount))}
                  {detailDlRow('Оплачено', toMoney(order.paid_amount))}
                </dl>
              </section>

              <section className="orders-detail__block">
                <h4 className="orders-detail__block-title">Строки заявки</h4>
                <div className="commercial-table-wrap">
                  <table className="data-table data-table--order-detail-lines">
                    <thead>
                      <tr>
                        <th>Товар</th>
                        <th className="data-table__cell--num">Заказано</th>
                        <th className="data-table__cell--num">Продано</th>
                        <th className="data-table__cell--num">Осталось</th>
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
                          <td className="data-table__cell--num">{formatLineQty(line.remaining_quantity)}</td>
                          <td className="data-table__cell--num">{formatLineMoneyCell(line.unit_price)}</td>
                          <td className="data-table__cell--num">{formatLineMoneyCell(line.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="orders-detail__block">
                <h4 className="orders-detail__block-title">Связанные документы</h4>
                <div className="orders-detail__sub">
                  <strong className="orders-detail__sub-title">Связанные продажи</strong>
                  {relatedSales.length === 0 ? (
                    <p className="orders-detail__muted">Нет.</p>
                  ) : (
                    <div className="commercial-table-wrap">
                      <table className="data-table data-table--order-detail-lines">
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
                              <td>{sale.order_number || sale.sale_number || `Продажа ${sale.id}`}</td>
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
                    </div>
                  )}
                </div>
                <div className="orders-detail__sub">
                  <strong className="orders-detail__sub-title">Оплаты</strong>
                  {relatedPayments.length === 0 ? (
                    <p className="orders-detail__muted">Нет.</p>
                  ) : (
                    <div className="commercial-table-wrap">
                      <table className="data-table data-table--order-detail-lines">
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
                    </div>
                  )}
                </div>
              </section>
            </div>
            {renderFooter()}
          </>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
