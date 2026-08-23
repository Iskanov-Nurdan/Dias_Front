import React, { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiBriefcase, FiTrendingUp } from 'react-icons/fi';
import { useAuth } from '../../../auth';
import './CashPage.scss';

const CASH_TABS = [
  { key: 'clients', label: 'Клиенты', path: '/cash/clients', accessKey: 'clients', Icon: FiBriefcase },
  { key: 'sales', label: 'Продажи', path: '/cash/sales', accessKey: 'sales', Icon: FiTrendingUp },
];

const CASH_SHELL_ACCESS_KEYS = ['clients', 'sales'];

const matchTabByPath = (pathname) => {
  if (pathname.startsWith('/cash/sales')) return 'sales';
  if (pathname.startsWith('/cash/clients')) return 'clients';
  return '';
};

const CashPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const accesses = Array.isArray(user?.accesses) ? user.accesses : [];

  const hasCashShellAccess = useMemo(
    () => CASH_SHELL_ACCESS_KEYS.some((k) => accesses.includes(k)),
    [accesses],
  );

  const tabs = useMemo(
    () => CASH_TABS.filter((tab) => accesses.includes(tab.accessKey)),
    [accesses],
  );

  if (!hasCashShellAccess) return <Navigate to="/forbidden" replace />;

  const activeKey = matchTabByPath(location.pathname);
  const activeTab = tabs.find((t) => t.key === activeKey);

  if (!activeTab) {
    if (tabs.length > 0) return <Navigate to={tabs[0].path} replace />;
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <div className="cash-page">
      {tabs.length > 0 ? (
        <div className="materials-tabs cash-page__tabs" role="tablist" aria-label="Касса">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`materials-tabs__tab${activeKey === tab.key ? ' materials-tabs__tab--active' : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <tab.Icon aria-hidden size={16} strokeWidth={2} />
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}
      <Outlet />
    </div>
  );
};

export default CashPage;
