import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layers, Search, Grid3x3, Plus } from 'lucide-react';
import {
  fetchBlanks, createBlank, updateBlank, deleteBlank,
  fetchProfiles, createProfile, updateProfile, deleteProfile,
} from './api';
import { useToast } from '../../app/providers/ToastProvider';
import { useDebounce } from '../../shared/hooks/useDebounce';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { PrimaryTabs, Fab } from '../../shared/ui';
import {
  BlanksList, ProfilesList,
  BlankFormModal, BlankEditModal, BlankCompositionModal, ProfileFormModal, ProfileDetailModal,
} from './components';
import './WorkshopPage.scss';

const TAB_BLANKS = 'blanks';
const TAB_PROFILES = 'profiles';

const TABS = [
  { id: TAB_BLANKS, label: 'Заготовки', icon: Layers },
  { id: TAB_PROFILES, label: 'Профили', icon: Grid3x3 },
];

const normalize = (s) => (s || '').trim().toLowerCase();

const WorkshopPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(TAB_BLANKS);

  // ── Заготовки (справочник, растёт медленно — клиентский поиск) ──
  const [blanks, setBlanks] = useState([]);
  const [blanksLoading, setBlanksLoading] = useState(false);
  const [blanksError, setBlanksError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput);

  const loadBlanks = useCallback(() => {
    setBlanksLoading(true);
    setBlanksError(null);
    fetchBlanks(null)
      .then((data) => setBlanks(data?.items ?? []))
      .catch((err) => setBlanksError(getApiErrorMessage(err)))
      .finally(() => setBlanksLoading(false));
  }, []);

  useEffect(() => { loadBlanks(); }, [loadBlanks]);

  const blanksFiltered = useMemo(() => {
    const q = normalize(debouncedSearch);
    if (!q) return blanks;
    return blanks.filter((b) => normalize(b.name).includes(q));
  }, [blanks, debouncedSearch]);

  // ── Профили (отдельный access-key 'recipes' на бэкенде — не гейтим отдельно,
  // при нехватке прав пользователь увидит обычную 403-ошибку на вкладке) ──
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState(null);
  const [profileSearchInput, setProfileSearchInput] = useState('');
  const debouncedProfileSearch = useDebounce(profileSearchInput);

  const loadProfiles = useCallback(() => {
    setProfilesLoading(true);
    setProfilesError(null);
    fetchProfiles(null)
      .then((data) => setProfiles(data?.items ?? []))
      .catch((err) => setProfilesError(getApiErrorMessage(err)))
      .finally(() => setProfilesLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === TAB_PROFILES) loadProfiles();
  }, [activeTab, loadProfiles]);

  const profilesFiltered = useMemo(() => {
    const q = normalize(debouncedProfileSearch);
    if (!q) return profiles;
    return profiles.filter((p) => normalize(p.name).includes(q) || normalize(p.code).includes(q));
  }, [profiles, debouncedProfileSearch]);

  const [showProfileAddModal, setShowProfileAddModal] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [detailsProfile, setDetailsProfile] = useState(null);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState(null);
  const [profileFormError, setProfileFormError] = useState(null);
  const [profileFormSaving, setProfileFormSaving] = useState(false);

  const handleCreateProfile = async (payload) => {
    setProfileFormError(null);
    setProfileFormSaving(true);
    try {
      await createProfile(payload, null);
      setShowProfileAddModal(false);
      loadProfiles();
      toast.success('Профиль добавлен');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setProfileFormError(msg);
      toast.error(msg);
    } finally {
      setProfileFormSaving(false);
    }
  };

  const handleEditProfile = async (payload) => {
    setProfileFormError(null);
    setProfileFormSaving(true);
    try {
      await updateProfile(editProfile.id, payload, null);
      setEditProfile(null);
      loadProfiles();
      toast.success('Изменения сохранены');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setProfileFormError(msg);
      toast.error(msg);
    } finally {
      setProfileFormSaving(false);
    }
  };

  const handleDeleteProfile = () => {
    if (!confirmDeleteProfile) return;
    deleteProfile(confirmDeleteProfile.id, null)
      .then(() => {
        setConfirmDeleteProfile(null);
        loadProfiles();
        toast.success('Профиль удалён');
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        setConfirmDeleteProfile(null);
      });
  };

  // ── Модалки ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [compositionItem, setCompositionItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const handleCreate = async (payload) => {
    setFormError(null);
    setFormSaving(true);
    try {
      await createBlank(payload, null);
      setShowAddModal(false);
      loadBlanks();
      toast.success('Заготовка добавлена');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleEdit = async (payload) => {
    setFormError(null);
    setFormSaving(true);
    try {
      await updateBlank(editItem.id, payload, null);
      setEditItem(null);
      loadBlanks();
      toast.success('Изменения сохранены');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleSaveComposition = async (composition) => {
    setFormError(null);
    setFormSaving(true);
    try {
      await updateBlank(compositionItem.id, { composition }, null);
      setCompositionItem(null);
      loadBlanks();
      toast.success('Состав обновлён');
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteBlank(confirmDelete.id, null)
      .then(() => {
        setConfirmDelete(null);
        loadBlanks();
        toast.success('Заготовка удалена');
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        setConfirmDelete(null);
      });
  };

  return (
    <div className="workshop-page">
      <PrimaryTabs items={TABS} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === TAB_BLANKS && (
        <>
          <div className="workshop-page__toolbar">
            <div className="ui-search workshop-page__search">
              <Search size={16} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <button type="button" className="workshop-page__add workshop-page__add--desktop-only" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Заготовка
            </button>
          </div>

          <BlanksList
            items={blanksFiltered}
            loading={blanksLoading}
            error={blanksError}
            onRetry={loadBlanks}
            onEdit={setEditItem}
            onComposition={setCompositionItem}
            onDelete={setConfirmDelete}
            confirmDelete={confirmDelete}
            onConfirmDelete={handleDelete}
            onCancelDelete={() => setConfirmDelete(null)}
            emptyStateActionLabel="Добавить заготовку"
            emptyStateOnAction={() => setShowAddModal(true)}
          />
        </>
      )}

      {activeTab === TAB_PROFILES && (
        <>
          <div className="workshop-page__toolbar">
            <div className="ui-search workshop-page__search">
              <Search size={16} className="ui-search__icon" />
              <input
                type="text"
                placeholder="Поиск по названию или коду"
                value={profileSearchInput}
                onChange={(e) => setProfileSearchInput(e.target.value)}
                className="ui-search__input"
              />
            </div>
            <button type="button" className="workshop-page__add workshop-page__add--desktop-only" onClick={() => setShowProfileAddModal(true)}>
              <Plus size={16} /> Профиль
            </button>
          </div>

          <ProfilesList
            items={profilesFiltered}
            loading={profilesLoading}
            error={profilesError}
            onRetry={loadProfiles}
            onEdit={setEditProfile}
            onDetails={setDetailsProfile}
            onDelete={setConfirmDeleteProfile}
            confirmDelete={confirmDeleteProfile}
            onConfirmDelete={handleDeleteProfile}
            onCancelDelete={() => setConfirmDeleteProfile(null)}
            emptyStateActionLabel="Добавить профиль"
            emptyStateOnAction={() => setShowProfileAddModal(true)}
          />
        </>
      )}

      {showAddModal && (
        <BlankFormModal
          onSave={handleCreate}
          onClose={() => { setShowAddModal(false); setFormError(null); }}
          error={formError}
          saving={formSaving}
        />
      )}

      {editItem && (
        <BlankEditModal
          item={editItem}
          onSave={handleEdit}
          onClose={() => { setEditItem(null); setFormError(null); }}
          error={formError}
          saving={formSaving}
        />
      )}

      {compositionItem && (
        <BlankCompositionModal
          item={compositionItem}
          onSave={handleSaveComposition}
          onClose={() => { setCompositionItem(null); setFormError(null); }}
          error={formError}
          saving={formSaving}
        />
      )}

      {showProfileAddModal && (
        <ProfileFormModal
          blanks={blanks}
          onSave={handleCreateProfile}
          onClose={() => { setShowProfileAddModal(false); setProfileFormError(null); }}
          error={profileFormError}
          saving={profileFormSaving}
        />
      )}

      {editProfile && (
        <ProfileFormModal
          profile={editProfile}
          blanks={blanks}
          onSave={handleEditProfile}
          onClose={() => { setEditProfile(null); setProfileFormError(null); }}
          error={profileFormError}
          saving={profileFormSaving}
        />
      )}

      {detailsProfile && (
        <ProfileDetailModal
          item={detailsProfile}
          onClose={() => setDetailsProfile(null)}
        />
      )}

      {activeTab === TAB_BLANKS && <Fab onClick={() => setShowAddModal(true)} label="Добавить заготовку" />}
      {activeTab === TAB_PROFILES && <Fab onClick={() => setShowProfileAddModal(true)} label="Добавить профиль" />}
    </div>
  );
};

export default WorkshopPage;
