import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/roles/ — query: search (поиск по названию, серверная фильтрация) */
export const fetchRoles = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/roles/', { params, ...withSignal({}, signal) });
  return data;
};

/** GET /api/employees/ — query: search (fio, phone, login), role_id, page, perPage */
export const fetchEmployees = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.roleId != null && queryState.roleId !== '') params.role_id = queryState.roleId;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.perPage = queryState.perPage;
  const { data } = await apiClient.get('/employees/', { params, ...withSignal({}, signal) });
  return data;
};

/** Тело POST/PATCH: login, fio, password (обязательны при создании), phone, roleId (опц.). roleId — число или null. */
const toEmployeeBody = (payload, isCreate) => {
  const b = {};
  if (payload.fio != null && payload.fio !== '') b.fio = payload.fio;
  if (payload.login != null && payload.login !== '') b.login = payload.login;
  if (payload.phone != null && payload.phone !== '') b.phone = payload.phone;
  if (payload.password != null && payload.password !== '') b.password = payload.password;
  if (payload.roleId != null && payload.roleId !== '') {
    b.roleId = Number(payload.roleId) || payload.roleId;
  } else if (isCreate) {
    b.roleId = null;
  }
  return b;
};

export const createEmployee = async (body, signal) => {
  const b = toEmployeeBody(body, true);
  if (!b.login || !b.fio || !body.password) {
    return Promise.reject(new Error('Обязательные поля: логин, ФИО, пароль'));
  }
  const { data } = await apiClient.post('/employees/', b, withSignal({}, signal));
  return data;
};

export const updateEmployee = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/employees/${id}/`, toEmployeeBody(body, false), withSignal({}, signal));
  return data;
};

export const deleteEmployee = async (id, signal) => {
  await apiClient.delete(`/employees/${id}/`, withSignal({}, signal));
};

export const fetchEmployeeAccess = async (id, signal) => {
  const res = await apiClient.get(`/employees/${id}/access/`, withSignal({}, signal));
  const data = res?.data ?? res;
  return data?.data ?? data;
};

/** PUT тело: { access: { pageId: true/false, ... } } */
export const updateEmployeeAccess = async (id, access, signal) => {
  const { data } = await apiClient.put(`/employees/${id}/access/`, { access }, withSignal({}, signal));
  return data;
};

/** POST тело: { name: "Название роли" } */
export const createRole = async (body, signal) => {
  const { data } = await apiClient.post('/roles/', { name: body?.name ?? body }, withSignal({}, signal));
  return data;
};

export const updateRole = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/roles/${id}/`, body, withSignal({}, signal));
  return data;
};

export const deleteRole = async (id, signal) => {
  await apiClient.delete(`/roles/${id}/`, withSignal({}, signal));
};
