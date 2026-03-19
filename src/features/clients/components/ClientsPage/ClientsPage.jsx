import React, { useState } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { ConfirmModal, EmptyState, ErrorState, Loading, useToast } from '../../../../shared/ui';
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
      setSubmitError(err.response?.data?.error || 'Ошибка');
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
      const data = err.response?.data;
      setSubmitError(data?.code ? `[${data.code}] ${data.error || 'Ошибка'}` : (data?.error || 'Ошибка'));
    }
  };

  const handleOpenHistory = async (client) => {
    setHistoryTarget(client);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const res = await apiClient.get(`clients/${client.id}/history/`);
      setHistoryItems(res.data?.items || res.data?.results || []);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="page page--clients">
      <div className="page__actions">
        <input
          type="text"
          placeholder="Поиск..."
          value={queryState.search}
          onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <button type="button" className="btn btn--primary" onClick={() => setModalClient({})}>
          + Создать
        </button>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет клиентов" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.name || c.title || `#${c.id}`}</td>
                <td>{c.phone || c.phone_number || '—'}</td>
                <td>
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => setModalClient(c)}>
                    Ред.
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => handleOpenHistory(c)}>
                    История
                  </button>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => setDeleteTarget({ id: c.id, name: c.name || `#${c.id}` })}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {submitError && <p className="modal__error">{submitError}</p>}

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
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const ClientModal = ({ client, onClose, onSubmit, error }) => {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || client?.phone_number || '');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{client ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: name.trim(),
              phone: phone.trim() || undefined,
            });
          }}
        >
          <label>Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Введите имя" />
          <label>Телефон</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 (___) ___-__-__" />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
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
                <th>Тип</th>
                <th>Описание</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h, idx) => (
                <tr key={h.id || idx}>
                  <td>{h.date || h.created_at || '—'}</td>
                  <td>{h.type || h.event || '—'}</td>
                  <td>{h.description || h.comment || '—'}</td>
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
