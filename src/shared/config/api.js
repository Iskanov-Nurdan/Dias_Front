// apiConfig.js (или где у тебя это лежит)

// нормализация base URL
const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase || '').trim();

  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  const withApiPath = /\/api$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;

  return `${withApiPath}/`;
};

// 🌍 API BASE
export const API_BASE = normalizeApiBase(
  process.env.REACT_APP_API_URL
);

// 🔌 WS URL
export const WS_URL = (
  process.env.REACT_APP_WS_URL || ''
).trim() || undefined;