const DEFAULT_API = 'http://127.0.0.1:8000/api/';
export const API_BASE = (process.env.REACT_APP_API_URL || DEFAULT_API).replace(/\/?$/, '/');

const DEFAULT_WS = '';
export const WS_URL = (process.env.REACT_APP_WS_URL || DEFAULT_WS).trim() || undefined;
