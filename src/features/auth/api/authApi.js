import { apiClient } from '../../../shared/api';

// LOGIN
export const login = async (name, password) => {
  const res = await apiClient.post('auth/login/', {
    name,
    password,
  });

  // сохраняем токены
  if (res.data.access) {
    localStorage.setItem('access', res.data.access);
  }
  if (res.data.refresh) {
    localStorage.setItem('refresh', res.data.refresh);
  }

  return res.data;
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

  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
};

// GET CURRENT USER
export const getMe = async () => {
  const res = await apiClient.get('auth/me/');
  return res.data;
};