import React, { useState, useEffect, useMemo } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import { useServerQuery, getApiErrorMessage, formatQuantityDisplay } from '../../../../shared/lib';
import {
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  ActionMenu,
  useToast,
  Badge,
  Select,
} from '../../../../shared/ui';
import {
  createClient,
  getClient,
  getClientFinancialSummary,
  getClientHistory,
  updateClient,
} from '../../api/clientsApi';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './ClientsPage.scss';

const ACTIVITY_FILTER = {
  all: 'all',
  active: 'active',
  inactive: 'inactive',
};

const PAYMENT_STATUS_RU = {
  unpaid: 'Не оплачено',
  partially_paid: 'Частично оплачено',
  paid: 'Оплачено',
  overpaid: 'Переплата',
  refunded: 'Возврат денег',
};

const CREDIT_LIMIT_MODE_RU = {
  soft: 'Мягкий лимит',
  hard: 'Жёсткий лимит',
};

const textOrDash = (v) => (v == null || v === '' ? '—' : String(v));

const translatePaymentStatus = (v) => {
  const key = String(v || '').toLowerCase();
  return PAYMENT_STATUS_RU[key] || '—';
};

const translateCreditLimitMode = (v) => {
  const key = String(v || '').toLowerCase();
  return CREDIT_LIMIT_MODE_RU[key] || '—';
};

const moneyValue = (v) => (v == null || v === '' ? '—' : `${formatQuantityDisplay(v)} сом`);

const pickClientFinanceSummary = (summaryRes) => {
  if (summaryRes.status !== 'fulfilled') return {};
  const d = summaryRes.value?.data;
  if (d?.items && typeof d.items === 'object' && !Array.isArray(d.items)) return d.items;
  return d && typeof d === 'object' ? d : {};
};

const FINANCE_SUMMARY_KEYS = [
  'payment_status',
  'total_revenue',
  'total_paid',
  'total_paid_net',
  'total_refunded',
  'client_debt_money',
  'client_advance_amount',
  'credit_limit',
  'credit_available',
  'credit_limit_mode',
  'credit_is_over_limit',
  'credit_warning',
];

const extractFinanceFromHistoryPayload = (historyData) => {
  const out = {};
  if (!historyData || typeof historyData !== 'object') return out;
  const bucket = historyData.items;
  const src =
    bucket && typeof bucket === 'object' && !Array.isArray(bucket) ? bucket : historyData;
  for (const k of FINANCE_SUMMARY_KEYS) {
    if (k in src) out[k] = src[k];
  }
  return out;
};

const clientIsActive = (c) => {
  if (c == null) return true;
  const st = String(c.status || '').toLowerCase();
  if (st === 'inactive') return false;
  if (st === 'active') return true;
  if (c.is_active === false) return false;
  if (c.active === false) return false;
  return true;
};

const clientStatusLabel = (c) => (clientIsActive(c) ? 'Активен' : 'Неактивен');

const ClientsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '' });
  const [activityFilter, setActivityFilter] = useState(ACTIVITY_FILTER.all);
  const [modalClient, setModalClient] = useState(null);
  const [detailClient, setDetailClient] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyFinance, setHistoryFinance] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const queryForApi = useMemo(() => {
    const base = { ...queryState };
    if (activityFilter === ACTIVITY_FILTER.active) base.is_active = true;
    else if (activityFilter === ACTIVITY_FILTER.inactive) base.is_active = false;
    return base;
  }, [queryState, activityFilter]);

  const { items, meta, raw, loading, error, refetch } = useServerQuery('clients/', queryForApi, { enabled: true });
  useOperationalRefetch(['sale', 'payment', 'order'], refetch, true);

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const ps = Number(queryState.page_size) || 20;
    if (raw && typeof raw.count === 'number' && ps > 0) {
      return { page: queryState.page, pages: Math.max(1, Math.ceil(raw.count / ps)), total: raw.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalClient?.id) {
        await updateClient(modalClient.id, payload);
      } else {
        await createClient(payload);
      }
      setModalClient(null);
      refetch();
      toast.show('Сохранено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка'));
    }
  };

  const handleOpenHistory = async (client) => {
    setHistoryTarget(client);
    setHistoryItems([]);
    setHistoryFinance(null);
    setHistoryLoading(true);
    try {
      const [historyRes, summaryRes] = await Promise.allSettled([
        getClientHistory(client.id),
        getClientFinancialSummary(client.id),
      ]);
      const historyData = historyRes.status === 'fulfilled' ? (historyRes.value.data || {}) : {};
      const summaryBucket = pickClientFinanceSummary(summaryRes);
      const fromHistoryFinance = extractFinanceFromHistoryPayload(historyData);
      const rows = [];
      (Array.isArray(historyData.orders) ? historyData.orders : []).forEach((o) => {
        rows.push({
          id: `o-${o.id}`,
          date: o.date || o.created_at,
          type: 'Заявка',
          amount: '—',
          description: `${o.order_number || 'Заявка'}${o.client_name ? ` · ${o.client_name}` : ''}`,
        });
      });
      (Array.isArray(historyData.sales) ? historyData.sales : []).forEach((s) => {
        rows.push({
          id: `s-${s.id}`,
          date: s.date || s.created_at,
          type: 'Продажа',
          amount: s.revenue != null ? moneyValue(s.revenue) : '—',
          description: `${s.order_number || s.sale_number || 'Продажа'}`,
        });
      });
      (Array.isArray(historyData.payments) ? historyData.payments : []).forEach((p) => {
        rows.push({
          id: `p-${p.id}`,
          date: p.date || p.created_at,
          type: 'Оплата',
          amount: p.amount != null ? moneyValue(p.amount) : '—',
          description: `${p.payment_number || 'Платёж'}`,
        });
      });
      (Array.isArray(historyData.returns) ? historyData.returns : []).forEach((r) => {
        rows.push({
          id: `r-${r.id}`,
          date: r.date || r.created_at,
          type: 'Возврат',
          amount: r.amount != null ? moneyValue(r.amount) : '—',
          description: `${r.return_number || 'Возврат'}${r.return_reason ? ` · ${r.return_reason}` : ''}`,
        });
      });
      rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      setHistoryItems(rows);
      setHistoryFinance({ ...fromHistoryFinance, ...summaryBucket });
    } catch {
      setHistoryItems([]);
      setHistoryFinance(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const activitySelectOptions = useMemo(
    () => [
      { value: ACTIVITY_FILTER.all, label: 'Все' },
      { value: ACTIVITY_FILTER.active, label: 'Активные' },
      { value: ACTIVITY_FILTER.inactive, label: 'Неактивные' },
    ],
    [],
  );

  return (
    <div className="page page--clients commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start clients-toolbar__start">
          <input
            type="text"
            className="ds-toolbar__search ds-toolbar__search--full"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <div className="clients-toolbar__filter">
            <Select
              value={activityFilter}
              onChange={(v) => {
                setActivityFilter(v);
                setQueryState((p) => ({ ...p, page: 1 }));
              }}
              options={activitySelectOptions}
              placeholder="Статус"
              className="clients-toolbar__activity-select"
            />
          </div>
        </div>
        <div className="ds-toolbar__end ds-hide-mobile">
          <button type="button" className="btn btn--primary" onClick={() => setModalClient({})}>
            Создать
          </button>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        <button type="button" className="btn btn--primary" onClick={() => setModalClient({})}>
          Создать
        </button>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет клиентов" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <div className="commercial-table-wrap">
          <table className="data-table data-table--row-actions data-table--clickable data-table--clients">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Контакт</th>
                <th className="data-table__cell--num">Продаж</th>
                <th className="data-table__cell--num">Сумма продаж</th>
                <th>Статус</th>
                <th className="data-table__cell--actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetailClient(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailClient(c);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td className="data-table__cell--lead">{c.name || c.title || '—'}</td>
                  <td className="data-table__cell--muted">{c.phone || c.phone_number || '—'}</td>
                  <td className="data-table__cell--muted">{c.contact || c.contact_person || c.contact_name || '—'}</td>
                  <td className="data-table__cell--num">{c.sales_count ?? c.orders_count ?? '—'}</td>
                  <td className="data-table__cell--num">
                    {c.sales_total != null && c.sales_total !== ''
                      ? `${formatQuantityDisplay(c.sales_total)} сом`
                      : '—'}
                  </td>
                  <td>
                    {clientIsActive(c) ? (
                      <Badge variant="success">{clientStatusLabel(c)}</Badge>
                    ) : (
                      <Badge variant="default">{clientStatusLabel(c)}</Badge>
                    )}
                  </td>
                  <td className="data-table__cell--actions">
                    <ActionMenu
                      ariaLabel="Действия"
                      items={[
                        { label: 'Открыть', onClick: () => setDetailClient(c) },
                        { label: 'Редактировать', onClick: () => setModalClient(c) },
                        { label: 'История', onClick: () => handleOpenHistory(c) },
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
        <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}

      {detailClient && (
        <ClientDetailModal
          client={detailClient}
          onClose={() => setDetailClient(null)}
          onEdit={(client) => {
            setDetailClient(null);
            setModalClient(client);
          }}
          onOpenHistory={(client) => {
            setDetailClient(null);
            handleOpenHistory(client);
          }}
        />
      )}

      {modalClient !== null && (
        <ClientModal
          client={modalClient?.id ? modalClient : null}
          onClose={() => {
            setModalClient(null);
            setSubmitError('');
          }}
          onSubmit={handleSubmit}
          error={submitError}
        />
      )}

      {historyTarget && (
        <HistoryModal
          client={historyTarget}
          loading={historyLoading}
          items={historyItems}
          finance={historyFinance}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
};

const ClientDetailModal = ({ client, onClose, onEdit, onOpenHistory }) => {
  const [full, setFull] = useState(client);
  const [detailLoading, setDetailLoading] = useState(Boolean(client?.id));
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    if (!client?.id) {
      setFull(client);
      setDetailLoading(false);
      setDetailError('');
      return;
    }
    setFull(client);
    setDetailLoading(true);
    setDetailError('');
    getClient(client.id)
      .then((res) => {
        setFull(res.data);
      })
      .catch((err) => {
        setDetailError(getApiErrorMessage(err, 'Не удалось загрузить клиента'));
        setFull(client);
      })
      .finally(() => setDetailLoading(false));
  }, [client?.id]);

  const c = full || client;

  const row = (label, value) => (
    <div className="clients-detail__row">
      <span className="clients-detail__label">{label}</span>
      <span className="clients-detail__value">{value}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide clients-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка клиента</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="clients-modal__body">
          {detailLoading && <Loading />}
          {detailError && <p className="modal__error">{detailError}</p>}
          {!detailLoading && (
            <>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Основные данные</h4>
                {row('Название', textOrDash(c?.name || c?.title))}
                {row('Контакт', textOrDash(c?.contact || c?.contact_person || c?.contact_name))}
                {row('Телефон', textOrDash(c?.phone || c?.phone_number))}
                {row('WhatsApp / Telegram', textOrDash(c?.messenger || c?.whatsapp_telegram))}
                {row('Email', textOrDash(c?.email))}
                {row('Адрес', textOrDash(c?.address))}
                {row('Тип клиента', textOrDash(c?.client_type || c?.type))}
                {row('Статус', clientStatusLabel(c))}
              </section>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Финансы</h4>
                {row('Продаж', textOrDash(c?.sales_count ?? c?.orders_count))}
                {row(
                  'Сумма продаж',
                  c?.sales_total != null && c?.sales_total !== '' ? moneyValue(c.sales_total) : '—',
                )}
                {row('Кредитный лимит', c?.credit_limit != null && c?.credit_limit !== '' ? moneyValue(c.credit_limit) : '—')}
                {row('Режим лимита', translateCreditLimitMode(c?.credit_limit_mode))}
              </section>
            </>
          )}
        </div>
        <div className="modal__actions clients-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={() => onOpenHistory(c)}>
            История
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onEdit(c)}>
            Редактировать
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientModal = ({ client, onClose, onSubmit, error }) => {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || client?.phone_number || '');
  const [contactPerson, setContactPerson] = useState(client?.contact || client?.contact_person || client?.contact_name || '');
  const [messenger, setMessenger] = useState(client?.messenger || client?.whatsapp_telegram || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phoneAlt, setPhoneAlt] = useState(client?.phone_alt || client?.second_phone || '');
  const [inn, setInn] = useState(client?.inn || '');
  const [address, setAddress] = useState(client?.address || '');
  const [clientType, setClientType] = useState(client?.client_type || client?.type || '');
  const [comment, setComment] = useState(client?.comment || client?.notes || '');
  const [creditLimit, setCreditLimit] = useState(
    client?.credit_limit != null && client?.credit_limit !== '' ? String(client.credit_limit) : '',
  );
  const [creditLimitMode, setCreditLimitMode] = useState(
    client?.credit_limit_mode ? String(client.credit_limit_mode).toLowerCase() : '',
  );
  const [isActive, setIsActive] = useState(clientIsActive(client));

  useEffect(() => {
    setName(client?.name || '');
    setPhone(client?.phone || client?.phone_number || '');
    setContactPerson(client?.contact || client?.contact_person || client?.contact_name || '');
    setMessenger(client?.messenger || client?.whatsapp_telegram || '');
    setEmail(client?.email || '');
    setPhoneAlt(client?.phone_alt || client?.second_phone || '');
    setInn(client?.inn || '');
    setAddress(client?.address || '');
    setClientType(client?.client_type || client?.type || '');
    setComment(client?.comment || client?.notes || '');
    setCreditLimit(client?.credit_limit != null && client?.credit_limit !== '' ? String(client.credit_limit) : '');
    setCreditLimitMode(client?.credit_limit_mode ? String(client.credit_limit_mode).toLowerCase() : '');
    setIsActive(clientIsActive(client));
  }, [client?.id, client]);

  const isDirty = useDirtyFromBaseline(client?.id ?? 'new', false, {
    name: name.trim(),
    phone: phone.trim(),
    contactPerson: contactPerson.trim(),
    messenger: messenger.trim(),
    email: email.trim(),
    phoneAlt: phoneAlt.trim(),
    inn: inn.trim(),
    address: address.trim(),
    clientType: clientType.trim(),
    comment: comment.trim(),
    creditLimit: creditLimit.trim(),
    creditLimitMode,
    isActive,
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  const creditModeOptions = useMemo(
    () => [
      { value: '', label: '— не задан —' },
      { value: 'soft', label: 'Мягкий лимит' },
      { value: 'hard', label: 'Жёсткий лимит' },
    ],
    [],
  );

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal clients-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{client ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          className="clients-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            const creditNum = creditLimit.trim() === '' ? undefined : Number(creditLimit.trim().replace(',', '.'));
            const payload = {
              name: name.trim(),
              phone: phone.trim() || undefined,
              contact: contactPerson.trim() || undefined,
              email: email.trim() || undefined,
              phone_alt: phoneAlt.trim() || undefined,
              inn: inn.trim() || undefined,
              address: address.trim() || undefined,
              client_type: clientType.trim() || undefined,
              notes: comment.trim() || undefined,
              is_active: isActive,
              messenger: messenger.trim() || undefined,
              credit_limit: creditNum !== undefined && !Number.isNaN(creditNum) ? creditNum : undefined,
              credit_limit_mode: creditLimitMode || undefined,
            };
            onSubmit(payload);
          }}
        >
          <div className="clients-modal__scroll">
            <fieldset className="clients-modal__section">
              <legend className="clients-modal__legend">Основное</legend>
              <label>Название / компания *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ФИО или организация" />
              <label>Контактное лицо</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="ФИО" />
              <label>Телефон</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+996 …" />
              <label>WhatsApp / Telegram</label>
              <input value={messenger} onChange={(e) => setMessenger(e.target.value)} placeholder="@username или номер" />
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="необязательно" />
            </fieldset>
            <fieldset className="clients-modal__section">
              <legend className="clients-modal__legend">Дополнительно</legend>
              <label>Доп. телефон</label>
              <input value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} placeholder="Необязательно" />
              <label>ИНН</label>
              <input value={inn} onChange={(e) => setInn(e.target.value)} placeholder="Необязательно" />
              <label>Адрес</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Доставка" />
              <label>Тип клиента</label>
              <input value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="Розница, опт…" />
              <label>Комментарий</label>
              <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Внутренние заметки" />
            </fieldset>
            <fieldset className="clients-modal__section">
              <legend className="clients-modal__legend">Кредит</legend>
              <label>Кредитный лимит</label>
              <input
                inputMode="decimal"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="сом"
              />
              <label>Режим лимита</label>
              <Select value={creditLimitMode} onChange={setCreditLimitMode} options={creditModeOptions} placeholder="Выберите" />
            </fieldset>
            <fieldset className="clients-modal__section clients-modal__section--status">
              <legend className="clients-modal__legend">Статус</legend>
              <label className="clients-form__check">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Клиент активен
              </label>
            </fieldset>
            {error && <p className="modal__error">{error}</p>}
          </div>
          <div className="modal__actions clients-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HistoryModal = ({ client, loading, items, finance, onClose }) => {
  const f = finance && typeof finance === 'object' ? finance : {};
  const financeBlock = (title, rows) => (
    <section className="clients-history__block">
      <h4 className="clients-history__block-title">{title}</h4>
      <dl className="clients-history__dl">
        {rows.map(([k, v]) => (
          <div key={k} className="clients-history__dl-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );

  const financeRows = [
    ['Статус оплаты', 'payment_status' in f ? translatePaymentStatus(f.payment_status) : '—'],
    ['Выручка', 'total_revenue' in f ? moneyValue(f.total_revenue) : '—'],
    ['Оплачено', 'total_paid' in f ? moneyValue(f.total_paid) : '—'],
    ['Долг', 'client_debt_money' in f ? moneyValue(f.client_debt_money) : '—'],
    ['Аванс', 'client_advance_amount' in f ? moneyValue(f.client_advance_amount) : '—'],
    ['Возвраты денег', 'total_refunded' in f ? moneyValue(f.total_refunded) : '—'],
  ];

  const creditRows = [
    ['Кредитный лимит', 'credit_limit' in f ? moneyValue(f.credit_limit) : '—'],
    ['Доступный кредит', 'credit_available' in f ? moneyValue(f.credit_available) : '—'],
    ['Режим лимита', 'credit_limit_mode' in f ? translateCreditLimitMode(f.credit_limit_mode) : '—'],
    [
      'Превышение лимита',
      'credit_is_over_limit' in f ? (f.credit_is_over_limit ? 'Да' : 'Нет') : '—',
    ],
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide clients-modal clients-modal--history" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>История: {client?.name || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="clients-modal__body clients-modal__scroll">
          {!loading && (
            <div className="clients-history__summary">
              {financeBlock('Финансы', financeRows)}
              {financeBlock('Кредит', creditRows)}
            </div>
          )}
          {loading && <Loading />}
          {!loading && items.length === 0 && <EmptyState title="Нет данных" />}
          {!loading && items.length > 0 && (
            <section className="clients-history__block clients-history__block--table">
              <h4 className="clients-history__block-title">История</h4>
              <div className="commercial-table-wrap">
                <table className="data-table data-table--clients-history">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Событие</th>
                      <th className="data-table__cell--num">Сумма</th>
                      <th>Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((h, idx) => (
                      <tr key={h.id || idx}>
                        <td className="clients-history__date">{h.date || h.created_at || '—'}</td>
                        <td>
                          <div className="clients-history__type">{h.type || h.event || '—'}</div>
                        </td>
                        <td className="data-table__cell--num">{h.amount ?? '—'}</td>
                        <td>
                          <div className="clients-history__desc">{h.description || h.comment || '—'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;
