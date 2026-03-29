import React, { useState, useEffect } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import { useServerQuery, getApiErrorMessage, formatQuantityDisplay } from '../../../../shared/lib';
import {
  ConfirmModal,
  Collapse,
  EmptyState,
  ErrorState,
  Loading,
  ActionMenu,
  useToast,
} from '../../../../shared/ui';
import { apiClient } from '../../../../shared/api';
import './ClientsPage.scss';

const ClientsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '' });
  const [modalClient, setModalClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const { items, loading, error, refetch } = useServerQuery('clients/', queryState, { enabled: true });

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
    setHistoryLoading(true);
    try {
      const res = await apiClient.get(`clients/${client.id}/history/`);
      let rows = res.data?.items || [];
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
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="page page--clients">
      <header className="ds-page-top">
        <p className="ds-page-top__desc">Контакты для документов и отгрузок.</p>
      </header>
      <div className="ds-toolbar ds-toolbar--stack-mobile">
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
        <table className="data-table data-table--fixed data-table--row-actions data-table--clickable data-table--clients">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Телефон</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => setModalClient(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setModalClient(c);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <td className="data-table__cell--lead">{c.name || c.title || `#${c.id}`}</td>
                <td className="data-table__cell--muted">{c.phone || c.phone_number || '—'}</td>
                <td>
                  <ActionMenu
                    ariaLabel="Действия"
                    items={[
                      { label: 'История', onClick: () => handleOpenHistory(c) },
                      { label: 'Удалить', danger: true, onClick: () => setDeleteTarget({ id: c.id, name: c.name || `#${c.id}` }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {submitError && !deleteTarget && <p className="modal__error">{submitError}</p>}

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

const ClientModal = ({ client, onClose, onSubmit, error }) => {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || client?.phone_number || '');
  const [phoneAlt, setPhoneAlt] = useState(client?.phone_alt || client?.second_phone || '');
  const [address, setAddress] = useState(client?.address || '');
  const [clientType, setClientType] = useState(client?.client_type || client?.type || '');
  const [comment, setComment] = useState(client?.comment || client?.notes || '');

  useEffect(() => {
    setName(client?.name || '');
    setPhone(client?.phone || client?.phone_number || '');
    setPhoneAlt(client?.phone_alt || client?.second_phone || '');
    setAddress(client?.address || '');
    setClientType(client?.client_type || client?.type || '');
    setComment(client?.comment || client?.notes || '');
  }, [client?.id, client]);

  const isDirty = useDirtyFromBaseline(client?.id ?? 'new', false, {
    name: name.trim(),
    phone: phone.trim(),
    phoneAlt: phoneAlt.trim(),
    address: address.trim(),
    clientType: clientType.trim(),
    comment: comment.trim(),
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
            onSubmit({
              name: name.trim(),
              phone: phone.trim() || undefined,
              phone_alt: phoneAlt.trim() || undefined,
              address: address.trim() || undefined,
              client_type: clientType.trim() || undefined,
              notes: comment.trim() || undefined,
            });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ФИО или организация" />
          <label>Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+996 …" />
          <Collapse title="Подробнее">
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

const HistoryModal = ({ client, loading, items, onClose }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
      <div className="modal__head">
        <h3>История: {client?.name}</h3>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      <div style={{ padding: '1.5rem' }}>
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
