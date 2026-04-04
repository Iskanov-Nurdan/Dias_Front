const isProd =
  window.location.hostname.includes('nur.tw1.ru');

const DEFAULT_API = isProd
  ? 'https://nur.tw1.ru/api/'
  : 'http://72.56.244.50/api/';

export const API_BASE = (
  process.env.REACT_APP_API_URL || DEFAULT_API
).replace(/\/?$/, '/');

const DEFAULT_WS = isProd
  ? 'wss://nur.tw1.ru/ws/'
  : 'ws://72.56.244.50/ws/';

export const WS_URL = (
  process.env.REACT_APP_WS_URL || DEFAULT_WS
).trim() || undefined;