import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MoreHorizontal,
  User, LogOut, Moon, Sun,
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { ActionSheet } from '../../shared/ui';
import ShiftClockWidget from '../../features/shifts/components/ShiftClockWidget';
import { prefetchRoutePage } from '../prefetchRoutes';
import {
  PAGE_IDS, PAGE_LABELS, PAGE_ROUTES, PAGE_GROUPS, PAGE_ICONS, MOBILE_NAV_PRIMARY_IDS,
} from '../../shared/constants/pages';
import './MainLayout.scss';

const THEME_STORAGE_KEY = 'dias_theme';

const ICON_SIZE_SM = 18;
/** Иконки в списке навигации сайдбара (см. .main-layout__nav-icon) */
const NAV_ICON_SIZE = 20;
/** Иконки в нижней таб-навигации на мобиле (см. .main-layout__bottom-nav-icon) */
const BOTTOM_NAV_ICON_SIZE = 21;

// Задержка перед авто-закрытием: короткое касание края мышью мимоходом
// не должно раскрывать/закрывать сайдбар с миганием
const CLOSE_DELAY_MS = 220;

const getSectionTitleForPath = (pathname) => {
  const pageId = Object.keys(PAGE_ROUTES).find((id) => PAGE_ROUTES[id] === pathname);
  if (pageId) return PAGE_LABELS[pageId] || 'DIAS LINE';
  return 'DIAS LINE';
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
  const [isMobile, setIsMobile] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
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

  // На мобильном курсора нет — там нижняя таб-навигация вместо сайдбара,
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
    if (isMobile) setMoreSheetOpen(false);
    else closeSidebarNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

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

  /**
   * Переход по пункту меню закрывает сайдбар сразу — на десктопе схлопывает
   * узкую полосу обратно, не дожидаясь, пока курсор физически покинет
   * область сайдбара; на мобиле — закрывает шторку «Ещё», если она открыта.
   */
  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setMoreSheetOpen(false);
    else closeSidebarNow();
  };

  const sectionTitle = getSectionTitleForPath(location.pathname);
  const isSidebarExpandedView = !isMobile && sidebarOpen;

  const visiblePages = PAGE_IDS.filter((id) => hasAccess(id));
  const visibleSet = new Set(visiblePages);
  const navGroups = Object.entries(PAGE_GROUPS).map(([groupLabel, pageIds]) => ({
    label: groupLabel,
    pages: pageIds.filter((id) => visibleSet.has(id)),
  })).filter((g) => g.pages.length > 0);

  // ── Нижняя таб-навигация на мобиле: 4 главных раздела + «Ещё» для
  // остального, если у пользователя доступно больше 4 разделов. Если
  // доступно ≤4 — «Ещё» не нужна, показываем их все как отдельные вкладки.
  let mobileTabPages = visiblePages;
  let moreMenuPages = [];
  if (visiblePages.length > 4) {
    const primary = MOBILE_NAV_PRIMARY_IDS.filter((id) => visibleSet.has(id));
    const rest = visiblePages.filter((id) => !primary.includes(id));
    mobileTabPages = primary.length >= 4 ? primary.slice(0, 4) : primary.concat(rest.slice(0, 4 - primary.length));
    const tabSet = new Set(mobileTabPages);
    moreMenuPages = visiblePages.filter((id) => !tabSet.has(id));
  }
  const moreActive = moreMenuPages.some((id) => location.pathname === PAGE_ROUTES[id]);

  return (
    <div className={`main-layout ${sidebarOpen && !isMobile ? 'main-layout--sidebar-open' : ''}`}>
      <header className="main-layout__header">
        <div className="main-layout__header-left">
          <span className="main-layout__header-page-title">{sectionTitle}</span>
        </div>
        <div className="main-layout__header-right">
          <ShiftClockWidget />
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
          <img src={`${process.env.PUBLIC_URL || ''}/dias-line-logo.png`} alt="DIAS LINE" />
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
                <span className="main-layout__sidebar-user-name">{user?.name || ''}</span>
                <span className="main-layout__sidebar-user-role">{user?.role_name || ''}</span>
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
      {isMobile && (
        <nav className="main-layout__bottom-nav" aria-label="Навигация">
          {mobileTabPages.map((pageId) => {
            const path = PAGE_ROUTES[pageId];
            const isActive = location.pathname === path;
            const Label = PAGE_LABELS[pageId] || pageId;
            const Icon = PAGE_ICONS[pageId];
            return (
              <button
                key={pageId}
                type="button"
                className={`main-layout__bottom-nav-item ${isActive ? 'main-layout__bottom-nav-item--active' : ''}`}
                onClick={() => handleNavigate(path)}
              >
                {Icon && <span className="main-layout__bottom-nav-icon" aria-hidden><Icon size={BOTTOM_NAV_ICON_SIZE} strokeWidth={1.75} /></span>}
                <span className="main-layout__bottom-nav-label">{Label}</span>
              </button>
            );
          })}
          {moreMenuPages.length > 0 && (
            <button
              type="button"
              className={`main-layout__bottom-nav-item ${moreActive ? 'main-layout__bottom-nav-item--active' : ''}`}
              onClick={() => setMoreSheetOpen(true)}
              aria-haspopup="true"
              aria-expanded={moreSheetOpen}
            >
              <span className="main-layout__bottom-nav-icon" aria-hidden><MoreHorizontal size={BOTTOM_NAV_ICON_SIZE} strokeWidth={1.75} /></span>
              <span className="main-layout__bottom-nav-label">Ещё</span>
            </button>
          )}
        </nav>
      )}
      {isMobile && (
        <ActionSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="Ещё разделы">
          {moreMenuPages.map((pageId) => {
            const path = PAGE_ROUTES[pageId];
            const isActive = location.pathname === path;
            const Label = PAGE_LABELS[pageId] || pageId;
            const Icon = PAGE_ICONS[pageId];
            return (
              <button
                key={pageId}
                type="button"
                className={`action-sheet__item ${isActive ? 'action-sheet__item--active' : ''}`}
                onClick={() => handleNavigate(path)}
              >
                {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}
                {Label}
              </button>
            );
          })}
          <div className="main-layout__more-user">
            <span className="main-layout__sidebar-user-avatar" aria-hidden>
              <User size={ICON_SIZE_SM} />
            </span>
            <div className="main-layout__sidebar-user-info">
              <span className="main-layout__sidebar-user-name">{user?.name || ''}</span>
              <span className="main-layout__sidebar-user-role">{user?.role_name || ''}</span>
            </div>
          </div>
          <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={handleLogout}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
            Выйти
          </button>
        </ActionSheet>
      )}
    </div>
  );
};

export default MainLayout;
