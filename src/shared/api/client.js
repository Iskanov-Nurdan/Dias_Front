import axios from 'axios';
import { isForbiddenError } from '../lib/apiError';

// --- Выбор API: меняй когда нужно ---
// true  = запросы на локальный бэкенд (127.0.0.1:8000)
// false = запросы на бэкенд по домену (rahmanata.kg)
const USE_LOCAL_API = true;

// Taplink использует бэкенд (а не localStorage).
// false = демо-режим (только localStorage, без сервера)
export const TAPLINK_BACKEND_ENABLED = true;

// В dev (npm start) используем прокси — запросы идут на localhost, CRA проксирует на сервер (обход CORS)
const isDev = process.env.NODE_ENV === 'development';
const API_BASE = USE_LOCAL_API
  ? 'http://127.0.0.1:8000/api'
  : isDev
    ? '/api'
    : 'https://rahmanata.kg/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

const getToken = () => {
  try {
    return localStorage.getItem('token');
  } catch {
    return null;
  }
};

const getRefreshToken = () => {
  try {
    return localStorage.getItem('refresh');
  } catch {
    return null;
  }
};

/** Очистить токены и user (для logout) */
export const clearAuth = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
  } catch {}
};

/** Сохранить токены (для login). refresh — опционально. */
export const setAuthTokens = (access, refresh) => {
  try {
    if (access) localStorage.setItem('token', access);
    if (refresh != null) localStorage.setItem('refresh', refresh);
  } catch {}
};

const setTokens = (access, refresh) => {
  setAuthTokens(access, refresh);
};

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const onRefreshFailed = () => {
  refreshSubscribers.forEach((cb) => cb(null));
  refreshSubscribers = [];
};

const tryRefreshToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_BASE.replace(/\/api$/, '')}/api/auth/refresh`, { refresh }, {
      headers: { 'Content-Type': 'application/json' },
    });
    const access = data?.access ?? data?.token;
    if (access) {
      setTokens(access, null);
      return access;
    }
    return null;
  } catch {
    return null;
  }
};

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    const originalRequest = err.config;

    if (err.message === 'Network Error' || !err.response) {
      err.userMessage = 'Нет соединения с сервером';
      return Promise.reject(err);
    }

    if (isForbiddenError(err)) {
      err.userMessage = err.response?.data?.error?.message ?? 'Нет доступа';
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !originalRequest._retry) {
      const path = window.location.pathname || '';
      if (path.startsWith('/login')) return Promise.reject(err);

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            } else {
              resolve(Promise.reject(err));
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const newToken = await tryRefreshToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      onRefreshFailed();
      clearAuth();
      window.location.replace('/login');
      return Promise.reject(err);
    }

    return Promise.reject(err);
  }
);
