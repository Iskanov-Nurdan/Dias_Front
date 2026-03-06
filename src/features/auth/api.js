import { apiClient } from '../../shared/api/client';

/** POST /api/auth/ или /api/auth/login, тело { login, password } */
export const login = async (loginData, signal) => {
  const { data } = await apiClient.post('/auth/', { login: loginData.login, password: loginData.password }, { signal });
  return data;
};

/** POST /api/auth/refresh — обновить access token. Не требует Authorization. */
export const refreshToken = async (refresh, signal) => {
  const { data } = await apiClient.post('/auth/refresh', { refresh }, { signal });
  return data;
};

/** POST /api/auth/logout — выход. Требует Authorization. Refresh уходит в blacklist. */
export const logout = async (refreshToken, signal) => {
  const { data } = await apiClient.post('/auth/logout', { refresh: refreshToken }, { signal });
  return data;
};
