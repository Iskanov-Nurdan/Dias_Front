import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import { useServerQuery, getApiErrorMessage, formatQuantityDisplay } from '../../../../shared/lib';
import { formatDate } from '../../../../shared/constants/common';
import {
  ConfirmModal,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  ActionMenu,
  useToast,
  Badge,
  SearchableSelect,
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

const PAYMENT_METHOD_RU = {
  cash: 'Наличные',
  transfer: 'Перевод',
  card: 'Карта',
  other: 'Другое',
};

const DOC_STATUS_RU = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  in_progress: 'В работе',
  partially_shipped: 'Частично продана',
  shipped: 'Продана',
  closed: 'Закрыта',
  canceled: 'Отменена',
  draft: 'Черновик',
  completed: 'Завершено',
  active: 'Активен',
  inactive: 'Неактивен',
  paid: 'Оплачено',
  unpaid: 'Не оплачено',
  partially_paid: 'Частично оплачено',
  overpaid: 'Переплата',
  refunded: 'Возврат денег',
};

const textOrDash = (v) => (v == null || v === '' ? '—' : String(v));
const asLower = (v) => String(v || '').trim().toLowerCase();

const translatePaymentStatus = (v) => {
  const key = asLower(v);
  return PAYMENT_STATUS_RU[key] || '—';
};

const translateCreditLimitMode = (v) => {
  const key = asLower(v);
  return CREDIT_LIMIT_MODE_RU[key] || '—';
};

const translatePaymentMethod = (v) => {
  const key = asLower(v);
  return PAYMENT_METHOD_RU[key] || textOrDash(v);
};

const translateDocStatus = (v) => {
  const key = asLower(v);
  return DOC_STATUS_RU[key] || textOrDash(v);
};

const moneyValue = (v) => (v == null || v === '' ? '—' : `${formatQuantityDisplay(v)} сом`);

const normalizeObjectData = (data) => {
  if (data?.items && typeof data.items === 'object' && !Array.isArray(data.items)) return data.items;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
};

const FINANCE_SUMMARY_KEYS = [
  'payment_status',
  'total_revenue',
  'total_cost',
  'total_profit',
  'defect_revenue',
  'total_paid_gross',
  'total_paid',
  'total_paid_net',
  'total_refunded',
  'client_debt_money',
  'client_advance_amount',
  'credit_limit',
  'credit_available',
  'credit_limit_mode',
  'credit_is_over_limit',
  'is_over_limit',
  'credit_warning',
];

const extractFinance = (payload) => {
  const out = {};
  const src = normalizeObjectData(payload);
  for (const k of FINANCE_SUMMARY_KEYS) {
    if (k in src) out[k] = src[k];
  }
  return out;
};

const getErrorCode = (err) => asLower(err?.response?.data?.code);

const getClientErrorText = (err, fallback) => {
  const code = getErrorCode(err);
  if (code === 'delete_disabled') return 'Удаление клиентов отключено. Используйте деактивацию.';
  if (code === 'missing_param') return 'Не указан клиент.';
  if (code === 'not_found') return 'Клиент не найден.';
  if (err?.response?.status === 404) return 'Клиент не найден.';
  return getApiErrorMessage(err, fallback);
};

const statusBadge = (statusValue) => {
  const status = asLower(statusValue);
  if (['active', 'paid', 'completed', 'confirmed'].includes(status)) return 'success';
  if (['inactive', 'unpaid', 'canceled'].includes(status)) return 'default';
  if (['partially_paid', 'in_progress', 'partially_shipped', 'overpaid'].includes(status)) return 'warning';
  return 'default';
};

const clientIsActive = (c) => {
  if (c == null) return true;
  const st = asLower(c.status);
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
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [financialTarget, setFinancialTarget] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState('');
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

  const syncClientInUi = useCallback((updated) => {
    if (!updated?.id) return;
    if (detailClient?.id === updated.id) setDetailClient(updated);
    if (modalClient?.id === updated.id) setModalClient(updated);
    if (historyTarget?.id === updated.id) setHistoryTarget(updated);
    if (financialTarget?.id === updated.id) setFinancialTarget(updated);
  }, [detailClient?.id, financialTarget?.id, historyTarget?.id, modalClient?.id]);

  const handleSubmit = async (payload) => {
    setSubmitError('');
    try {
      let res;
      if (modalClient?.id) {
        res = await updateClient(modalClient.id, payload);
      } else {
        res = await createClient(payload);
      }
      syncClientInUi(res?.data || null);
      setModalClient(null);
      refetch();
      toast.show('Сохранено');
    } catch (err) {
      setSubmitError(getClientErrorText(err, 'Ошибка сохранения клиента'));
    }
  };

  const handleToggleClientActive = async (client, nextActive) => {
    try {
      const res = await updateClient(client.id, { is_active: nextActive });
      syncClientInUi(res?.data || null);
      refetch();
      toast.show(nextActive ? 'Клиент активирован' : 'Клиент деактивирован');
    } catch (err) {
      toast.show(getClientErrorText(err, 'Не удалось изменить статус клиента'));
    }
  };

  const handleOpenHistory = async (client) => {
    setHistoryTarget(client);
    setHistoryData(null);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const historyRes = await getClientHistory(client.id);
      setHistoryData(normalizeObjectData(historyRes.data));
    } catch (err) {
      setHistoryError(getClientErrorText(err, 'Не удалось загрузить историю клиента'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenFinancialSummary = async (client) => {
    setFinancialTarget(client);
    setFinancialLoading(true);
    setFinancialError('');
    setFinancialData(null);
    try {
      const res = await getClientFinancialSummary(client.id);
      setFinancialData(normalizeObjectData(res.data));
    } catch (err) {
      setFinancialError(getClientErrorText(err, 'Не удалось загрузить финансовую сводку'));
    } finally {
      setFinancialLoading(false);
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
            <SearchableSelect
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
          <button type="button" className="btn btn--primary" onClick={() => setModalClient({ is_active: true })}>
            Создать клиента
          </button>
        </div>
      </div>

      <div className="ds-sticky-mobile-actions">
        <button type="button" className="btn btn--primary" onClick={() => setModalClient({ is_active: true })}>
          Создать клиента
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
                <th className="data-table__cell--num">Кредитный лимит</th>
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
                  <td className="data-table__cell--num">{moneyValue(c.credit_limit)}</td>
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
                        { label: 'Финсводка', onClick: () => handleOpenFinancialSummary(c) },
                        {
                          label: clientIsActive(c) ? 'Деактивировать' : 'Активировать',
                          onClick: () => handleToggleClientActive(c, !clientIsActive(c)),
                        },
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
          onOpenFinancialSummary={(client) => {
            setDetailClient(null);
            handleOpenFinancialSummary(client);
          }}
          onToggleActive={handleToggleClientActive}
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
          error={historyError}
          data={historyData}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {financialTarget && (
        <FinancialSummaryModal
          client={financialTarget}
          loading={financialLoading}
          error={financialError}
          data={financialData}
          onClose={() => setFinancialTarget(null)}
        />
      )}
    </div>
  );
};

const ClientDetailModal = ({ client, onClose, onEdit, onOpenHistory, onOpenFinancialSummary, onToggleActive }) => {
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
    const row = client;
    setFull(row);
    setDetailLoading(true);
    setDetailError('');
    getClient(row.id)
      .then((res) => {
        setFull(res.data);
      })
      .catch((err) => {
        setDetailError(getClientErrorText(err, 'Не удалось загрузить клиента'));
        setFull(row);
      })
      .finally(() => setDetailLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- по id строки
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
                {row('Статус', clientStatusLabel(c))}
                {row('Тип клиента', textOrDash(c?.client_type || c?.type))}
                {row('Заметки', textOrDash(c?.notes))}
              </section>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Контакты</h4>
                {row('Контакт', textOrDash(c?.contact || c?.contact_person || c?.contact_name))}
                {row('Телефон', textOrDash(c?.phone || c?.phone_number))}
                {row('Доп. телефон', textOrDash(c?.phone_alt || c?.second_phone))}
                {row('Email', textOrDash(c?.email))}
                {row('Мессенджер', textOrDash(c?.messenger || c?.whatsapp_telegram))}
              </section>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Реквизиты</h4>
                {row('ИНН', textOrDash(c?.inn))}
                {row('Адрес', textOrDash(c?.address))}
              </section>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Кредит</h4>
                {row('Кредитный лимит', c?.credit_limit != null && c?.credit_limit !== '' ? moneyValue(c.credit_limit) : '—')}
                {row('Режим лимита', translateCreditLimitMode(c?.credit_limit_mode))}
              </section>
              <section className="clients-detail__section">
                <h4 className="clients-detail__section-title">Продажи</h4>
                {row('Продаж', textOrDash(c?.sales_count ?? c?.orders_count))}
                {row(
                  'Сумма продаж',
                  c?.sales_total != null && c?.sales_total !== '' ? moneyValue(c.sales_total) : '—',
                )}
              </section>
            </>
          )}
        </div>
        <div className="modal__actions clients-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={() => onOpenHistory(c)}>
            История
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => onOpenFinancialSummary(c)}>
            Финсводка
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => onToggleActive(c, !clientIsActive(c))}
          >
            {clientIsActive(c) ? 'Деактивировать' : 'Активировать'}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onEdit(c)}>
            Редактировать
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
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
  const [creditLimitMode, setCreditLimitMode] = useState(client?.credit_limit_mode ? asLower(client.credit_limit_mode) : 'soft');
  const [isActive, setIsActive] = useState(client?.id ? clientIsActive(client) : true);

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
    setCreditLimitMode(client?.credit_limit_mode ? asLower(client.credit_limit_mode) : 'soft');
    setIsActive(client?.id ? clientIsActive(client) : true);
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
              credit_limit: creditNum !== undefined && !Number.isNaN(creditNum) ? creditNum : null,
              credit_limit_mode: creditLimitMode || 'soft',
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
              <label>Мессенджер</label>
              <input value={messenger} onChange={(e) => setMessenger(e.target.value)} placeholder="Telegram @alpha" />
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
              <SearchableSelect value={creditLimitMode} onChange={setCreditLimitMode} options={creditModeOptions} placeholder="Выберите" />
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

const HistoryModal = ({ client, loading, error, data, onClose }) => {
  const d = data && typeof data === 'object' ? data : {};
  const f = extractFinance(d);
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
    ['Сумма заявок', 'total_ordered' in d ? moneyValue(d.total_ordered) : '—'],
    ['Оплачено', 'total_paid' in f ? moneyValue(f.total_paid) : '—'],
    ['Оплачено всего', 'total_paid_gross' in f ? moneyValue(f.total_paid_gross) : '—'],
    ['Долг', 'client_debt_money' in f ? moneyValue(f.client_debt_money) : '—'],
    ['Аванс', 'client_advance_amount' in f ? moneyValue(f.client_advance_amount) : '—'],
    ['Возвраты денег', 'total_refunded' in f ? moneyValue(f.total_refunded) : '—'],
    ['Прибыль', 'total_profit' in f ? moneyValue(f.total_profit) : '—'],
    ['Продажа брака', 'defect_revenue' in f ? moneyValue(f.defect_revenue) : '—'],
  ];

  const creditRows = [
    ['Кредитный лимит', 'credit_limit' in f ? moneyValue(f.credit_limit) : '—'],
    ['Доступный кредит', 'credit_available' in f ? moneyValue(f.credit_available) : '—'],
    ['Режим лимита', 'credit_limit_mode' in f ? translateCreditLimitMode(f.credit_limit_mode) : '—'],
    [
      'Превышение лимита',
      (f.credit_is_over_limit ?? f.is_over_limit) != null ? (f.credit_is_over_limit ?? f.is_over_limit ? 'Да' : 'Нет') : '—',
    ],
    ['Предупреждение', textOrDash(f.credit_warning)],
  ];

  const orders = Array.isArray(d.orders) ? d.orders : [];
  const sales = Array.isArray(d.sales) ? d.sales : [];
  const payments = Array.isArray(d.payments) ? d.payments : [];
  const returns = Array.isArray(d.returns) ? d.returns : [];

  const hasDocs = orders.length || sales.length || payments.length || returns.length;

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
          {!loading && error && <ErrorState error={{ userMessage: error }} onRetry={() => {}} />}
          {!loading && !error && !hasDocs && <EmptyState title="Нет данных истории" />}
          {!loading && !error && (
            <>
              <HistoryTable
                title="Заявки"
                emptyTitle="Нет заявок"
                columns={['Номер', 'Дата', 'Статус', 'Сумма']}
                rows={orders.map((o) => [textOrDash(o.order_number), formatDate(o.date || o.created_at), translateDocStatus(o.status), moneyValue(o.total_amount)])}
              />
              <HistoryTable
                title="Продажи"
                emptyTitle="Нет продаж"
                columns={['Номер', 'Дата', 'Статус', 'Сумма', 'Оплачено', 'Долг']}
                rows={sales.map((s) => [
                  textOrDash(s.sale_number || s.order_number),
                  formatDate(s.date || s.created_at),
                  translateDocStatus(s.sale_status || s.status),
                  moneyValue(s.revenue || s.total_amount),
                  moneyValue(s.paid_amount),
                  moneyValue(s.debt_amount),
                ])}
              />
              <HistoryTable
                title="Оплаты"
                emptyTitle="Нет оплат"
                columns={['Номер', 'Дата', 'Тип', 'Способ', 'Сумма', 'Статус']}
                rows={payments.map((p) => [
                  textOrDash(p.payment_number),
                  formatDate(p.date || p.created_at),
                  textOrDash(p.payment_type),
                  translatePaymentMethod(p.payment_method),
                  moneyValue(p.amount),
                  translateDocStatus(p.status),
                ])}
              />
              <HistoryTable
                title="Возвраты"
                emptyTitle="Нет возвратов"
                columns={['Номер', 'Дата', 'Статус', 'Причина']}
                rows={returns.map((r) => [
                  textOrDash(r.return_number),
                  formatDate(r.date || r.created_at),
                  translateDocStatus(r.status),
                  textOrDash(r.return_reason),
                ])}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const HistoryTable = ({ title, emptyTitle, columns, rows }) => (
  <section className="clients-history__block clients-history__block--table">
    <h4 className="clients-history__block-title">{title}</h4>
    {!rows.length ? (
      <EmptyState title={emptyTitle} />
    ) : (
      <div className="commercial-table-wrap">
        <table className="data-table data-table--clients-history">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${title}-${idx}`}>
                {row.map((cell, ci) => (
                  <td key={`${title}-${idx}-${ci}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

const FinancialSummaryModal = ({ client, loading, error, data, onClose }) => {
  const d = data && typeof data === 'object' ? data : {};
  const rows = [
    ['Статус оплаты', translatePaymentStatus(d.payment_status)],
    ['Выручка', moneyValue(d.total_revenue)],
    ['Себестоимость', moneyValue(d.total_cost)],
    ['Прибыль', moneyValue(d.total_profit)],
    ['Продажа брака', moneyValue(d.defect_revenue)],
    ['Оплачено всего', moneyValue(d.total_paid_gross)],
    ['Возвращено', moneyValue(d.total_refunded)],
    ['Оплачено netto', moneyValue(d.total_paid_net)],
    ['Долг', moneyValue(d.client_debt_money)],
    ['Аванс', moneyValue(d.client_advance_amount)],
    ['Кредитный лимит', moneyValue(d.credit_limit)],
    ['Режим лимита', translateCreditLimitMode(d.credit_limit_mode)],
    ['Доступный кредит', moneyValue(d.credit_available)],
    ['Лимит превышен', d.is_over_limit == null ? '—' : d.is_over_limit ? 'Да' : 'Нет'],
    ['Предупреждение', textOrDash(d.credit_warning)],
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal clients-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Финсводка: {client?.name || '—'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="clients-modal__body">
          {loading && <Loading />}
          {!loading && error && <ErrorState error={{ userMessage: error }} onRetry={() => {}} />}
          {!loading && !error && (
            <section className="clients-history__block">
              <dl className="clients-history__dl">
                {rows.map(([label, value]) => (
                  <div key={label} className="clients-history__dl-row">
                    <dt>{label}</dt>
                    <dd>
                      {label === 'Статус оплаты' ? (
                        <Badge variant={statusBadge(d.payment_status)}>{value}</Badge>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientsPage;
