import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiClient } from '../api';

const buildQueryString = (queryState) => {
  const params = new URLSearchParams();
  Object.entries(queryState || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.append(key, value);
    }
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const useServerQuery = (url, queryState, options = {}) => {
  const { enabled = true, fetcher } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const queryKey = useMemo(() => JSON.stringify(queryState || {}), [queryState]);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    const currentFetcher = fetcherRef.current;
    if (!currentFetcher && !url) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const id = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const stableQueryState = queryKey ? JSON.parse(queryKey) : {};
      let payload;
      if (currentFetcher) {
        payload = await currentFetcher(stableQueryState, abortRef.current.signal);
      } else {
        const qs = buildQueryString(stableQueryState);
        const res = await apiClient.get(`${url}${qs}`, {
          signal: abortRef.current.signal,
        });
        payload = res.data;
      }
      if (id !== requestIdRef.current) return;
      setData(payload);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      if (id !== requestIdRef.current) return;
      const payload = err.response?.data && typeof err.response.data === 'object'
        ? { ...err.response.data, status: err.response.status }
        : { error: err.message, code: 'UNKNOWN', status: err.response?.status };
      setError(payload);
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [url, enabled, queryKey]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  return {
    items: data?.items ?? [],
    meta: data?.meta ?? null,
    links: data?.links ?? null,
    raw: data,
    loading,
    error,
    refetch,
  };
};
