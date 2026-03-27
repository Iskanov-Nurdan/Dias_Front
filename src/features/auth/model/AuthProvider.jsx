import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OPERATIONAL_WS_TOKEN_REJECTED_EVENT } from '../../../shared/realtime/operationalWsConstants';
import { login as loginApi, logout as logoutApi, getMe } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getMe();
      const u = data.user || data;
      const accesses = data.accesses ?? u?.accesses ?? [];
      setUser({ ...u, accesses });
    } catch {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('refresh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const onWsTokenRejected = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh');
      setUser(null);
    };
    window.addEventListener(OPERATIONAL_WS_TOKEN_REJECTED_EVENT, onWsTokenRejected);
    return () => window.removeEventListener(OPERATIONAL_WS_TOKEN_REJECTED_EVENT, onWsTokenRejected);
  }, []);

  const login = useCallback(async (name, password) => {
    const data = await loginApi(name, password);
    localStorage.setItem('token', data.token);
    if (data.refresh) localStorage.setItem('refresh', data.refresh);
    else localStorage.removeItem('refresh');
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    await logoutApi();
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    setUser(null);
  }, []);

  const value = { user, loading, login, logout, refetch: loadUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
