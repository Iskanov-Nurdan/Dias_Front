import { apiClient } from '../../shared/api/client';

const withSignal = (config, signal) => (signal ? { ...config, signal } : config);

/** GET /api/roles/ — query: search (поиск по названию, серверная фильтрация) */
export const fetchRoles = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  const { data } = await apiClient.get('/roles/', { params, ...withSignal({}, signal) });
  return data;
};

/** GET /api/users/ — query: search (name, email), role (id), page, page_size */
export const fetchEmployees = async (queryState, signal) => {
  const params = {};
  if (queryState?.search) params.search = queryState.search;
  if (queryState?.roleId != null && queryState.roleId !== '') params.role = queryState.roleId;
  if (queryState?.page) params.page = queryState.page;
  if (queryState?.perPage) params.page_size = queryState.perPage;
  const { data } = await apiClient.get('/users/', { params, ...withSignal({}, signal) });
  return data;
};

/**
 * Тело POST/PATCH: name (это же логин — единое поле у DIAS_ERP, отдельного login
 * там нет), password (обязателен при создании), role (id роли или null).
 */
const toEmployeeBody = (payload) => {
  const b = {};
  if (payload.name != null && payload.name !== '') b.name = payload.name;
  if (payload.password != null && payload.password !== '') b.password = payload.password;
  if (payload.roleId != null && payload.roleId !== '') {
    b.role = Number(payload.roleId) || payload.roleId;
  } else {
    b.role = null;
  }
  return b;
};

export const createEmployee = async (body, signal) => {
  const b = toEmployeeBody(body);
  if (!b.name || !body.password) {
    return Promise.reject(new Error('Обязательные поля: имя, пароль'));
  }
  const { data } = await apiClient.post('/users/', b, withSignal({}, signal));
  return data;
};

export const updateEmployee = async (id, body, signal) => {
  const { data } = await apiClient.patch(`/users/${id}/`, toEmployeeBody(body), withSignal({}, signal));
  return data;
};

export const deleteEmployee = async (id, signal) => {
  await apiClient.delete(`/users/${id}/`, withSignal({}, signal));
};

/**
 * PATCH тело: { access_keys: ['users','chemistry',...] } — полная замена набора
 * ключей доступа этого сотрудника (см. shared/constants/accessKeys.js). Нет отдельного
 * GET-эндпоинта для чтения доступов одного сотрудника — они уже приходят как
 * accesses в самом объекте пользователя (список/create/update), поэтому отдельного
 * fetchEmployeeAccess здесь больше нет.
 */
export const updateEmployeeAccess = async (id, accessKeys, signal) => {
  const { data } = await apiClient.patch(`/users/${id}/access/`, { access_keys: accessKeys }, withSignal({}, signal));
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
