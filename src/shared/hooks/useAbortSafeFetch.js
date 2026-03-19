import { useRef, useCallback, useEffect } from 'react';

export const useAbortSafeFetch = () => {
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const run = useCallback(async (asyncFn) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const id = ++requestIdRef.current;
    const signal = abortRef.current.signal;

    try {
      const result = await asyncFn(signal);
      if (id !== requestIdRef.current) return undefined;
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return undefined;
      if (id !== requestIdRef.current) return undefined;
      throw err;
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const getSignal = useCallback(() => {
    if (!abortRef.current) abortRef.current = new AbortController();
    return abortRef.current.signal;
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { run, abort, getSignal };
};
