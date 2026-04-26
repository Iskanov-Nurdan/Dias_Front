/**
 * Массив записей из ответа списка ModelViewSet: только `data.items` (см. StandardResultsSetPagination).
 */
export function parseApiListResponse(data) {
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  return [];
}
