import { useState } from 'react';
import { useDebounce } from './useDebounce';
import { SEARCH_DEBOUNCE_MS } from '../constants/common';

export const useDebouncedSearch = (initial = '', delay = SEARCH_DEBOUNCE_MS) => {
  const [localValue, setLocalValue] = useState(initial);
  const debouncedValue = useDebounce(localValue, delay);
  return [localValue, setLocalValue, debouncedValue];
};
