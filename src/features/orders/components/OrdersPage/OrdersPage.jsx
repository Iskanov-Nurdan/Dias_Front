import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, parseLocaleNumber, formatQuantityDisplay, getApiErrorMessage } from '../../../../shared/lib';
import {
  Badge,
  EmptyState,
  ErrorState,
  IntegerInput,
  Loading,
  Pagination,
  SearchableSelect,
  useToast,
} from '../../../../shared/ui';
import {
  approveOrder,
  createOrder,
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
  return c.id != null ? `Клиент #${c.id}` : '';
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
  return p.id != null ? `Профиль #${p.id}` : '';
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
  if (rid != null) return `Клиент #${rid}`;
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
  if (rid != null) return `Профиль #${rid}`;
  return '—';
};

const requestStatusText = (s) => {
  const v = String(s || '').toLowerCase();
  const map = {
    draft: 'Черновик',
    not_ready: 'Не готово',
    ready: 'Готово',
    in_production: 'В производстве',
    approved: 'Принята',
    checking: 'Проверка',
    rejected: 'Отклонена',
  };
  return map[v] || (s != null && s !== '' ? String(s) : '—');
};

const requestStatusBadgeVariant = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'draft') return 'default';
  if (v === 'not_ready') return 'danger';
  if (v === 'ready') return 'success';
  if (v === 'in_production') return 'primary';
  return 'default';
};

const renderResourceCheck = (rc) => {
  if (rc == null) return <p className="orders-rq__muted">—</p>;
  if (typeof rc === 'string') return <pre className="orders-rq__pre">{rc}</pre>;
  const items = Array.isArray(rc) ? rc : Array.isArray(rc?.items) ? rc.items : null;
  if (items && items.length) {
    return (
      <table className="data-table data-table--tight orders-rq__table">
        <thead>
          <tr>
            <th>Позиция</th>
            <th>Нужно</th>
            <th>Доступно</th>
            <th>Хватает</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{it.name || it.title || it.id || '—'}</td>
              <td>{it.needed != null ? String(it.needed) : '—'}</td>
              <td>{it.available != null ? String(it.available) : '—'}</td>
              <td>{it.enough === true ? 'да' : it.enough === false ? 'нет' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  try {
    return <pre className="orders-rq__pre">{JSON.stringify(rc, null, 2)}</pre>;
  } catch {
    return <p className="orders-rq__muted">—</p>;
  }
};

const OrdersPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, request_status: '' });
  const [clients, setClients] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

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

  useOperationalRefetch(['order', 'sale', 'payment', 'return', 'production_batch'], refetch, true);

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
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <SearchableSelect
            value={queryState.request_status}
            onChange={(v) => setQueryState((p) => ({ ...p, request_status: v, page: 1 }))}
            placeholder="Статус заявки"
            options={filterOptions}
          />
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
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--orders-rq">
            <thead>
              <tr>
                <th className="data-table__cell--narrow"> </th>
                <th>Клиент</th>
                <th>Профиль</th>
                <th>Длина, м</th>
                <th>Количество</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const st = o.request_status;
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
                      <td>{o.length != null && o.length !== '' ? String(o.length) : '—'}</td>
                      <td>{o.quantity != null && o.quantity !== '' ? formatQuantityDisplay(o.quantity) : '—'}</td>
                      <td>
                        <Badge variant={requestStatusBadgeVariant(st)}>{requestStatusText(st)}</Badge>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="orders-rq__detail-row">
                        <td colSpan={6}>
                          <div className="orders-rq__card">
                            <div className="orders-rq__row">
                              <span className="orders-rq__k">Всего, м</span>
                              <span className="orders-rq__v">
                                {o.total_meters != null && o.total_meters !== '' ? String(o.total_meters) : '—'}
                              </span>
                            </div>
                            <div className="orders-rq__row orders-rq__row--block">
                              <span className="orders-rq__k">Проверка ресурсов</span>
                              <div className="orders-rq__v">{renderResourceCheck(o.resource_check)}</div>
                            </div>

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

                            {String(st).toLowerCase() === 'ready' && (
                              <p className="orders-rq__hint orders-rq__hint--muted">Статус «Готово» — действий нет</p>
                            )}

                            {String(st).toLowerCase() === 'in_production' && (
                              <p className="orders-rq__hint orders-rq__hint--muted">Только просмотр</p>
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
  const [profile, setProfile] = useState('');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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

  const canSubmit = client && profile && length.trim() && parseLocaleNumber(quantity) > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLocalError('');
    setBusy(true);
    try {
      const qn = parseLocaleNumber(quantity);
      await createOrder({
        client: Number(client),
        date,
        profile: Number(profile),
        length: String(length).trim(),
        quantity: qn,
      });
      await onCreated();
    } catch (err) {
      setLocalError(getErr(err, 'Ошибка создания'));
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
            <label>Клиент *</label>
            <SearchableSelect
              value={client}
              onChange={(v) => setClient(v != null ? String(v) : '')}
              options={clientOptions}
              placeholder="Выберите клиента"
            />
            <label>Профиль *</label>
            <SearchableSelect
              value={profile}
              onChange={(v) => setProfile(v != null ? String(v) : '')}
              options={profileOptions}
              placeholder="Выберите профиль"
            />
            <label>Длина, м *</label>
            <input
              inputMode="decimal"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              disabled={busy}
            />
            <label>Количество *</label>
            <IntegerInput min={1} value={quantity} onChange={setQuantity} disabled={busy} />
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
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
