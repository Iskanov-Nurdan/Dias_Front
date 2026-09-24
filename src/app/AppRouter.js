import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers/AuthProvider';
import MainLayout from './layouts/MainLayout';
import NoAccessPage from './components/NoAccessPage';
import { PAGE_IDS } from '../shared/constants/pages';

const LoginPage = React.lazy(() => import('../features/auth/LoginPage'));
const EmployeesPage = React.lazy(() => import('../features/employees/EmployeesPage'));
const MaterialsPage = React.lazy(() => import('../features/materials/MaterialsPage'));
const WorkshopPage = React.lazy(() => import('../features/workshop/WorkshopPage'));
const WorkshopFloorPage = React.lazy(() => import('../features/workshop/WorkshopFloorPage'));
const ProductionPage = React.lazy(() => import('../features/production/ProductionPage'));
const OTKPage = React.lazy(() => import('../features/otk/OTKPage'));
const WarehousePage = React.lazy(() => import('../features/warehouse/WarehousePage'));
const ClientsPage = React.lazy(() => import('../features/clients/ClientsPage'));
const SalesPage = React.lazy(() => import('../features/sales/SalesPage'));
const ActivityLogPage = React.lazy(() => import('../features/activity/ActivityLogPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const ShiftsPage = React.lazy(() => import('../features/shifts/ShiftsPage'));
const NotFoundPage = React.lazy(() => import('../features/not-found/NotFoundPage'));

const ProtectedRoute = ({ children, pageId }) => {
  const { user, hasAccess, getFirstAvailableRoute } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (pageId && !hasAccess(pageId)) {
    const hasAnyAccess = PAGE_IDS.some((id) => hasAccess(id));
    if (!hasAnyAccess) return <NoAccessPage />;
    return <Navigate to={getFirstAvailableRoute()} replace />;
  }
  return children;
};

const IndexRedirect = () => {
  const { getFirstAvailableRoute } = useAuth();
  return <Navigate to={getFirstAvailableRoute()} replace />;
};

/** Публичной витрины у DIAS_ERP нет — "/" без сессии всегда ведёт на вход. */
const RootGate = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootGate><MainLayout /></RootGate>}>
        <Route index element={<IndexRedirect />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute pageId="employees">
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="materials"
          element={
            <ProtectedRoute pageId="materials">
              <MaterialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="workshop"
          element={
            <ProtectedRoute pageId="workshop">
              <WorkshopPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="workshop-floor"
          element={
            <ProtectedRoute pageId="workshop-floor">
              <WorkshopFloorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="production"
          element={
            <ProtectedRoute pageId="production">
              <ProductionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="otk"
          element={
            <ProtectedRoute pageId="otk">
              <OTKPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="warehouse"
          element={
            <ProtectedRoute pageId="warehouse">
              <WarehousePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="clients"
          element={
            <ProtectedRoute pageId="clients">
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales"
          element={
            <ProtectedRoute pageId="sales">
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="activity-log"
          element={
            <ProtectedRoute pageId="activity-log">
              <ActivityLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="shifts"
          element={
            <ProtectedRoute pageId="shifts">
              <ShiftsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute pageId="analytics">
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
