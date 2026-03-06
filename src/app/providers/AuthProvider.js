import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PAGE_IDS, PAGE_ROUTES } from '../../shared/constants/pages';
import { logout as logoutApi } from '../../features/auth/api';
import { setAuthTokens, clearAuth } from '../../shared/api/client';

const ADMIN_ROLE_NAME = 'Администратор';

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
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  const roleName = user?.roleName ?? user?.role?.name ?? '';
  const isAdmin =
    (user?.canManageRoles === true || user?.can_manage_roles === true || roleName === ADMIN_ROLE_NAME) &&
    (roleName === '' || roleName === ADMIN_ROLE_NAME);

  const login = useCallback((userData, token, refresh) => {
    const normalized = normalizeUserAccess(userData);
    setAuthTokens(token, refresh);
    try {
      localStorage.setItem('user', JSON.stringify(normalized));
    } catch {}
    setUser(normalized);
  }, []);

  const logout = useCallback(async () => {
    const refresh = typeof localStorage !== 'undefined' ? localStorage.getItem('refresh') : null;
    try {
      if (refresh) await logoutApi(refresh, null);
    } catch {
      // Игнорируем ошибку — всё равно очищаем локально
    }
    clearAuth();
    setUser(null);
  }, []);

  /** ТЗ: доступ при явном true; is_system/Admin — полный доступ */
  const hasAccess = useCallback(
    (pageId) => {
      if (!user) return false;
      if (isAdmin) return true;
      const access = user.access ?? user.data?.access;
      if (!access || typeof access !== 'object') return false;
      return access[pageId] === true;
    },
    [user, isAdmin]
  );

  const getFirstAvailableRoute = useCallback(() => {
    for (const id of PAGE_IDS) {
      if (hasAccess(id)) return PAGE_ROUTES[id];
    }
    return '/employees';
  }, [hasAccess]);

  const accessDeniedModal =
    showAccessDenied &&
    createPortal(
      <div className="access-denied-overlay" onClick={() => setShowAccessDenied(false)}>
        <div className="access-denied-box" onClick={(e) => e.stopPropagation()}>
          <p className="access-denied-text">У вас нет доступа</p>
          <button type="button" className="access-denied-btn" onClick={() => setShowAccessDenied(false)}>
            Закрыть
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, getFirstAvailableRoute, isAdmin, showAccessDenied: () => setShowAccessDenied(true) }}>
      {children}
      {accessDeniedModal}
    </AuthContext.Provider>
  );
};
