import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchSummary,
  fetchClientsBySport,
  fetchIncomeExpenseDaily,
  fetchTopTrainers,
  fetchWarehouseRestocks,
  fetchSalesByProduct,
  fetchSalesByCategory,
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
  const [topTrainers, setTopTrainers] = useState(null);
  const [warehouseRestocks, setWarehouseRestocks] = useState(null);
  const [salesByProduct, setSalesByProduct] = useState(null);
  const [salesByCategory, setSalesByCategory] = useState(null);
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
    setLoading(true);
    setError(null);
    try {
      const promises = [
        fetchSummary(q, s).then((r) => r?.data ?? r),
        fetchClientsBySport(q, s).then((r) => r?.data ?? r),
        hasMonth ? fetchIncomeExpenseDaily(q, s).then((r) => r?.data ?? r) : Promise.resolve({ items: [] }),
        fetchTopTrainers(q, s).then((r) => r?.data ?? r),
        fetchWarehouseRestocks(q, s).then((r) => r?.data ?? r),
        fetchSalesByProduct(q, s).then((r) => r?.data ?? r),
        fetchSalesByCategory(q, s).then((r) => r?.data ?? r),
        fetchLeadsAnalytics(q, s).then((r) => r?.data ?? r),
      ];
      const [summaryRes, bySportRes, dailyRes, trainersRes, warehouseRes, salesProductRes, salesCategoryRes, leadsAnalyticsRes] = await Promise.all(promises);
      setSummary(summaryRes ?? {});
      setClientsBySport(bySportRes ?? {});
      setIncomeExpenseDaily(dailyRes ?? {});
      setTopTrainers(trainersRes ?? {});
      setWarehouseRestocks(warehouseRes ?? {});
      setSalesByProduct(salesProductRes ?? {});
      setSalesByCategory(salesCategoryRes ?? {});
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
    topTrainers,
    warehouseRestocks,
    salesByProduct,
    salesByCategory,
    leadsAnalytics,
    loading,
    error,
    loadAll,
  };
}
