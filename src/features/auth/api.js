import { apiClient } from '../../shared/api/client';

/** ТЗ: POST /api/auth/ или /api/auth/login, тело { login, password } */
export const login = async (loginData, signal) => {
  const { data } = await apiClient.post('/auth/', { login: loginData.login, password: loginData.password }, { signal });
  return data;
};
