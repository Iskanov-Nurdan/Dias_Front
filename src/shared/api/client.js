import axios from 'axios';
import { isForbiddenError } from '../lib/apiError';

// --- Выбор API: меняй когда нужно ---
// true  = запросы на локальный бэкенд DIAS_ERP (127.0.0.1:8000) 
// false = запросы на прод-бэкенд DIAS_ERP (см. REACT_APP_API_URL)
const USE_LOCAL_API =true;


// Taplink использует бэкенд (а не localStorage).
// false = демо-режим (только localStorage, без сервера)
export const TAPLINK_BACKEND_ENABLED = true;

// Запросы всегда идут напрямую по абсолютному URL (не через CRA-прокси из
// package.json "proxy" — тот был мёртвым хвостом от старого проекта и
// перебивал собой USE_LOCAL_API в dev-режиме). CORS на стороне DIAS_ERP
// должен разрешать Origin фронта (CORS_ALLOWED_ORIGINS) — и localhost:3000
// для dev, и прод-домен фронта.
const PROD_API_URL = 'https://diass.tw1.ru/api';
const API_BASE = USE_LOCAL_API
  ? 'http://127.0.0.1:8000/api'
  : (process.env.REACT_APP_API_URL || PROD_API_URL);

// withCredentials не нужен: авторизация у DIAS_ERP через JWT в заголовке
// Authorization, не через cookie. С withCredentials:true браузер требует от
// сервера Access-Control-Allow-Credentials:true на каждый CORS-ответ, а
// corsheaders в DIAS_ERP это не отдаёт (CORS_ALLOW_CREDENTIALS не включён) —
// preflight падал именно поэтому.
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

const getToken = () => {
  try {
    return localStorage.getItem('token');
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

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// DIAS_ERP не отдаёт /api/auth/refresh (access-токен живёт 24ч) — вместо
// очереди рефреша просто разлогиниваем по первому 401, кроме самой /login.
apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.message === 'Network Error' || !err.response) {
      err.userMessage = 'Нет соединения с сервером';
      return Promise.reject(err);
    }

    if (isForbiddenError(err)) {
      err.userMessage = err.response?.data?.detail ?? err.response?.data?.error ?? 'Нет доступа';
      return Promise.reject(err);
    }

    if (err.response?.status === 401) {
      const path = window.location.pathname || '';
      if (!path.startsWith('/login')) {
        clearAuth();
        window.location.replace('/login');
      }
    }

    return Promise.reject(err);
  }
);
