import { apiClient } from '../../shared/api/client';

/** POST /api/auth/ или /api/auth/login, тело { login, password } */
export const login = async (loginData, signal) => {
  const { data } = await apiClient.post('/auth/', { login: loginData.login, password: loginData.password }, { signal });
  return data;
};

/** GET /api/auth/me — текущий пользователь по токену: роль/доступы читаются заново на
 * сервере, а не доверяются кэшу в localStorage (там могли остаться права, отозванные
 * после последнего логина). */
export const fetchMe = async (signal) => {
  const { data } = await apiClient.get('/auth/me', { signal });
  return data;
};

// Обновление access-токена делает интерцептор в shared/api/client.js — отдельная
// функция здесь никем не вызывалась и только вводила в заблуждение.

/** POST /api/auth/logout — выход. Требует Authorization. Refresh уходит в blacklist. */
export const logout = async (refreshToken, signal) => {
  const { data } = await apiClient.post('/auth/logout', { refresh: refreshToken }, { signal });
  return data;
};
