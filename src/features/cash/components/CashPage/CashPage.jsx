import React, { useMemo } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth';

const CASH_TABS = [
  { key: 'clients', label: 'Клиенты', path: '/cash/clients' },
  { key: 'client_orders', label: 'Заявки', path: '/cash/orders' },
  { key: 'sales', label: 'Продажи', path: '/cash/sales' },
  { key: 'returns', label: 'Возвраты', path: '/cash/returns' },
  { key: 'defects', label: 'Брак / переделка', path: '/cash/defects' },
];

const matchTabByPath = (pathname) => {
  if (pathname.startsWith('/cash/orders')) return 'client_orders';
  if (pathname.startsWith('/cash/sales')) return 'sales';
  if (pathname.startsWith('/cash/returns')) return 'returns';
  if (pathname.startsWith('/cash/defects')) return 'defects';
  if (pathname.startsWith('/cash/clients')) return 'clients';
  return '';
};

const CashPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const accesses = Array.isArray(user?.accesses) ? user.accesses : [];

  const tabs = useMemo(
    () => CASH_TABS.filter((tab) => accesses.includes(tab.key)),
    [accesses],
  );

  if (tabs.length === 0) return <Navigate to="/forbidden" replace />;

  const activeKey = matchTabByPath(location.pathname);
  if (!activeKey) return <Navigate to={tabs[0].path} replace />;

  return (
    <div className="cash-page">
      <div className="materials-tabs" role="tablist" aria-label="Касса">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`materials-tabs__tab${activeKey === tab.key ? ' materials-tabs__tab--active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Outlet />
    </div>
  );
};

export default CashPage;
