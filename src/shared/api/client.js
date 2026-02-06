import axios from 'axios';

const API_BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://rahman.tw1.su/api'
    : 'http://127.0.0.1:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.hash = '#/login';
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
