/**
 * Достаёт массив записей из ответа списка API.
 * Поддержка: `{ items }` (контракт фронта), `{ results }` (Django REST PageNumberPagination), сырой массив.
 */
export function parseApiListResponse(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
}
