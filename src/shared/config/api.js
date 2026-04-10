const DEFAULT_API_BASE = 'https://api.diass.tw1.ru/api/';
const DEFAULT_WS_URL = 'wss://api.diass.tw1.ru/ws/';

const normalizeBase = (value, fallback) => {
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  // Prevent mixed-content failures when the app is served over HTTPS.
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    (raw.startsWith('http://') || raw.startsWith('ws://'))
  ) {
    return fallback;
  }

  return raw.replace(/\/+$/, '') + '/';
};

export const API_BASE = normalizeBase(
  process.env.REACT_APP_API_URL,
  DEFAULT_API_BASE
);

export const WS_URL = normalizeBase(
  process.env.REACT_APP_WS_URL,
  DEFAULT_WS_URL
);
