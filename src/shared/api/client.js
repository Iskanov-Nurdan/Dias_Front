import axios from 'axios';
import { API_BASE } from '../config/api';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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
      window.location.href = '/login';
      return Promise.reject(err);
    }

    if (err.response?.status === 403) {
      const enhanced = { ...err };
      enhanced.userMessage = 'Нет доступа к этому ресурсу.';
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
