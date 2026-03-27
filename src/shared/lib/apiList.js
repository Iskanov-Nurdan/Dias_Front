/**
 * Достаёт массив записей из ответа списка API.
 * Контракт бэка (StandardResultsSetPagination): только **`items`** + `meta` + `links` — см. docs/DIAS_BACKEND_CONTRACT.md.
 */
export function parseApiListResponse(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.items)) return data.items;
  return [];
}
