import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSports,
  fetchTrainers,
  createSport,
  updateSport,
  deleteSport,
  createTrainer,
  updateTrainer,
  deleteTrainer,
} from './api';
import { useAuth } from '../../app/providers/AuthProvider';
import { Select, Pagination, FilterBar } from '../../shared/ui';
import { SportsList, TrainersList, SportFormModal, TrainerFormModal } from './components';
import './SportsTrainersPage.scss';

const TAB_SPORTS = 'sports';
const TAB_TRAINERS = 'trainers';

const SportsTrainersPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const [activeTab, setActiveTab] = useState(TAB_SPORTS);
  const [queryState, setQueryState] = useState({ sportId: '', search: '', page: 1, perPage: 20 });
  const [sportSearch, setSportSearch] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');
  const [sportsData, setSportsData] = useState([]);
  const [trainersData, setTrainersData] = useState(null);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [trainersLoading, setTrainersLoading] = useState(false);
  const [sportsError, setSportsError] = useState(null);
  const [trainersError, setTrainersError] = useState(null);
  const [formSport, setFormSport] = useState(null);
  const [formTrainer, setFormTrainer] = useState(null);
  const [sportFormError, setSportFormError] = useState(null);
  const [sportFormSaving, setSportFormSaving] = useState(false);
  const [trainerFormError, setTrainerFormError] = useState(null);
  const [trainerFormSaving, setTrainerFormSaving] = useState(false);
  const [confirmDeleteSport, setConfirmDeleteSport] = useState(null);
  const [confirmDeleteTrainer, setConfirmDeleteTrainer] = useState(null);
  const controllerRef = useRef(null);
  const lastSportsRequestId = useRef(0);
  const lastTrainersRequestId = useRef(0);

  const fetchSportsSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastSportsRequestId.current;
    setSportsLoading(true);
    setSportsError(null);
    try {
      const data = await fetchSports({ search: sportSearch || undefined }, controllerRef.current.signal);
      if (rid !== lastSportsRequestId.current) return;
      setSportsData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastSportsRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setSportsError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastSportsRequestId.current) setSportsLoading(false);
    }
  }, [sportSearch]);

  const fetchTrainersSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastTrainersRequestId.current;
    setTrainersLoading(true);
    setTrainersError(null);
    try {
      const data = await fetchTrainers({ ...queryState, search: trainerSearch || undefined }, controllerRef.current.signal);
      if (rid !== lastTrainersRequestId.current) return;
      setTrainersData(data);
    } catch (err) {
      if (rid !== lastTrainersRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setTrainersError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastTrainersRequestId.current) setTrainersLoading(false);
    }
  }, [queryState, trainerSearch]);

  useEffect(() => {
    if (activeTab === TAB_SPORTS || activeTab === TAB_TRAINERS) fetchSportsSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchSportsSafe]);

  useEffect(() => {
    if (activeTab === TAB_TRAINERS) fetchTrainersSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchTrainersSafe]);

  const trainersItems = trainersData?.items ?? trainersData?.results ?? trainersData ?? [];

  const handleSaveSport = async (payload) => {
    setSportFormError(null);
    setSportFormSaving(true);
    try {
      if (formSport?.id) await updateSport(formSport.id, payload, null);
      else await createSport(payload, null);
      setFormSport(null);
      fetchSportsSafe();
    } catch (e) {
      const d = e.response?.data;
      setSportFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setSportFormSaving(false);
    }
  };

  const handleSaveTrainer = async (payload) => {
    setTrainerFormError(null);
    setTrainerFormSaving(true);
    try {
      if (formTrainer?.id) await updateTrainer(formTrainer.id, payload, null);
      else await createTrainer(payload, null);
      setFormTrainer(null);
      fetchTrainersSafe();
    } catch (e) {
      const d = e.response?.data;
      setTrainerFormError(d?.error?.message ?? d?.message ?? d?.detail ?? 'Ошибка сохранения');
    } finally {
      setTrainerFormSaving(false);
    }
  };

  const handleDeleteSport = () => {
    if (!confirmDeleteSport) return;
    setSportsError(null);
    deleteSport(confirmDeleteSport.id, null)
      .then(() => {
        setConfirmDeleteSport(null);
        fetchSportsSafe();
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления';
        setSportsError(msg);
        setConfirmDeleteSport(null);
      });
  };

  const handleDeleteTrainer = () => {
    if (!confirmDeleteTrainer) return;
    setTrainersError(null);
    deleteTrainer(confirmDeleteTrainer.id, null)
      .then(() => {
        setConfirmDeleteTrainer(null);
        fetchTrainersSafe();
      })
      .catch((e) => {
        const msg = e.response?.data?.error?.message || e.response?.data?.message || e.response?.data?.detail || e.message || 'Ошибка удаления';
        setTrainersError(msg);
        setConfirmDeleteTrainer(null);
      });
  };

  return (
    <div className="sports-trainers-page">
      <h1 className="sports-trainers-page__title">Спорт и тренеры</h1>
      <div className="sports-trainers-page__tabs">
        <button type="button" className={`sports-trainers-page__tab ${activeTab === TAB_SPORTS ? 'sports-trainers-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_SPORTS)}>Виды спорта</button>
        <button type="button" className={`sports-trainers-page__tab ${activeTab === TAB_TRAINERS ? 'sports-trainers-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_TRAINERS)}>Тренеры</button>
      </div>
      {activeTab === TAB_SPORTS && (
        <FilterBar className="sports-trainers-page__filter-bar">
          <input
            type="text"
            placeholder="Поиск по названию"
            value={sportSearch}
            onChange={(e) => setSportSearch(e.target.value)}
            className="sports-trainers-page__search"
          />
          <button type="button" className="sports-trainers-page__add filter-bar__action" onClick={() => setFormSport({})}>
            Добавить
          </button>
        </FilterBar>
      )}
      {activeTab === TAB_TRAINERS && (
        <FilterBar className="sports-trainers-page__filter-bar">
          <input
            type="text"
            placeholder="Поиск (ФИО тренера)"
            value={trainerSearch}
            onChange={(e) => setTrainerSearch(e.target.value)}
            className="sports-trainers-page__search"
          />
          <Select
            value={queryState.sportId}
            onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))}
            options={[{ value: '', label: 'Все виды спорта' }, ...sportsData.map((s) => ({ value: String(s.id), label: s.name || '' }))]}
            placeholder="Все виды спорта"
            className="sports-trainers-page__select-wrap"
          />
          <button type="button" className="sports-trainers-page__add filter-bar__action" onClick={() => setFormTrainer({})}>
            Добавить
          </button>
        </FilterBar>
      )}
      {activeTab === TAB_SPORTS && (
        <SportsList items={sportsData} loading={sportsLoading} error={sportsError} onRetry={fetchSportsSafe} onEdit={(s) => (isAdmin ? setFormSport(s) : showAccessDenied())} onDelete={(s) => (isAdmin ? setConfirmDeleteSport(s) : showAccessDenied())} confirmDelete={confirmDeleteSport} onConfirmDelete={handleDeleteSport} onCancelDelete={() => setConfirmDeleteSport(null)} />
      )}
      {activeTab === TAB_TRAINERS && (
        <>
          <TrainersList items={trainersItems} sports={sportsData} loading={trainersLoading} error={trainersError} onRetry={fetchTrainersSafe} onEdit={(t) => (isAdmin ? setFormTrainer(t) : showAccessDenied())} onDelete={(t) => (isAdmin ? setConfirmDeleteTrainer(t) : showAccessDenied())} confirmDelete={confirmDeleteTrainer} onConfirmDelete={handleDeleteTrainer} onCancelDelete={() => setConfirmDeleteTrainer(null)} />
          <Pagination
            meta={trainersData?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={trainersLoading}
            entityLabel="тренеров"
          />
        </>
      )}
      {formSport && (
        <SportFormModal
          sport={formSport}
          onSave={handleSaveSport}
          onClose={() => { setFormSport(null); setSportFormError(null); }}
          error={sportFormError}
          saving={sportFormSaving}
        />
      )}
      {formTrainer && (
        <TrainerFormModal
          trainer={formTrainer}
          sports={sportsData}
          onSave={handleSaveTrainer}
          onClose={() => { setFormTrainer(null); setTrainerFormError(null); }}
          error={trainerFormError}
          saving={trainerFormSaving}
        />
      )}
    </div>
  );
};

export default SportsTrainersPage;
