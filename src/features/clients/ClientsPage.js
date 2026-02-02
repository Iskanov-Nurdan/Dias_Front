import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchClients, fetchClient, createClient, updateClient, deleteClient, extendClient } from './api';
import { fetchSports } from '../sports-trainers/api';
import { fetchTrainers } from '../sports-trainers/api';
import { Select, ConfirmModal } from '../../shared/ui';
import { ClientsList, ClientCardModal, ClientFormModal, ExtendModal } from './components';
import './ClientsPage.scss';

const ClientsPage = () => {
  const [queryState, setQueryState] = useState({ search: '', sportId: '', paid: '', clientType: '', page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formClient, setFormClient] = useState(null);
  const [cardClient, setCardClient] = useState(null);
  const [extendClientObj, setExtendClientObj] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchClients(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setData(res);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastRequestId.current) setLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    fetchSafe();
    return () => controllerRef.current?.abort();
  }, [fetchSafe]);

  useEffect(() => {
    fetchSports(null).then((d) => setSports(Array.isArray(d) ? d : d?.results ?? d?.items ?? [])).catch(() => {});
  }, []);

  const items = data?.items ?? data?.results ?? data ?? [];

  const handleSaveClient = async (payload) => {
    try {
      if (formClient?.id) await updateClient(formClient.id, payload, null);
      else await createClient(payload, null);
      setFormClient(null);
      fetchSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteClient = () => {
    if (!confirmDelete) return;
    deleteClient(confirmDelete.id, null).then(() => { setConfirmDelete(null); fetchSafe(); }).catch(console.error);
  };

  const handleOpenCard = (c) =>
    fetchClient(c.id, null)
      .then((res) => setCardClient(res?.data ?? res))
      .catch(console.error);

  const handleSaveExtend = (payload) => {
    if (!extendClientObj) return;
    extendClient(extendClientObj.id, payload, null).then(() => { setExtendClientObj(null); fetchSafe(); }).catch(console.error);
  };

  return (
    <div className="clients-page">
      <h1 className="clients-page__title">Клиенты</h1>
      <div className="clients-page__toolbar">
        <div className="clients-page__filters">
          <input type="text" placeholder="Поиск (ФИО, телефон)" value={queryState.search} onChange={(e) => setQueryState((q) => ({ ...q, search: e.target.value, page: 1 }))} className="clients-page__search" />
          <Select
            value={queryState.sportId}
            onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))}
            options={[{ value: '', label: 'Все виды спорта' }, ...sports.map((s) => ({ value: String(s.id), label: s.name || '' }))]}
            placeholder="Все виды спорта"
            className="clients-page__select-wrap"
          />
          <Select
            value={queryState.paid}
            onChange={(v) => setQueryState((q) => ({ ...q, paid: v, page: 1 }))}
            options={[{ value: '', label: 'Оплата — все' }, { value: 'true', label: 'Оплачено' }, { value: 'false', label: 'Не оплачено' }]}
            placeholder="Оплата — все"
            className="clients-page__select-wrap"
          />
          <Select
            value={queryState.clientType}
            onChange={(v) => setQueryState((q) => ({ ...q, clientType: v, page: 1 }))}
            options={[{ value: '', label: 'Тип — все' }, { value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }]}
            placeholder="Тип — все"
            className="clients-page__select-wrap"
          />
        </div>
        <button type="button" className="clients-page__add" onClick={() => setFormClient({})}>
          Добавить клиента
        </button>
      </div>
      <ClientsList items={items} loading={loading} error={error} onRetry={fetchSafe} onEdit={setFormClient} onDelete={setConfirmDelete} onDetails={handleOpenCard} onExtend={setExtendClientObj} />
      {formClient && <ClientFormModal client={formClient} sports={sports} fetchTrainers={fetchTrainers} onSave={handleSaveClient} onClose={() => setFormClient(null)} />}
      {cardClient && <ClientCardModal client={cardClient} onEdit={setFormClient} onDelete={setConfirmDelete} onClose={() => setCardClient(null)} />}
      {extendClientObj && <ExtendModal client={extendClientObj} onSave={handleSaveExtend} onClose={() => setExtendClientObj(null)} />}
      {confirmDelete && <ConfirmModal title="Удалить клиента?" message={confirmDelete.fio} confirmText="Удалить" onConfirm={handleDeleteClient} onCancel={() => setConfirmDelete(null)} danger />}
    </div>
  );
};

export default ClientsPage;
