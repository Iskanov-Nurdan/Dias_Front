import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { PAGE_IDS, PAGE_LABELS, PAGE_ROUTES, PAGE_GROUPS } from '../../shared/constants/pages';
import './MainLayout.scss';

const SIDEBAR_STORAGE_KEY = 'mainLayout_sidebarCollapsed';

// Иконки (inline SVG)
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const IconChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTrophy = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);
const IconUsersRound = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 21a8 8 0 0 0-16 0" />
    <circle cx="10" cy="8" r="5" />
    <path d="M22 21a8 8 0 0 0-11-8" />
    <path d="M16 3.13a8 8 0 0 1 0 15.75" />
  </svg>
);
const IconPackage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M16.5 9.4l-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);
const IconShoppingCart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);
const IconReceipt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5V14" />
  </svg>
);
const IconWallet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
);
const IconInbox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLogOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const PAGE_ICONS = {
  analytics: IconChart,
  employees: IconUsers,
  'sports-trainers': IconTrophy,
  clients: IconUsersRound,
  leads: IconInbox,
  warehouse: IconPackage,
  sales: IconShoppingCart,
  expenses: IconReceipt,
  salary: IconWallet,
};

const getStoredSidebarCollapsed = () => {
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return v === '1';
  } catch {
    return false;
  }
};

const MainLayout = () => {
  const { user, logout, hasAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredSidebarCollapsed);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  const visiblePages = PAGE_IDS.filter((id) => hasAccess(id));
  const visibleSet = new Set(visiblePages);
  const navGroups = Object.entries(PAGE_GROUPS).map(([groupLabel, pageIds]) => ({
    label: groupLabel,
    pages: pageIds.filter((id) => visibleSet.has(id)),
  })).filter((g) => g.pages.length > 0);

  return (
    <div className={`main-layout ${sidebarCollapsed ? 'main-layout--sidebar-collapsed' : ''}`}>
      <header className="main-layout__header">
        <div className="main-layout__header-left">
          <button
            type="button"
            className="main-layout__sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню'}
            aria-label={sidebarCollapsed ? 'Открыть меню' : 'Свернуть меню'}
          >
            {sidebarCollapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
          <span className="main-layout__brand">Рахман Ата</span>
        </div>
        <div className="main-layout__user">
          <span className="main-layout__user-icon" aria-hidden>
            <IconUser />
          </span>
          <div className="main-layout__user-info">
            <span className="main-layout__user-name">{user?.fio || user?.login || ''}</span>
            <span className="main-layout__user-role">{user?.roleName || ''}</span>
          </div>
          <button type="button" className="main-layout__logout" onClick={handleLogout} title="Выйти">
            <IconLogOut />
            <span className="main-layout__logout-text">Выйти</span>
          </button>
        </div>
      </header>
      <aside className="main-layout__sidebar">
        <div className="main-layout__sidebar-logo">
          <img src={`${process.env.PUBLIC_URL || ''}/logo.png`} alt="Рахман Ата" />
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
                    onClick={() => navigate(path)}
                    title={Label}
                  >
                    {Icon && <span className="main-layout__nav-icon" aria-hidden><Icon /></span>}
                    <span className="main-layout__nav-label">{Label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-layout__content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
