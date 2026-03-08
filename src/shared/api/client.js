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

    if (err.response?.status === 403) {
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
