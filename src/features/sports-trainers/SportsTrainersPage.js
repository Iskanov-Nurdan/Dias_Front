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
import { Select } from '../../shared/ui';
import { SportsList, TrainersList, SportFormModal, TrainerFormModal } from './components';
import './SportsTrainersPage.scss';

const TAB_SPORTS = 'sports';
const TAB_TRAINERS = 'trainers';

const SportsTrainersPage = () => {
  const [activeTab, setActiveTab] = useState(TAB_SPORTS);
  const [queryState, setQueryState] = useState({ sportId: '', page: 1, perPage: 20 });
  const [sportsData, setSportsData] = useState([]);
  const [trainersData, setTrainersData] = useState(null);
  const [sportsLoading, setSportsLoading] = useState(false);
  const [trainersLoading, setTrainersLoading] = useState(false);
  const [sportsError, setSportsError] = useState(null);
  const [trainersError, setTrainersError] = useState(null);
  const [formSport, setFormSport] = useState(null);
  const [formTrainer, setFormTrainer] = useState(null);
  const [confirmDeleteSport, setConfirmDeleteSport] = useState(null);
  const [confirmDeleteTrainer, setConfirmDeleteTrainer] = useState(null);
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchSportsSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setSportsLoading(true);
    setSportsError(null);
    try {
      const data = await fetchSports(controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setSportsData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setSportsError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastRequestId.current) setSportsLoading(false);
    }
  }, []);

  const fetchTrainersSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setTrainersLoading(true);
    setTrainersError(null);
    try {
      const data = await fetchTrainers(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setTrainersData(data);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError') return;
      setTrainersError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastRequestId.current) setTrainersLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    if (activeTab === TAB_SPORTS) fetchSportsSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchSportsSafe]);

  useEffect(() => {
    if (activeTab === TAB_TRAINERS) fetchTrainersSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchTrainersSafe]);

  const trainersItems = trainersData?.items ?? trainersData?.results ?? trainersData ?? [];

  const handleSaveSport = async (payload) => {
    try {
      if (formSport?.id) await updateSport(formSport.id, payload, null);
      else await createSport(payload, null);
      setFormSport(null);
      fetchSportsSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTrainer = async (payload) => {
    try {
      if (formTrainer?.id) await updateTrainer(formTrainer.id, payload, null);
      else await createTrainer(payload, null);
      setFormTrainer(null);
      fetchTrainersSafe();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSport = () => {
    if (!confirmDeleteSport) return;
    deleteSport(confirmDeleteSport.id, null).then(() => { setConfirmDeleteSport(null); fetchSportsSafe(); }).catch(console.error);
  };

  const handleDeleteTrainer = () => {
    if (!confirmDeleteTrainer) return;
    deleteTrainer(confirmDeleteTrainer.id, null).then(() => { setConfirmDeleteTrainer(null); fetchTrainersSafe(); }).catch(console.error);
  };

  return (
    <div className="sports-trainers-page">
      <h1 className="sports-trainers-page__title">Виды спорта / Тренеры</h1>
      <div className="sports-trainers-page__tabs">
        <button type="button" className={`sports-trainers-page__tab ${activeTab === TAB_SPORTS ? 'sports-trainers-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_SPORTS)}>Виды спорта</button>
        <button type="button" className={`sports-trainers-page__tab ${activeTab === TAB_TRAINERS ? 'sports-trainers-page__tab--active' : ''}`} onClick={() => setActiveTab(TAB_TRAINERS)}>Тренеры</button>
      </div>
      {activeTab === TAB_TRAINERS && (
        <div className="sports-trainers-page__filters">
          <Select
            value={queryState.sportId}
            onChange={(v) => setQueryState((q) => ({ ...q, sportId: v, page: 1 }))}
            options={[{ value: '', label: 'Все виды спорта' }, ...sportsData.map((s) => ({ value: String(s.id), label: s.name || '' }))]}
            placeholder="Все виды спорта"
            className="sports-trainers-page__select-wrap"
          />
        </div>
      )}
      {activeTab === TAB_SPORTS && (
        <SportsList items={sportsData} loading={sportsLoading} error={sportsError} onRetry={fetchSportsSafe} onAdd={() => setFormSport({})} onEdit={setFormSport} onDelete={setConfirmDeleteSport} confirmDelete={confirmDeleteSport} onConfirmDelete={handleDeleteSport} onCancelDelete={() => setConfirmDeleteSport(null)} />
      )}
      {activeTab === TAB_TRAINERS && (
        <TrainersList items={trainersItems} loading={trainersLoading} error={trainersError} onRetry={fetchTrainersSafe} onAdd={() => setFormTrainer({})} onEdit={setFormTrainer} onDelete={setConfirmDeleteTrainer} confirmDelete={confirmDeleteTrainer} onConfirmDelete={handleDeleteTrainer} onCancelDelete={() => setConfirmDeleteTrainer(null)} />
      )}
      {formSport && <SportFormModal sport={formSport} onSave={handleSaveSport} onClose={() => setFormSport(null)} />}
      {formTrainer && <TrainerFormModal trainer={formTrainer} sports={sportsData} onSave={handleSaveTrainer} onClose={() => setFormTrainer(null)} />}
    </div>
  );
};

export default SportsTrainersPage;
