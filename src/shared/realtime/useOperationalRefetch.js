import { useEffect, useMemo } from 'react';
import { useOperationalRealtime } from './OperationalRealtimeContext';

/**
 * При событии WS с resource из списка вызывает refetch() (например refetch из useServerQuery).
 * @param {string|string[]} resources — имя или список имён `resource` с бэка
 * @param {() => void} refetch
 * @param {boolean} [enabled=true]
 */
export function useOperationalRefetch(resources, refetch, enabled = true) {
  const { subscribe } = useOperationalRealtime();
  const key = useMemo(() => {
    const arr = Array.isArray(resources) ? [...resources] : [resources];
    return JSON.stringify(arr.filter(Boolean).sort());
  }, [resources]);

  const resourceSet = useMemo(() => {
    const arr = JSON.parse(key);
    return new Set(Array.isArray(arr) ? arr : []);
  }, [key]);

  useEffect(() => {
    if (!enabled || typeof refetch !== 'function' || resourceSet.size === 0) return undefined;
    return subscribe((msg) => {
      if (msg?.event !== 'change') return;
      const r = msg?.resource;
      if (r != null && resourceSet.has(r)) refetch();
    });
  }, [subscribe, refetch, enabled, resourceSet]);
}
