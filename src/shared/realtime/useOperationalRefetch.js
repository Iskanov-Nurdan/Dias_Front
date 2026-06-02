import { useEffect, useMemo, useRef } from 'react';
import { useOperationalRealtime } from './OperationalRealtimeContext';

const REFETCH_DEBOUNCE_MS = 300;

/**
 * При событии WS с resource из списка вызывает refetch() (например refetch из useServerQuery).
 * Поддерживает префиксы: `chemistry*` → любой resource, начинающийся с `chemistry`.
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

  const { resourceSet, resourcePrefixes } = useMemo(() => {
    const arr = JSON.parse(key);
    const list = Array.isArray(arr) ? arr : [];
    const exact = new Set();
    const prefixes = [];
    list.forEach((item) => {
      const r = String(item ?? '').trim();
      if (!r) return;
      if (r.endsWith('*')) prefixes.push(r.slice(0, -1));
      else exact.add(r);
    });
    return { resourceSet: exact, resourcePrefixes: prefixes };
  }, [key]);

  useEffect(() => {
    if (
      !enabled
      || typeof refetchRef.current !== 'function'
      || (resourceSet.size === 0 && resourcePrefixes.length === 0)
    ) {
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
      if (r == null || r === '') return;
      const name = String(r);
      if (resourceSet.has(name) || resourcePrefixes.some((prefix) => name.startsWith(prefix))) {
        schedule();
      }
    });
  }, [subscribe, enabled, resourceSet, resourcePrefixes]);

  useEffect(
    () => () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    },
    [],
  );
}
