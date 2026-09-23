import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dias_pos_parked_carts_v1';
// Отложенные чеки старше суток — почти наверняка забытые, не мусорим ими
// список; сама смена кассира тоже их не переживает (см. clearParkedForShift).
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const readAll = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    return list.filter((c) => now - (c.createdAt || 0) < MAX_AGE_MS);
  } catch {
    return [];
  }
};

const writeAll = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore — квота/приватный режим, отложенные чеки не критичны для работы кассы */
  }
};

/**
 * Отложенные чеки кассы — намеренно НЕ на бэкенде. Чекаут в apps.sales —
 * один атомарный POST, который сразу списывает склад и создаёт оплату
 * (см. SaleSerializer.create); полноценного «черновика без последствий»
 * там нет. Поэтому отложенный чек — это просто корзина в localStorage
 * этого браузера, которая ничего не резервирует на складе. Из-за этого при
 * восстановлении чек обязан быть пере-провалидирован (актуальные остатки/
 * цены) перед оплатой — это ответственность RegisterModal, не этого хука.
 */
export function useParkedCarts() {
  const [carts, setCarts] = useState(readAll);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setCarts(readAll());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // writeAll вызывается СИНХРОННО здесь, а не внутри апдейтера setCarts —
  // раньше park() запускался прямо перед onClose(), который в том же тике
  // размонтирует RegisterModal (и с ним этот хук); React в такой ситуации
  // может не докоммитить функциональный апдейтер setState для фибера,
  // который тут же убирают из дерева — из-за этого запись в localStorage
  // иногда просто не происходила («Чек отложен» показывался, а список
  // отложенных оставался пустым). Прямой вызов writeAll — обычный побочный
  // эффект, не зависящий от того, коммитит ли React это состояние.
  const park = useCallback((cart) => {
    const prev = readAll();
    const id = cart.id || `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [...prev.filter((c) => c.id !== id), { ...cart, id, createdAt: cart.createdAt || Date.now() }];
    writeAll(next);
    setCarts(next);
  }, []);

  const remove = useCallback((id) => {
    const next = readAll().filter((c) => c.id !== id);
    writeAll(next);
    setCarts(next);
  }, []);

  return { carts, park, remove };
}
