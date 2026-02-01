import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

export const fetchRoles = async (signal) => {
  const { data } = await apiClient.get('/roles/', withSignal({}, signal));
  return data;
};

/** ТЗ: GET /api/employees/ — query: search, roleId, page, perPage (camelCase) */
export const fetchEmployees = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.roleId) params.roleId = queryState.roleId;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/employees/', { params, ...withSignal({}, signal) });
  return data;
};

export const fetchEmployee = async (id, signal) => {
  const { data } = await apiClient.get(`/employees/${id}/`, withSignal({}, signal));
  return data;
};

export const createEmployee = async (body, signal) => {
  const { data } = await apiClient.post('/employees/', body, withSignal({}, signal));
  return data;
};

export const updateEmployee = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/employees/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteEmployee = async (id, signal) => {
  await apiClient.delete(`/employees/${id}/`, withSignal({}, signal));
};

export const fetchEmployeeAccess = async (id, signal) => {
  const { data } = await apiClient.get(`/employees/${id}/access/`, withSignal({}, signal));
  return data;
};

export const updateEmployeeAccess = async (id, access, signal) => {
  const { data } = await apiClient.put(`/employees/${id}/access/`, access, withSignal({}, signal));
  return data;
};

export const createRole = async (body, signal) => {
  const { data } = await apiClient.post('/roles/', body, withSignal({}, signal));
  return data;
};

export const updateRole = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/roles/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteRole = async (id, signal) => {
  await apiClient.delete(`/roles/${id}/`, withSignal({}, signal));
};
