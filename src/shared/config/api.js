const DEFAULT_API = window.location.hostname === 'nur.tw1.ru' 
    ? 'http://nur.tw1.ru' 
    : 'http://72.56.244.50';
export const API_BASE = (process.env.REACT_APP_API_URL || DEFAULT_API).replace(/\/?$/, '/');

const DEFAULT_WS = '';
export const WS_URL = (process.env.REACT_APP_WS_URL || DEFAULT_WS).trim() || undefined;