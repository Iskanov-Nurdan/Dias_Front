import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus } from 'lucide-react';
import { fetchClients, createClient, updateClient, setClientActive } from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Pagination, ConfirmModal, Fab } from '../../shared/ui';
import { ClientsList, ClientFormModal, ClientProfileModal } from './components';
import './ClientsPage.scss';

const ClientsPage = () => {
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);
  const [queryState, setQueryState] = useState({ search: '', page: 1, perPage: 20 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formClient, setFormClient] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [profileClient, setProfileClient] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchClients(queryState, null)
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [queryState]);

  useEffect(() => {
    setQueryState((q) => ({ ...q, search: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const items = data?.items ?? [];

  const handleSave = async (payload) => {
    setFormError(null);
    setSaving(true);
    try {
      if (formClient?.id) {
        await updateClient(formClient.id, payload, null);
        toast.success('Клиент обновлён');
      } else {
        await createClient(payload, null);
        toast.success('Клиент добавлен');
      }
      setFormClient(null);
      load();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = () => {
    if (!confirmToggle) return;
    const nextActive = confirmToggle.is_active === false;
    setClientActive(confirmToggle.id, nextActive, null)
      .then(() => {
        setConfirmToggle(null);
        load();
        toast.success(nextActive ? 'Клиент активирован' : 'Клиент деактивирован');
      })
      .catch((err) => toast.error(getApiErrorMessage(err)));
  };

  return (
    <div className="clients-page">
      <div className="clients-page__toolbar">
        <div className="ui-search clients-page__search">
          <Search size={16} className="ui-search__icon" />
          <input
            type="text"
            placeholder="Поиск по имени или телефону"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="ui-search__input"
          />
        </div>
        <button type="button" className="clients-page__add clients-page__add--desktop-only" onClick={() => setFormClient({})}>
          <Plus size={16} /> Добавить
        </button>
      </div>

      <ClientsList
        items={items}
        loading={loading}
        error={error}
        onRetry={load}
        onEdit={setFormClient}
        onToggleActive={setConfirmToggle}
        onProfile={setProfileClient}
        emptyMessage={debouncedSearch ? 'Ничего не найдено' : 'Клиентов пока нет'}
      />
      <Pagination
        meta={data?.meta}
        currentPage={queryState.page}
        onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
        loading={loading}
        entityLabel="клиентов"
      />

      {formClient && (
        <ClientFormModal
          client={formClient}
          onSave={handleSave}
          onClose={() => { setFormClient(null); setFormError(null); }}
          error={formError}
          saving={saving}
        />
      )}

      {profileClient && (
        <ClientProfileModal client={profileClient} onClose={() => setProfileClient(null)} />
      )}

      {confirmToggle && (
        <ConfirmModal
          title={confirmToggle.is_active === false ? 'Активировать клиента?' : 'Деактивировать клиента?'}
          message={confirmToggle.is_active === false
            ? `«${confirmToggle.name}» снова появится в активных списках.`
            : `«${confirmToggle.name}» перестанет быть доступен для новых продаж. Удаление недоступно — только деактивация.`}
          confirmText={confirmToggle.is_active === false ? 'Активировать' : 'Деактивировать'}
          onConfirm={handleToggleActive}
          onCancel={() => setConfirmToggle(null)}
        />
      )}

      <Fab onClick={() => setFormClient({})} label="Добавить клиента" />
    </div>
  );
};

export default ClientsPage;
