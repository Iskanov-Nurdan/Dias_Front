import axios from 'axios';
import { API_BASE } from '../config/api';
import { getAuditShiftId } from '../lib/auditContext';
import { isAuditShiftMutation } from '../lib/auditShiftRoutes';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
});

function ensureRequestId(config) {
  const method = (config.method || 'get').toLowerCase();
  const mutating = method === 'post' || method === 'put' || method === 'patch' || method === 'delete';
  if (!mutating) return;
  const h = config.headers;
  const has =
    (h['X-Request-Id'] ?? h['x-request-id']) ||
    (h['X-Correlation-Id'] ?? h['x-correlation-id']);
  if (has) return;
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  h['X-Request-Id'] = id.slice(0, 64);
}

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const shiftId = getAuditShiftId();
  if (shiftId) {
    const h = config.headers;
    const hasAuditHeader =
      (h['X-Audit-Shift-Id'] ?? h['x-audit-shift-id']) ||
      (h['X-Shift-Id'] ?? h['x-shift-id']);
    if (
      !hasAuditHeader &&
      isAuditShiftMutation(config.url, config.method, config.baseURL || API_BASE)
    ) {
      config.headers['X-Audit-Shift-Id'] = shiftId;
      config.headers['X-Shift-Id'] = shiftId;
    }
  }
  ensureRequestId(config);
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
      return Promise.reject(err);
    }

    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    if (err.response?.status === 403) {
      const enhanced = { ...err };
      enhanced.userMessage = 'Нет доступа к этому ресурсу.';
      return Promise.reject(enhanced);
    }

    if (err.response?.status === 409) {
      const enhanced = { ...err };
      const d = err.response?.data;
      const detail =
        d && typeof d === 'object'
          ? (typeof d.detail === 'string' ? d.detail : typeof d.error === 'string' ? d.error : null)
          : null;
      enhanced.userMessage =
        detail ||
        'Конфликт состояния (например, уже открыта смена — см. POST /shifts/open/ и /lines/{id}/open/).';
      return Promise.reject(enhanced);
    }

    if (err.response?.status === 429) {
      const enhanced = { ...err };
      const d = err.response?.data;
      let msg =
        d && typeof d === 'object'
          ? (typeof d.detail === 'string' ? d.detail : typeof d.error === 'string' ? d.error : null)
          : null;
      if (!msg) msg = 'Слишком много запросов. Подождите немного.';
      const w = d && typeof d === 'object' && d.wait != null && Number.isFinite(Number(d.wait))
        ? ` Повторите через ${Math.ceil(Number(d.wait))} с.`
        : '';
      enhanced.userMessage = `${msg}${w}`;
      return Promise.reject(enhanced);
    }

    if (!err.response && err.request) {
      const enhanced = { ...err };
      enhanced.userMessage = 'Нет соединения с сервером. Проверьте интернет.';
      return Promise.reject(enhanced);
    }

    return Promise.reject(err);
  }
);

export default client;
