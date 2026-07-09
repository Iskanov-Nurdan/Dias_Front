import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchAnalytics,
  fetchClientsBySport,
  fetchIncomeExpenseDaily,
  fetchExpensesByCategory,
  fetchNewClientsForMonth,
  fetchPeriodComparison,
  fetchLeadsAnalytics,
} from '../api';

/**
 * Загрузка и состояние данных аналитики по queryState (year, month, day).
 * Возвращает все блоки данных, loading, error и loadAll для ручного обновления.
 */
export function useAnalyticsData(queryState) {
  const [summary, setSummary] = useState(null);
  const [clientsBySport, setClientsBySport] = useState(null);
  const [incomeExpenseDaily, setIncomeExpenseDaily] = useState(null);
  const [expensesByCategory, setExpensesByCategory] = useState(null);
  const [newClientsByMonth, setNewClientsByMonth] = useState(null);
  const [periodComparison, setPeriodComparison] = useState(null);
  const [leadsAnalytics, setLeadsAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const loadAll = useCallback(async () => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const s = controllerRef.current.signal;
    const q = queryState;
    const hasMonth = q.month != null && q.month !== '';
    const hasMonthNoDay = hasMonth && (q.day == null || q.day === '');
    const hasYear = q.year != null && q.year !== '';
    setLoading(true);
    setError(null);
    try {
      const monthPromises = hasYear ? Array.from({ length: 12 }, (_, i) =>
        fetchNewClientsForMonth(q.year, i + 1, s).then((r) => ({ month: i + 1, count: (r?.data?.items ?? r?.items ?? []).length }))
      ) : [];
      const promises = [
        fetchAnalytics(q, s).then((r) => r?.data ?? r ?? {}),
        fetchClientsBySport(q, s).then((r) => r?.data ?? r),
        hasMonth ? fetchIncomeExpenseDaily(q, s).then((r) => r?.data ?? r) : Promise.resolve({ items: [] }),
        fetchExpensesByCategory(q, s).then((r) => r?.data ?? r),
        hasMonthNoDay ? fetchPeriodComparison(q, s).then((r) => r?.data ?? r) : Promise.resolve(null),
        fetchLeadsAnalytics(q, s).then((r) => r?.data ?? r),
        ...(monthPromises.length > 0 ? [Promise.all(monthPromises).then((arr) => arr.reduce((acc, { month, count }) => ({ ...acc, [month]: count }), {}))] : [Promise.resolve(null)]),
      ];
      const results = await Promise.all(promises);
      const monthRes = monthPromises.length > 0 ? results.pop() : null;
      const [
        analyticsRes, bySportRes, dailyRes, expensesCatRes,
        periodCompRes, leadsAnalyticsRes,
      ] = results;
      setSummary(analyticsRes ?? {});
      setClientsBySport(bySportRes ?? {});
      setIncomeExpenseDaily(dailyRes ?? {});
      setExpensesByCategory(expensesCatRes ?? {});
      setNewClientsByMonth(monthRes ?? null);
      setPeriodComparison(periodCompRes ?? null);
      setLeadsAnalytics(leadsAnalyticsRes ?? {});
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      setError(err.response?.data?.message || err.response?.data?.detail || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [queryState.year, queryState.month, queryState.day]);

  useEffect(() => {
    loadAll();
    return () => controllerRef.current?.abort();
  }, [loadAll]);

  return {
    summary,
    clientsBySport,
    incomeExpenseDaily,
    expensesByCategory,
    newClientsByMonth,
    periodComparison,
    leadsAnalytics,
    loading,
    error,
    loadAll,
  };
}
