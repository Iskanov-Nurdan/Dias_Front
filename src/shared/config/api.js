const isProd =
  window.location.hostname.includes('nur.tw1.ru');

const DEFAULT_API = isProd
  ? 'https://nur.tw1.ru/api/'
  : 'http://72.56.244.50/api/';

const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase || '').trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  const withApiPath = /\/api$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;

  return `${withApiPath}/`;
};

export const API_BASE = normalizeApiBase(
  process.env.REACT_APP_API_URL || DEFAULT_API
);

const DEFAULT_WS = isProd
  ? 'wss://nur.tw1.ru/ws/'
  : 'ws://72.56.244.50/ws/';

export const WS_URL = (
  process.env.REACT_APP_WS_URL || DEFAULT_WS
).trim() || undefined;
