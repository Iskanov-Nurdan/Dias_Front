/**
 * Массив записей из ответа списка API.
 * Поддерживается «стандарт DIAS»: `items`, и DRF-пейджинг: `results`.
 */
export function parseApiListResponse(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/** meta из ответа или усечённый DRF (count / next / previous). */
export function parseApiListMeta(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.meta != null && typeof data.meta === 'object') return data.meta;
  if (data.count != null || data.next != null || data.previous != null) {
    return {
      count: data.count,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  }
  return null;
}
