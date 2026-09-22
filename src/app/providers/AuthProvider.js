import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PAGE_IDS, PAGE_ROUTES, PAGE_ID_ACCESS_KEY_MAP } from '../../shared/constants/pages';
import { ACCESS_KEYS } from '../../shared/constants/accessKeys';
import { logout as logoutApi, fetchMe } from '../../features/auth/api';
import { setAuthTokens, clearAuth } from '../../shared/api/client';

// Совпадает с system_constants.SYSTEM_ADMIN_ROLE_NAME в DIAS_ERP — так называется
// роль системного админа, которую сеет бэкенд. Другие суперюзерские роли с иным
// названием этой проверкой не поймать, но её обход требует, чтобы бэкенд отдавал
// отдельный булев флаг — сегодня он этого не делает.
const ADMIN_ROLE_NAME = 'Администратор';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/**
 * Нормализует user.accesses (массив access-key строк от DIAS_ERP, см. accessKeys.js)
 * в объект { accessKey: boolean } под ключом access — так с ним удобно работать
 * в hasAccess/AccessModal, не таская каждый раз .includes() по массиву.
 */
const normalizeUserAccess = (u) => {
  if (!u || typeof u !== 'object') return u;
  const raw = u.accesses ?? u.access ?? u.data?.accesses ?? u.data?.access;
  if (!Array.isArray(raw)) return { ...u, access: {} };
  const access = ACCESS_KEYS.reduce((o, key) => ({ ...o, [key]: raw.includes(key) }), {});
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

  // role_name приходит только с /api/me (в ответе логина есть только id роли) —
  // сразу после входа, до первого fetchMe, isAdmin будет false и подтянется
  // после того как useEffect ниже смёржит свежий /api/me в user.
  const isAdmin = (user?.role_name ?? '') === ADMIN_ROLE_NAME;

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
        // GET /api/me отдаёт { user: {...}, accesses: [...] } — accesses дублирует
        // user.accesses, нормализуем именно вложенный user.
        const fresh = normalizeUserAccess(res?.user ?? res);
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

  /**
   * Доступ по access[accessKey] === true, где accessKey — это либо сам pageId
   * (для реальных access-key DIAS_ERP), либо его перевод через
   * PAGE_ID_ACCESS_KEY_MAP (для старых pageId вроде 'employees'). pageId без
   * записи в этой карте пока не мигрирован — доступа к нему нет ни у кого,
   * пока страницу не подключили к DIAS_ERP.
   */
  const hasAccess = useCallback(
    (pageId) => {
      if (!user) return false;
      const access = user.access;
      if (!access || typeof access !== 'object') return false;
      const accessKey = PAGE_ID_ACCESS_KEY_MAP[pageId] ?? pageId;
      return access[accessKey] === true;
    },
    [user]
  );

  const getFirstAvailableRoute = useCallback(() => {
    // PAGE_ROUTES[id] может не существовать — не у каждого pageId есть свой
    // маршрут. Без проверки первый же такой id отправил бы пользователя
    // на /undefined.
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
