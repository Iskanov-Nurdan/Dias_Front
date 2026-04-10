import { API_BASE, WS_URL } from '../config/api';

/** /ws/operational/?token=… — см. docs/WEBSOCKET_API.md */
export function buildOperationalWsUrl(accessToken, apiBaseUrl = API_BASE, wsBase = WS_URL) {
  const token = encodeURIComponent(accessToken || '');
  if (wsBase && String(wsBase).trim()) {
    const normalizedBase = String(wsBase).replace(/\/+$/, '');
    const base = /\/operational$/i.test(normalizedBase)
      ? normalizedBase
      : `${normalizedBase}/operational`;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}token=${token}`;
  }
  const raw = (apiBaseUrl || API_BASE).replace(/\/$/, '');
  try {
    const u = new URL(raw.endsWith('/api') ? `${raw}/` : raw);
    const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${u.host}/ws/operational/?token=${token}`;
  } catch {
    return `ws://127.0.0.1:8000/ws/operational/?token=${token}`;
  }
}
