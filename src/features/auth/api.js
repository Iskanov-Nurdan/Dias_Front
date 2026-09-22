import { apiClient } from '../../shared/api/client';

/** POST /api/auth/login, тело { name, password } — DIAS_ERP логинит по полю name (не email/username). */
export const login = async (loginData, signal) => {
  const { data } = await apiClient.post('/auth/login', { name: loginData.login, password: loginData.password }, { signal });
  return data;
};

/** GET /api/me — текущий пользователь по токену: роль/доступы читаются заново на
 * сервере, а не доверяются кэшу в localStorage (там могли остаться права, отозванные
 * после последнего логина). Ответ: { user: {...}, accesses: [...] }. */
export const fetchMe = async (signal) => {
  const { data } = await apiClient.get('/me', { signal });
  return data;
};

/** POST /api/auth/logout — выход. Требует Authorization. Refresh уходит в blacklist. */
export const logout = async (refreshToken, signal) => {
  const { data } = await apiClient.post('/auth/logout', { refresh: refreshToken }, { signal });
  return data;
};
