import { apiClient } from '../../../shared/api';

const isEndpointMissing = (err) => err?.response?.status === 404 || err?.response?.status === 405;
const normalizeList = (data) => ({
  items: data?.items ?? data?.results ?? [],
  meta: data?.meta ?? null,
  links: data?.links ?? null,
});

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
 * Бэкенд: OtkCheck, batch.otk_status (accepted/rejected), при принятом > 0 — запись на склад ГП.
 */
export const acceptBatch = (batchId, data) =>
  apiClient.post(`batches/${batchId}/otk_accept/`, {
    otk_accepted: data.accepted,
    otk_defect: data.rejected ?? 0,
    otk_defect_reason: data.rejectReason || null,
    otk_comment: data.comment || null,
    otk_status: (data.rejected > 0 && data.accepted === 0 ? 'rejected' : 'accepted'),
    otk_inspector: data.inspectorId || null,
    otk_checked_at: new Date().toISOString(),
  });
