import axios from 'axios';

// --- Выбор API: меняй когда нужно ---
// true  = запросы на локальный бэкенд (127.0.0.1:8000)
// false = запросы на бэкенд по домену (rahmanata.tw1.su)
const USE_LOCAL_API = false;

// В dev (npm start) используем прокси — запросы идут на localhost, CRA проксирует на сервер (обход CORS)
const isDev = process.env.NODE_ENV === 'development';
const API_BASE = USE_LOCAL_API
  ? 'http://127.0.0.1:8000/api'
  : isDev
    ? '/api'
    : 'https://rahmanata.tw1.su/api';

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

const clearAuth = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {}
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
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname || '';
      if (!path.startsWith('/login')) {
        clearAuth();
        window.location.replace('/login');
      }
    }
    if (err.message === 'Network Error' || !err.response) {
      err.userMessage = 'Нет соединения с сервером';
    }
    return Promise.reject(err);
  }
);

/**
 * Abort-safe fetch: pass signal from AbortController.
 * On unmount or new request, abort previous. Use requestId to ignore stale responses.
 */
export const createAbortSafeRequest = () => {
  let controller = null;
  let lastRequestId = 0;

  const getSignal = () => {
    if (controller) controller.abort();
    controller = new AbortController();
    return { signal: controller.signal, requestId: ++lastRequestId };
  };

  const request = async (fn) => {
    const { signal, requestId } = getSignal();
    try {
      const result = await fn(signal);
      return { result, requestId };
    } catch (e) {
      if (e.name === 'AbortError') return { aborted: true, requestId };
      throw e;
    }
  };

  const abort = () => {
    if (controller) controller.abort();
  };

  return { request, getSignal, abort };
};
