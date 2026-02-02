import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchSalary, saveSalary } from './api';
import { ErrorState, EmptyState } from '../../shared/ui';
import './SalaryPage.scss';

const SalaryPage = () => {
  const [queryState, setQueryState] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleSaveSalary = (row) => {
    const trainerId = row.trainerId ?? row.trainer_id ?? row.id;
    if (trainerId == null) return;
    saveSalary(trainerId, queryState, null).then(() => fetchSafe()).catch(console.error);
  };

  return (
    <div className="salary-page">
      <h1 className="salary-page__title">Зарплата</h1>
      <div className="salary-page__filters">
        <input type="number" placeholder="Год" value={queryState.year} onChange={(e) => setQueryState((q) => ({ ...q, year: e.target.value }))} className="salary-page__input" min="2020" max="2030" />
        <input type="number" placeholder="Месяц" value={queryState.month} onChange={(e) => setQueryState((q) => ({ ...q, month: e.target.value }))} className="salary-page__input" min="1" max="12" />
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
              <th>60% тренеру</th>
              <th>40% клубу</th>
              <th>Итого к выплате</th>
              <th>Сохранён</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="salary-page__loading-cell"><span className="loading-inline"><span className="loading-inline__spinner" aria-hidden />Загрузка…</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="salary-page__empty-cell"><EmptyState message="Нет данных за период" /></td></tr>
            ) : items.map((row) => {
                const income = row.income ?? row.revenue ?? row.clientIncome ?? 0;
                const trainerShare = row.trainerShare ?? row.trainer_share ?? row.percent60 ?? 0;
                const clubShare = row.clubShare ?? row.club_share ?? row.percent40 ?? 0;
                const total = row.total ?? row.totalToPay ?? trainerShare;
                const saved = row.saved === true || row.saved === 'true';
                const format = (v) => (typeof v === 'number' && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} Р` : (v ?? '—'));
                return (
                  <tr key={row.trainerId ?? row.trainer_id ?? row.id ?? Math.random()}>
                    <td>{row.trainerName ?? row.trainer?.fio ?? row.fio ?? '—'}</td>
                    <td>{row.clientCount ?? row.clientsCount ?? row.clients_count ?? row.count ?? '—'}</td>
                    <td>{format(income)}</td>
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
