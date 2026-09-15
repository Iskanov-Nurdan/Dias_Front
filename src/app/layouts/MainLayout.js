import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X,
  User, LogOut, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { prefetchRoutePage } from '../prefetchRoutes';
import {
  PAGE_IDS, PAGE_LABELS, PAGE_ROUTES, PAGE_GROUPS, PAGE_ICONS,
} from '../../shared/constants/pages';
import './MainLayout.scss';

const THEME_STORAGE_KEY = 'rahman-theme';

const ICON_SIZE = 20;
const ICON_SIZE_SM = 18;
/** Иконки в списке навигации сайдбара (см. .main-layout__nav-icon) */
const NAV_ICON_SIZE = 20;

// Задержка перед авто-закрытием: короткое касание края мышью мимоходом
// не должно раскрывать/закрывать сайдбар с миганием
const CLOSE_DELAY_MS = 220;

const getSectionTitleForPath = (pathname) => {
  const pageId = Object.keys(PAGE_ROUTES).find((id) => PAGE_ROUTES[id] === pathname);
  if (pageId) return PAGE_LABELS[pageId] || 'Рахман Ата';
  return 'Рахман Ата';
};

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

const MOBILE_BREAKPOINT = 768;

const MainLayout = () => {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  /**
   * Сайдбар на десктопе — ровно одно состояние: открыт/закрыт, всегда
   * стартует закрытым (узкая полоса с иконками). Открывать кнопкой не нужно —
   * раскрывается наведением курсора или фокусом с клавиатуры (Tab), и
   * закрывается одинаково всегда: по клику на пункт меню — сразу, по уходу
   * курсора/фокуса — с небольшой задержкой, по клику вне сайдбара и по
   * Esc — сразу.
   */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const closeTimerRef = useRef(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => () => clearCloseTimer(), []);

  // На мобильном курсора нет — там своё выезжающее меню (mobileMenuOpen),
  // эта логика туда не подключается вовсе
  const openSidebar = () => {
    if (isMobile) return;
    clearCloseTimer();
    setSidebarOpen(true);
  };

  const closeSidebarNow = () => {
    clearCloseTimer();
    setSidebarOpen(false);
  };

  const scheduleCloseSidebar = () => {
    if (isMobile) return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setSidebarOpen(false), CLOSE_DELAY_MS);
  };

  // Клавиатурная навигация (Tab) раскрывает сайдбар так же, как наведение —
  // иначе без мыши подписи пунктов меню не увидеть. relatedTarget проверяем,
  // чтобы не закрывать сайдбар при переходе фокуса между кнопками внутри него.
  const handleSidebarBlur = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    scheduleCloseSidebar();
  };

  // Клик вне сайдбара закрывает его сразу — это покрывает случай «открыл
  // фокусом с клавиатуры, потом кликнул мышью в другое место»: mouseleave
  // тут не сработает, потому что курсор в сайдбар вообще не заходил.
  useEffect(() => {
    if (!sidebarOpen || isMobile) return undefined;
    const onPointerDown = (e) => {
      if (sidebarRef.current?.contains(e.target)) return;
      closeSidebarNow();
    };
    const onEscape = (e) => {
      if (e.key === 'Escape') closeSidebarNow();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen, isMobile]);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (isMobile) setMobileMenuOpen(false);
    else closeSidebarNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);

  /**
   * Переход по пункту меню закрывает сайдбар сразу — на мобильном прячет
   * выезжающее меню, на десктопе схлопывает узкую полосу обратно, не
   * дожидаясь, пока курсор физически покинет область сайдбара.
   */
  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setMobileMenuOpen(false);
    else closeSidebarNow();
  };

  const sectionTitle = getSectionTitleForPath(location.pathname);
  const isSidebarExpandedView = (isMobile && mobileMenuOpen) || (!isMobile && sidebarOpen);

  const visiblePages = PAGE_IDS.filter((id) => hasAccess(id));
  const visibleSet = new Set(visiblePages);
  const navGroups = Object.entries(PAGE_GROUPS).map(([groupLabel, pageIds]) => ({
    label: groupLabel,
    pages: pageIds.filter((id) => visibleSet.has(id)),
  })).filter((g) => g.pages.length > 0);

  return (
    <div className={`main-layout ${sidebarOpen && !isMobile ? 'main-layout--sidebar-open' : ''} ${mobileMenuOpen ? 'main-layout--mobile-menu-open' : ''}`}>
      {isMobile && mobileMenuOpen && (
        <div className="main-layout__mobile-overlay" onClick={toggleMobileMenu} aria-hidden="false" />
      )}
      <header className="main-layout__header">
        <div className="main-layout__header-left">
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
          <span className="main-layout__header-page-title">{sectionTitle}</span>
        </div>
        <div className="main-layout__header-center" />
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
      <aside
        ref={sidebarRef}
        className="main-layout__sidebar"
        onMouseEnter={openSidebar}
        onMouseLeave={scheduleCloseSidebar}
        onFocus={openSidebar}
        onBlur={handleSidebarBlur}
      >
        <div className="main-layout__sidebar-logo">
          <img src={`${process.env.PUBLIC_URL || ''}/rahman.png`} alt="Рахман Ата" />
        </div>
        <nav className="main-layout__nav">
          {navGroups.map((group) => (
            <div key={group.label} className="main-layout__nav-group">
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
                    onClick={() => handleNavigate(path)}
                    onMouseEnter={() => prefetchRoutePage(pageId)}
                    onFocus={() => prefetchRoutePage(pageId)}
                    title={Label}
                  >
                    {Icon && <span className="main-layout__nav-icon" aria-hidden><Icon size={NAV_ICON_SIZE} strokeWidth={1.75} /></span>}
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
            {isSidebarExpandedView && (
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
        <div className="main-layout__content-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
