import { useEffect, useMemo, useRef } from 'react';
import { useOperationalRealtime } from './OperationalRealtimeContext';

const REFETCH_DEBOUNCE_MS = 300;

/**
 * При событии WS с resource из списка вызывает refetch() (например refetch из useServerQuery).
 * @param {string|string[]} resources — имя или список имён `resource` с бэка
 * @param {() => void} refetch
 * @param {boolean} [enabled=true]
 */
export function useOperationalRefetch(resources, refetch, enabled = true) {
  const { subscribe } = useOperationalRealtime();
  const refetchRef = useRef(refetch);
  const debounceRef = useRef(null);

  refetchRef.current = refetch;

  const key = useMemo(() => {
    const arr = Array.isArray(resources) ? [...resources] : [resources];
    return JSON.stringify(arr.filter(Boolean).sort());
  }, [resources]);

  const resourceSet = useMemo(() => {
    const arr = JSON.parse(key);
    return new Set(Array.isArray(arr) ? arr : []);
  }, [key]);

  useEffect(() => {
    if (!enabled || typeof refetchRef.current !== 'function' || resourceSet.size === 0) {
      return undefined;
    }

    const flush = () => {
      debounceRef.current = null;
      refetchRef.current?.();
    };

    const schedule = () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, REFETCH_DEBOUNCE_MS);
    };

    return subscribe((msg) => {
      if (msg?.event !== 'change') return;
      const r = msg?.resource;
      if (r != null && resourceSet.has(r)) schedule();
    });
  }, [subscribe, enabled, resourceSet]);

  useEffect(
    () => () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    },
    [],
  );
}
