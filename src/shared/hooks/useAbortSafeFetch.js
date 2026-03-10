import { useRef, useCallback, useEffect } from 'react';
import { isCanceledError } from '../lib/apiError';

/**
 * Хук для безопасных запросов с AbortController и lastRequestId.
 * Отменяет предыдущий запрос при новом вызове и игнорирует устаревшие ответы.
 *
 * @returns {Object} { run, abort }
 *   run(fetchFn) — выполняет fetchFn(signal), возвращает Promise с результатом или null при отмене
 *   abort() — отменяет текущий запрос
 */
export function useAbortSafeFetch() {
  const controllerRef = useRef(null);
  const lastRequestId = useRef(0);

  const run = useCallback(async (fetchFn) => {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const rid = ++lastRequestId.current;
    const signal = controllerRef.current.signal;

    try {
      const result = await fetchFn(signal);
      if (rid !== lastRequestId.current) return null;
      return result;
    } catch (err) {
      if (rid !== lastRequestId.current || isCanceledError(err)) return null;
      throw err;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { run, abort, getSignal: () => controllerRef.current?.signal };
}
