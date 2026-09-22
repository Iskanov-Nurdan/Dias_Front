import { useCallback, useEffect, useState } from 'react';

export const PRODUCT_LINE = { PROFILE: 'profile', FOAM: 'foam' };

const STORAGE_KEY = 'dias_product_line';

const readStored = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === PRODUCT_LINE.FOAM ? PRODUCT_LINE.FOAM : PRODUCT_LINE.PROFILE;
  } catch {
    return PRODUCT_LINE.PROFILE;
  }
};

/**
 * Переключатель «Пластиковый профиль / Пенополистирол» — общий на Сырьё,
 * Производство, Склад и Кассу (см. ProductLineTabs). У Foam нет своих
 * Заготовки/Цеха/ОТК — бэкенд apps.foam короче apps.workshop, поэтому
 * переключатель встроен только в эти 4 страницы, а не глобально в layout.
 * localStorage, а не React-контекст: значение должно быть одинаковым сразу
 * при первом рендере любой из четырёх страниц, без лишнего провайдера наверху.
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
      /* ignore */
    }
  }, []);

  return [line, setLine];
}
