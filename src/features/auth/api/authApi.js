import { apiClient } from '../../../shared/api';

// LOGIN
export const login = async (name, password) => {
  const res = await apiClient.post('auth/login/', {
    name,
    username: name,
    password,
  });
  const access = res.data.access || res.data.token || null;
  const refresh = res.data.refresh || null;

  if (access) {
    localStorage.setItem('token', access);
    localStorage.setItem('access', access);
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('access');
  }

  if (refresh) {
    localStorage.setItem('refresh', refresh);
  } else {
    localStorage.removeItem('refresh');
  }

  return {
    ...res.data,
    token: access,
    access,
    refresh,
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
