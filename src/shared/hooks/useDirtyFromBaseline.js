import { useRef, useEffect, useCallback } from 'react';

/**
 * После loading === false один раз фиксирует baseline как JSON(values).
 * При смене key baseline сбрасывается.
 * Возвращает () => boolean — отличается ли текущее values от baseline.
 */
export function useDirtyFromBaseline(key, loading, values) {
  const baselineRef = useRef(null);
  const prevKey = useRef(key);
  useEffect(() => {
    if (prevKey.current !== key) {
      prevKey.current = key;
      baselineRef.current = null;
    }
  }, [key]);
  const snap = JSON.stringify(values);
  useEffect(() => {
    if (loading) return;
    if (baselineRef.current != null) return;
    try {
      baselineRef.current = JSON.parse(snap);
    } catch {
      baselineRef.current = null;
    }
  }, [loading, key, snap]);
  return useCallback(() => {
    if (baselineRef.current == null) return false;
    return JSON.stringify(baselineRef.current) !== snap;
  }, [snap]);
}
