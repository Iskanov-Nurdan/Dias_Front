import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'analytics_filters';

const getStored = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.year !== 'undefined') return { year: p.year, month: p.month ?? '', day: p.day ?? '' };
  } catch (_) {}
  return null;
};

const setStored = (q) => {
  try {
    if (q) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
};

/**
 * Фильтры аналитики с сохранением в sessionStorage.
 * @param {Object} defaultQuery — { year, month, day }
 * @returns {[Object, Function, Function]} [queryState, setQueryState, resetFilters]
 */
export function useAnalyticsFilters(defaultQuery) {
  const [queryState, setQueryState] = useState(() => getStored() || defaultQuery);

  useEffect(() => {
    setStored(queryState);
  }, [queryState.year, queryState.month, queryState.day]);

  const resetFilters = useCallback(() => {
    setQueryState(defaultQuery);
    setStored(null);
  }, [defaultQuery]);

  return [queryState, setQueryState, resetFilters];
}
