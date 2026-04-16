import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../features/auth';
import { ACCESS_LABELS } from '../../../shared/config/constants';
import { NavIcons as Icons, ACCESS_NAV_ICONS as PAGE_ICONS } from '../../../shared/config/navPageIcons';
import { getNavSections } from '../../../shared/config/navigation';
import './MainLayout.scss';

const SIDEBAR_COLLAPSED_KEY = 'dias_sidebar_collapsed';

const SidebarContent = memo(({ collapsed, inDrawer, navRows, currentPath, displayName, roleName, toggleCollapsed, handleLogout, onCloseDrawer }) => (
  <div className={`main-layout__sidebar-inner${inDrawer ? ' main-layout__sidebar-inner--drawer' : ''}`}>
    <div className="main-layout__logo-row">
      <div className="main-layout__logo">
        <span className="main-layout__logo-icon">D</span>
        {(!collapsed || inDrawer) && <span className="main-layout__logo-text">DIAS LINE</span>}
      </div>
      {inDrawer && onCloseDrawer && (
        <button
          type="button"
          className="main-layout__drawer-close"
          onClick={onCloseDrawer}
          aria-label="Закрыть меню"
        >
          <Icons.X />
        </button>
      )}
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
        {navRows.map((item) => {
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
      for (const l of links) {
        rows.push({
          path: l.path,
          accessKey: l.accessKey,
          label: l.label || ACCESS_LABELS[l.accessKey] || l.accessKey,
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
    (item) =>
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
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
          onCloseDrawer={() => setMobileOpen(false)}
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
          <span className="main-layout__header-spacer" aria-hidden="true" />
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
