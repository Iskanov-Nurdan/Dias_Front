import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useOperationalRefetch } from '../../../../shared/realtime';
import {
  useServerQuery,
  parseLocaleNumber,
  formatQuantityDisplay,
  formatNumberForInput,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import {
  Badge,
  DecimalInput,
  EmptyState,
  ErrorState,
  IntegerInput,
  Loading,
  Pagination,
  SearchableSelect,
  useToast,
  ClientDateFilter,
} from '../../../../shared/ui';
import {
  approveOrder,
  createOrder,
  getOrdersNoCache,
  getOrderSelectSources,
  recheckOrder,
  rejectOrder,
} from '../../api/ordersApi';
import './OrdersPage.scss';

const getErr = (e, fallback) => getApiErrorMessage(e, fallback);

const pickClientName = (c) => {
  if (!c) return '';
  if (c.label != null) {
    const lab = String(c.label).trim();
    if (lab && !/^клиент$/i.test(lab)) return lab;
  }
  const n =
    (typeof c.name === 'string' && c.name.trim()) ||
    (typeof c.title === 'string' && c.title.trim()) ||
    (typeof c.client_name === 'string' && c.client_name.trim());
  if (n) return n;
  return '';
};

const pickProfileName = (p) => {
  if (!p) return '';
  if (p.label != null) {
    const lab = String(p.label).trim();
    if (lab) return lab;
  }
  const n =
    (typeof p.name === 'string' && p.name.trim()) ||
    (typeof p.title === 'string' && p.title.trim()) ||
    (typeof p.code === 'string' && p.code.trim());
  if (n) return n;
  return '';
};

const orderClientLabel = (o, clientList) => {
  if (o?.client && typeof o.client === 'object') {
    const t = pickClientName(o.client);
    if (t) return t;
  }
  if (o?.client_name && String(o.client_name).trim()) return String(o.client_name).trim();
  let rid = o?.client_id;
  if (rid == null && o?.client != null && typeof o.client !== 'object') rid = o.client;
  if (rid != null && Array.isArray(clientList)) {
    const row = clientList.find((c) => String(c.id) === String(rid));
    if (row) return pickClientName(row);
  }
  if (rid != null) return '—';
  return '—';
};

const orderProfileLabel = (o, profileList) => {
  if (o?.profile && typeof o.profile === 'object') {
    const t = pickProfileName(o.profile);
    if (t) return t;
  }
  if (o?.profile_name && String(o.profile_name).trim()) return String(o.profile_name).trim();
  let rid = o?.profile_id;
  if (rid == null && o?.profile != null && typeof o.profile !== 'object') rid = o.profile;
  if (rid != null && Array.isArray(profileList)) {
    const row = profileList.find((p) => String(p.id) === String(rid));
    if (row) return pickProfileName(row);
  }
  if (rid != null) return '—';
  return '—';
};

const pickRecipeName = (r) => {
  if (!r) return '';
  if (r.label != null) {
    const lab = String(r.label).trim();
    if (lab) return lab;
  }
  const n =
    (typeof r.recipe === 'string' && r.recipe.trim())
    || (typeof r.recipe_name === 'string' && r.recipe_name.trim())
    || (typeof r.name === 'string' && r.name.trim())
    || (typeof r.product === 'string' && r.product.trim())
    || (typeof r.product_name === 'string' && r.product_name.trim());
  if (n) return n;
  return '';
};

const orderRecipeLabel = (o, recipeList) => {
  if (o?.recipe && typeof o.recipe === 'object') {
    const t = pickRecipeName(o.recipe);
    if (t) return t;
  }
  if (o?.recipe_name && String(o.recipe_name).trim()) return String(o.recipe_name).trim();
  let rid = o?.recipe_id;
  if (rid == null && o?.recipe != null && typeof o.recipe !== 'object') rid = o.recipe;
  if (rid != null && Array.isArray(recipeList)) {
    const row = recipeList.find((r) => String(r.id) === String(rid));
    if (row) return pickRecipeName(row);
  }
  if (rid != null) return '—';
  return '—';
};

const requestStatusText = (s) => {
  const v = String(s || '').toLowerCase();
  const map = {
    draft: 'Черновик',
    not_ready: 'Не готово',
    ready: 'Готово',
    in_production: 'В производстве',
    closed: 'Закрыта',
    approved: 'Принята',
    checking: 'Проверка',
    rejected: 'Отклонена',
  };
  return map[v] || (s != null && s !== '' ? String(s) : '—');
};

const resolveOrderStatusValue = (order) => (
  order?.request_status
  || order?.status
  || ''
);

const resolveOrderStatusText = (order) => (
  order?.request_status_label
  || order?.status_label
  || requestStatusText(resolveOrderStatusValue(order))
);

const requestStatusBadgeVariant = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'draft') return 'default';
  if (v === 'not_ready') return 'danger';
  if (v === 'ready') return 'success';
  if (v === 'in_production') return 'primary';
  return 'default';
};

const OrdersPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, request_status: '' });
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [clientDateFilter, setClientDateFilter] = useState('');

  const { items, meta, loading, error, refetch } = useServerQuery('orders/', queryState, {
    enabled: true,
    fetcher: async (params, signal) => {
      const res = await getOrdersNoCache(params, { signal });
      return res.data;
    },
  });

  useEffect(() => {
    getOrderSelectSources()
      .then((res) => {
        const data = res.data || {};
        setClients(Array.isArray(data.clients) ? data.clients : []);
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      })
      .catch(() => {
        setClients([]);
        setProfiles([]);
        setRecipes([]);
      });
  }, []);

  useOperationalRefetch(['order', 'orders', 'sale', 'payment', 'return', 'production_batch'], refetch, true);

  const orderDateFields = useMemo(
    () => ['created_at', 'updated_at', 'date', 'order_date', 'requested_at'],
    [],
  );

  const visibleOrders = useMemo(() => {
    if (!clientDateFilter) return items;
    return (items || []).filter((o) =>
      matchesClientDateFilter(clientDateFilter, pickFirstIsoDate(o, orderDateFields)),
    );
  }, [items, clientDateFilter, orderDateFields]);

  const onApprove = useCallback(
    async (id) => {
      setActionError('');
      setActionBusy(true);
      try {
        await approveOrder(id);
        await refetch();
        toast.show('Принято');
      } catch (e) {
        setActionError(getErr(e, 'Ошибка'));
        toast.show(getErr(e, 'Ошибка'));
      } finally {
        setActionBusy(false);
      }
    },
    [refetch, toast],
  );

  const onReject = useCallback(
    async (id) => {
      setActionError('');
      setActionBusy(true);
      try {
        await rejectOrder(id);
        await refetch();
        toast.show('Отклонено');
      } catch (e) {
        setActionError(getErr(e, 'Ошибка'));
        toast.show(getErr(e, 'Ошибка'));
      } finally {
        setActionBusy(false);
      }
    },
    [refetch, toast],
  );

  const onRecheck = useCallback(
    async (id) => {
      setActionError('');
      setActionBusy(true);
      try {
        await recheckOrder(id);
        await refetch();
        toast.show('Проверка выполнена');
      } catch (e) {
        setActionError(getErr(e, 'Ошибка'));
        toast.show(getErr(e, 'Ошибка'));
      } finally {
        setActionBusy(false);
      }
    },
    [refetch, toast],
  );

  const filterOptions = useMemo(
    () => [
      { value: '', label: 'Все' },
      { value: 'draft', label: 'Черновик' },
      { value: 'not_ready', label: 'Не готово' },
      { value: 'ready', label: 'Готово' },
      { value: 'in_production', label: 'В производстве' },
    ],
    [],
  );

  return (
    <div className="page commercial-page orders-rq-page">
      <div className="ds-toolbar commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <SearchableSelect
            value={queryState.request_status}
            onChange={(v) => setQueryState((p) => ({ ...p, request_status: v, page: 1 }))}
            placeholder="Статус заявки"
            options={filterOptions}
          />
          <ClientDateFilter value={clientDateFilter} onChange={setClientDateFilter} id="orders-date-filter" />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            Создать заявку
          </button>
        </div>
      </div>

      {actionError && <p className="orders-rq__banner-error">{actionError}</p>}

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет заявок" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && visibleOrders.length === 0 && (
        <EmptyState title="На выбранную дату заявок нет (на этой странице)" />
      )}
      {!loading && (!error || error.status === 404) && visibleOrders.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--orders-rq">
            <thead>
              <tr>
                <th className="data-table__cell--narrow"> </th>
                <th>Клиент</th>
                <th>Профиль</th>
                <th>Рецепт</th>
                <th>Количество</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => {
                const st = resolveOrderStatusValue(o);
                const stText = resolveOrderStatusText(o);
                const isOpen = expandedId === o.id;
                return (
                  <React.Fragment key={o.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setExpandedId(isOpen ? null : o.id)}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? '▼' : '▶'}
                        </button>
                      </td>
                      <td>{orderClientLabel(o, clients)}</td>
                      <td>{orderProfileLabel(o, profiles)}</td>
                      <td>{orderRecipeLabel(o, recipes)}</td>
                      <td>{o.quantity != null && o.quantity !== '' ? formatQuantityDisplay(o.quantity) : '—'}</td>
                      <td>
                        <Badge variant={requestStatusBadgeVariant(st)}>{stText}</Badge>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="orders-rq__detail-row">
                        <td colSpan={6}>
                          <div className="orders-rq__card">
                            {String(st).toLowerCase() === 'draft' && (
                              <div className="orders-rq__actions">
                                <button
                                  type="button"
                                  className="btn btn--primary"
                                  disabled={actionBusy}
                                  onClick={() => onApprove(o.id)}
                                >
                                  Принять
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--danger"
                                  disabled={actionBusy}
                                  onClick={() => onReject(o.id)}
                                >
                                  Отклонить
                                </button>
                              </div>
                            )}

                            {String(st).toLowerCase() === 'not_ready' && (
                              <div className="orders-rq__actions">
                                <button
                                  type="button"
                                  className="btn btn--secondary"
                                  disabled={actionBusy}
                                  onClick={() => onRecheck(o.id)}
                                >
                                  Проверить снова
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!loading && (!error || error.status === 404) && (
        <Pagination meta={meta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {createOpen && (
        <CreateOrderModal
          clients={clients}
          profiles={profiles}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refetch();
            toast.show('Заявка создана');
          }}
        />
      )}
    </div>
  );
};

const CreateOrderModal = ({ clients, profiles, onClose, onCreated }) => {
  const [client, setClient] = useState('');
  const [lines, setLines] = useState([{ profile: '', quantity: '' }]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState('debt');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  /** Полная оплата — сумма заявки (цена). */
  const [fullAmount, setFullAmount] = useState('');
  /** Частичная — итог и оплачено сейчас. */
  const [partialTotal, setPartialTotal] = useState('');
  const [partialPaidNow, setPartialPaidNow] = useState('');
  /** В долг — на какую сумму открыт долг. */
  const [debtAmount, setDebtAmount] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  const clientOptions = useMemo(
    () =>
      (clients || []).map((c) => {
        const label = pickClientName(c);
        return {
          value: String(c.id),
          label,
          searchText: [c.label, c.name, c.title, c.phone, c.phone_number, String(c.id)]
            .filter((x) => x != null && String(x).trim() !== '')
            .join(' '),
        };
      }),
    [clients],
  );
  const profileOptions = useMemo(
    () =>
      (profiles || []).map((p) => {
        const label = pickProfileName(p);
        return {
          value: String(p.id),
          label,
          searchText: [p.label, p.name, p.title, p.code, String(p.id)]
            .filter((x) => x != null && String(x).trim() !== '')
            .join(' '),
        };
      }),
    [profiles],
  );

  useEffect(() => {
    if (paymentType === 'full') {
      setPartialTotal('');
      setPartialPaidNow('');
      setDebtAmount('');
    } else if (paymentType === 'partial') {
      setFullAmount('');
      setDebtAmount('');
    } else {
      setFullAmount('');
      setPartialTotal('');
      setPartialPaidNow('');
    }
  }, [paymentType]);

  const nFull = parseLocaleNumber(fullAmount);
  const nPartTotal = parseLocaleNumber(partialTotal);
  const nPartPaid = parseLocaleNumber(partialPaidNow);
  const nDebt = parseLocaleNumber(debtAmount);
  const partialRemainder =
    Number.isFinite(nPartTotal) && Number.isFinite(nPartPaid) ? Math.max(0, nPartTotal - nPartPaid) : null;

  const linesValid = lines.length > 0 && lines.every((ln) => (
    ln.profile
    && parseLocaleNumber(ln.quantity) > 0
  ));

  const paymentValid = (() => {
    if (paymentType === 'full') {
      return Number.isFinite(nFull) && nFull > 0;
    }
    if (paymentType === 'partial') {
      return Number.isFinite(nPartTotal) && nPartTotal > 0
        && Number.isFinite(nPartPaid) && nPartPaid >= 0
        && nPartPaid <= nPartTotal;
    }
    return Number.isFinite(nDebt) && nDebt > 0;
  })();

  const canSubmit = Boolean(client) && linesValid && paymentValid;
  useEffect(() => {
    setActiveLineIdx((prev) => {
      if (!lines.length) return 0;
      if (prev < 0) return 0;
      if (prev >= lines.length) return lines.length - 1;
      return prev;
    });
  }, [lines]);
  const selectedLine = lines[activeLineIdx] || null;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLocalError('');
    setBusy(true);
    try {
      const orderLines = lines.map((ln) => ({
        profile: Number(ln.profile),
        quantity: parseLocaleNumber(ln.quantity),
      }));
      const first = orderLines[0];
      const paymentExtras = {};
      if (paymentType === 'full') {
        paymentExtras.total_amount = String(nFull);
        paymentExtras.paid_amount = String(nFull);
      } else if (paymentType === 'partial') {
        paymentExtras.total_amount = String(nPartTotal);
        paymentExtras.paid_amount = String(nPartPaid);
        paymentExtras.amount_remaining = String(Math.max(0, nPartTotal - nPartPaid));
      } else {
        paymentExtras.total_amount = String(nDebt);
        paymentExtras.paid_amount = '0';
      }
      await createOrder({
        client: Number(client),
        date,
        profile: first.profile,
        quantity: first.quantity,
        order_lines: orderLines,
        payment_type: paymentType,
        payment_method: paymentMethod,
        ...paymentExtras,
      });
      await onCreated();
    } catch (err) {
      const d = err?.response?.data;
      const code = d && typeof d === 'object' ? (d.code || d.error?.code || '') : '';
      const asStr = d && typeof d === 'object' ? JSON.stringify(d) : '';
      if (
        String(code).toUpperCase() === 'AMBIGUOUS_RECIPE_FOR_PROFILE'
        || /AMBIGUOUS_RECIPE_FOR_PROFILE/i.test(asStr)
      ) {
        setLocalError(
          'У профиля несколько активных рецептов — сервер не может выбрать один. Оставьте один активный рецепт на профиль.',
        );
      } else {
        setLocalError(getErr(err, 'Ошибка создания'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая заявка</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть" disabled={busy}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="orders-rq-create">
            <div className="orders-rq-create__top">
              <div>
                <label>Клиент *</label>
                <SearchableSelect
                  value={client}
                  onChange={(v) => setClient(v != null ? String(v) : '')}
                  options={clientOptions}
                  placeholder="Выберите клиента"
                />
              </div>
            </div>

            <div className="orders-rq-create__cart-layout">
              <div className="orders-rq-create__cart-panel">
                <div className="orders-rq-create__cart-head">
                  <label>Товары (корзина) *</label>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setLines((prev) => [...prev, { profile: '', quantity: '' }])}
                    disabled={busy}
                  >
                    + Добавить
                  </button>
                </div>
                <div className="orders-rq-create__cart-list">
                  {lines.map((line, idx) => {
                    const profileName = profileOptions.find((x) => String(x.value) === String(line.profile))?.label || `Товар ${idx + 1}`;
                    const qty = parseLocaleNumber(line.quantity) || 0;
                    return (
                      <button
                        key={`order-line-${idx}`}
                        type="button"
                        className={`orders-rq-create__cart-item ${idx === activeLineIdx ? 'is-active' : ''}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <span>{profileName}</span>
                        <span>{qty > 0 ? `${formatQuantityDisplay(qty)} шт` : 'Не заполнено'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="orders-rq-create__line-card">
                <div className="orders-rq-create__line-card-head">
                  <div className="orders-rq-create__line-title">Детали товара</div>
                  {selectedLine && lines.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--secondary orders-rq-create__line-remove"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== activeLineIdx))}
                      disabled={busy}
                    >
                      Удалить
                    </button>
                  )}
                </div>
                {!selectedLine && <p className="orders-rq__muted">Выберите товар из корзины</p>}
                {selectedLine && (
                  <div className="orders-rq-create__line-grid">
                    <div>
                      <label>Профиль *</label>
                      <SearchableSelect
                        value={selectedLine.profile}
                        onChange={(v) => {
                          const nextProfile = v != null ? String(v) : '';
                          setLines((prev) => prev.map((x, i) => (
                            i === activeLineIdx ? { ...x, profile: nextProfile } : x
                          )));
                        }}
                        options={profileOptions}
                        placeholder="Выберите профиль"
                      />
                    </div>
                    <div>
                      <label>Количество *</label>
                      <IntegerInput
                        min={1}
                        value={selectedLine.quantity}
                        onChange={(v) => setLines((prev) => prev.map((x, i) => (
                          i === activeLineIdx ? { ...x, quantity: v } : x
                        )))}
                        disabled={busy}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
            <label>Тип оплаты *</label>
            <SearchableSelect
              value={paymentType}
              onChange={(v) => setPaymentType(v != null ? String(v) : 'debt')}
              options={[
                { value: 'full', label: 'Полная' },
                { value: 'partial', label: 'Частичная' },
                { value: 'debt', label: 'В долг' },
              ]}
              disabled={busy}
            />
            <label>Способ оплаты *</label>
            <SearchableSelect
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v != null ? String(v) : 'cash')}
              options={[
                { value: 'cash', label: 'Наличные' },
                { value: 'card', label: 'Карта' },
                { value: 'transfer', label: 'Перевод' },
              ]}
              disabled={busy}
            />
            {paymentType === 'full' && (
              <>
                <label>Цена (сумма заявки) *</label>
                <DecimalInput min={0} value={fullAmount} onChange={setFullAmount} required disabled={busy} />
              </>
            )}
            {paymentType === 'partial' && (
              <>
                <label>Итог (сумма заявки) *</label>
                <DecimalInput min={0} value={partialTotal} onChange={setPartialTotal} required disabled={busy} />
                <label>Оплачено сейчас *</label>
                <DecimalInput min={0} value={partialPaidNow} onChange={setPartialPaidNow} required disabled={busy} />
                <label>Остаток к оплате</label>
                <input
                  readOnly
                  className="orders-rq-create__readonly-sum"
                  value={
                    partialRemainder != null && Number.isFinite(partialRemainder)
                      ? `${formatNumberForInput(partialRemainder)} сом`
                      : '—'
                  }
                />
              </>
            )}
            {paymentType === 'debt' && (
              <>
                <label>Сумма долга *</label>
                <DecimalInput min={0} value={debtAmount} onChange={setDebtAmount} required disabled={busy} />
              </>
            )}
            {localError && <p className="modal__error">{localError}</p>}
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit || busy}>
              {busy ? '…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrdersPage;
