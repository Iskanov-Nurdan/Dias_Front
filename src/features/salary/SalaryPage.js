import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSalary, saveSalary } from './api';
import { ErrorState, EmptyState, Select } from '../../shared/ui';
import './SalaryPage.scss';

const MONTHS = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const SalaryPage = () => {
  const [queryState, setQueryState] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [percentByTrainer, setPercentByTrainer] = useState({});
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const fetchSafe = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalary(queryState, controllerRef.current.signal);
      if (rid !== lastRequestId.current) return;
      setData(res);
    } catch (err) {
      if (rid !== lastRequestId.current || err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      if (rid === lastRequestId.current) setLoading(false);
    }
  }, [queryState.year, queryState.month, queryState.day]);

  useEffect(() => {
    fetchSafe();
    return () => controllerRef.current?.abort();
  }, [fetchSafe]);

  const items = data?.data?.items ?? data?.items ?? data?.results ?? data?.payments ?? (Array.isArray(data) ? data : []);

  const getTrainerPercent = (row) => {
    const trainerId = row.trainerId ?? row.trainer_id ?? row.id;
    if (trainerId != null && percentByTrainer[trainerId] !== undefined) return percentByTrainer[trainerId];
    const p = row.trainerPercent ?? row.trainer_percent ?? row.percent;
    return typeof p === 'number' && !Number.isNaN(p) ? p : (p != null ? Number(p) : 60);
  };

  const setTrainerPercent = (row, value) => {
    const trainerId = row.trainerId ?? row.trainer_id ?? row.id;
    if (trainerId == null) return;
    const num = value === '' ? '' : Math.min(100, Math.max(0, Number(value)));
    setPercentByTrainer((prev) => ({ ...prev, [trainerId]: num }));
  };

  const handleSaveSalary = (row) => {
    const trainerId = row.trainerId ?? row.trainer_id ?? row.id;
    if (trainerId == null) return;
    const percent = getTrainerPercent(row);
    saveSalary(trainerId, queryState, percent, null).then(() => fetchSafe()).catch(console.error);
  };

  return (
    <div className="salary-page">
      <h1 className="salary-page__title">Зарплата</h1>
      <div className="salary-page__filters">
        <input type="number" placeholder="Год" value={queryState.year} onChange={(e) => setQueryState((q) => ({ ...q, year: e.target.value }))} className="salary-page__input" min="2020" max="2030" />
        <div className="salary-page__filter-month">
          <label className="salary-page__filter-label">Месяц</label>
          <Select
            value={queryState.month ? String(queryState.month) : String(new Date().getMonth() + 1)}
            onChange={(v) => setQueryState((q) => ({ ...q, month: v ? Number(v) : new Date().getMonth() + 1 }))}
            options={MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))}
            placeholder="Месяц"
            className="salary-page__month-select"
          />
        </div>
        <input type="number" placeholder="День" value={queryState.day} onChange={(e) => setQueryState((q) => ({ ...q, day: e.target.value }))} className="salary-page__input" min="1" max="31" />
      </div>
      {error && <ErrorState message={error} onRetry={fetchSafe} />}
      <div className="salary-page__table-wrap">
        <table className="salary-page__table">
          <thead>
            <tr>
              <th>Тренер</th>
              <th>Кол-во клиентов</th>
              <th>Доход от клиентов</th>
              <th>Процент тренеру</th>
              <th>Тренеру</th>
              <th>Клубу</th>
              <th>Итого к выплате</th>
              <th>Сохранён</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="salary-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="salary-page__empty-cell"><EmptyState message="Нет данных за период" /></td></tr>
            ) : items.map((row) => {
                const income = row.income ?? row.revenue ?? row.clientIncome ?? 0;
                const percent = getTrainerPercent(row);
                const numPercent = typeof percent === 'number' && !Number.isNaN(percent) ? percent : 60;
                const trainerShare = income * (numPercent / 100);
                const clubShare = income - trainerShare;
                const total = trainerShare;
                const saved = row.saved === true || row.saved === 'true';
                const format = (v) => (typeof v === 'number' && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} Р` : (v ?? '—'));
                return (
                  <tr key={row.trainerId ?? row.trainer_id ?? row.id ?? Math.random()}>
                    <td>{row.trainerName ?? row.trainer?.fio ?? row.fio ?? '—'}</td>
                    <td>{row.clientCount ?? row.clientsCount ?? row.clients_count ?? row.count ?? '—'}</td>
                    <td>{format(income)}</td>
                    <td className="salary-page__percent-cell">
                      <input
                        type="text"
                        value={percent === '' ? '' : percent}
                        onChange={(e) => setTrainerPercent(row, e.target.value)}
                        className="salary-page__percent-input"
                        placeholder="%"
                      />
                    </td>
                    <td>{format(trainerShare)}</td>
                    <td>{format(clubShare)}</td>
                    <td>{format(total)}</td>
                    <td>{saved ? 'Да' : 'Нет'}</td>
                    <td className="salary-page__actions">
                      {!saved && (
                        <button type="button" className="salary-page__save-btn" onClick={() => handleSaveSalary(row)}>Сохранить</button>
                      )}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalaryPage;
