import React, { useState, useEffect, useCallback } from 'react';
import { fetchSalary, saveSalary } from './api';
import { useAbortSafeFetch } from '../../shared/hooks/useAbortSafeFetch';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { MONTHS } from '../../shared/constants/common';
import { ErrorState, EmptyState, Select, SkeletonTable, FilterBar } from '../../shared/ui';
import './SalaryPage.scss';

const pickNumber = (...vals) => {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

/** Строки таблицы из разных форм ответа API (в т.ч. после снятия PeriodSnapshot) */
const getSalaryItems = (raw) => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  const root = raw.data != null && typeof raw.data === 'object' ? raw.data : raw;
  const fromRoot =
    root?.items
    ?? root?.trainers
    ?? root?.salary_items
    ?? root?.salaryItems
    ?? root?.results
    ?? root?.payments;
  if (Array.isArray(fromRoot)) return fromRoot;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
};

const SalaryPage = () => {
  const [queryState, setQueryState] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [percentByTrainer, setPercentByTrainer] = useState({});
  const [savingTrainerId, setSavingTrainerId] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const { run: runSalary } = useAbortSafeFetch();

  const fetchSafe = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveError(null);
    try {
      const res = await runSalary((signal) => fetchSalary(queryState, signal));
      if (res === null) return;
      setData(res);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [runSalary, queryState.year, queryState.month, queryState.day]);

  useEffect(() => {
    fetchSafe();
  }, [fetchSafe]);

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const isMonthEnded = queryState.year < nowYear || (queryState.year === nowYear && queryState.month < nowMonth);

  const items = getSalaryItems(data);

  const getTrainerPercent = (row) => {
    const trainerId = row.trainerId ?? row.trainer_id ?? row.id;
    if (trainerId != null && percentByTrainer[trainerId] !== undefined) return percentByTrainer[trainerId];
    const p = row.trainerPercent ?? row.trainer_percent ?? row.percent;
    return typeof p === 'number' && !Number.isNaN(p) ? p : (p != null ? Number(p) : 0);
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
    setSaveError(null);
    setSavingTrainerId(trainerId);
    const percent = getTrainerPercent(row);
    saveSalary(trainerId, queryState, percent, null)
      .then(() => {
        setPercentByTrainer((prev) => {
          const next = { ...prev };
          delete next[trainerId];
          return next;
        });
        return fetchSafe();
      })
      .catch((err) => {
        setSaveError(getApiErrorMessage(err));
      })
      .finally(() => setSavingTrainerId(null));
  };

  return (
    <div className="salary-page">
      
      <FilterBar className="salary-page__filter-bar">
        <div className="salary-page__filter-item">
          <input type="number" placeholder="Год" value={queryState.year} onChange={(e) => setQueryState((q) => ({ ...q, year: Number(e.target.value) || q.year }))} className="salary-page__input" min="2020" max="2030" />
        </div>
        <div className="salary-page__filter-item salary-page__filter-month">
          <Select
            value={queryState.month ? String(queryState.month) : String(new Date().getMonth() + 1)}
            onChange={(v) => setQueryState((q) => ({ ...q, month: v ? Number(v) : new Date().getMonth() + 1 }))}
            options={MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))}
            placeholder="Месяц"
            className="salary-page__month-select"
          />
        </div>
        <div className="salary-page__filter-item">
          <input type="number" placeholder="День" value={queryState.day} onChange={(e) => setQueryState((q) => ({ ...q, day: e.target.value }))} className="salary-page__input" min="1" max="31" />
        </div>
      </FilterBar>
      {error && <ErrorState message={error} onRetry={fetchSafe} />}
      {saveError && <div className="salary-page__save-error" role="alert">{saveError}</div>}
      {!isMonthEnded && !error && (
        <p className="salary-page__hint">Сохранять зарплату можно только за прошедший месяц (после его окончания).</p>
      )}
      <div className="salary-page__section-head">
          <h2 className="salary-page__section-title">Расчёт по тренерам</h2>
          <span className="salary-page__legend">
            <span><span className="salary-page__legend-dot salary-page__legend-dot--saved" /> Сохранено</span>
            <span><span className="salary-page__legend-dot salary-page__legend-dot--pending" /> На расчёте</span>
          </span>
        </div>
      <div className="salary-page__table-wrap">
        <table className="salary-page__table">
          <thead>
            <tr>
              <th className="salary-page__th-name">Тренер</th>
              <th className="salary-page__th-num">Всего</th>
              <th className="salary-page__th-num">Оплатили</th>
              <th className="salary-page__th-num">Не оплатили</th>
              <th className="salary-page__th-money">Доход</th>
              <th className="salary-page__th-percent">% тренеру</th>
              <th className="salary-page__th-money">Тренеру</th>
              <th className="salary-page__th-money">Клубу</th>
              <th className="salary-page__th-money">К выплате</th>
              <th className="salary-page__th-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="salary-page__skeleton-cell">
                  <SkeletonTable rows={6} cols={3} />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} className="salary-page__empty-cell"><EmptyState compact tableCell message="Нет данных за период" /></td></tr>
            ) : items.map((row, index) => {
                const trainerId = row.trainerId ?? row.trainer_id ?? row.id ?? index;
                const fallbackIncome =
                  pickNumber(
                    row.income,
                    row.revenue,
                    row.totalIncome,
                    row.total_income,
                    row.clientIncome,
                    row.client_income,
                    row.amount,
                    row.sum,
                    row.total,
                  ) ?? 0;
                const income = Number.isFinite(Number(fallbackIncome)) ? Number(fallbackIncome) : 0;

                const percent = getTrainerPercent(row);
                const numPercent = typeof percent === 'number' && !Number.isNaN(percent) ? percent : 0;

                const trainerShare = Math.round(income * (numPercent / 100));
                const clubShare = Math.max(0, income - trainerShare);

                const total = trainerShare;
                const saved = row.saved === true || row.saved === 'true';
                const isSaving = savingTrainerId === trainerId;
                const paidCount =
                  pickNumber(
                    row.paidClientCount,
                    row.paid_client_count,
                    row.clientsPaid,
                    row.clients_paid,
                    row.paidCount,
                    row.paid_count,
                    row.clientCount,
                    row.clientsCount,
                    row.clients_count,
                    row.count,
                  ) ?? 0;
                const unpaidCount =
                  pickNumber(
                    row.unpaidClientCount,
                    row.unpaid_client_count,
                    row.clientsUnpaid,
                    row.clients_unpaid,
                    row.unpaidCount,
                    row.unpaid_count,
                    row.unpaid,
                  ) ?? 0;
                const totalCount = (Number(paidCount) || 0) + (Number(unpaidCount) || 0);
                const hasUnpaid = Number(unpaidCount) > 0;
                const canSave = isMonthEnded && !hasUnpaid && !saved;
                const format = (v) => (typeof v === 'number' && !Number.isNaN(v) ? `${Number(v).toLocaleString('ru-RU')} сом` : (v ?? '—'));
                return (
                  <tr key={trainerId} className={`salary-page__row salary-page__row--${saved ? 'saved' : 'pending'}`}>
                    <td className="salary-page__td-name" data-label="Тренер"><span className="salary-page__cell-value">{row.trainerName ?? row.trainer?.fio ?? row.fio ?? '—'}</span></td>
                    <td className="salary-page__td-num" data-label="Всего"><span className="salary-page__cell-value">{totalCount ?? '—'}</span></td>
                    <td className="salary-page__td-num" data-label="Оплатили"><span className="salary-page__cell-value">{paidCount ?? '—'}</span></td>
                    <td className={`salary-page__td-num ${hasUnpaid ? 'salary-page__td-num--unpaid' : ''}`} data-label="Не оплатили"><span className="salary-page__cell-value">{unpaidCount !== undefined && unpaidCount !== null ? unpaidCount : '—'}</span></td>
                    <td className="salary-page__td-money" data-label="Доход"><span className="salary-page__cell-value">{format(income)}</span></td>
                    <td className="salary-page__percent-cell" data-label="% тренеру">
                      <span className="salary-page__cell-value salary-page__cell-value--percent">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={percent === '' ? '' : percent}
                          onChange={(e) => setTrainerPercent(row, e.target.value)}
                          className="salary-page__percent-input"
                          placeholder="0"
                          aria-label="Процент тренеру"
                          disabled={saved}
                        />
                      </span>
                    </td>
                    <td className="salary-page__td-money" data-label="Тренеру"><span className="salary-page__cell-value">{format(trainerShare)}</span></td>
                    <td className="salary-page__td-money" data-label="Клубу"><span className="salary-page__cell-value">{format(clubShare)}</span></td>
                    <td className="salary-page__td-money salary-page__td-total" data-label="К выплате"><span className="salary-page__cell-value">{format(total)}</span></td>
                    <td className="salary-page__actions" data-label="">
                      {!saved && (
                        <button
                          type="button"
                          className="salary-page__save-btn"
                          onClick={() => handleSaveSalary(row)}
                          disabled={isSaving || !canSave}
                          title={!isMonthEnded ? 'Сохранять можно только за прошедший месяц' : hasUnpaid ? 'Сохранить можно только когда все клиенты оплатили' : undefined}
                        >
                          {isSaving ? 'Сохранение…' : 'Сохранить'}
                        </button>
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
