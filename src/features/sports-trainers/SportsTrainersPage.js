import React, { useState, useEffect, useCallback } from 'react';
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
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { Select, Pagination, FilterBar } from '../../shared/ui';
import { SportsList, TrainersList, SportFormModal, TrainerFormModal, TrainerScheduleModal } from './components';
import { WEEKDAYS } from './scheduleConstants';
import './SportsTrainersPage.scss';

const TAB_SPORTS = 'sports';
const TAB_TRAINERS = 'trainers';

const SportsTrainersPage = () => {
  const { isAdmin, showAccessDenied } = useAuth();
  const [activeTab, setActiveTab] = useState(TAB_SPORTS);
  const [queryState, setQueryState] = useState({
    sportId: '',
    search: '',
    weekday: '',
    timeFrom: '',
    timeTo: '',
    page: 1,
    perPage: 20,
  });
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
  const [scheduleTrainer, setScheduleTrainer] = useState(null);
  const { run: runSports } = useAbortSafeFetch();
  const { run: runTrainers } = useAbortSafeFetch();

  const fetchSportsSafe = useCallback(async () => {
    setSportsLoading(true);
    setSportsError(null);
    try {
      const data = await runSports((signal) => fetchSports({ search: sportSearch || undefined }, signal));
      if (data === null) return;
      setSportsData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      setSportsError(getApiErrorMessage(err));
    } finally {
      setSportsLoading(false);
    }
  }, [runSports, sportSearch]);

  const fetchTrainersSafe = useCallback(async () => {
    setTrainersLoading(true);
    setTrainersError(null);
    try {
      const data = await runTrainers((signal) => fetchTrainers({ ...queryState, search: trainerSearch || undefined }, signal));
      if (data === null) return;
      setTrainersData(data);
    } catch (err) {
      setTrainersError(getApiErrorMessage(err));
    } finally {
      setTrainersLoading(false);
    }
  }, [runTrainers, queryState, trainerSearch]);

  useEffect(() => {
    if (activeTab === TAB_SPORTS || activeTab === TAB_TRAINERS) fetchSportsSafe();
  }, [activeTab, fetchSportsSafe]);

  useEffect(() => {
    if (activeTab === TAB_TRAINERS) fetchTrainersSafe();
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
        setSportsError(getApiErrorMessage(e));
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
        setTrainersError(getApiErrorMessage(e));
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
        <div className="sports-trainers-page__content">
          <FilterBar className="sports-trainers-page__filter-bar">
            <input
              type="text"
              placeholder="Поиск"
              value={sportSearch}
              onChange={(e) => setSportSearch(e.target.value)}
              className="sports-trainers-page__search"
            />
            <button type="button" className="sports-trainers-page__add filter-bar__action" onClick={() => setFormSport({})}>
              Добавить
            </button>
          </FilterBar>
          <SportsList
            items={sportsData}
            loading={sportsLoading}
            error={sportsError}
            onRetry={fetchSportsSafe}
            onEdit={(s) => (isAdmin ? setFormSport(s) : showAccessDenied())}
            onDelete={(s) => (isAdmin ? setConfirmDeleteSport(s) : showAccessDenied())}
            confirmDelete={confirmDeleteSport}
            onConfirmDelete={handleDeleteSport}
            onCancelDelete={() => setConfirmDeleteSport(null)}
            emptyStateActionLabel={isAdmin ? 'Добавить вид спорта' : undefined}
            emptyStateOnAction={isAdmin ? () => setFormSport({}) : undefined}
          />
        </div>
      )}
      {activeTab === TAB_TRAINERS && (
        <div className="sports-trainers-page__content">
          <FilterBar className="sports-trainers-page__filter-bar">
          <input
            type="text"
            placeholder="Поиск"
            value={trainerSearch}
            onChange={(e) => setTrainerSearch(e.target.value)}
            className="sports-trainers-page__search"
          />
          <Select
            value={queryState.sportId}
            onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))}
            options={[{ value: '', label: 'Все виды спорта' }, ...sportsData.map((s) => ({ value: String(s.id), label: s.name || '' }))]}
            placeholder="Спорт"
            className="sports-trainers-page__select-wrap"
          />
          <Select
            value={String(queryState.weekday ?? '')}
            onChange={(v) => setQueryState((q) => ({ ...q, weekday: v, page: 1 }))}
            options={[
              { value: '', label: 'Все дни' },
              ...WEEKDAYS.map((w) => ({ value: String(w.weekday), label: w.short })),
            ]}
            placeholder="День"
            className="sports-trainers-page__select-wrap sports-trainers-page__select-wrap--compact"
          />
          <label className="sports-trainers-page__time-filter">
            <span className="sports-trainers-page__time-filter-label">С</span>
            <input
              type="time"
              className="sports-trainers-page__time-input"
              value={queryState.timeFrom || ''}
              onChange={(e) => setQueryState((q) => ({ ...q, timeFrom: e.target.value, page: 1 }))}
              disabled={!queryState.weekday}
              title={!queryState.weekday ? 'Сначала выберите день недели' : undefined}
            />
          </label>
          <label className="sports-trainers-page__time-filter">
            <span className="sports-trainers-page__time-filter-label">До</span>
            <input
              type="time"
              className="sports-trainers-page__time-input"
              value={queryState.timeTo || ''}
              onChange={(e) => setQueryState((q) => ({ ...q, timeTo: e.target.value, page: 1 }))}
              disabled={!queryState.weekday}
            />
          </label>
          <button type="button" className="sports-trainers-page__add filter-bar__action" onClick={() => setFormTrainer({})}>
            Добавить
          </button>
        </FilterBar>
          <TrainersList
            items={trainersItems}
            sports={sportsData}
            loading={trainersLoading}
            error={trainersError}
            onRetry={fetchTrainersSafe}
            onEdit={(t) => (isAdmin ? setFormTrainer(t) : showAccessDenied())}
            onSchedule={(t) => setScheduleTrainer(t)}
            onDelete={(t) => (isAdmin ? setConfirmDeleteTrainer(t) : showAccessDenied())}
            confirmDelete={confirmDeleteTrainer}
            onConfirmDelete={handleDeleteTrainer}
            onCancelDelete={() => setConfirmDeleteTrainer(null)}
            emptyStateActionLabel={isAdmin ? 'Добавить тренера' : undefined}
            emptyStateOnAction={isAdmin ? () => setFormTrainer({}) : undefined}
          />
          <Pagination
            meta={trainersData?.meta}
            currentPage={queryState.page}
            onPage={(p) => setQueryState((q) => ({ ...q, page: p }))}
            loading={trainersLoading}
            entityLabel="тренеров"
          />
        </div>
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
      {scheduleTrainer?.id && (
        <TrainerScheduleModal
          trainer={scheduleTrainer}
          readOnly={!isAdmin}
          onClose={() => setScheduleTrainer(null)}
          onSaved={fetchTrainersSafe}
        />
      )}
    </div>
  );
};

export default SportsTrainersPage;
