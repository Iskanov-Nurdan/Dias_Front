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
      const data = await fetchSports(controllerRef.current.signal);
      if (rid !== lastSportsRequestId.current) return;
      setSportsData(Array.isArray(data) ? data : data?.results ?? data?.items ?? []);
    } catch (err) {
      if (rid !== lastSportsRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setSportsError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastSportsRequestId.current) setSportsLoading(false);
    }
  }, []);

  const fetchTrainersSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastTrainersRequestId.current;
    setTrainersLoading(true);
    setTrainersError(null);
    try {
      const data = await fetchTrainers(queryState, controllerRef.current.signal);
      if (rid !== lastTrainersRequestId.current) return;
      setTrainersData(data);
    } catch (err) {
      if (rid !== lastTrainersRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setTrainersError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastTrainersRequestId.current) setTrainersLoading(false);
    }
  }, [queryState]);

  useEffect(() => {
    if (activeTab === TAB_SPORTS || activeTab === TAB_TRAINERS) fetchSportsSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchSportsSafe]);

  useEffect(() => {
    if (activeTab === TAB_TRAINERS) fetchTrainersSafe();
    return () => controllerRef.current?.abort();
  }, [activeTab, fetchTrainersSafe]);

  const trainersItems = trainersData?.items ?? trainersData?.results ?? trainersData ?? [];
  const sportsFiltered = sportSearch.trim()
    ? sportsData.filter((s) => (s.name || '').toLowerCase().includes(sportSearch.trim().toLowerCase()))
    : sportsData;
  const trainersFiltered = trainerSearch.trim()
    ? trainersItems.filter((t) => (t.fio || '').toLowerCase().includes(trainerSearch.trim().toLowerCase()))
    : trainersItems;

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
      {activeTab === TAB_SPORTS && (
        <div className="sports-trainers-page__toolbar">
          <div className="sports-trainers-page__filters">
            <input
              type="text"
              placeholder="Поиск по названию"
              value={sportSearch}
              onChange={(e) => setSportSearch(e.target.value)}
              className="sports-trainers-page__search"
            />
          </div>
          <button type="button" className="sports-trainers-page__add" onClick={() => setFormSport({})}>
            Добавить
          </button>
        </div>
      )}
      {activeTab === TAB_TRAINERS && (
        <div className="sports-trainers-page__toolbar">
          <div className="sports-trainers-page__filters">
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
          </div>
          <button type="button" className="sports-trainers-page__add" onClick={() => setFormTrainer({})}>
            Добавить
          </button>
        </div>
      )}
      {activeTab === TAB_SPORTS && (
        <SportsList items={sportsFiltered} loading={sportsLoading} error={sportsError} onRetry={fetchSportsSafe} onEdit={setFormSport} onDelete={setConfirmDeleteSport} confirmDelete={confirmDeleteSport} onConfirmDelete={handleDeleteSport} onCancelDelete={() => setConfirmDeleteSport(null)} />
      )}
      {activeTab === TAB_TRAINERS && (
        <TrainersList items={trainersFiltered} sports={sportsData} loading={trainersLoading} error={trainersError} onRetry={fetchTrainersSafe} onEdit={setFormTrainer} onDelete={setConfirmDeleteTrainer} confirmDelete={confirmDeleteTrainer} onConfirmDelete={handleDeleteTrainer} onCancelDelete={() => setConfirmDeleteTrainer(null)} />
      )}
      {formSport && <SportFormModal sport={formSport} onSave={handleSaveSport} onClose={() => setFormSport(null)} />}
      {formTrainer && <TrainerFormModal trainer={formTrainer} sports={sportsData} onSave={handleSaveTrainer} onClose={() => setFormTrainer(null)} />}
    </div>
  );
};

export default SportsTrainersPage;
