import React, { useState, useEffect, useMemo } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import { useServerQuery, getApiErrorMessage, formatQuantityDisplay } from '../../../../shared/lib';
import {
  ConfirmModal,
  Collapse,
  EmptyState,
  ErrorState,
  Loading,
  Pagination,
  ActionMenu,
  useToast,
  Badge,
} from '../../../../shared/ui';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './ClientsPage.scss';

const clientCanDelete = (c) => {
  const n = Number(c?.sales_count ?? c?.sales_total_count ?? 0);
  if (Number.isFinite(n) && n > 0) return false;
  if (c?.has_sales === true) return false;
  return true;
};

const ClientsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '' });
  const [modalClient, setModalClient] = useState(null);
  const [detailClient, setDetailClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyFinance, setHistoryFinance] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { items, meta, raw, loading, error, refetch } = useServerQuery('clients/', queryState, { enabled: true });
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
        await apiClient.patch(`clients/${modalClient.id}/`, payload);
      } else {
        await apiClient.post('clients/', payload);
      }
      setModalClient(null);
      refetch();
      toast.show('Сохранено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await apiClient.delete(`clients/${deleteTarget.id}/`);
      setDeleteTarget(null);
      refetch();
      toast.show('Удалено');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, 'Ошибка удаления'));
    }
  };

  const handleOpenHistory = async (client) => {
    setHistoryTarget(client);
    setHistoryItems([]);
    setHistoryFinance(null);
    setHistoryLoading(true);
    try {
      const [historyRes, summaryRes] = await Promise.allSettled([
        apiClient.get(`clients/${client.id}/history/`),
        apiClient.get('payments/summary/', { params: { client_id: client.id } }),
      ]);
      const historyData = historyRes.status === 'fulfilled' ? (historyRes.value.data || {}) : {};
      const summaryData = summaryRes.status === 'fulfilled' ? (summaryRes.value.data || {}) : {};
      let rows = historyData?.items || [];
      if (!rows.length) {
        const s = await apiClient.get('sales/', { params: { page_size: 200, client_id: client.id } });
        const sales = s.data?.items || [];
        rows = sales.map((x) => ({
          id: x.id,
          date: x.created_at || x.date,
          type: 'Продажа',
          description: `${x.product_name || x.product?.name || 'Товар'} · ${formatQuantityDisplay(x.quantity)} шт · ${x.price != null ? `${formatQuantityDisplay(x.price)} сом` : '—'}`,
        }));
      }
      setHistoryItems(rows);
      setHistoryFinance({ ...historyData, ...summaryData });
    } catch {
      setHistoryItems([]);
      setHistoryFinance(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="page page--clients commercial-page">
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
              <th className="data-table__cell--num">Сумма</th>
              <th>Статус</th>
              <th aria-hidden />
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
                <td className="data-table__cell--muted">{c.contact_person || c.contact_name || '—'}</td>
                <td className="data-table__cell--num">{c.sales_count ?? c.orders_count ?? '—'}</td>
                <td className="data-table__cell--num">
                  {c.sales_total != null && c.sales_total !== ''
                    ? `${formatQuantityDisplay(c.sales_total)} сом`
                    : '—'}
                </td>
                <td>
                  {c.is_active === false || c.active === false ? (
                    <Badge variant="default">Неактивен</Badge>
                  ) : (
                    <Badge variant="success">Активен</Badge>
                  )}
                </td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'Открыть', onClick: () => setDetailClient(c) },
                      { label: 'Редактировать', onClick: () => setModalClient(c) },
                      { label: 'История', onClick: () => handleOpenHistory(c) },
                      ...(clientCanDelete(c)
                        ? [{ label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ id: c.id, name: c.name || c.title || 'Клиент' }) }]
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
        <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
      )}
      {submitError && !deleteTarget && <p className="modal__error">{submitError}</p>}

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
          onClose={() => { setModalClient(null); setSubmitError(''); }}
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

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить клиента?"
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setSubmitError(''); }}
        error={deleteTarget ? submitError : undefined}
      />
    </div>
  );
};

const clientIsActive = (c) => {
  if (c == null) return true;
  if (c.is_active === false) return false;
  if (c.active === false) return false;
  return true;
};

const ClientDetailModal = ({ client, onClose, onEdit, onOpenHistory }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal__head">
        <h3>Карточка клиента</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div style={{ padding: '1.5rem' }}>
        <section className="card" style={{ padding: 12, marginBottom: 12 }}>
          <h4>Основные данные</h4>
          <p><strong>Название:</strong> {client?.name || client?.title || '—'}</p>
          <p><strong>Телефон:</strong> {client?.phone || client?.phone_number || '—'}</p>
          <p><strong>Контакт:</strong> {client?.contact_person || client?.contact_name || '—'}</p>
          <p><strong>Статус:</strong> {clientIsActive(client) ? 'Активен' : 'Неактивен'}</p>
          {(client?.comment || client?.notes) && (
            <p><strong>Комментарий:</strong> {client.comment || client.notes}</p>
          )}
        </section>
        <section className="card" style={{ padding: 12, marginBottom: 12 }}>
          <h4>Связанные данные</h4>
          <p><strong>Продаж:</strong> {client?.sales_count ?? client?.orders_count ?? '—'}</p>
          <p><strong>Сумма продаж:</strong> {client?.sales_total != null && client?.sales_total !== '' ? `${formatQuantityDisplay(client.sales_total)} сом` : '—'}</p>
        </section>
      </div>
      <div className="modal__actions">
        <button type="button" className="btn btn--secondary" onClick={() => onOpenHistory(client)}>История</button>
        <button type="button" className="btn btn--primary" onClick={() => onEdit(client)}>Редактировать</button>
      </div>
    </div>
  </div>
);

const ClientModal = ({ client, onClose, onSubmit, error }) => {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || client?.phone_number || '');
  const [contactPerson, setContactPerson] = useState(client?.contact_person || client?.contact_name || '');
  const [messenger, setMessenger] = useState(client?.messenger || client?.whatsapp_telegram || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phoneAlt, setPhoneAlt] = useState(client?.phone_alt || client?.second_phone || '');
  const [address, setAddress] = useState(client?.address || '');
  const [clientType, setClientType] = useState(client?.client_type || client?.type || '');
  const [comment, setComment] = useState(client?.comment || client?.notes || '');
  const [isActive, setIsActive] = useState(clientIsActive(client));

  useEffect(() => {
    setName(client?.name || '');
    setPhone(client?.phone || client?.phone_number || '');
    setContactPerson(client?.contact_person || client?.contact_name || '');
    setMessenger(client?.messenger || client?.whatsapp_telegram || '');
    setEmail(client?.email || '');
    setPhoneAlt(client?.phone_alt || client?.second_phone || '');
    setAddress(client?.address || '');
    setClientType(client?.client_type || client?.type || '');
    setComment(client?.comment || client?.notes || '');
    setIsActive(clientIsActive(client));
  }, [client?.id, client]);

  const isDirty = useDirtyFromBaseline(client?.id ?? 'new', false, {
    name: name.trim(),
    phone: phone.trim(),
    contactPerson: contactPerson.trim(),
    messenger: messenger.trim(),
    email: email.trim(),
    phoneAlt: phoneAlt.trim(),
    address: address.trim(),
    clientType: clientType.trim(),
    comment: comment.trim(),
    isActive,
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{client ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const messengerValue = messenger.trim() || undefined;
            const payload = {
              name: name.trim(),
              phone: phone.trim() || undefined,
              contact_person: contactPerson.trim() || undefined,
              email: email.trim() || undefined,
              phone_alt: phoneAlt.trim() || undefined,
              address: address.trim() || undefined,
              client_type: clientType.trim() || undefined,
              notes: comment.trim() || undefined,
              is_active: isActive,
            };
            if ('whatsapp_telegram' in (client || {}) && !('messenger' in (client || {}))) {
              payload.whatsapp_telegram = messengerValue;
            } else {
              payload.messenger = messengerValue;
            }
            onSubmit(payload);
          }}
        >
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
          <label className="clients-form__check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Клиент активен (неактивного нельзя выбрать в новых продажах)
          </label>
          <Collapse title="Ещё">
            <label>Доп. телефон</label>
            <input value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} placeholder="Необязательно" />
            <label>Адрес</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Доставка" />
            <label>Тип</label>
            <input value={clientType} onChange={(e) => setClientType(e.target.value)} placeholder="Розница, опт…" />
            <label>Комментарий</label>
            <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Внутренние заметки" />
          </Collapse>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const moneyValue = (v) => (v == null || v === '' ? '—' : `${formatQuantityDisplay(v)} сом`);

const HistoryModal = ({ client, loading, items, finance, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal__head">
        <h3>История: {client?.name}</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div style={{ padding: '1.5rem' }}>
        {!loading && finance && (
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <strong>Финансовая сводка</strong>
            <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: '0.9375rem' }}>
              {'total_revenue' in finance && <div>Выручка: {moneyValue(finance.total_revenue)}</div>}
              {'total_paid' in finance && <div>Оплачено: {moneyValue(finance.total_paid)}</div>}
              {'total_refunded' in finance && <div>Возвратов денег: {moneyValue(finance.total_refunded)}</div>}
              {'client_debt_money' in finance && <div>Долг: {moneyValue(finance.client_debt_money)}</div>}
              {'client_advance_amount' in finance && <div>Аванс: {moneyValue(finance.client_advance_amount)}</div>}
              {'credit_limit' in finance && <div>Кредитный лимит: {moneyValue(finance.credit_limit)}</div>}
              {'credit_available' in finance && <div>Доступный кредит: {moneyValue(finance.credit_available)}</div>}
              {'credit_limit_mode' in finance && <div>Режим лимита: {finance.credit_limit_mode || '—'}</div>}
              {'credit_is_over_limit' in finance && <div>Превышение лимита: {finance.credit_is_over_limit ? 'Да' : 'Нет'}</div>}
              {'credit_warning' in finance && finance.credit_warning && <div>Предупреждение: {finance.credit_warning}</div>}
            </div>
          </div>
        )}
        {loading && <Loading />}
        {!loading && items.length === 0 && <EmptyState title="Нет данных" />}
        {!loading && items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Событие</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h, idx) => (
                <tr key={h.id || idx}>
                  <td className="clients-history__date">{h.date || h.created_at || '—'}</td>
                  <td>
                    <div className="clients-history__type">{h.type || h.event || '—'}</div>
                    {(h.description || h.comment) && (
                      <div className="clients-history__desc">{h.description || h.comment}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </div>
);

export default ClientsPage;
