import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth';
import { ACCESS_LABELS } from '../../../shared/config/constants';
import { getNavSections } from '../../../shared/config/navigation';
import './MainLayout.scss';

const SIDEBAR_COLLAPSED_KEY = 'dias_sidebar_collapsed';

// Inline SVG icons (Lucide-style)
const Icons = {
  BarChart2: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Factory: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>
    </svg>
  ),
  Package: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Flask: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3h6m-3 0v7l-4.5 7.5A2 2 0 0 0 9.24 21h5.52a2 2 0 0 0 1.74-3L12 10V3"/>
    </svg>
  ),
  BookOpen: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  Cog: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  ShieldCheck: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  Warehouse: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect x="8" y="10" width="8" height="4"/>
    </svg>
  ),
  Building2: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Clock: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  CalendarCheck: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>
    </svg>
  ),
  ClipboardCheck: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  User: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  Menu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

const PAGE_ICONS = {
  my_shift: Icons.Clock,
  analytics: Icons.BarChart2,
  clients: Icons.Building2,
  sales: Icons.TrendingUp,
  lines: Icons.Factory,
  materials: Icons.Package,
  chemistry: Icons.Flask,
  recipes: Icons.BookOpen,
  otk: Icons.ClipboardCheck,
  warehouse: Icons.Warehouse,
  users: Icons.Users,
  shifts: Icons.CalendarCheck,
};

const SidebarContent = memo(({ collapsed, inDrawer, navRows, currentPath, displayName, roleName, toggleCollapsed, handleLogout }) => (
  <div className={`main-layout__sidebar-inner${inDrawer ? ' main-layout__sidebar-inner--drawer' : ''}`}>
    <div className="main-layout__logo-row">
      <div className="main-layout__logo">
        <span className="main-layout__logo-icon">D</span>
        {(!collapsed || inDrawer) && <span className="main-layout__logo-text">DIAS LINE</span>}
      </div>
      {!inDrawer && (
        <button
          type="button"
          className={`main-layout__collapse-btn ${collapsed ? 'main-layout__collapse-btn--collapsed' : ''}`}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <Icons.ChevronLeft />
        </button>
      )}
    </div>

    <div className="main-layout__nav-wrap">
      <nav className="main-layout__nav" aria-label="Главное меню">
        {navRows.map((row, idx) => {
          if (row.type === 'section') {
            if (collapsed && !inDrawer) return null;
            return (
              <div key={`sec-${row.label}-${idx}`} className="main-layout__nav-section">
                {row.label}
              </div>
            );
          }
          const item = row;
          const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
          const IconComp = item.Icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`main-layout__link${isActive ? ' main-layout__link--active' : ''}`}
              title={collapsed && !inDrawer ? item.label : undefined}
            >
              {IconComp && (
                <span className="main-layout__link-icon">
                  <IconComp />
                </span>
              )}
              {(!collapsed || inDrawer) && (
                <span className="main-layout__link-label">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>

    <div className="main-layout__user-card">
      <div className="main-layout__user-avatar" aria-hidden="true">
        <Icons.User />
      </div>
      {(!collapsed || inDrawer) && (
        <div className="main-layout__user-info">
          <span className="main-layout__user-name">{displayName}</span>
          <span className="main-layout__user-role">{roleName}</span>
        </div>
      )}
      <button
        type="button"
        className="main-layout__logout-btn"
        onClick={handleLogout}
        aria-label="Выйти"
        title="Выйти"
      >
        <Icons.LogOut />
      </button>
    </div>
  </div>
));

const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Close mobile drawer on route change (don't scroll main to top — let each page handle it)
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handle = (e) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [mobileOpen]);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const accesses = Array.isArray(user?.accesses) ? user.accesses : [];

  const navRows = useMemo(() => {
    const rows = [];
    for (const section of getNavSections()) {
      const links = section.links.filter((l) => accesses.includes(l.accessKey));
      if (links.length === 0) continue;
      rows.push({ type: 'section', label: section.label });
      for (const l of links) {
        rows.push({
          type: 'link',
          path: l.path,
          accessKey: l.accessKey,
          label: ACCESS_LABELS[l.accessKey] || l.accessKey,
          Icon: PAGE_ICONS[l.accessKey] || null,
        });
      }
    }
    return rows;
  }, [accesses]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.email || 'Пользователь';
  const roleName = user?.role_name || user?.role?.name || 'Администратор';

  const currentPage = navRows.find(
    (row) =>
      row.type === 'link' &&
      (location.pathname === row.path || location.pathname.startsWith(`${row.path}/`)),
  );
  const pageTitle = currentPage?.label || 'DIAS LINE';

  return (
    <div className={`main-layout${collapsed ? ' main-layout--collapsed' : ''}`}>
      {/* Desktop sidebar */}
      <aside className="main-layout__sidebar" aria-label="Навигация">
        <SidebarContent
          collapsed={collapsed}
          inDrawer={false}
          navRows={navRows}
          currentPath={location.pathname}
          displayName={displayName}
          roleName={roleName}
          toggleCollapsed={toggleCollapsed}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Mobile overlay + drawer */}
      {mobileOpen && (
        <div
          className="main-layout__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className={`main-layout__drawer${mobileOpen ? ' main-layout__drawer--open' : ''}`} aria-hidden={!mobileOpen}>
        <SidebarContent
          collapsed={collapsed}
          inDrawer
          navRows={navRows}
          currentPath={location.pathname}
          displayName={displayName}
          roleName={roleName}
          toggleCollapsed={toggleCollapsed}
          handleLogout={handleLogout}
        />
      </div>

      {/* Main content */}
      <div className="main-layout__body">
        <header className="main-layout__header">
          <button
            type="button"
            className="main-layout__mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          >
            <Icons.Menu />
          </button>
          <h1 className="main-layout__page-title">{pageTitle}</h1>
        </header>
        <main className="main-layout__main" ref={mainRef}>
          <div className="main-layout__viewport">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
