import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

// ─── Лиды ───────────────────────────────────────────────────────────────────

/** GET /api/leads/ — query: search, status, channel, stageId, page, perPage, date_from, date_to */
export const fetchLeads = async (queryState, signal) => {
  const params = {};
  if (queryState?.search)     params.search     = queryState.search;
  if (queryState?.status)     params.status     = queryState.status;
  if (queryState?.channel)    params.channel    = queryState.channel;
  if (queryState?.stageId)    params.stageId    = queryState.stageId;
  if (queryState?.page)       params.page       = queryState.page;
  if (queryState?.perPage)    params.perPage    = queryState.perPage;
  if (queryState?.date_from)  params.date_from  = queryState.date_from;
  if (queryState?.date_to)    params.date_to    = queryState.date_to;
  const { data } = await apiClient.get('/leads/', { params, ...withSignal({}, signal) });
  return data;
};

export const fetchLead = async (id, signal) => {
  const { data } = await apiClient.get(`/leads/${id}/`, withSignal({}, signal));
  return data;
};

export const createLead = async (body, signal) => {
  const { data } = await apiClient.post('/leads/', body, withSignal({}, signal));
  return data;
};

/**
 * PATCH /api/leads/:id/
 * Поддерживает все поля карточки:
 *   name, phone, channel, status,
 *   source, targetType (adult|children),
 *   sportId, trainerId,
 *   trialStatus, resultStatus,
 *   amount, comment,
 *   stageId (null = убрать из воронки)
 */
export const updateLead = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/leads/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteLead = async (id, signal) => {
  await apiClient.delete(`/leads/${id}/`, withSignal({}, signal));
};

// ─── Этапы воронки ───────────────────────────────────────────────────────────

/** GET /api/leads/funnel-stages/ — список этапов, отсортированных по order */
export const fetchFunnelStages = async (signal) => {
  const { data } = await apiClient.get('/leads/funnel-stages/', withSignal({}, signal));
  return data;
};
