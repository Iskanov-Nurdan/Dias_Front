import { useCallback, useEffect, useState } from 'react';

/** Линии продукта, между которыми переключаются профильные страницы. */
export const PRODUCT_LINE = {
  PROFILE: 'profile',
  FOAM: 'foam',
};

const STORAGE_KEY = 'dias_product_line';

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === PRODUCT_LINE.FOAM
      ? PRODUCT_LINE.FOAM
      : PRODUCT_LINE.PROFILE;
  } catch {
    return PRODUCT_LINE.PROFILE;
  }
};

/**
 * Общий выбор линии продукта (Профиль/Пенопласт).
 * Хранится в localStorage, чтобы переключение оставалось согласованным
 * при переходе между разделами (Сырьё → Заготовка → Производство → ОТК → Склад).
 */
export function useProductLine() {
  const [line, setLineState] = useState(readStored);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setLineState(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLine = useCallback((next) => {
    setLineState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  return [line, setLine];
}
