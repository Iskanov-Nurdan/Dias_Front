import { apiClient } from '../../../shared/api';

export const login = async (name, password) => {
  const res = await apiClient.post('auth/login', { name, password });
  return res.data;
};

/** POST /api/auth/logout — тело `{ refresh }` для блэклиста refresh-токена (см. API бэка). */
export const logout = async () => {
  const refresh = localStorage.getItem('refresh');
  try {
    if (refresh) {
      await apiClient.post('auth/logout', { refresh });
    }
  } catch {
    // Logout may fail if token expired; still clear local state
  }
};

export const getMe = async () => {
  const res = await apiClient.get('me');
  return res.data;
};
