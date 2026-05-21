import { apiClient } from '../../../shared/api';

/** GET/POST /api/plastic-profiles/ */
export const getPlasticProfiles = (params) => apiClient.get('plastic-profiles/', { params });
export const getPlasticProfile = (id) => apiClient.get(`plastic-profiles/${id}/`);
export const createPlasticProfile = (data) => apiClient.post('plastic-profiles/', data);
export const updatePlasticProfile = (id, data) => apiClient.patch(`plastic-profiles/${id}/`, data);
export const deletePlasticProfile = (id) => apiClient.delete(`plastic-profiles/${id}/`);

/**
 * Партии производства (ProductionBatch): POST /api/batches/ — legacy, не вкладка «Заявки».
 * Старт по заявке: только production/requests/{id}/start/ с blank(s), без line.
 */
export const getProductionBatches = (params) => apiClient.get('batches/', { params });
export const getProductionBatch = (id) => apiClient.get(`batches/${id}/`);
export const createProductionBatch = (data) => apiClient.post('batches/', data);
export const updateProductionBatch = (id, data) => apiClient.patch(`batches/${id}/`, data);
export const deleteProductionBatch = (id) => apiClient.delete(`batches/${id}/`);

/**
 * Передать партию в очередь ОТК. Тело пустое.
 */
export const submitProductionBatchForOtk = (id) =>
  apiClient.post(`batches/${id}/submit-for-otk/`, {});

export const getProductionReadyRequests = (params) => apiClient.get('production/requests/', { params });

/**
 * Старт по заявке: одна позиция — legacy `{ blank }` или `{ order_line_id, blank }`.
 * Несколько позиций — `{ line_starts: [{ order_line_id, blank }, …] }` → отдельный BlankProductionRun на каждый профиль в ОТК.
 *
 * @param {number|string} id — id заявки
 * @param {{ orderLineId?: number|null, blankId: number }[]} lineStarts
 */
export const startProductionRequest = (id, lineStarts) => {
  const rows = (Array.isArray(lineStarts) ? lineStarts : [])
    .map((row) => ({
      orderLineId: row?.orderLineId != null ? Number(row.orderLineId) : null,
      profileId: row?.profileId != null ? Number(row.profileId) : null,
      blankId: Number(row?.blankId ?? row?.blank),
    }))
    .filter((row) => Number.isFinite(row.blankId) && row.blankId > 0);

  if (!rows.length) {
    return Promise.reject(new Error('blank required'));
  }

  if (rows.length === 1) {
    const one = rows[0];
    const body = { blank: one.blankId };
    if (one.orderLineId != null && Number.isFinite(one.orderLineId)) {
      body.order_line_id = one.orderLineId;
    }
    return apiClient.post(`production/requests/${id}/start/`, body);
  }

  return apiClient.post(`production/requests/${id}/start/`, {
    line_starts: rows.map((row) => {
      const item = { blank: row.blankId };
      if (row.orderLineId != null && Number.isFinite(row.orderLineId)) {
        item.order_line_id = row.orderLineId;
      } else if (row.profileId != null && Number.isFinite(Number(row.profileId))) {
        item.profile_id = Number(row.profileId);
      }
      return item;
    }),
  });
};
