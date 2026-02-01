import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { PAGE_IDS, PAGE_ROUTES } from '../../shared/constants/pages';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** Нормализует user.access (на случай вложенного data.access с бэка) */
const normalizeUserAccess = (u) => {
  if (!u || typeof u !== 'object') return u;
  const access = u.access ?? u.data?.access;
  if (access && typeof access === 'object') {
    return { ...u, access };
  }
  return u;
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : null;
    return normalizeUserAccess(u);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

  const login = useCallback((userData, token) => {
    const normalized = normalizeUserAccess(userData);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalized));
    setUser(normalized);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  /** ТЗ: доступ только при явном true; false или отсутствие ключа — нет доступа */
  const hasAccess = useCallback(
    (pageId) => {
      if (!user) return false;
      const access = user.access ?? user.data?.access;
      if (!access || typeof access !== 'object') return false;
      return access[pageId] === true;
    },
    [user]
  );

  const getFirstAvailableRoute = useCallback(() => {
    for (const id of PAGE_IDS) {
      if (hasAccess(id)) return PAGE_ROUTES[id];
    }
    return '/employees';
  }, [hasAccess]);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, getFirstAvailableRoute }}>
      {children}
    </AuthContext.Provider>
  );
};
