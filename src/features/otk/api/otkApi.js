import { apiClient } from '../../../shared/api';
import { parseApiListResponse } from '../../../shared/lib/apiList';

const isEndpointMissing = (err) => err?.response?.status === 404 || err?.response?.status === 405;
const normalizeList = (data) => ({
  items: parseApiListResponse(data),
  meta: data?.meta ?? null,
  links: data?.links ?? null,
});

const BATCH_ID_CHUNK = 40;

/**
 * Партии по списку id (для догрузки карточек в очереди ОТК; ожидаются партии ProductionBatch).
 * Ожидается фильтр DRF/django-filter: `id__in` со списком через запятую.
 * Если бэк не поддерживает — согласовать фильтр очереди ОТК с бэкендом.
 */
export const fetchBatchesByIds = async (ids, signal) => {
  const uniq = [...new Set((ids || []).map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (uniq.length === 0) return [];
  const all = [];
  for (let i = 0; i < uniq.length; i += BATCH_ID_CHUNK) {
    const chunk = uniq.slice(i, i + BATCH_ID_CHUNK);
    const res = await apiClient.get('batches/', {
      params: {
        id__in: chunk.join(','),
        page_size: chunk.length,
      },
      signal,
    });
    const { items } = normalizeList(res.data);
    all.push(...items);
  }
  return all;
};

export const getBatchesAwaitingOtk = async ({ query = {}, signal } = {}) => {
  try {
    const res = await apiClient.get('otk/pending/', { params: query, signal });
    return normalizeList(res.data);
  } catch (err) {
    if (!isEndpointMissing(err)) throw err;
    const res = await apiClient.get('batches/', { params: query, signal });
    return normalizeList(res.data);
  }
};

export const getOtkHistory = async ({ query = {}, signal } = {}) => {
  const res = await apiClient.get('batches/', { params: query, signal });
  return normalizeList(res.data);
};

/**
 * Сохранить результат проверки ОТК: POST /api/batches/{id}/otk_accept/
 * `otk_accepted` / `otk_defect` — строки с целыми числами (брак может быть «0»): так DRF всё равно
 * приводит к int, а проверки вида `if not request.data.get('otk_defect')` не путают ноль с «не передано».
 */
export const acceptBatch = (batchId, data) => {
  const accepted = Math.trunc(Number(data.accepted));
  const defect = Math.trunc(Number(data.rejected ?? 0));
  const accOk = Number.isFinite(accepted) && accepted >= 0;
  const defOk = Number.isFinite(defect) && defect >= 0;
  if (!accOk || !defOk) {
    return Promise.reject(new Error('Некорректные количества принято / брак'));
  }
  const status = defect > 0 && accepted === 0 ? 'rejected' : 'accepted';
  const body = {
    otk_accepted: String(accepted),
    otk_defect: String(defect),
    accepted,
    rejected: defect,
    otk_status: status,
  };
  if (data.rejectReason != null && String(data.rejectReason).trim() !== '') {
    body.otk_defect_reason = String(data.rejectReason).trim();
  }
  if (data.comment != null && String(data.comment).trim() !== '') {
    body.otk_comment = String(data.comment).trim();
  }
  if (data.inspectorId != null && data.inspectorId !== '') {
    body.otk_inspector = data.inspectorId;
  }
  if (data.inspectorName != null && String(data.inspectorName).trim() !== '') {
    body.otk_inspector_name = String(data.inspectorName).trim();
  }
  if (data.checkedAt != null && String(data.checkedAt).trim() !== '') {
    body.otk_checked_at = String(data.checkedAt).trim();
  }
  return apiClient.post(`batches/${batchId}/otk_accept/`, body);
};
