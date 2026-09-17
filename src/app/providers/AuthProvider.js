import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PAGE_IDS, PAGE_ROUTES } from '../../shared/constants/pages';
import { logout as logoutApi, fetchMe } from '../../features/auth/api';
import { setAuthTokens, clearAuth } from '../../shared/api/client';

const ADMIN_ROLE_NAME = 'Администратор';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** Нормализует user.access в объект { pageId: boolean }. Поддержка data.access, массива id, объекта. */
const normalizeUserAccess = (u) => {
  if (!u || typeof u !== 'object') return u;
  const raw = u.access ?? u.data?.access;
  if (!raw || typeof raw !== 'object') return { ...u, access: {} };
  const access = Array.isArray(raw)
    ? PAGE_IDS.reduce((o, id) => ({ ...o, [id]: raw.includes(id) }), {})
    : PAGE_IDS.reduce((o, id) => ({ ...o, [id]: raw[id] === true }), {});
  return { ...u, access };
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
  const [accessDeniedOpen, setAccessDeniedOpen] = useState(false);

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

  // При старте приложения перечитываем роль/доступы с сервера (GET /auth/me) — localStorage
  // мог сохранить права, отозванные после последнего логина (например, сотруднику закрыли
  // доступ к разделу). Тихо: не разлогиниваем при сетевой ошибке, интерцептор в client.js
  // сам обработает истёкший/невалидный токен при следующем реальном запросе.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let cancelled = false;
    fetchMe(null)
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data ?? res;
        const fresh = normalizeUserAccess(payload);
        setUser((prev) => {
          const merged = { ...prev, ...fresh };
          try { localStorage.setItem('user', JSON.stringify(merged)); } catch {}
          return merged;
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
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

  /** Доступ по access[pageId] === true. Вкладки в сайдбаре показываем только при наличии доступа. */
  const hasAccess = useCallback(
    (pageId) => {
      if (!user) return false;
      const access = user.access;
      if (!access || typeof access !== 'object') return false;
      if (access[pageId] === true) return true;
      if (pageId === 'reports') {
        if (access.reports === false) return false;
        return access.clients === true;
      }
      return false;
    },
    [user]
  );

  const getFirstAvailableRoute = useCallback(() => {
    // PAGE_ROUTES[id] может не существовать — не у каждого pageId есть свой
    // маршрут (например 'shifts-summary' — это право на вкладку внутри
    // «Смен», а не отдельная страница). Без проверки первый же такой id
    // отправил бы пользователя на /undefined.
    for (const id of PAGE_IDS) {
      if (hasAccess(id) && PAGE_ROUTES[id]) return PAGE_ROUTES[id];
    }
    return '/employees';
  }, [hasAccess]);

  const showAccessDenied = useCallback(() => setAccessDeniedOpen(true), []);

  const authValue = useMemo(
    () => ({
      user,
      login,
      logout,
      hasAccess,
      getFirstAvailableRoute,
      isAdmin,
      showAccessDenied,
    }),
    [user, login, logout, hasAccess, getFirstAvailableRoute, isAdmin, showAccessDenied]
  );

  const accessDeniedModal =
    accessDeniedOpen &&
    createPortal(
      <div className="access-denied-overlay" onClick={() => setAccessDeniedOpen(false)}>
        <div className="access-denied-box" onClick={(e) => e.stopPropagation()}>
          <p className="access-denied-text">У вас нет доступа</p>
          <button type="button" className="access-denied-btn" onClick={() => setAccessDeniedOpen(false)}>
            Закрыть
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <AuthContext.Provider value={authValue}>
      {children}
      {accessDeniedModal}
    </AuthContext.Provider>
  );
};
