import { apiClient } from '../../../shared/api';

// LOGIN
export const login = async (name, password) => {
  const res = await apiClient.post('auth/login/', {
    name,
    password,
  });
  const token = res.data.token || res.data.access || null;

  return {
    ...res.data,
    token,
    refresh: res.data.refresh || null,
  };
};

// LOGOUT
export const logout = async () => {
  const refresh = localStorage.getItem('refresh');

  try {
    if (refresh) {
      await apiClient.post('auth/logout/', { refresh });
    }
  } catch (e) {
    // игнор ошибки
  }

  localStorage.removeItem('token');
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
};

// GET CURRENT USER
export const getMe = async () => {
  const res = await apiClient.get('auth/me/');
  return res.data;
};
