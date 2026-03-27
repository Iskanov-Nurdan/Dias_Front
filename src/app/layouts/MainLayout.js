import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, ChevronLeft, ChevronRight, X,
  User, LogOut, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { prefetchRoutePage } from '../prefetchRoutes';
import { PAGE_IDS, PAGE_LABELS, PAGE_ROUTES, PAGE_GROUPS, PAGE_ICONS } from '../../shared/constants/pages';
import './MainLayout.scss';

const SIDEBAR_STORAGE_KEY = 'mainLayout_sidebarCollapsed';
const THEME_STORAGE_KEY = 'rahman-theme';

/** Синхронно с --icon-size-md / --icon-size-sm в _variables.scss */
const ICON_SIZE = 20;
const ICON_SIZE_SM = 18;

const getInitialTheme = () => {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY);
    if (s === 'dark' || s === 'light') return s;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

const getStoredSidebarCollapsed = () => {
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return v === '1';
  } catch {
    return false;
  }
};

const MOBILE_BREAKPOINT = 768;

const MainLayout = () => {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredSidebarCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) setMobileMenuOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileMenuOpen || !isMobile) return;
    const onEscape = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen, isMobile]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);

  const visiblePages = PAGE_IDS.filter((id) => hasAccess(id));
  const visibleSet = new Set(visiblePages);
  const navGroups = Object.entries(PAGE_GROUPS).map(([groupLabel, pageIds]) => ({
    label: groupLabel,
    pages: pageIds.filter((id) => visibleSet.has(id)),
  })).filter((g) => g.pages.length > 0);

  return (
    <div className={`main-layout ${sidebarCollapsed ? 'main-layout--sidebar-collapsed' : ''} ${mobileMenuOpen ? 'main-layout--mobile-menu-open' : ''}`}>
      {isMobile && mobileMenuOpen && (
        <div className="main-layout__mobile-overlay" onClick={toggleMobileMenu} aria-hidden="false" />
      )}
      <header className="main-layout__header">
        <div className="main-layout__header-left">
          <button
            type="button"
            className="main-layout__sidebar-toggle main-layout__sidebar-toggle--desktop"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню'}
            aria-label={sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню'}
          >
            {sidebarCollapsed ? <ChevronRight size={ICON_SIZE_SM} /> : <ChevronLeft size={ICON_SIZE_SM} />}
          </button>
          <button
            type="button"
            className="main-layout__sidebar-toggle main-layout__sidebar-toggle--mobile"
            onClick={toggleMobileMenu}
            title={mobileMenuOpen ? 'Закрыть меню' : 'Меню'}
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={ICON_SIZE} /> : <Menu size={ICON_SIZE} />}
          </button>
          <span className="main-layout__brand">Рахман Ата</span>
        </div>
        <div className="main-layout__header-right">
          <button
            type="button"
            className="main-layout__theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          >
            {theme === 'dark' ? <Sun size={ICON_SIZE_SM} strokeWidth={1.75} /> : <Moon size={ICON_SIZE_SM} strokeWidth={1.75} />}
          </button>
        </div>
      </header>
      <aside className="main-layout__sidebar">
        <div className="main-layout__sidebar-logo">
          <img src={`${process.env.PUBLIC_URL || ''}/rahman.png`} alt="Рахман Ата" />
        </div>
        <nav className="main-layout__nav">
          {navGroups.map((group) => (
            <div key={group.label} className="main-layout__nav-group">
              {!sidebarCollapsed && <span className="main-layout__nav-group-label">{group.label}</span>}
              {group.pages.map((pageId) => {
                const path = PAGE_ROUTES[pageId];
                const isActive = location.pathname === path;
                const Label = PAGE_LABELS[pageId] || pageId;
                const Icon = PAGE_ICONS[pageId];
                return (
                  <button
                    key={pageId}
                    type="button"
                    className={`main-layout__nav-item ${isActive ? 'main-layout__nav-item--active' : ''}`}
                    onClick={() => { navigate(path); if (isMobile) setMobileMenuOpen(false); }}
                    onMouseEnter={() => prefetchRoutePage(pageId)}
                    onFocus={() => prefetchRoutePage(pageId)}
                    title={Label}
                  >
                    {Icon && <span className="main-layout__nav-icon" aria-hidden><Icon size={ICON_SIZE} strokeWidth={1.75} /></span>}
                    <span className="main-layout__nav-label">{Label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="main-layout__sidebar-footer">
          <div className="main-layout__sidebar-user-card">
            <span className="main-layout__sidebar-user-avatar" aria-hidden>
              <User size={ICON_SIZE_SM} />
            </span>
            {!sidebarCollapsed && (
              <div className="main-layout__sidebar-user-info">
                <span className="main-layout__sidebar-user-name">{user?.fio || user?.login || ''}</span>
                <span className="main-layout__sidebar-user-role">{user?.roleName || ''}</span>
              </div>
            )}
            <button
              type="button"
              className="main-layout__sidebar-logout"
              onClick={handleLogout}
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut size={ICON_SIZE_SM} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-layout__content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
