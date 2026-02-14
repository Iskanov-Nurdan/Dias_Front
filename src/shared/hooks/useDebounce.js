import { useState, useEffect } from 'react';
import { SEARCH_DEBOUNCE_MS } from '../constants/common';

/**
 * Возвращает значение с задержкой. Для поиска: value — текущий ввод, debouncedValue — то, что уходит в API.
 * @param {*} value — значение
 * @param {number} [delay] — задержка в мс
 * @returns {*} debouncedValue
 */
export function useDebounce(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Для поисковых полей: возвращает [localValue, setLocalValue, debouncedValue].
 * В API/фильтр передавать debouncedValue.
 */
export function useDebouncedSearch(initialValue = '') {
  const [localValue, setLocalValue] = useState(initialValue);
  const debouncedValue = useDebounce(localValue);
  return [localValue, setLocalValue, debouncedValue];
}
